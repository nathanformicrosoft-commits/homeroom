#!/usr/bin/env node
// The reinvestment ladder: says when the next paid upgrade (own domain, more sending inboxes, research capacity) is
// funded and safe, and records what the owner reports buying. It never buys, pays, sends or signs up for anything:
// the owner buys, tells Claude, and Claude logs it here. Rules: playbook/DOMAIN-SETUP.md ("Budget plan",
// "Reinvestment ladder") and playbook/STATE.md; the rungs and their conditions: playbook/upgrades.json.
//   node upgrades.js [status]   read-only: every rung as bought / ready / funded but blocked (why) / not yet (what is missing)
//   node upgrades.js renewals   read-only: yearly renewals due within 30 days (and monthly payments due within 7)
//   node upgrades.js bought <id> --amount N [--currency USD] [--date YYYY-MM-DD] [--note "..."] [--charge | --refund]
//       the only command that writes: appends one line to data/spend.jsonl (created if missing), after checking it.
//       --date   the day it was paid, if not today (never in the future)
//       --charge another payment for a rung already bought (a monthly Workspace bill, a real second charge)
//       --refund money that came back: --amount must be negative, and no more than was logged for that rung
//       A second purchase of a rung already bought is refused: always for a one-time rung, and for a yearly
//       (monthly) rung until 30 (7) days before its renewal date, when it is logged as the renewal.
// Money available = collected (the same figure learn.js shows) x settings.reinvestShare - everything in data/spend.jsonl.
// learn.js calls forInsights() for the "**Act on:**" line and the "## Upgrades and milestones" section of insights.md.
const fs = require('fs');
const { P, readJSON, appendJSONL, today, addDays, daysBetween } = require('./lib');

const LADDER = 'playbook/upgrades.json', SPEND = 'data/spend.jsonl';
const MONTHS = { yearly: 12, monthly: 1 };
const RENEW_WINDOW = { yearly: 30, monthly: 7 }; // days before the renewal date it is listed, and can be logged as a renewal
const RENEW_GRACE = { yearly: 45, monthly: 7 }; // a renewal paid this late still continues the same period
const WHEN_KEYS = new Set(['money', 'costSetting', 'after', 'afterDays', 'healthy', 'pauseOnComplaint', 'requires', 'minInboxes', 'trigger', 'lowDays']);
const DONE_KEYS = new Set(['sendLocalHoursEndAtLeast', 'skipDatesYear']);
const HEALTH_DEFAULTS = { windowDays: 30, maxBounceRate: 0.03, maxStopRate: 0.05, minEmails: 20, complaintPauseDays: 30 };
const PHP_MILESTONES = [100000, 1000000, 10000000];
const PHP_FALLBACK = 58;
const CASH_EVENTS = ['deposit', 'paid', 'carepaid', 'upsell']; // what learn.js counts as collected

const round2 = (n) => Math.round(n * 100) / 100;
const usd = (n) => { const r = round2(Math.abs(n)); return `${n < -0.005 ? '-' : ''}$${r.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 })}`; };
const pct = (a, b) => (b ? `${Math.round((1000 * a) / b) / 10}%` : '0%');
const per = (r) => (r.recurring === 'yearly' ? '/yr' : r.recurring === 'monthly' ? '/month' : ' one-time');
const isDate = (s) => { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; };
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0); // stable: same-day entries keep file order
const addMonths = (d, n) => { const [y, m, day] = d.split('-').map(Number); const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, m - 1 + n, Math.min(day, last))).toISOString().slice(0, 10); };
const inDays = (d) => (d > 0 ? `in ${d} day${d === 1 ? '' : 's'}` : d === 0 ? 'today' : `${-d} day${d === -1 ? '' : 's'} ago`);

