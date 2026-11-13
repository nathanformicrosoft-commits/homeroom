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

const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// Price for one prospect: an explicit p.quote wins, else the market tier for p.complexity, else the market default.
function quoteFor(p, config) {
  const m = config.markets[p.market];
  return p.quote || (m.tiers && m.tiers[p.complexity || 'standard']) || m.quote;
}

module.exports = { ROOT, P, readJSON, writeJSON, readJSONL, appendJSONL, today, addDays, readCSV, writeCSV, money, sendWindow, words, quoteFor };
