const crypto = require('crypto');
const { auth, getJSON } = require('./_lib');
const REC = require('../rec.js');
// Calendar feed (.ics) for Google Calendar / Apple Calendar "subscribe by URL".
// GET /api/ical?link=1 (logged in) -> {url}; GET /api/ical?k=<key> -> the calendar feed.
const key = () => crypto.createHash('sha256').update('ical:' + (process.env.TURSO_AUTH_TOKEN || '') + (process.env.FAMILY_CODE || '')).digest('hex').slice(0, 32);
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = l => { const out = []; while (l.length > 70) { out.push(l.slice(0, 70)); l = ' ' + l.slice(70); } out.push(l); return out.join('\r\n'); };

module.exports = async (req, res) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (req.query.link) {
      if (!(await auth(req, res))) return;
      return res.status(200).json({ url: `https://${host}/api/ical?k=${key()}`, webcal: `webcal://${host}/api/ical?k=${key()}` });
    }
    if (req.query.k !== key()) return res.status(403).send('forbidden');
    const db = (await getJSON('bny:data')) || {};
    const now = Date.now(), day = ms => new Date(ms).toISOString().slice(0, 10);
    const from = day(now - 30 * 864e5), to = day(now + 200 * 864e5);
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BenYehuda//Family//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:משפחת בן יהודה', 'X-WR-TIMEZONE:Asia/Jerusalem', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
    for (const e of (db.events || [])) {
      if (e.del || !e.date || !e.title) continue;
      const kids = e.kids || (e.kid ? [e.kid] : []);
      for (const d of REC.occDates(e, to)) {
        if (d < from) continue;
        const at = REC.ilToMs(d, REC.timeOn(e, d));
        L.push('BEGIN:VEVENT', `UID:${e.id}-${d}@benyehuda`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(at)}`, `DTEND:${stamp(at + 30 * 60000)}`,
          fold('SUMMARY:' + esc(e.title + (kids.length ? ' (' + kids.join(', ') + ')' : '') + (e.req ? ' ❗' : ''))));
        if (Number(e.remind) >= 0) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), `TRIGGER:-PT${Math.round(Number(e.remind))}M`, 'END:VALARM');
        L.push('END:VEVENT');
      }
    }
    L.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(L.join('\r\n') + '\r\n');
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