// ---------------------------------------------------------------- the ladder file
// Checked strictly: a rule that cannot be read is never guessed at, so nothing shows as funded until it is fixed.
function loadLadder() {
  let raw;
  try { raw = readJSON(LADDER, null); } catch (e) { throw new Error(`${LADDER} is not valid JSON (${e.message})`); }
  if (!raw || !Array.isArray(raw.rungs) || !raw.rungs.length) throw new Error(`${LADDER} is missing or has no "rungs" list`);
  const health = { ...HEALTH_DEFAULTS, ...(raw.health || {}) };
  for (const k of Object.keys(HEALTH_DEFAULTS)) if (!(Number(health[k]) >= 0)) throw new Error(`${LADDER} health.${k} must be a number of 0 or more`);
  const ids = new Set(), rungs = [], reminders = [];
  for (const r of raw.rungs) {
    const where = `${LADDER} rung "${(r && r.id) || '?'}"`;
    if (!r || !/^[a-z0-9-]+$/.test(r.id || '')) throw new Error(`${where}: id must be lowercase letters, digits and dashes`);
    if (ids.has(r.id)) throw new Error(`${where}: the id is used twice`);
    if (!(Number(r.costUSD) > 0)) throw new Error(`${where}: costUSD must be a positive number`);
    if (!(r.recurring === null || Object.prototype.hasOwnProperty.call(MONTHS, r.recurring))) throw new Error(`${where}: recurring must be "yearly", "monthly" or null`);
    const w = r.when;
    if (!w || typeof w !== 'object') throw new Error(`${where}: needs a "when" block`);
    for (const k of Object.keys(w)) if (!k.startsWith('_') && !WHEN_KEYS.has(k)) throw new Error(`${where}: unknown "when" key "${k}" (a typo there could loosen a rule)`);
    if (!['collected', 'available'].includes(w.money)) throw new Error(`${where}: when.money must be "collected" or "available"`);
    if (w.after !== undefined && !ids.has(w.after)) throw new Error(`${where}: when.after must name an earlier rung`);
    if (w.afterDays !== undefined && !(Number(w.afterDays) >= 0)) throw new Error(`${where}: when.afterDays must be a number`);
    if (w.minInboxes !== undefined && !(Number(w.minInboxes) >= 1)) throw new Error(`${where}: when.minInboxes must be 1 or more`);
    if (w.trigger !== undefined && w.trigger !== 'bankShort') throw new Error(`${where}: when.trigger can only be "bankShort"`);
    if (w.requires !== undefined && (!w.requires || typeof w.requires.setting !== 'string' || !('equals' in w.requires))) throw new Error(`${where}: when.requires needs "setting" and "equals"`);
    ids.add(r.id); rungs.push(r);
  }
  for (const m of raw.reminders || []) {
    const where = `${LADDER} reminder "${(m && m.id) || '?'}"`;
    if (!m || !/^[a-z0-9-]+$/.test(m.id || '') || ids.has(m.id)) throw new Error(`${where}: needs its own id (lowercase, digits, dashes)`);
    if (!isDate(m.from)) throw new Error(`${where}: "from" must be a YYYY-MM-DD date`);
    if (typeof m.text !== 'string' || !m.text) throw new Error(`${where}: needs "text"`);
    const keys = Object.keys(m.doneWhen || {}).filter((k) => !k.startsWith('_'));
    if (!keys.length) throw new Error(`${where}: needs a "doneWhen" check, or it could never show`);
    for (const k of keys) if (!DONE_KEYS.has(k)) throw new Error(`${where}: unknown doneWhen key "${k}"`);
    ids.add(m.id); reminders.push(m);
  }
  return { rungs, reminders, health };
}
const costOf = (r, st) => { const k = r.when.costSetting; return k && Number(st[k]) > 0 ? Number(st[k]) : Number(r.costUSD); };

// ---------------------------------------------------------------- data/spend.jsonl
// One line per payment the owner reports: {date, id, kind: purchase|renewal|charge|refund, amount, currency, amountUSD,
// recurring, note, logged}. A broken line stops the ladder (money available is unknown), it is never skipped.
function readSpend() {
  if (!fs.existsSync(P(SPEND))) return { entries: [], error: null };
  const lines = fs.readFileSync(P(SPEND), 'utf8').split('\n'), entries = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    let e;
    try { e = JSON.parse(l); } catch (x) { return { entries, error: `${SPEND} line ${i + 1} is not valid JSON` }; }
    if (!e || typeof e.id !== 'string' || !isDate(e.date) || !Number.isFinite(Number(e.amountUSD)) || !['purchase', 'renewal', 'charge', 'refund'].includes(e.kind)) return { entries, error: `${SPEND} line ${i + 1} has no valid id, date, kind or amountUSD` };
    entries.push({ ...e, amountUSD: Number(e.amountUSD) });
  }
  return { entries, error: null };
}
// What has been paid for one rung, and since when it has been owned. A full refund means it is no longer bought.
function ledgerFor(r, entries) {
  const es = entries.filter((e) => e.id === r.id).sort(byDate);
  const len = MONTHS[r.recurring] || 0, grace = RENEW_GRACE[r.recurring] || 0;
  let net = 0, paid = 0, refunded = 0, start = null, through = null, last = null, periods = 0;
  for (const e of es) {
    net = round2(net + e.amountUSD);
    if (e.kind === 'refund') { refunded = round2(refunded - e.amountUSD); if (net <= 0.005) { start = null; through = null; periods = 0; } continue; }
    paid = round2(paid + e.amountUSD);
    if (e.kind === 'charge') continue; // a bill or second charge: counts as spent, changes no date
    last = e;
    if (!len) { if (!start) start = e.date; continue; }
    // every renewal date counts from the original purchase date (never chained), so month-end days don't drift
    if (start && through && e.date <= addDays(through, grace)) periods++; // renewal: the period continues
    else { start = e.date; periods = 1; } // first purchase, or bought again after a lapse or a full refund
    through = addMonths(start, periods * len);
  }
  return { entries: es, net, paid, refunded, bought: !!start && net > 0.005, start, through, last };
}

// ---------------------------------------------------------------- money collected (the same formula as learn.js)
function cashSeries(config, ev) {
  const st = config.settings || {}, markets = config.markets || {};
  const mkt = (m) => markets[m] || markets.US || {};
  const curOf = (e) => e.currency || mkt(e.market).currency || 'USD';
  const rateUSD = (cur) => (cur === 'USD' ? 1 : Number((st.fxToUSD || {})[cur]));
  const series = [], noRate = new Set();
  let total = 0, undated = 0;
  for (const e of ev) {
    if (!CASH_EVENTS.includes(e.event) || !e.amount) continue;
    const r = rateUSD(curOf(e));
    if (!(r > 0)) { noRate.add(curOf(e)); continue; } // left out, as learn.js does (never counted as 0 by mistake)
    const v = (Number(e.amount) || 0) * r;
    total += v; // counted in collected like learn.js does, dated or not
    if (isDate(e.date)) series.push({ date: e.date, usd: v }); else undated++; // milestones need a date
  }
  series.sort(byDate);
  return { series, total, noRate, undated };
}

