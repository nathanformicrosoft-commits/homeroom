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
    const warm = st.emailWarmup || [[0, 15]];
    for (const [d, n] of warm) if (since >= d) cap = n;
    if (st.emailCapAfterWarmup && since >= warm[warm.length - 1][0]) cap = Math.max(cap, st.emailCapAfterWarmup);
    if (st.throttleUntil && day <= st.throttleUntil) cap = Math.max(1, Math.floor(cap / 2));
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

// Price for one prospect: an explicit p.quote wins, then the offer it was given (p.offer, see assignOffers),
// else the market tier for p.complexity, else the market default.
function baseQuote(p, config) {
  const m = config.markets[p.market];
  return (m.tiers && m.tiers[p.complexity || 'standard']) || m.quote;
}
function quoteFor(p, config) {
  return p.quote || (p.offer && p.offer.quote) || baseQuote(p, config);
}
// Monthly care price the prospect was quoted (Basic tier). Older pitches keep the price they were sent.
function careFor(p, config) {
  const m = config.markets[p.market];
  return (p.offer && p.offer.care) || (m.careTiers && m.careTiers.basic) || m.careQuote;
}
const toUSD = (amount, currency, config) => (currency === 'USD' ? amount : amount * (((config.settings.fxToUSD || {})[currency]) || 0));

