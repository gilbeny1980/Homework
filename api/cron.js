const webpush = require('web-push');
const { markFired, wasFired, subsAll, subDel, subGet, snoozesDue, snoozeDel, getJSON, setJSON, getUsers, ntfyTopics, ntfyPublish, tg, tgConfigured, tgChats, tgPoll } = require('./_lib');
const REC = require('../rec.js');
// Called every 5 minutes by GitHub Actions. Public on purpose: it only sends reminders that are already due,
// and each reminder is sent once (markFired), so calling it extra times is harmless.
const TZ = 'Asia/Jerusalem';
const dayStr = (ms) => { const d = new Date(new Date(ms).toLocaleString('en-US', { timeZone: TZ })); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
module.exports = async (req, res) => {
  try {
    const clean = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, ''); // tolerate stray spaces/quotes/dots from copy-paste
    webpush.setVapidDetails((process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim(), clean(process.env.VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
    // keep a short log of who triggers this endpoint (shown in /api/health): helps verify the external scheduler works
    const log = ((await getJSON('bny:cronlog')) || []).slice(-11);
    log.push({ t: Date.now(), ua: String(req.headers['user-agent'] || '').slice(0, 40) });
    await setJSON('bny:cronlog', log);
    const db = (await getJSON('bny:data')) || {};
    const users = await getUsers();
    const parents = users.filter(x => x.p).map(x => x.u);
    // a reminder about a child goes to that child and to the parents; no person = everyone (to: null)
    const recipients = kids => {
      if (!kids.length) return null;
      const set = new Set(parents);
      for (const k of kids) { const u = users.find(x => x.n === k); if (u) set.add(u.u); }
      return [...set];
    };
    const now = Date.now(), msgs = [];
    const toDate = dayStr(now + 2 * 86400000);
    for (const e of (db.events || [])) {
      if (e.del || !(e.remind >= 0) || !e.date) continue;
      const kids = e.kids && e.kids.length ? e.kids : (e.kid ? [e.kid] : []);
      const nag = Number(e.nag) > 0 ? Number(e.nag) : 0, needsDone = !!e.req;
      for (const date of REC.occDates(e, toDate)) {
        const tm = REC.timeOn(e, date), at = REC.ilToMs(date, tm), fire = at - e.remind * 60000;
        if (now < fire || now >= at + (needsDone ? 6 * 3600000 : nag ? 6 * 3600000 : 3600000)) continue;
        const title = 'תזכורת: ' + e.title + (kids.length ? ` (${kids.join(', ')})` : ''), body = `${date} בשעה ${tm}`, to = recipients(kids);
        const first = await markFired(`${e.id}:${at}`);
        if (first) msgs.push({ title, body, to, eid: e.id, at, req: needsDone });
        if (needsDone) {
          // keeps going (parents only) every `nag` minutes (default 10) until a parent confirms "done"
          const paused = Number(await getJSON(`bny:pause:${e.id}:${at}`)) > now;
          if (!first && !paused && !(await wasFired(`done:${e.id}:${at}`))) {
            const every = (nag || 2) * 60000, k = Math.floor((now - fire) / every);
            if (k >= 1 && k <= 400 && await markFired(`${e.id}:${at}:r${k}`)) msgs.push({ title: '❗ ממתין לאישור: ' + e.title + (kids.length ? ` (${kids.join(', ')})` : ''), body, to: parents, eid: e.id, at, req: true });
          }
        } else if (nag && !first && !(await wasFired(`ack:${e.id}:${at}`))) {
          // repeat every `nag` minutes (up to 30 times) until someone taps "got it" or snoozes
          const k = Math.min(30, Math.floor((now - fire) / (nag * 60000)));
          if (k >= 1) {
            for (let j = 1; j < k; j++) await markFired(`${e.id}:${at}:n${j}`);
            if (await markFired(`${e.id}:${at}:n${k}`)) msgs.push({ title: '🔁 ' + title, body, to, eid: e.id, at });
          }
        }
      }
    }
    // daily task digest at 08:00-08:59 Israel time (parents / manager only)
    const il = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    const day = dayStr(now);
    if (il.getHours() >= 8) {
      const n = (db.tasks || []).filter(t => !t.del && !t.done && t.due && t.due <= day).length;
      if (n && await markFired('digest:' + day)) msgs.push({ title: 'משימות להיום', body: `יש ${n} משימות פתוחות להיום או באיחור`, to: parents });
    }
    const subs = await subsAll();
    let sent = 0;
    const fails = [];
    for (const m of msgs) for (const { sub, uname } of subs) {
      if (m.to && uname && uname !== 'admin' && !m.to.includes(uname)) continue;
      try { await webpush.sendNotification(sub, JSON.stringify({ title: m.title, body: m.body, eid: m.eid || '', at: m.at || 0, req: !!m.req && (!uname || uname === 'admin' || parents.includes(uname)) })); sent++; }
      catch (err) { fails.push(err.statusCode || String(err.message || err).slice(0, 40)); if (err.statusCode === 404 || err.statusCode === 410) await subDel(sub.endpoint); }
    }
    // Telegram: handle new /start links + button presses, then send the reminders (with action buttons)
    if (tgConfigured()) {
      try { await tgPoll(); } catch (err) { fails.push('tgpoll'); }
      const chats = await tgChats();
      for (const m of msgs) for (const u of Object.keys(chats)) {
        if (m.to && u !== 'admin' && !m.to.includes(u)) continue;
        const confirmer = u === 'admin' || parents.includes(u);
        const kb = !m.eid ? [] : (m.req && confirmer)
          ? [[{ text: '✔ בוצע', callback_data: `d:${m.eid}:${m.at}` }, { text: '⏰ נודניק 10 דק׳', callback_data: `p:${m.eid}:${m.at}` }]]
          : [[{ text: '✔ הבנתי', callback_data: `k:${m.eid}:${m.at}` }]];
        try { await tg('sendMessage', { chat_id: chats[u], text: `🔔 ${m.title}\n${m.body}`, disable_notification: false, reply_markup: { inline_keyboard: kb } }); sent++; } catch (err) { fails.push('tg'); }
      }
    }
    // urgent notifications through ntfy (only for people who set it up): max priority, with action buttons
    let nsent = 0;
    const topics = await ntfyTopics(), site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const post = body => ({ action: 'http', method: 'POST', url: `${site}/api/snooze`, headers: { 'Content-Type': 'application/json' }, clear: true, body: JSON.stringify(body) });
    for (const m of msgs) for (const u of Object.keys(topics)) {
      if (m.to && u !== 'admin' && !m.to.includes(u)) continue;
      const confirmer = u === 'admin' || parents.includes(u), topic = topics[u];
      const actions = !m.eid ? [] : (m.req && confirmer)
        ? [{ ...post({ action: 'done', topic, eid: m.eid, at: m.at }), label: '✔ בוצע' }, { ...post({ action: 'pause', topic, eid: m.eid, at: m.at, minutes: 10 }), label: '⏰ נודניק 10 דק׳' }]
        : [{ ...post({ action: 'ack', eid: m.eid, at: m.at }), label: '✔ הבנתי' }];
      if (m.eid) actions.push({ ...post({ action: 'skip', topic, eid: m.eid, at: m.at }), label: '🚫 אין צורך בתזכורת' });
      try { await ntfyPublish({ topic, title: m.title, message: m.body, click: site + '/', actions }); nsent++; } catch (err) { fails.push('ntfy'); }
    }
    sent += nsent;
    // due snoozes go back only to the device that asked
    for (const s of await snoozesDue(now)) {
      const sub = await subGet(s.endpoint);
      await snoozeDel(s.id);
      if (!sub) continue;
      try { await webpush.sendNotification(sub, JSON.stringify({ title: '⏰ ' + s.title, body: s.body, eid: s.eid, at: Number(s.at) })); sent++; }
      catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await subDel(s.endpoint); }
    }
    if (msgs.length || fails.length) { // diagnostics only: counts and error codes, no event text
      const sl = ((await getJSON('bny:sendlog')) || []).slice(-9);
      sl.push({ t: Date.now(), msgs: msgs.map(m => (m.to ? m.to.join('+') : 'all')), sent, fails });
      await setJSON('bny:sendlog', sl);
    }
    res.status(200).json({ messages: msgs.length, sent });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