// ---------------------------------------------------------------- inbox health (the governor's data, over a month)
function healthOf(H, ev, T, sendState) {
  const age = (e) => daysBetween(e.date, T), inWin = (e, d) => isDate(e.date) && age(e) >= 0 && age(e) < d;
  const emails = ev.filter((e) => e.event === 'pitched' && e.channel === 'email' && inWin(e, H.windowDays));
  const inboxOf = new Map(), per = {};
  for (const e of emails) { const box = e.inbox || 'main'; inboxOf.set(e.slug, box); (per[box] = per[box] || { emails: 0, bounces: 0, stops: 0 }).emails++; }
  let bounces = 0, stops = 0;
  for (const e of ev) {
    if (!['bounced', 'stop'].includes(e.event) || !inWin(e, H.windowDays) || !inboxOf.has(e.slug)) continue;
    const s = per[inboxOf.get(e.slug)];
    if (e.event === 'bounced') { s.bounces++; bounces++; } else { s.stops++; stops++; }
  }
  const complaints = ev.filter((e) => e.event === 'complaint' && inWin(e, H.complaintPauseDays)).sort(byDate);
  const lastComplaint = complaints.length ? complaints[complaints.length - 1].date : null;
  const problems = [];
  if (emails.length < H.minEmails) problems.push(`only ${emails.length} email(s) sent in the last ${H.windowDays} days; a clean month needs at least ${H.minEmails} to judge`);
  for (const [box, s] of Object.entries(per)) {
    const name = box === 'main' ? 'the sending inbox' : `inbox ${box}`;
    if (s.bounces / s.emails >= H.maxBounceRate) problems.push(`${name}: bounces ${pct(s.bounces, s.emails)} in the last ${H.windowDays} days (must be under ${pct(H.maxBounceRate, 1)})`);
    if (s.stops / s.emails >= H.maxStopRate) problems.push(`${name}: STOPs ${pct(s.stops, s.emails)} in the last ${H.windowDays} days (must be under ${pct(H.maxStopRate, 1)})`);
  }
  if (sendState && isDate(sendState.throttleUntil) && sendState.throttleUntil >= T) problems.push(`the send governor has cut volume until ${sendState.throttleUntil}`);
  return { emails: emails.length, bounces, stops, complaints: complaints.length, lastComplaint, paused: !!lastComplaint, pausedUntil: lastComplaint ? addDays(lastComplaint, H.complaintPauseDays) : null, problems, inboxes: Object.keys(per).length };
}

// ---------------------------------------------------------------- can research keep up
// bank.js records the bank (data/bank.json) and its `low` mark, but no dates or take shortfalls. If it ever records
// `lowSince` (the day the bank went under low), the lowDays rule uses it; until then today's count is used.
function bankOf(T, lowDays, warnings) {
  let bs = {}, bank = [];
  try { bs = readJSON('data/bank-state.json', {}) || {}; bank = readJSON('data/bank.json', []); } catch (e) { warnings.push(`data/bank-state.json or data/bank.json could not be read (${e.message}); research capacity counts as not needed`); return { banked: 0, low: 0, short: false, why: 'bank files unreadable' }; }
  const banked = Array.isArray(bank) ? bank.length : 0, low = Number(bs.low) > 0 ? Number(bs.low) : 25, under = banked < low;
  if (isDate(bs.lowSince)) { const d = daysBetween(bs.lowSince, T); return { banked, low, perRunMax: bs.perRunMax, short: under && d >= lowDays, why: `${banked} banked, under the low mark of ${low} since ${bs.lowSince} (${d} days; ${lowDays} needed)` }; }
  return { banked, low, perRunMax: bs.perRunMax, short: under, why: `${banked} banked, low mark ${low}${under ? ', under it today' : ''} (bank.js records no dates, so this is today's count)` };
}

