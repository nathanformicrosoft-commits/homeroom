// Shared helpers for the pipeline scripts.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const P = (...a) => path.join(ROOT, ...a);
const readJSON = (f, d) => (fs.existsSync(P(f)) ? JSON.parse(fs.readFileSync(P(f), 'utf8')) : d);
const writeJSON = (f, v) => fs.writeFileSync(P(f), JSON.stringify(v, null, 2) + '\n');
const readJSONL = (f) => (fs.existsSync(P(f)) ? fs.readFileSync(P(f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const appendJSONL = (f, v) => fs.appendFileSync(P(f), JSON.stringify(v) + '\n');
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// leads.csv: every field quoted, "" escapes
function readCSV(f) {
  if (!fs.existsSync(P(f))) return { header: [], rows: [] };
  const text = fs.readFileSync(P(f), 'utf8');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const header = rows.shift() || [];
  return { header, rows: rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] || '']))) };
}
function writeCSV(f, { header, rows }) {
  const q = (x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`;
  fs.writeFileSync(P(f), [header.join(','), ...rows.map((r) => header.map((h) => q(r[h])).join(','))].join('\n') + '\n');
}

function money(market, amount, config) {
  const m = config.markets[market];
  return `${m.symbol}${amount}${m.showCode ? ' ' + m.currency : ''}`;
}

// Next Tue–Thu at the market's local send hour, shown in Manila time.
function sendWindow(tz, fromDate, config) {
  const [h1, h2] = config.settings.sendLocalHours;
  const d = new Date(fromDate + 'T00:00:00Z');
  do { d.setUTCDate(d.getUTCDate() + 1); } while (!config.settings.sendDays.includes(d.getUTCDay()));
  const day = d.toISOString().slice(0, 10);
  const offset = (zone) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(day + 'T12:00:00Z')).find((x) => x.type === 'timeZoneName').value;
    const m = name.match(/([+-])(\d{2}):?(\d{2})?/);
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3] || 0) / 60) : 0;
  };
  const utc = (h) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0) + (h - offset(tz)) * 3600e3);
  const fmt = (t) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(t);
  return { day, local: `${h1}–${h2}am local`, manila: `${fmt(utc(h1))} to ${fmt(utc(h2))} Manila time`, utcStart: utc(h1).toISOString() };
}

// --- Send scheduling (deliverability) ---
// Next send day (Tue–Thu by default) strictly after fromDate.
function nextSendDay(fromDate, config) {
  const d = new Date(fromDate + 'T00:00:00Z');
  do { d.setUTCDate(d.getUTCDate() + 1); } while (!config.settings.sendDays.includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}
function tzOffset(zone, day) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(day + 'T12:00:00Z')).find((x) => x.type === 'timeZoneName').value;
  const m = name.match(/([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3] || 0) / 60) : 0;
}
const fmtIn = (zone, t) => new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(t);
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Gives every message its own send time:
//  - emails: inside the recipient's local window, at least emailGapMinutes apart from every other email
//    (in the sender's time, which is what spam filters see), and no more than the warm-up cap per day;
//  - Messenger/SMS: at most messengerPerDay per day.
// Overflow rolls to the next send day.
function makeScheduler(config, outcomes, runDate) {
  const st = config.settings;
  const [h1, h2] = st.sendLocalHours;
  const gap = (st.emailGapMinutes || 9) * 60e3;
  const firstEmail = outcomes.filter((e) => e.event === 'pitched' && e.channel === 'email').map((e) => e.date).sort()[0];
  const emailCap = (day) => {
    const since = firstEmail ? Math.round((new Date(day) - new Date(firstEmail)) / 864e5) : 0;
    let cap = 15;
    for (const [d, n] of st.emailWarmup || [[0, 15]]) if (since >= d) cap = n;
    return cap;
  };
  const used = {};
  const times = [];
  const hourIn = (zone, t) => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(t);
  return function assign(p) {
    let day = nextSendDay(runDate, config);
    for (let tries = 0; tries < 40; tries++, day = nextSendDay(day, config)) {
      const u = (used[day] = used[day] || { email: 0, chat: 0 });
      const off = tzOffset(p.tz, day);
      const at = (h) => new Date(Date.parse(day + 'T00:00:00Z') + (h - off) * 3600e3);
      if (p.channel !== 'email') {
        if (u.chat >= (st.messengerPerDay || 10)) continue;
        u.chat++;
        return { day, utc: at(h1).toISOString(), local: `${fmtIn(p.tz, at(h1))} to ${hourIn(p.tz, at(h2))} their time`, manila: `${fmtIn('Asia/Manila', at(h1))} to ${hourIn('Asia/Manila', at(h2))} Manila time` };
      }
      if (u.email >= emailCap(day)) continue;
      const start = at(h1).getTime() + (hash(p.slug) % 7) * 60e3;
      const end = at(h2).getTime();
      for (let t = start; t < end; t += 60e3) {
        if (times.every((x) => Math.abs(x - t) >= gap)) {
          times.push(t);
          u.email++;
          const d = new Date(t);
          return { day, utc: d.toISOString(), local: `${fmtIn(p.tz, d)} their time`, manila: `${fmtIn('Asia/Manila', d)} Manila time` };
        }
      }
    }
    throw new Error('no send slot found for ' + p.slug);
  };
}

const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// Price for one prospect: an explicit p.quote wins, else the market tier for p.complexity, else the market default.
function quoteFor(p, config) {
  const m = config.markets[p.market];
  return p.quote || (m.tiers && m.tiers[p.complexity || 'standard']) || m.quote;
}

module.exports = { ROOT, P, readJSON, writeJSON, readJSONL, appendJSONL, today, addDays, readCSV, writeCSV, money, sendWindow, words, quoteFor, makeScheduler, nextSendDay };