// ---------- learning: small Bayesian helpers (Thompson sampling) ----------
function rng(seed) {
  let a = hash(String(seed));
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function gammaDraw(k, r) {
  if (k < 1) return gammaDraw(k + 1, r) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = gauss(r); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
const betaDraw = (a, b, r) => { const x = gammaDraw(a, r); return x / (x + gammaDraw(b, r)); };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// One experiment's results. A pitch counts as a trial once it is ageDays old (or as soon as it succeeds),
// so recent sends that haven't had time to answer don't count as failures.
function experimentStats(name, ex, outcomes, asOf, success) {
  const evs = {};
  for (const e of outcomes) (evs[e.slug] = evs[e.slug] || []).push(e.event);
  const st = Object.fromEntries(ex.arms.map((a) => [a.id, { ...a, sent: 0, n: 0, s: 0 }]));
  for (const e of outcomes) {
    if (e.event !== 'pitched' || !e.variant || !(e.variant[name] in st)) continue;
    const a = st[e.variant[name]];
    a.sent++;
    const ok = (evs[e.slug] || []).some((x) => success.includes(x));
    if (ok || daysBetween(e.date, asOf) >= (ex.ageDays || 7)) { a.n++; if (ok) a.s++; }
  }
  return Object.values(st);
}
// Chance that each live arm is the best one, where best = conversion x valueFn(arm).
function probBest(stats, ex, valueFn = () => 1, draws = 4000, seed = 'pb') {
  const live = stats.filter((a) => !a.retired);
  const [a0, b0] = ex.prior || [0.5, 10];
  const r = rng(seed), wins = Object.fromEntries(live.map((a) => [a.id, 0]));
  for (let i = 0; i < draws; i++) {
    let best = null, bv = -1;
    for (const a of live) { const v = betaDraw(a0 + a.s, b0 + a.n - a.s, r) * valueFn(a); if (v > bv) { bv = v; best = a.id; } }
    wins[best]++;
  }
  return Object.fromEntries(live.map((a) => [a.id, wins[a.id] / draws]));
}
// Arm for the next pitch: balanced until every live arm has minPerArm assigned, then Thompson sampling,
// which sends most pitches to the likely winner while still testing the others now and then.
function chooseArm(ex, stats, assigned, seed, valueFn = () => 1) {
  const live = ex.arms.filter((a) => !a.retired);
  const under = live.filter((a) => (assigned[a.id] || 0) < (ex.minPerArm || 25));
  if (under.length) return under.sort((a, b) => (assigned[a.id] || 0) - (assigned[b.id] || 0))[0];
  const [a0, b0] = ex.prior || [0.5, 10];
  const r = rng(seed);
  let best = live[0], bv = -1;
  for (const a of live) { const s = stats.find((x) => x.id === a.id) || { n: 0, s: 0 }; const v = betaDraw(a0 + s.s, b0 + s.n - s.s, r) * valueFn(a); if (v > bv) { bv = v; best = a; } }
  return best;
}

// Price for a price-test arm: the market tier times the arm's multiplier, rounded to 50, never below the minimum.
function armQuote(p, config, arm) {
  const m = config.markets[p.market], base = baseQuote(p, config);
  if (!arm || arm.multiplier === 1) return base;
  return Math.max(m.minQuote || 0, Math.round((base * arm.multiplier) / 50) * 50);
}

// Expected first-year care revenue per new client, in USD: measured take-up (starting from a 50% guess) x Basic price x 12.
function careValueUSD(config, outcomes) {
  const wins = new Set(outcomes.filter((e) => ['won', 'deposit', 'paid'].includes(e.event)).map((e) => e.slug)).size;
  const cares = new Set(outcomes.filter((e) => e.event === 'care').map((e) => e.slug)).size;
  const m = config.markets.US;
  return ((cares + 1) / (wins + 2)) * ((m.careTiers && m.careTiers.basic) || m.careQuote) * 12;
}
// Value of one won client on a price arm, in USD, used to weigh conversion against price.
const priceArmValue = (config, outcomes) => { const cv = careValueUSD(config, outcomes); return (a) => config.markets.US.tiers.standard * (a.multiplier || 1) + cv; };

// Gives every prospect without an offer a fixed price-test arm, subject line and call to action, stored on the
// prospect so the demo page, the email and every later reply quote the same numbers.
// Prospects already in pitches/queue.json from before offers existed keep exactly what they were sent.
function assignOffers(prospects, config, experiments, outcomes, oldQueue) {
  const prev = Object.fromEntries((oldQueue || []).map((q) => [q.slug, q]));
  const keys = ['price', 'subject', 'cta', 'format'];
  const assigned = { price: {}, subject: {}, cta: {}, format: {} };
  const count = (p) => { for (const k of keys) if (p.offer && p.offer[k]) assigned[k][p.offer[k]] = (assigned[k][p.offer[k]] || 0) + 1; };
  prospects.forEach(count);
  const asOf = today();
  const won = ['won', 'deposit', 'paid'], pos = ['interested', 'won', 'deposit', 'paid'];
  const { price: priceEx, subject: subjEx, cta: ctaEx, format: fmtEx } = experiments;
  const stats = {
    price: priceEx ? experimentStats('price', priceEx, outcomes, asOf, won) : [],
    subject: subjEx ? experimentStats('subject', subjEx, outcomes, asOf, pos) : [],
    cta: ctaEx ? experimentStats('cta', ctaEx, outcomes, asOf, pos) : [],
    format: fmtEx ? experimentStats('format', fmtEx, outcomes, asOf, pos) : [],
  };
  const value = priceArmValue(config, outcomes);
  let changed = 0;
  for (const p of prospects) {
    if (p.offer || p.status === 'do-not-contact' || p.stage === 'final' || p.forgotten) continue;
    const m = config.markets[p.market];
    const q = prev[p.slug];
    if (q) {
      p.offer = { price: 'P1', quote: q.quote, care: m.careQuote, legacy: true };
      if (q.channel === 'email') Object.assign(p.offer, { subject: q.variant && q.variant.subject, cta: 'C1', format: 'F1' });
    } else {
      const pa = priceEx ? chooseArm(priceEx, stats.price, assigned.price, 'price:' + p.slug, value) : null;
      p.offer = { price: pa ? pa.id : 'P1', quote: p.quote || armQuote(p, config, pa), care: (m.careTiers && m.careTiers.basic) || m.careQuote };
      if (p.channel === 'email') {
        if (subjEx) p.offer.subject = chooseArm(subjEx, stats.subject, assigned.subject, 'subject:' + p.slug).id;
        p.offer.format = fmtEx ? chooseArm(fmtEx, stats.format, assigned.format, 'format:' + p.slug).id : 'F1';
        if (ctaEx && p.offer.format !== 'F2') p.offer.cta = chooseArm(ctaEx, stats.cta, assigned.cta, 'cta:' + p.slug).id;
      }
    }
    count(p);
    changed++;
  }
  return changed;
}

// Sending volume set by learn.js in data/send-state.json: which weekdays, the daily email cap after warm-up,
// and a throttle date after any bad signal. Applied on top of config.settings.
function applySendState(config) {
  const st = readJSON('data/send-state.json', null);
  if (!st) return config;
  if (Array.isArray(st.sendDays) && st.sendDays.length) config.settings.sendDays = st.sendDays;
  if (st.emailCapAfterWarmup) config.settings.emailCapAfterWarmup = st.emailCapAfterWarmup;
  if (st.throttleUntil) config.settings.throttleUntil = st.throttleUntil;
  return config;
}

module.exports = { ROOT, P, readJSON, writeJSON, readJSONL, appendJSONL, today, addDays, readCSV, writeCSV, money, sendWindow, words, quoteFor, baseQuote, careFor, toUSD, makeScheduler, nextSendDay, rng, betaDraw, daysBetween, experimentStats, probBest, chooseArm, armQuote, assignOffers, careValueUSD, priceArmValue, applySendState };