// ---------------------------------------------------------------- the whole picture, read-only
function evaluate(ctx = {}) {
  const config = ctx.config || readJSON('config.json');
  const st = config.settings || {};
  const T = ctx.T || today();
  const ev = ctx.ev || readOutcomes();
  const sendState = ctx.sendState || readJSON('data/send-state.json', {});
  const warnings = [];
  const ladder = loadLadder(); // throws: the callers show the error and nothing counts as funded
  const cash = cashSeries(config, ev);
  const collected = round2(Number.isFinite(ctx.collectedUSD) ? ctx.collectedUSD : cash.total);
  if (cash.noRate.size) warnings.push(`no rate in settings.fxToUSD for ${[...cash.noRate].join(', ')}: that money is left out of collected, as in learn.js`);
  if (cash.undated) warnings.push(`${cash.undated} payment(s) in data/outcomes.jsonl have no valid date: counted in collected, but left out of the money milestones`);
  let share = 1, cushion = 300;
  if (st.reinvestShare !== undefined && st.reinvestShare !== null) {
    const s = Number(st.reinvestShare);
    if (Number.isFinite(s) && s >= 0 && s <= 1) share = s;
    else { share = 0; warnings.push(`settings.reinvestShare is ${JSON.stringify(st.reinvestShare)} but must be between 0 and 1, so 0 is used (nothing counts as available) until it is fixed`); }
  }
  if (st.upgradeCushionUSD !== undefined && st.upgradeCushionUSD !== null) {
    const c = Number(st.upgradeCushionUSD);
    if (Number.isFinite(c) && c >= 0) cushion = c;
    else warnings.push(`settings.upgradeCushionUSD is ${JSON.stringify(st.upgradeCushionUSD)}, not a number of 0 or more, so the default $300 is used`);
  }
  const spend = readSpend();
  if (spend.error) return { T, error: `${spend.error}. Money available is unknown, so nothing shows as funded until it is fixed by hand (never delete a real payment)`, warnings };
  const spent = round2(spend.entries.reduce((a, e) => a + e.amountUSD, 0));
  const available = round2(collected * share - spent);
  const known = new Set(ladder.rungs.map((r) => r.id));
  const strays = [...new Set(spend.entries.filter((e) => !known.has(e.id)).map((e) => e.id))];
  if (strays.length) warnings.push(`${SPEND} has payments for ${strays.join(', ')}, which is not a rung in ${LADDER}; they still count as spent`);
  const ledgers = Object.fromEntries(ladder.rungs.map((r) => [r.id, ledgerFor(r, spend.entries)]));
  const inboxes = Math.max(1, ladder.rungs.filter((r) => r.addsInbox && ledgers[r.id].bought).length); // the personal Gmail until own-domain
  const H = ladder.health, health = healthOf(H, ev, T, sendState);
  const bank = bankOf(T, Math.max(...ladder.rungs.map((r) => Number(r.when.lowDays) || 7)), warnings);
  const domainLive = /^https:\/\/(?!.*netlify\.app)/.test((config.netlify || {}).baseUrl || ''); // the same test as learn.js
  let remaining = available; // money not yet set aside for an earlier rung
  const rungs = [];
  for (const r of ladder.rungs) {
    const L = ledgers[r.id], w = r.when, cost = costOf(r, st);
    const x = { id: r.id, rung: r, cost, ledger: L, seq: [], reasons: [] };
    rungs.push(x);
    if (L.bought) {
      x.status = 'bought';
      if (r.recurring && L.through) x.renewal = { date: L.through, days: daysBetween(T, L.through) };
      continue;
    }
    if (w.after) {
      const pv = ledgers[w.after];
      if (!pv.bought) x.seq.push(`buy ${w.after} first`);
      else if (daysBetween(pv.start, T) < Number(w.afterDays || 0)) x.reasons.push(`wait until ${addDays(pv.start, Number(w.afterDays))}: one new inbox a month (${w.after} was bought ${pv.start})`);
    }
    if (w.minInboxes && inboxes < Number(w.minInboxes)) x.seq.push(`needs ${w.minInboxes} sending inboxes (${inboxes} now)`);
    if (w.trigger === 'bankShort' && !bank.short) { x.seq.push(`not needed yet: the prospect bank is keeping up (${bank.why})`); x.notNeeded = true; }
    if ((w.pauseOnComplaint || w.healthy) && health.paused) x.reasons.push(`ladder paused until ${health.pausedUntil}: a spam complaint was logged ${health.lastComplaint}`);
    if (w.healthy) x.reasons.push(...health.problems);
    if (w.requires && st[w.requires.setting] !== w.requires.equals) x.reasons.push(`${w.requires.blocked} (settings.${w.requires.setting} is not ${JSON.stringify(w.requires.equals)})`);
    if (r.id === 'own-domain' && domainLive) x.reasons.push(`the demos already use ${config.netlify.baseUrl}, so it looks bought: log what was paid with node upgrades.js bought own-domain --amount <paid> --date <day paid>`);
    if (w.money === 'collected') {
      x.funded = collected >= cost - 0.005;
      x.need = round2(cost - collected);
      x.money = x.funded ? `money covered (${usd(collected)} collected of ${usd(cost)})` : `needs ${usd(x.need)} more collected (${usd(collected)} of ${usd(cost)})`;
    } else {
      x.funded = remaining - cost >= cushion - 0.005;
      x.need = round2(cost + cushion - remaining);
      const have = `${usd(remaining)} available${remaining !== available ? ' after earlier rungs' : ''}; it takes ${usd(cost)} + the ${usd(cushion)} cushion`;
      x.money = x.funded ? `money covered (${have})` : `needs ${usd(x.need)} more (${have})`;
    }
    x.status = x.seq.length || !x.funded ? 'notyet' : x.reasons.length ? 'blocked' : 'ready';
    if (x.status === 'ready' || x.status === 'blocked') remaining = round2(remaining - cost); // set aside, so later rungs can't count it too
  }
  const next = rungs.find((x) => x.status === 'notyet' && !x.notNeeded) || null;
  const renewals = rungs.filter((x) => x.renewal && x.renewal.days <= RENEW_WINDOW[x.rung.recurring]).map((x) => ({ id: x.id, name: x.rung.name, date: x.renewal.date, days: x.renewal.days, cost: x.cost, rung: x.rung }));
  const upcoming = rungs.filter((x) => x.renewal).sort((a, b) => (a.renewal.date < b.renewal.date ? -1 : 1))[0] || null;
  // dated reminders: due from their date until the change is made
  const done = (d) => Object.entries(d).filter(([k]) => !k.startsWith('_')).every(([k, v]) => (k === 'sendLocalHoursEndAtLeast' ? Array.isArray(st.sendLocalHours) && Number(st.sendLocalHours[1]) >= Number(v)
    : k === 'skipDatesYear' ? Object.keys(st.skipDates || {}).length > 0 && Object.values(st.skipDates).every((ds) => Array.isArray(ds) && ds.some((s) => String(s).startsWith(`${v}-`))) : false));
  const reminders = ladder.reminders.filter((m) => T >= m.from && !done(m.doneWhen));
  // money milestones, new in the last 7 days
  const phpRate = Number(st.phpPerUSD) > 0 ? Number(st.phpPerUSD) : PHP_FALLBACK, estimate = !(Number(st.phpPerUSD) > 0);
  const rateNote = estimate ? `estimate at ₱${PHP_FALLBACK}/USD; set settings.phpPerUSD for the real rate` : `at ₱${phpRate}/USD`;
  const milestones = [];
  let nextMilestone = null;
  for (const php of PHP_MILESTONES) {
    const needUSD = php / phpRate;
    let cum = 0, on = null;
    for (const c of cash.series) { cum += c.usd; if (!on && cum >= needUSD - 0.005) on = c.date; }
    const reached = on && cash.total >= needUSD - 0.005;
    if (reached && daysBetween(on, T) >= 0 && daysBetween(on, T) < 7) milestones.push({ short: `₱${php.toLocaleString('en-US')} collected${estimate ? ' (estimate)' : ''}`, text: `₱${php.toLocaleString('en-US')} collected, reached ${on} (${usd(needUSD)}, ${rateNote})` });
    if (!reached && !nextMilestone) nextMilestone = `₱${php.toLocaleString('en-US')} (₱${Math.round(cash.total * phpRate).toLocaleString('en-US')} so far, ${rateNote})`;
  }
  const goal = Number(st.goalUSDPerYear) > 0 ? Number(st.goalUSDPerYear) : 200000, monthGoal = goal / 12;
  const monthSum = {};
  let paceMonth = null;
  for (const c of cash.series) { const m = c.date.slice(0, 7); monthSum[m] = (monthSum[m] || 0) + c.usd; if (!paceMonth && monthSum[m] >= monthGoal - 0.005) paceMonth = { month: m, date: c.date }; }
  if (paceMonth && daysBetween(paceMonth.date, T) >= 0 && daysBetween(paceMonth.date, T) < 7) milestones.push({ short: `first month at a ${usd(goal)}-a-year pace`, text: `first month at a ${usd(goal)}-a-year pace: ${usd(monthSum[paceMonth.month])} collected in ${paceMonth.month} so far (${usd(monthGoal)} a month), reached ${paceMonth.date}` });
  // the one line the daily run copies into its push notification
  const act = [];
  for (const x of rungs.filter((y) => y.status === 'ready')) act.push(`Funded: ${x.id} (about ${usd(x.cost)}${per(x.rung)}), buy it yourself if you want it`);
  for (const r of renewals.filter((y) => y.days <= 7)) act.push(r.days < 0 ? `Renewal: ${r.id} was due ${r.date}, check it renewed and log it` : `Renewal: ${r.id} due ${r.date}`);
  for (const m of reminders) act.push(`Reminder: ${m.short || m.text}`);
  for (const m of milestones) act.push(`Milestone: ${m.short}`);
  return { T, collected, share, spent, available, cushion, inboxes, health, H, bank, rungs, next, renewals, upcoming, reminders, milestones, nextMilestone, act, warnings };
}
function readOutcomes() {
  if (!fs.existsSync(P('data/outcomes.jsonl'))) return [];
  return fs.readFileSync(P('data/outcomes.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ---------------------------------------------------------------- text
const READY_TEXT = (id, code) => `Funded. Buy it yourself if you want it (Claude never buys), then tell Claude: ${code ? '`' : ''}node upgrades.js bought ${id} --amount <paid>${code ? '`' : ''}`;
const healthLine = (u) => `last ${u.H.windowDays} days: ${u.health.emails} emails, ${u.health.bounces} bounced (${pct(u.health.bounces, u.health.emails)}), ${u.health.stops} STOP (${pct(u.health.stops, u.health.emails)}), ${u.health.complaints} complaint(s)`;
const ladderLine = (u) => (u.health.paused ? `PAUSED until ${u.health.pausedUntil}: a spam complaint was logged ${u.health.lastComplaint} (any complaint pauses the inbox and research rungs for ${u.H.complaintPauseDays} days)` : 'running');
const renewalText = (r, code) => {
  const cmd = `node upgrades.js bought ${r.id} --amount <paid>`, c = code ? `\`${cmd}\`` : cmd;
  return `${r.id} (${r.name}): ${r.rung.recurring === 'yearly' ? 'renews' : 'next monthly payment'} ${r.date} (${inDays(r.days)}), about ${usd(r.cost)}${per(r.rung)}. ${r.days < 0 ? 'Check that it renewed (and was not left to lapse), then' : 'Check auto-renew and the card on file; once paid,'} log it: ${c}`;
};

// insights.md: the "**Act on:**" line and the section. Never throws (learn.js must always finish).
function forInsights(ctx) {
  let u;
  try { u = evaluate(ctx); } catch (e) { u = { error: e.message, warnings: [] }; }
  if (u.error) return { actOn: `**Act on:** Check: the upgrade ladder cannot be read (${u.error}); see node upgrades.js status`, section: ['## Upgrades and milestones', '', `- **Check:** ${u.error}. Nothing shows as funded until it is fixed.`, ...u.warnings.map((w) => `- Note: ${w}`), ''] };
  const s = ['## Upgrades and milestones', '', "Claude never buys, pays or signs up for anything: the owner buys, then tells Claude, who logs it. Whole ladder: `node upgrades.js status` (rules: playbook/upgrades.json and DOMAIN-SETUP.md \"Reinvestment ladder\").", ''];
  s.push(`- Money available for upgrades: **${usd(u.available)}** (${usd(u.collected)} collected x ${Math.round(u.share * 100)}% reinvested - ${usd(u.spent)} spent). Cushion kept after an inbox or research upgrade: ${usd(u.cushion)}.`);
  s.push(`- Ladder: ${u.health.paused ? `**${ladderLine(u)}**` : ladderLine(u)}. Sending inboxes: ${u.inboxes}. Health, ${healthLine(u)}.`);
  const ready = u.rungs.filter((x) => x.status === 'ready'), blocked = u.rungs.filter((x) => x.status === 'blocked');
  for (const x of ready) s.push(`- **Ready to buy: ${x.id}** (${x.rung.name}, about ${usd(x.cost)}${per(x.rung)}): ${x.rung.unlocks}.${x.rung.action ? ` What to do: ${x.rung.action}.` : ''} ${READY_TEXT(x.id, true)}`);
  for (const x of blocked) s.push(`- Funded but blocked: **${x.id}** (${x.rung.name}, about ${usd(x.cost)}${per(x.rung)}): ${x.reasons.join('; ')}.`);
  if (!ready.length && !blocked.length) s.push('- Ready to buy: nothing yet.');
  if (u.next) s.push(`- Next: ${u.next.id} (${u.next.rung.name}, about ${usd(u.next.cost)}${per(u.next.rung)}): ${[...u.next.seq, u.next.money, ...u.next.reasons].join('; ')}.`);
  else if (!ready.length && !blocked.length) s.push('- Next: nothing left on the ladder.');
  if (u.renewals.length) s.push('- Renewals due within 30 days:', ...u.renewals.map((r) => `  - ${renewalText(r, true)}`));
  else s.push(`- Renewals due within 30 days: none.${u.upcoming ? ` Next: ${u.upcoming.id} ${u.upcoming.renewal.date}.` : ''}`);
  s.push(u.reminders.length ? `- **Reminders due:** ${u.reminders.map((m) => `${m.text} (from ${m.from}).`).join(' ')}` : '- Reminders due: none.');
  s.push(u.milestones.length ? `- **Money milestones reached in the last 7 days:** ${u.milestones.map((m) => m.text).join('; ')}.` : `- Money milestones reached in the last 7 days: none.${u.nextMilestone ? ` Next: ${u.nextMilestone}.` : ''}`);
  for (const w of u.warnings) s.push(`- Note: ${w}.`);
  s.push('');
  return { actOn: `**Act on:** ${u.act.length ? u.act.join('; ') : 'nothing new'}`, section: s, result: u };
}

// ---------------------------------------------------------------- command line
function printStatus() {
  const u = evaluate();
  if (u.error) { console.log(`Upgrades ladder: ${u.error}`); u.warnings.forEach((w) => console.log(`Note: ${w}`)); return; }
  const out = [`Upgrades ladder, ${u.T} (${LADDER}). Claude never buys: the owner buys, then tells Claude, who logs it.`,
    `Money available: ${usd(u.available)} = ${usd(u.collected)} collected x ${Math.round(u.share * 100)}% reinvested - ${usd(u.spent)} spent (${SPEND}). Cushion for inbox and research rungs: ${usd(u.cushion)}.`,
    `Ladder: ${ladderLine(u)}. Sending inboxes: ${u.inboxes}. Health, ${healthLine(u)}.`,
    `Prospect bank: ${u.bank.why}.`, ''];
  const pad = Math.max(...u.rungs.map((x) => x.id.length)) + 2;
  for (const x of u.rungs) {
    const head = `${x.id.padEnd(pad)}${x.rung.name}, about ${usd(x.cost)}${per(x.rung)}`;
    const L = x.ledger;
    if (x.status === 'bought') {
      out.push(`${head}\n${' '.repeat(pad)}bought: ${L.start}, ${usd(L.paid)} paid${L.refunded ? `, ${usd(L.refunded)} refunded` : ''}${x.renewal ? `; ${x.rung.recurring === 'yearly' ? 'renews' : 'next payment'} ${x.renewal.date} (${inDays(x.renewal.days)})` : ''}`);
      continue;
    }
    // the next rung gets every missing condition; rungs further up only say what has to come first
    const full = x === u.next || !x.seq.length;
    const why = x.status === 'ready' ? `ready: ${READY_TEXT(x.id)}${x.rung.action ? `\n${' '.repeat(pad)}what to do: ${x.rung.action}` : ''}`
      : x.status === 'blocked' ? `funded but blocked: ${x.reasons.join('; ')}`
        : `not yet: ${(full ? [...x.seq, x.money, ...x.reasons] : x.seq).join('; ')}`;
    out.push(`${head}\n${' '.repeat(pad)}${why}\n${' '.repeat(pad)}unlocks: ${x.rung.unlocks}`);
  }
  out.push('', u.reminders.length ? `Reminders due:\n${u.reminders.map((m) => `- ${m.text} (from ${m.from})`).join('\n')}` : 'Reminders due: none.');
  out.push(u.renewals.length ? `Renewals due within 30 days:\n${u.renewals.map((r) => `- ${renewalText(r)}`).join('\n')}` : 'Renewals due within 30 days: none.');
  out.push(u.milestones.length ? `Money milestones in the last 7 days:\n${u.milestones.map((m) => `- ${m.text}`).join('\n')}` : `Money milestones in the last 7 days: none.${u.nextMilestone ? ` Next: ${u.nextMilestone}.` : ''}`);
  for (const w of u.warnings) out.push(`Note: ${w}.`);
  out.push('', `Act on: ${u.act.length ? u.act.join('; ') : 'nothing new'}`);
  console.log(out.join('\n'));
}

function printRenewals() {
  const u = evaluate();
  if (u.error) { console.log(`Upgrades ladder: ${u.error}`); return; }
  if (!u.renewals.length) { console.log(`No renewals due within 30 days (${u.T}).${u.upcoming ? ` Next: ${u.upcoming.id} on ${u.upcoming.renewal.date} (${inDays(u.upcoming.renewal.days)}).` : ' Nothing bought yet.'}`); return; }
  console.log([`Renewals due within 30 days (${u.T}; monthly payments within 7):`, ...u.renewals.map((r) => `- ${renewalText(r)}`)].join('\n'));
}

function fail(msg) { console.error(`Not logged: ${msg}`); process.exit(1); }

function bought(args) {
  const VALUE = new Set(['--amount', '--currency', '--date', '--note']), FLAG = new Set(['--refund', '--charge']);
  const opt = {}, pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((VALUE.has(a) || FLAG.has(a)) && a.slice(2) in opt) fail(`${a} is given twice`);
    if (VALUE.has(a)) { if (i + 1 >= args.length) fail(`${a} needs a value`); opt[a.slice(2)] = args[++i]; }
    else if (FLAG.has(a)) opt[a.slice(2)] = true;
    else if (a.startsWith('--')) fail(`unknown option ${a} (allowed: --amount, --currency, --date, --note, --charge, --refund)`);
    else pos.push(a);
  }
  const usage = 'usage: node upgrades.js bought <id> --amount N [--currency USD] [--date YYYY-MM-DD] [--note "..."] [--charge | --refund]';
  if (pos.length !== 1) fail(pos.length ? `one rung id only (got ${pos.join(' ')}). ${usage}` : usage);
  const id = pos[0];
  const config = readJSON('config.json'), st = config.settings || {};
  let ladder;
  try { ladder = loadLadder(); } catch (e) { fail(e.message); }
  const r = ladder.rungs.find((x) => x.id === id);
  if (!r) fail(ladder.reminders.some((m) => m.id === id) ? `${id} is a reminder, not a purchase` : `unknown rung "${id}". Rungs: ${ladder.rungs.map((x) => x.id).join(', ')}`);
  if (opt.refund && opt.charge) fail('use --refund or --charge, not both');
  // amount: plain number, at most 2 decimals, never zero; negative only for a refund
  if (opt.amount === undefined) fail(`--amount is required: what was actually paid. ${usage}`);
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(opt.amount).trim())) fail(`--amount must be a plain number with at most 2 decimals, like 115 or 95.50 (got "${opt.amount}"; no currency signs or commas)`);
  const amount = round2(Number(opt.amount));
  if (amount === 0) fail('--amount cannot be 0');
  if (amount < 0 && !opt.refund) fail('a negative amount is a refund: add --refund (and make sure the money really came back)');
  if (amount > 0 && opt.refund) fail('a refund is a negative amount, for example --amount -95 --refund');
  // currency: three letters, with a rate to USD
  const currency = String(opt.currency || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail(`--currency must be a 3-letter code like USD or PHP (got "${opt.currency}")`);
  const rate = currency === 'USD' ? 1 : Number((st.fxToUSD || {})[currency]);
  if (!(rate > 0)) fail(`there is no rate for ${currency} in settings.fxToUSD, so it can't be counted in USD. Add the rate, or log the USD amount the card or PayPal showed`);
  const amountUSD = round2(amount * rate);
  // date: a real day, not in the future, not more than 400 days back
  const T = today(), date = opt.date === undefined ? T : String(opt.date).trim();
  if (!isDate(date)) fail(`--date must be a real YYYY-MM-DD date (got "${opt.date}")`);
  if (date > T) fail(`--date ${date} is in the future; log a payment once it has been made`);
  if (daysBetween(date, T) > 400) fail(`--date ${date} is more than 400 days ago; check the date`);
  // note: short, and never a card, account or reference number (spend.jsonl is committed to git)
  const note = opt.note === undefined ? undefined : String(opt.note).trim();
  if (note !== undefined) {
    if (note.length > 200) fail('--note is longer than 200 characters');
    if (/\d{8,}/.test(note.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').replace(/[\s-]/g, ''))) fail('--note contains a long number (card, account or order number?). Leave it out: data/spend.jsonl is committed to git');
    if (/password|passcode|api[ _-]?key|secret|token|cvv|\bpin\b/i.test(note)) fail('--note looks like it mentions a password, key or code. Leave it out: data/spend.jsonl is committed to git');
  }
  // the amount against the planned price: a clear typo is refused, an unusual amount is logged with a warning
  const cost = costOf(r, st);
  if (Math.abs(amountUSD) > cost * 10) fail(`${usd(Math.abs(amountUSD))} is more than 10 times the planned ${usd(cost)}${per(r)} for ${id}; check the amount`);
  const warn = [];
  if (!opt.refund && !opt.charge && (amountUSD < cost * 0.5 || amountUSD > cost * 2)) warn.push(`${usd(amountUSD)} is far from the planned about ${usd(cost)}${per(r)}; logged as given, so check it is the full amount paid`);
  // what kind of payment it is, from what is already logged for this rung (catches double logs and retries)
  const spend = readSpend();
  if (spend.error) fail(`${spend.error}; fix it by hand first`);
  const L = ledgerFor(r, spend.entries.filter((e) => e.date <= date));
  const later = spend.entries.find((e) => e.id === id && e.date > date && ['purchase', 'renewal'].includes(e.kind));
  if (!opt.refund && !opt.charge && later) fail(`a ${later.kind} of ${id} dated ${later.date} is already logged, after ${date}. If that is this same payment, nothing to do; otherwise log payments in date order (ask the owner which dates are right)`);
  let kind;
  if (opt.refund) {
    if (!(L.net > 0.005)) fail(`nothing paid for ${id} is logged on or before ${date}, so there is nothing to refund`);
    if (-amountUSD > L.net + 0.005) fail(`the refund (${usd(-amountUSD)}) is more than the ${usd(L.net)} logged for ${id}`);
    kind = 'refund';
  } else if (opt.charge) {
    if (!L.bought) fail(`${id} is not logged as bought, so this is the purchase: run it again without --charge`);
    kind = 'charge';
  } else if (!L.bought) kind = 'purchase';
  else if (!r.recurring) fail(`${id} is a one-time purchase and was already logged as bought on ${L.start}. If it was logged twice, nothing to do. If it really was charged again, add --charge; money back is --amount -N --refund`);
  else {
    const opens = addDays(L.through, -RENEW_WINDOW[r.recurring]);
    if (date < opens) fail(`${id} is already logged as bought (${L.start}) and paid through ${L.through}. A renewal can be logged from ${opens}. If this is the same purchase logged twice, nothing to do. A monthly bill or a real second charge: add --charge`);
    kind = 'renewal';
  }
  const dup = spend.entries.find((e) => e.id === id && e.date === date && e.kind === kind && round2(e.amount) === amount && e.currency === currency && (e.note || '') === (note || ''));
  if (dup) fail(`the same ${kind} (${id}, ${amount} ${currency}, ${date}) is already logged. If it really was charged twice the same day, log the second one with a --note saying so`);
  // was it on the ladder's terms? The money was spent either way, so it is logged; the note says what the ladder said.
  let before;
  try { before = evaluate({ config }); } catch (e) { before = null; }
  const was = before && !before.error && before.rungs.find((x) => x.id === id);
  if (kind === 'purchase' && was && was.status !== 'ready') warn.push(`the ladder had ${id} as "${was.status === 'blocked' ? 'funded but blocked' : 'not yet'}" (${[...was.seq, ...(was.funded ? [] : [was.money]), ...was.reasons].join('; ')}). Logged anyway, because the money was spent`);
  const entry = { date, id, kind, amount, currency, amountUSD, recurring: r.recurring, note, logged: new Date().toISOString() };
  appendJSONL(SPEND, entry);
  // confirm the write first: anything that fails after this must never hide that the line was logged
  console.log(`Logged in ${SPEND}: ${id} ${kind}, ${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${currency}${currency === 'USD' ? '' : ` (${usd(amountUSD)})`} on ${date}.`);
  for (const w of warn) console.log(`Note: ${w}.`);
  let after;
  try { after = evaluate({ config }); } catch (e) { after = { error: e.message }; }
  if (after.error) { console.log(`Check: the payment is logged, but the ladder can't be shown right now (${after.error}). Do not log it again; run node upgrades.js status once that is fixed.`); return; }
  const now = after.rungs.find((x) => x.id === id);
  if (now && now.renewal) console.log(`${r.recurring === 'yearly' ? 'Renews' : 'Next payment'} ${now.renewal.date}.`);
  if (now && now.status !== 'bought' && kind === 'refund') console.log(`${id} is no longer counted as bought (fully refunded).`);
  console.log(`Money available now: ${usd(after.available)}.`);
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (!cmd || cmd === 'status') printStatus();
    else if (cmd === 'renewals') printRenewals();
    else if (cmd === 'bought') bought(rest);
    else { console.error('usage: node upgrades.js [status] | renewals | bought <id> --amount N [--currency USD] [--date YYYY-MM-DD] [--note "..."] [--charge | --refund]'); process.exit(1); }
  } catch (e) { console.error(`upgrades.js: ${e.message}`); process.exit(1); }
}

module.exports = { evaluate, forInsights, loadLadder, ledgerFor, cashSeries };
