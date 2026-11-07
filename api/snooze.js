const { subGet, subUname, canConfirm, snoozeAdd, markFired, setJSON, ntfyUserByTopic } = require('./_lib');
// Called by the service worker / alarm screen (no login there): the device's own push endpoint is the credential for snooze.
// action 'ack' = "got it": stops repeat reminders for that occurrence.
module.exports = async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (b.topic && (b.action === 'done' || b.action === 'pause' || b.action === 'skip')) { // buttons on an ntfy notification
      const un = await ntfyUserByTopic(b.topic);
      if (!un) return res.status(404).json({ error: 'unknown topic' });
      if (!b.eid || !b.at) return res.status(400).json({ error: 'missing' });
      if (b.action === 'skip') { // "no need for a reminder": stop all repeats of this occurrence (a parent's skip also clears the confirmation)
        await markFired(`ack:${b.eid}:${b.at}`);
        if (await canConfirm(un, false)) await markFired(`done:${b.eid}:${b.at}`);
        return res.status(200).json({ ok: true });
      }
      if (!(await canConfirm(un, false))) return res.status(403).json({ error: 'only a parent can confirm' });
      if (b.action === 'done') await markFired(`done:${b.eid}:${b.at}`);
      else await setJSON(`bny:pause:${b.eid}:${b.at}`, Date.now() + Math.min(Math.max(Number(b.minutes) || 10, 1), 1440) * 60000);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'done') { // "task done" tapped on a notification: only a parent's / the manager's device counts
      if (!b.eid || !b.at || !b.endpoint) return res.status(400).json({ error: 'missing' });
      const un = await subUname(b.endpoint);
      if (un === undefined) return res.status(404).json({ error: 'device not registered' });
      if (un !== null && !(await canConfirm(un, false))) return res.status(403).json({ error: 'only a parent can confirm' });
      await markFired(`done:${b.eid}:${b.at}`);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'ack') {
      if (!b.eid || !b.at) return res.status(400).json({ error: 'missing' });
      await markFired(`ack:${b.eid}:${b.at}`);
      return res.status(200).json({ ok: true });
    }
    if (!b.endpoint || !(await subGet(b.endpoint))) return res.status(404).json({ error: 'device not registered' });
    const min = Math.min(Math.max(Number(b.minutes) || 10, 1), 24 * 60);
    if (b.req && b.eid && b.at) { // a task that needs a parent's confirmation: pause the repeat series for a while (it resumes by itself)
      const un = await subUname(b.endpoint);
      if (un !== null && !(await canConfirm(un, false))) return res.status(403).json({ error: 'only a parent can snooze' });
      await setJSON(`bny:pause:${b.eid}:${b.at}`, Date.now() + min * 60000);
      return res.status(200).json({ ok: true });
    }
    await snoozeAdd(b.endpoint, Date.now() + min * 60000, String(b.title || 'תזכורת').slice(0, 200), String(b.body || '').slice(0, 300), b.eid, b.at);
    if (b.eid && b.at) await markFired(`ack:${b.eid}:${b.at}`); // snoozing also stops the repeat series
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
