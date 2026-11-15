#!/usr/bin/env node
// Turns logged outcomes into decisions, and keeps the pipeline improving on its own:
//   - money: collected, care plans, yearly pace toward settings.goalUSDPerYear, and what the goal takes
//   - experiments (price, subject, call to action): retires clear losers, raises the price ceiling when the
//     highest price is winning, and says when a copy test needs a new challenger
//   - targeting: which business types and markets answer, for the prospect bank
//   - send volume (data/send-state.json): reaches more businesses only while bounces, STOPs and complaints
//     stay low, and cuts back for a week at the first bad signal
//   - client growth: care plan, Local Growth, yearly prepay and referral asks that are due
// Writes playbook/insights.md, which every daily run reads first.
// Usage: node learn.js [--dry]   (--dry: write insights.md only; change no experiment or send settings)
//        node learn.js --links <slug>   read-only: prints that prospect's exact payment amounts and PayPal.me links
//        (deposit, final, care monthly and yearly, the next care payment, any refund owed after a cancel) in their
//        market's currency, plus the care-log details. Writes nothing. Drafts copy these instead of working them out.
const fs = require('fs');
const { P, readJSON, writeJSON, readJSONL, readCSV, today, addDays, careFor, daysBetween, experimentStats, probBest, priceArmValue, careValueUSD } = require('./lib');

const DRY = process.argv.includes('--dry');
const config = readJSON('config.json');
const st = config.settings;
const ev = readJSONL('data/outcomes.jsonl');
const mistakes = readJSONL('data/mistakes.jsonl');
const experiments = readJSON('playbook/experiments.json', {});
const experimentsAtStart = JSON.stringify(experiments);
const leads = readCSV('leads.csv').rows;
const T = today();
const changes = [];

const pitched = ev.filter((e) => e.event === 'pitched');
const by = (slug) => ev.filter((e) => e.slug === slug);
const POS = ['interested', 'won', 'deposit', 'paid'];
const WON = ['won', 'deposit', 'paid'];
const outcomeOf = (slug) => {
  const es = by(slug).map((e) => e.event);
  return { reply: es.some((x) => ['replied', 'interested', 'declined', 'stop', 'won', 'deposit', 'paid'].includes(x)), positive: es.some((x) => POS.includes(x)), stop: es.includes('stop') || es.includes('complaint'), won: es.some((x) => WON.includes(x)), bounced: es.includes('bounced') };
};
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
function table(groupFn, title) {
  const g = {};
  for (const e of pitched) { const k = groupFn(e) || 'unknown'; (g[k] = g[k] || []).push(e.slug); }
  const rows = Object.entries(g).map(([k, slugs]) => {
    const o = slugs.map(outcomeOf);
    return `| ${k} | ${slugs.length} | ${pct(o.filter((x) => x.reply).length, slugs.length)} | ${pct(o.filter((x) => x.positive).length, slugs.length)} | ${o.filter((x) => x.won).length} | ${o.filter((x) => x.stop).length} |`;
  });
  return [`### ${title}`, '', '| Group | Sent | Replied | Positive | Won | STOP |', '| --- | --- | --- | --- | --- | --- |', ...(rows.length ? rows : ['| (no sends yet) | 0 | – | – | 0 | 0 |']), ''];
}

const lines = [`# Insights (updated ${T})`, '', 'Read this before every run. It is rebuilt from data/outcomes.jsonl by `node learn.js`, which also tunes prices, copy tests and sending volume.', ''];

// ---------------------------------------------------------------- money
const mkt = (m) => config.markets[m] || config.markets.US;
const curOf = (e) => e.currency || mkt(e.market).currency || 'USD';
// A currency with no rate in settings.fxToUSD is "no rate": left out of USD totals and reported, never counted as 0.
const noRate = new Set();
const rateUSD = (cur) => (cur === 'USD' ? 1 : Number((st.fxToUSD || {})[cur]));
const usdOf = (n, cur) => { const r = rateUSD(cur); if (!(r > 0)) { noRate.add(cur); return 0; } return n * r; };
const inCur = (n, from, to) => { if (from === to) return n; const a = rateUSD(from), b = rateUSD(to); return a > 0 && b > 0 ? (n * a) / b : NaN; }; // NaN = no rate
const fx = (e) => usdOf(Number(e.amount) || 0, curOf(e));
const cash = ev.filter((e) => ['deposit', 'paid', 'carepaid', 'upsell'].includes(e.event) && e.amount);
const collected = cash.reduce((a, e) => a + fx(e), 0);
const builds90 = cash.filter((e) => e.event !== 'carepaid' && daysBetween(e.date, T) <= 90).reduce((a, e) => a + fx(e), 0);
const care = {}; // latest signed plan per client (used by "Grow existing clients"; money uses the ledger below)
for (const e of ev) { if (e.event === 'care') care[e.slug] = e; if (e.event === 'carecancel') delete care[e.slug]; }

// ---------------------------------------------------------------- STOP is permanent
// Any stop, complaint or forget event, a do-not-contact status on the prospect, or a row in data/do-not-contact.csv
// (matched by business name or email) means no payment link, care reminder or growth ask for that business, ever,
// even if a care event is logged after it. A false match only withholds a link; the owner can still act by hand.
const prospectBySlug = Object.fromEntries(readJSON('data/prospects.json', []).map((p) => [p.slug, p]));
const lc = (s) => String(s || '').trim().toLowerCase();
const dnc = readCSV('data/do-not-contact.csv').rows; // no file: no rows
const dncNames = new Set(dnc.map((r) => lc(r.business)).filter(Boolean)), dncEmails = new Set(dnc.map((r) => lc(r.email)).filter(Boolean));
const stopSlugs = new Set(ev.filter((e) => ['stop', 'complaint', 'forget'].includes(e.event)).map((e) => e.slug));
const isStopped = (slug) => { const p = prospectBySlug[slug] || {}; return stopSlugs.has(slug) || p.status === 'do-not-contact' || !!p.forgotten || dncNames.has(lc(p.name)) || dncEmails.has(lc(p.email)); };

// ---------------------------------------------------------------- care plans: paid up, pending, overdue
// How log.js stores them in data/outcomes.jsonl:
//   care      {amount: the MONTHLY price, currency, plan: 'basic'|'growth', annual: true or absent}
//   carepaid  {amount: one payment as received (a month, or the yearly total; negative = a refund the owner sent), currency}
//   carecancel (no amount) ends the plan. A stopped business (above) has no ledger: no reminders, left out of revenue.
// A plan counts toward monthly revenue only while logged payments cover today, plus CARE_GRACE days.
// Payments are applied in date order. Each full period's price (the monthly price, or monthly x annualMonths for a
// yearly plan) adds one period: from the end of the paid time when it came on time or early, from the payment date
// when it came after the due date (so next due = last payment + 1 month, or + 12 months, in the usual case).
// Less than a period's price is kept as credit (partial payment); more adds more periods (prepaid, or a double log).
// Within CARE_SLACK (10%) of the price counts as paid in full, so a payment logged after PayPal fees, or converted
// from another currency at the config rate, never asks the client for a few cents or dollars more.
// The yearly price paid on a monthly plan counts as 12 months (the yearly offer, never 10, so nobody is billed early)
// and stays under the checks, with no time limit, until the plan is logged again (with --annual if they chose yearly).
// A yearly plan counts as monthly price x annualMonths / 12 a month (2 months free), not x 12.
// A reminder link is only ever the plan's full period price, in the market's currency, at a price their offer allows,
// after launch and once the first payment is logged. Anything else (not launched, first payment not logged, part paid,
// refunds, wrong amount or currency) shows "Link: none (...)" and is listed under the checks.
const CARE_GRACE = 7, CARE_SOON = 3, CARE_CHECK_DAYS = 60, CARE_SLACK = 0.1;
const addMonths = (d, n) => { const [y, m, day] = d.split('-').map(Number); const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, m - 1 + n, Math.min(day, last))).toISOString().slice(0, 10); };
const fullMonths = (from, to) => { let n = 0; while (addMonths(from, n + 1) <= to) n++; return n; };
const round2 = (n) => Math.round(n * 100) / 100;
const amt = (n) => { const r = round2(n); return Number.isInteger(r) ? String(r) : r.toFixed(2); };
// Client-facing amount: the market's symbol, plus the code where that market shows it ($39, $39 AUD, £45).
const fmt = (n, market, cur) => { const m = mkt(market); cur = cur || m.currency; return cur === m.currency ? `${m.symbol || ''}${amt(n)}${m.showCode ? ` ${cur}` : ''}` : `${amt(n)} ${cur}`; };
// Payment links: only the owner's PayPal.me link (config.json payments.paypalMeLink) with an exact amount and currency.
const payLinkRaw = ((config.payments || {}).paypalMeLink || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
const payLink = /^(www\.)?paypal\.me\/[\w.-]+$/i.test(payLinkRaw) ? payLinkRaw : '';
const linkFor = (n, cur) => (!payLinkRaw ? 'none (payments.paypalMeLink is not set; the owner sends a PayPal invoice)'
  : !payLink ? 'none (payments.paypalMeLink is not a paypal.me link; ask the owner)'
    : !(n > 0) || !/^[A-Z]{3}$/.test(cur || '') ? 'none (no valid amount or currency; ask the owner)'
      : `${payLink}/${amt(n)}${cur}`);
const careLink = (c) => (!c.launch ? 'none (not launched yet)'
  : c.status === 'pending' && !(c.credit > 0.005) ? "none (check Marjorie's PayPal first; log carepaid if paid)"
    : c.checks ? 'none (see the care log checks)' // any open check: a payment may be missing from the log
    : !c.linkOk ? 'none (check the plan amount first)'
      : Math.abs(c.credit) > 0.005 ? 'none (part paid or refunded: ask the owner)'
        : linkFor(c.periodPrice, c.cur));
// Prices a client can be on: Basic = today's tier, the older careQuote (pitches before 2026-11-15) or the price their
// offer quoted; Local Growth = the growth tier. A logged plan at any other price gets no payment link until checked.
const carePrices = (slug, plan, market) => {
  const m = mkt(market), t = m.careTiers || {}, o = (prospectBySlug[slug] || {}).offer || {};
  return [...new Set((plan === 'growth' ? [t.growth] : [t.basic, m.careQuote, o.care]).filter((x) => x > 0))];
};
const careEvents = {};
for (const e of ev) if (['care', 'carepaid', 'carecancel', 'paid'].includes(e.event)) (careEvents[e.slug] = careEvents[e.slug] || []).push(e);
const carePlans = [], careChecks = [], careLedger = {};
for (const [slug, list] of Object.entries(careEvents)) {
  if (!list.some((e) => ['care', 'carepaid'].includes(e.event))) continue;
  if (isStopped(slug)) { careChecks.push({ slug, tags: ['stopped'] }); continue; } // STOP is permanent: no ledger, no link, no revenue
  const es = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // stable: same-day events keep log order
  const issues = [], flag = (tag, text) => issues.push({ tag, text });
  const recent = (e) => daysBetween(e.date, T) <= CARE_CHECK_DAYS;
  const through = (c) => (c && c.anchor ? addMonths(c.anchor, c.periods * c.len) : null);
  let c = null, held = [], cancelled = null, everCancelled = false;
  const apply = (p) => {
    let a = Number(p.amount);
    const pc = curOf(p);
    if (!Number.isFinite(a) || a === 0) { if (recent(p)) flag('ledger', `the payment logged ${p.date} has no amount, so it is not counted (log it again with --amount)`); return; }
    if (pc !== c.cur) {
      const conv = inCur(a, pc, c.cur);
      // not counted means the client could be asked to pay again, so this check has no time limit
      if (!Number.isFinite(conv)) { flag('ledger', `the ${p.date} payment of ${amt(a)} ${pc} is not counted: the plan is in ${c.cur} and settings.fxToUSD has no rate for ${[pc, c.cur].filter((x) => !(rateUSD(x) > 0)).join(' and ')} (no rate). Add the rate, or ask the owner what arrived`); return; }
      if (recent(p)) flag('ledger', `the ${p.date} payment was logged in ${pc} but the plan is in ${c.cur}; counted as about ${amt(conv)} ${c.cur} at the config rate`);
      a = conv;
    }
    if (recent(p) && c.payments.some((x) => x.date === p.date && x.amount === p.amount)) flag('ledger', `two payments of ${amt(p.amount)} ${pc} are logged on ${p.date}. If it was logged twice by mistake the plan shows paid further ahead than it is; ask the owner`);
    if (recent(p) && a < 0) flag('ledger', `a refund of ${amt(-a)} ${c.cur} is logged on ${p.date}; the paid time was shortened to match`);
    c.payments.push({ date: p.date, amount: p.amount });
    const yearly = c.monthly * c.annualMonths;
    if (!c.annual && c.monthly > 0 && Math.abs(a - yearly) <= Math.min(yearly * CARE_SLACK, c.monthly / 2)) {
      c.yearlyOnMonthly.push(p.date); // the yearly offer on a monthly plan: 12 months, not annualMonths
      const t = through(c);
      if (t && p.date <= t) c.periods += 12; else { c.anchor = p.date; c.periods = 12; }
      return;
    }
    c.credit = round2(c.credit + a);
    if (!(c.periodPrice > 0)) return;
    if (c.credit >= c.periodPrice * (1 - CARE_SLACK) - 0.005) {
      const n = Math.max(1, Math.floor((c.credit + c.periodPrice * CARE_SLACK + 0.005) / c.periodPrice));
      c.credit = round2(c.credit - n * c.periodPrice);
      if (Math.abs(c.credit) <= c.periodPrice * CARE_SLACK) c.credit = 0; // PayPal fees or exchange rounding: never billed to the client
      const t = through(c);
      if (t && p.date <= t) c.periods += n; else { c.anchor = p.date; c.periods = n; }
    }
    while (c.credit < -0.005 && c.periods > 0) { c.periods--; c.credit = round2(c.credit + c.periodPrice); }
  };
  for (const e of es) {
    if (e.event === 'care') {
      const prev = c, monthly = Number(e.amount), cur = curOf(e), annualMonths = (mkt(e.market).careTiers || {}).annualMonths || 10;
      let credit = 0; // a plan change keeps the time already paid, and any credit
      if (prev && prev.credit) {
        const k = inCur(prev.credit, prev.cur, cur);
        if (Number.isFinite(k)) credit = round2(k);
        else flag('ledger', `the plan changed from ${prev.cur} to ${cur} on ${e.date} and settings.fxToUSD has no rate, so ${amt(prev.credit)} ${prev.cur} of credit is not carried over (no rate)`);
      }
      c = { slug, ev: e, plan: e.plan === 'growth' ? 'growth' : 'basic', annual: !!e.annual, market: e.market || 'US', cur, monthly, annualMonths,
        len: e.annual ? 12 : 1, periodPrice: e.annual ? monthly * annualMonths : monthly, anchor: through(prev), periods: 0, payments: prev ? prev.payments : [], since: prev ? prev.since : e.date,
        credit, yearlyOnMonthly: [] }; // logging the plan again settles the yearly-on-monthly check
      cancelled = null;
      for (const p of held) apply(p);
      held = [];
    } else if (e.event === 'carepaid') {
      if (c) apply(e);
      else if (cancelled && Number(e.amount) < 0) cancelled.refunds.push(e); // the owner's refund after a cancel
      else held.push(e);
    } else if (e.event === 'carecancel') {
      if (c) cancelled = { date: e.date, plan: c, paidThrough: through(c), refunds: [] };
      c = null; held = []; everCancelled = true;
    }
  }
  if (held.length && (!everCancelled || held.some(recent))) flag('ledger', `${held.length} care payment(s) logged (${held.map((p) => `${p.date}: ${amt(p.amount || 0)} ${curOf(p)}`).join(', ')}) with no ${everCancelled ? 'open ' : ''}care plan, so they are not counted. Log the plan: \`node log.js ${slug} care --amount <monthly price> --plan basic|growth [--annual]\``);
  if (c) {
    const prices = carePrices(slug, c.plan, c.market), marketCur = mkt(c.market).currency;
    c.linkOk = c.monthly > 0 && prices.includes(c.monthly) && c.cur === marketCur;
    if (!(c.monthly > 0)) flag('price', `the care plan has no valid amount. Log it again: \`node log.js ${slug} care --amount <monthly price> --plan ${c.plan}${c.annual ? ' --annual' : ''}\``);
    else if (!c.linkOk) flag('price', `the plan is logged at ${amt(c.monthly)} ${c.cur} a month, but ${c.plan === 'growth' ? 'Local Growth' : 'Basic'} in ${c.market} is ${prices.map((x) => `${amt(x)} ${marketCur}`).join(' or ')} a month (\`care --amount\` is the monthly price, also for a yearly plan). Check what they agreed and log the plan again with the right monthly price; no payment link until then`);
    if (c.yearlyOnMonthly.length) flag('ledger', `the payment(s) on ${c.yearlyOnMonthly.join(', ')} equal the yearly price on a monthly plan, so each is counted as 12 months (the yearly offer, so they are never billed early). If they chose yearly, log the plan again: \`node log.js ${slug} care --amount ${amt(c.monthly)} --plan ${c.plan} --annual\`; if not, ask the owner and log the plan again once settled. This check stays until then`);
    const launch = es.filter((e) => e.event === 'paid').map((e) => e.date).pop();
    c.paidThrough = through(c);
    c.launch = launch || null;
    c.due = c.paidThrough || (launch && launch > c.since ? launch : c.since); // first payment: at launch, or now if signed after launch
    const late = daysBetween(c.due, T);
    c.status = !(c.monthly > 0) ? 'check' : !c.paidThrough ? 'pending' : late <= 0 ? 'paid' : late <= CARE_GRACE ? 'grace' : 'lapsed';
    c.amountDue = round2(c.periodPrice - c.credit);
    c.monthlyUSD = c.monthly > 0 ? usdOf(c.monthly * (c.annual ? c.annualMonths / 12 : 1), c.cur) : 0;
    if (!c.launch) flag('nolaunch', 'no launch (`paid`) is logged, so no care reminder until the site is live');
    if (Math.abs(c.credit) > 0.005 && c.status !== 'check') flag('ledger', c.credit > 0 ? `${fmt(c.credit, c.market, c.cur)} of the next ${fmt(c.periodPrice, c.market, c.cur)} is logged (part paid), so no automatic link; the owner decides how to collect the rest` : `the refunds logged are ${fmt(-c.credit, c.market, c.cur)} more than the paid time covered, so no automatic link; ask the owner`);
    else if (c.launch && c.status === 'pending') flag('pending', `the plan is logged but no care payment is, so no reminder: check Marjorie's PayPal first, and if it came in, log \`node log.js ${slug} carepaid --amount <amount received> --currency ${c.cur}\``);
    c.checks = issues.filter((i) => !['nolaunch', 'pending'].includes(i.tag)).length;
    carePlans.push(c);
  }
  careLedger[slug] = { plan: c, cancelled, issues };
  if (issues.length) careChecks.push({ slug, tags: [...new Set(issues.map((i) => i.tag))] });
}

// ---------------------------------------------------------------- node learn.js --links <slug>: read-only, prints and exits
// The only source of payment amounts and links for drafts. Nothing here is written to a file (insights.md is in git).
const linksAt = process.argv.indexOf('--links');
if (linksAt > -1) {
  const slug = process.argv[linksAt + 1], p = prospectBySlug[slug];
  if (!slug || slug.startsWith('--')) { console.error('usage: node learn.js --links <slug>'); process.exit(1); }
  if (!p) { console.error(`unknown slug ${slug}: not in data/prospects.json`); process.exit(1); }
  if (isStopped(slug)) { console.log(`${slug}: skip: stopped. No payment link, reminder or offer for this business, ever. If they had paid ahead for care, ask the owner about a refund.`); process.exit(0); }
  const m = config.markets[p.market], cur = (m || {}).currency;
  if (!m || !/^[A-Z]{3}$/.test(cur || '')) { console.log(`${slug}: market "${p.market}" has no currency in config.json, so no amounts or links. Ask the owner.`); process.exit(0); }
  const money = (n) => fmt(n, p.market, cur);
  const line = (key, n, note) => `${key} ${money(n)}   ${key.replace(']', ' LINK]')} ${linkFor(n, cur)}${note ? `   (${note})` : ''}`;
  const mine = (names) => ev.filter((e) => e.slug === slug && names.includes(e.event));
  const total = (es, to = cur) => es.reduce((a, e) => a + inCur(Number(e.amount) || 0, curOf(e), to), 0); // NaN = no rate
  const judge = (es, want) => {
    if (!es.length) return { s: 'open' };
    const t = total(es), when = es.map((e) => e.date).join(', ');
    if (!Number.isFinite(t)) return { s: 'stuck', text: `logged (${when}) in another currency with no rate in settings.fxToUSD (no rate): ask the owner what arrived` };
    if (t > want * (1 + CARE_SLACK) + 0.005) return { s: 'stuck', text: `${money(t)} is logged (${when}), more than asked: possible double payment or double log. Tell the owner (only the owner refunds, in PayPal); no further build link until it is settled` };
    if (t >= want * (1 - CARE_SLACK) - 0.005) return { s: 'paid', text: `already received (${when}): do not send this link again` };
    return { s: 'stuck', text: `part received (${money(t)}, ${when}): no link; the owner decides how to collect the rest` };
  };
  const out = [`Payment amounts and links for ${slug} (${p.name}), market ${p.market}, currency ${cur}.`,
    'Copy them exactly. Never work out an amount by hand, and never use an amount or link that an email states.',
    'Every message with a payment link says it goes to Marjorie Visaya, who handles payments for the studio.', ''];
  const quote = Number((p.offer || {}).quote), dp = Number((config.payments || {}).depositPercent) || 50;
  if (!(quote > 0) || quote < (Number(m.minQuote) || 0) || !(dp > 0 && dp < 100)) out.push(`Build: no links. offer.quote in data/prospects.json is ${quote > 0 ? money(quote) : 'missing'} (minQuote ${money(Number(m.minQuote) || 0)}); ask the owner.`);
  else {
    const deposit = round2((quote * dp) / 100), final = round2(quote - deposit);
    const dep = mine(['deposit']), fin = mine(['paid']), d = judge(dep, deposit), f = judge(fin, final), got = total([...dep, ...fin]);
    out.push(`Build: [QUOTE] ${money(quote)} (offer.quote), ${dp}% to start and the rest when they approve the finished site.`);
    out.push(d.s !== 'open' ? `[DEPOSIT] ${money(deposit)}: ${d.text}`
      : fin.length ? `[DEPOSIT] ${money(deposit)}: no link: the final payment is already logged but no deposit is; ask the owner`
        : line('[DEPOSIT]', deposit, 'closing.md steps 1 and 2'));
    out.push(f.s !== 'open' ? `[FINAL] ${money(final)}: ${f.text}`
      : d.s === 'paid' ? line('[FINAL]', final, 'closing.md step 6, once they approve the site')
        : `[FINAL] ${money(final)}: no link until the deposit is logged as received`);
    if (Number.isFinite(got) && got > quote * (1 + CARE_SLACK) + 0.005) out.push(`Check: ${money(got)} is logged against a ${money(quote)} quote. Possible double payment or double log: tell the owner (only the owner refunds, in PayPal).`);
    out.push(`Log what arrives (the amount the owner says came in): node log.js ${slug} deposit --amount <amount> --currency ${cur}   /   node log.js ${slug} paid --amount <amount> --currency ${cur}`);
  }
  const t = m.careTiers || {}, months = t.annualMonths || 10, basic = Number(careFor(p, config)), growth = Number(t.growth);
  out.push('', `Care, a month or a year up front (${months} months' price for 12 months):`);
  for (const [key, n, what] of [['[CARE]', basic, 'Basic, a month'], ['[CARE YEAR]', basic * months, 'Basic, 12 months'], ['[GROWTH]', growth, 'Local Growth, a month'], ['[GROWTH YEAR]', growth * months, 'Local Growth, 12 months']]) out.push(n > 0 ? line(key, n, what) : `${key}: no price in config.json; ask the owner`);
  const L = careLedger[slug] || {}, c = L.plan;
  if (c) {
    const name = c.plan === 'growth' ? 'Local Growth' : 'Basic', cm = (n) => fmt(n, c.market, c.cur);
    out.push('', `Care plan on file: ${name}, ${c.annual ? `yearly at ${cm(c.periodPrice)} for 12 months` : `monthly at ${cm(c.monthly)}`}, since ${c.since}; ${c.paidThrough ? `paid through ${c.paidThrough}` : 'no payment counted yet'}${c.launch ? `; launched ${c.launch}` : '; no launch logged'}.`);
    const dueLink = careLink(c);
    out.push(`[CARE DUE] ${cm(c.periodPrice)}, due ${c.due}, [PERIOD] ${c.due} to ${addMonths(c.due, c.len)}   [CARE DUE LINK] ${dueLink}`);
    if (c.annual) out.push('They already pay yearly: leave the yearly line out of the reminder.');
    else if (dueLink.startsWith('none')) out.push('[PLAN YEAR]: no link while the care payment above has none.');
    else out.push(line('[PLAN YEAR]', c.monthly * c.annualMonths, `${name}, switch to yearly: 12 months for ${c.annualMonths} months' price`));
    out.push(`When a care payment arrives: node log.js ${slug} carepaid --amount <amount received> --currency ${c.cur}`);
  } else out.push('', 'Care plan on file: none. When they choose one, log it with its first payment: node log.js ' + slug + ' care --amount <monthly price> --plan basic|growth [--annual], then carepaid.');
  if (L.cancelled) {
    const k = L.cancelled, pc = k.plan, cm = (n) => fmt(n, pc.market, pc.cur), rate = pc.periodPrice / pc.len;
    const n = k.paidThrough && k.paidThrough > k.date ? fullMonths(k.date, k.paidThrough) : 0;
    const owed = round2(n * rate + Math.max(0, pc.credit)), sent = round2(-total(k.refunds, pc.cur)), left = round2(owed - (Number.isFinite(sent) ? sent : 0));
    out.push('', `Care plan cancelled ${k.date} (${pc.plan === 'growth' ? 'Local Growth' : 'Basic'}, ${pc.annual ? 'yearly' : 'monthly'}). ${k.paidThrough ? `Paid through ${k.paidThrough}: ${n} full month(s) unused at the cancel date.` : 'Nothing was paid for it.'}`);
    out.push(left > 0.005 ? `[REFUND] ${cm(left)} owed (${n} x ${cm(rate)}${pc.credit > 0.005 ? ` + ${cm(pc.credit)} part payment` : ''}${sent > 0 ? `, less ${cm(sent)} already refunded` : ''}). Only the owner sends refunds, in PayPal. Once sent: node log.js ${slug} carepaid --amount -<amount refunded> --currency ${pc.cur}`
      : `[REFUND] none owed${sent > 0 ? ` (${cm(sent)} already refunded)` : ''}.`);
  }
  if (L.issues && L.issues.length) out.push('', 'Care log checks (shown here only; insights.md lists the slug with a short reason):', ...L.issues.map((i) => `- ${i.text}`));
  console.log(out.join('\n'));
  process.exit(0);
}
const activeCare = carePlans.filter((c) => ['paid', 'grace'].includes(c.status)); // paid up (or within the grace days)
const pendingCare = carePlans.filter((c) => c.status === 'pending');
const lapsedCare = carePlans.filter((c) => c.status === 'lapsed');
const sumUSD = (cs) => cs.reduce((a, c) => a + c.monthlyUSD, 0);
const mrr = sumUSD(activeCare);
const runRate = mrr * 12 + builds90 * 4;
const goal = st.goalUSDPerYear || 200000;
const goalBy = st.goalBy || '2028-12-31';
const monthsLeft = Math.max(1, Math.round(daysBetween(T, goalBy) / 30.4));
// averages, measured once there are clients, otherwise from today's price arms
const wonSlugs = [...new Set(ev.filter((e) => WON.includes(e.event)).map((e) => e.slug))];
const buildBySlug = {};
for (const e of cash) if (['deposit', 'paid'].includes(e.event)) buildBySlug[e.slug] = (buildBySlug[e.slug] || 0) + fx(e);
const paidBuilds = Object.values(buildBySlug);
const liveArms = (experiments.price ? experiments.price.arms.filter((a) => !a.retired) : [{ multiplier: 1 }]);
const defaultBuild = config.markets.US.tiers.standard * (liveArms.reduce((a, x) => a + x.multiplier, 0) / liveArms.length);
const avgBuild = paidBuilds.length >= 3 ? paidBuilds.reduce((a, b) => a + b, 0) / paidBuilds.length : defaultBuild;
const avgCare = activeCare.length >= 3 ? mrr / activeCare.length : (config.markets.US.careTiers.basic * 0.75 + config.markets.US.careTiers.growth * 0.25);
const careNeeded = Math.ceil((0.6 * goal) / 12 / avgCare);
const buildsNeeded = Math.ceil((0.4 * goal) / 12 / avgBuild);

lines.push('## Money', '');
lines.push(`- Collected so far: ${cash.length ? `${usd(collected)} USD from ${cash.length} payment(s)` : 'nothing yet'}`);
if (noRate.size) lines.push(`- **No rate** for ${[...noRate].join(', ')} in settings.fxToUSD: money in ${noRate.size === 1 ? 'that currency is' : 'those currencies is'} left out of every USD total here (not counted as 0 by mistake). Ask the owner to add the rate to config.json.`);
lines.push(`- Care plans: ${activeCare.length} active (${activeCare.filter((e) => e.plan === 'growth').length} Local Growth), ${usd(mrr)}/month`);
if (pendingCare.length) lines.push(`- Signed, first payment pending: ${pendingCare.length} plan(s), ${usd(sumUSD(pendingCare))}/month once paid (not counted above or in the pace)`);
if (lapsedCare.length) lines.push(`- Overdue past the ${CARE_GRACE}-day grace: ${lapsedCare.length} plan(s), ${usd(sumUSD(lapsedCare))}/month (not counted until paid; see Care payments due)`);
lines.push(`- Yearly pace: **${usd(runRate)}** of the ${usd(goal)} goal (${pct(runRate, goal)}), ${monthsLeft} months left to ${goalBy}. Pace = care plans x 12 + last 90 days of build and extra-work revenue x 4.`);
lines.push(`- What the goal takes (60% from care plans, 40% from builds): about **${careNeeded} paying care clients** at ${usd(avgCare)}/month plus **${buildsNeeded} new builds a month** at ${usd(avgBuild)}${paidBuilds.length >= 3 ? ' (measured)' : ' (estimate from the live price arms)'}.`);
// Paid upgrades (own domain + business email) wait until sales have paid for them (owner's rule, 2026-11-15).
const upgradeCost = st.upgradeCostUSD || 115;
const clients = new Set(cash.filter((e) => ['deposit', 'paid'].includes(e.event)).map((e) => e.slug)).size;
const domainLive = /^https:\/\/(?!.*netlify\.app)/.test(config.netlify.baseUrl || '');
if (!domainLive) lines.push(collected >= upgradeCost
  ? `- **Paid upgrades are funded:** ${usd(collected)} collected from ${clients} client(s) covers the domain and business email (about ${usd(upgradeCost)} for year one). Tell the owner, and ask before buying anything: playbook/DOMAIN-SETUP.md.`
  : `- Paid upgrades (own domain + business email, about ${usd(upgradeCost)} a year): on hold until sales cover them. ${usd(collected)} collected so far.`);
const rate = st.phpPerUSD;
lines.push(`- Toward ₱${st.goalPHP.toLocaleString()}: ${rate ? `₱${Math.round(collected * rate).toLocaleString()} (at ₱${rate}/USD)` : `${usd(collected)} USD (set settings.phpPerUSD to convert)`}`, '');

// funnel on pitches old enough to have answered
const aged = pitched.filter((e) => daysBetween(e.date, T) >= 14);
const ao = aged.map((e) => outcomeOf(e.slug));
const winRate = aged.length ? ao.filter((x) => x.won).length / aged.length : 0;
lines.push('### Funnel (pitches at least 14 days old)', '');
if (aged.length) {
  lines.push(`- ${aged.length} pitched → ${pct(ao.filter((x) => x.reply).length, aged.length)} replied → ${pct(ao.filter((x) => x.positive).length, aged.length)} interested → ${pct(ao.filter((x) => x.won).length, aged.length)} became clients`);
  lines.push(`- Care plan take-up: ${pct(new Set(ev.filter((e) => e.event === 'care').map((e) => e.slug)).size, wonSlugs.length)} of clients (expected first-year care value per client: ${usd(careValueUSD(config, ev))})`);
} else lines.push('- No pitch is 14 days old yet. Rates appear here once one is.');
lines.push('');

// ---------------------------------------------------------------- send volume governor
const LEVELS = [
  { days: [2, 3, 4], email: 30, label: 'Tue–Thu, 30 emails a day' },
  { days: [1, 2, 3, 4], email: 30, label: 'Mon–Thu, 30 emails a day' },
  { days: [1, 2, 3, 4, 5], email: 30, label: 'Mon–Fri, 30 emails a day' },
  { days: [1, 2, 3, 4, 5], email: 35, label: 'Mon–Fri, 35 emails a day' },
  { days: [1, 2, 3, 4, 5], email: 40, label: 'Mon–Fri, 40 emails a day' },
];
const ceiling = st.emailCeiling || 40;
const state = readJSON('data/send-state.json', { level: 0, since: T, history: [] });
const emails = pitched.filter((e) => e.channel === 'email');
const firstEmail = emails.map((e) => e.date).sort()[0];
const warmDays = (st.emailWarmup || [[21, 30]]).slice(-1)[0][0];
const recent = emails.filter((e) => daysBetween(e.date, T) <= 21);
const recentSlugs = new Set(recent.map((e) => e.slug));
const recentEv = (name, days = 21) => ev.filter((e) => e.event === name && daysBetween(e.date, T) <= days);
const bounces = recentEv('bounced').filter((e) => recentSlugs.has(e.slug));
const stops = recentEv('stop').filter((e) => recentSlugs.has(e.slug));
const complaints = recentEv('complaint', 14);
const agedRecent = recent.filter((e) => daysBetween(e.date, T) >= 5);
const replies = agedRecent.filter((e) => outcomeOf(e.slug).reply).length;
const bouncesByDay = {};
for (const b of bounces) bouncesByDay[b.date] = (bouncesByDay[b.date] || 0) + 1;
const bad = [];
if (complaints.length) bad.push(`${complaints.length} spam complaint(s) in 14 days`);
if (recent.length >= 20 && bounces.length / recent.length > 0.03) bad.push(`bounce rate ${pct(bounces.length, recent.length)} (limit 3%)`);
if (Object.values(bouncesByDay).some((n) => n > 2)) bad.push('more than 2 bounces in one day');
if (recent.length >= 30 && stops.length / recent.length > 0.05) bad.push(`STOP rate ${pct(stops.length, recent.length)} (limit 5%)`);
const throttled = state.throttleUntil && state.throttleUntil >= T;
let decision = `Holding at level ${state.level}.`;
if (bad.length && !throttled) {
  state.throttleUntil = addDays(T, 7);
  state.level = Math.max(0, state.level - 1);
  state.since = T;
  decision = `**Cut back:** ${bad.join('; ')}. Email cap halved until ${state.throttleUntil} and dropped to level ${state.level}. Check list quality (only emails the business published) before then.`;
  changes.push('send volume cut back');
} else if (throttled) {
  decision = `Throttled until ${state.throttleUntil} (half the usual email cap). No increase until then.`;
} else {
  const need = [];
  if (!firstEmail || daysBetween(firstEmail, T) < warmDays) need.push(`finish the ${warmDays}-day warm-up (${firstEmail ? daysBetween(firstEmail, T) : 0} days so far)`);
  if (recent.length < 60) need.push(`at least 60 emails in the last 21 days (${recent.length})`);
  if (recent.length && bounces.length / recent.length > 0.02) need.push('bounces at 2% or less');
  if (recent.length && stops.length / recent.length > 0.03) need.push('STOPs at 3% or less');
  if (agedRecent.length >= 30 && replies / agedRecent.length < 0.02) need.push(`replies of at least 2% (now ${pct(replies, agedRecent.length)}): improve targeting and the first line before sending more`);
  else if (agedRecent.length < 30) need.push('30 emails at least 5 days old to judge replies');
  if (daysBetween(state.since, T) < 7) need.push('7 days at the current level');
  if (state.level >= LEVELS.length - 1) need.push('nothing: this is the top level for one inbox');
  if (!need.length && LEVELS[state.level + 1].email <= ceiling) {
    state.level++;
    state.since = T;
    decision = `**Stepped up** to level ${state.level} (${LEVELS[state.level].label}): last 21 days had ${recent.length} emails, ${pct(bounces.length, recent.length)} bounces, ${pct(stops.length, recent.length)} STOPs, no complaints, ${pct(replies, agedRecent.length)} replies.`;
    changes.push('send volume stepped up');
  } else decision = `Holding at level ${state.level}. Next step needs: ${need.join('; ')}.`;
}
const L = LEVELS[state.level];
state.sendDays = L.days;
state.emailCapAfterWarmup = Math.min(L.email, ceiling);
const chatPerDay = st.messengerPerDay ?? 10;
const perWeek = L.days.length * (state.emailCapAfterWarmup + chatPerDay);
state.updated = T;
state.history = [...(state.history || []), { date: T, level: state.level, throttleUntil: state.throttleUntil || null }].slice(-60);
lines.push('## Sending volume', '');
for (const [mk, ds] of Object.entries(st.skipDates || {})) { const last = [...ds].sort().pop(); if (last && daysBetween(T, last) < 60) lines.push(`- **Action:** the holiday list for ${mk} ends ${last}. Add next year's dates to settings.skipDates in config.json.`); }
lines.push(`- Level ${state.level} of ${LEVELS.length - 1}: ${L.label} after warm-up${chatPerDay ? `, plus up to ${chatPerDay} Messenger/SMS a day sent by the owner` : ' (email only)'}. Up to about ${perWeek} new businesses a week.`);
lines.push(`- Last 21 days: ${recent.length} emails, ${bounces.length} bounced, ${stops.length} STOP, ${complaints.length} complaints, ${pct(replies, agedRecent.length)} replied.`);
lines.push(`- ${decision}`);
lines.push(`- Rules: one level up at most every 7 days, only while healthy; any complaint, bounces over 3% (or 3 in one day) or STOPs over 5% halve the cap for a week. Never more than ${ceiling} emails a day from one inbox. Going beyond that needs your own domain and a second inbox (playbook/deliverability.md), which costs money, so ask the owner.`);
const monthlyReach = perWeek * 4.3;
if (winRate > 0 && aged.length >= 100) {
  const needReach = buildsNeeded / winRate;
  lines.push(`- At the measured ${(winRate * 100).toFixed(1)}% client rate, ${buildsNeeded} builds a month needs about ${Math.round(needReach)} contacts a month; the top level allows about ${Math.round(LEVELS[LEVELS.length - 1].days.length * (ceiling + chatPerDay) * 4.3)}. ${needReach > monthlyReach ? 'Reach is the limit right now: raise conversion (copy, targeting) or price, or ask the owner about a second inbox.' : 'Reach is enough; focus on conversion and price.'}`);
}
if (perWeek > 200) lines.push(`- Research has to keep up: the prospect bank adds about 224 a week at most (16 per run, twice a day). If the bank keeps running dry, raise perRunMax in data/bank-state.json.`);
lines.push('');

// ---------------------------------------------------------------- experiments
function experiment(name, title, success, valueFn, label) {
  const ex = experiments[name];
  if (!ex) return;
  const stats = experimentStats(name, ex, ev, T, success);
  const pb = probBest(stats, ex, valueFn, 4000, name + T);
  lines.push(`### Experiment: ${title}`, '', `Success = ${ex.metric}. Balanced until each version has ${ex.minPerArm} pitches; after that most pitches go to the likely winner.`, '');
  for (const a of stats) lines.push(`- ${a.id}${a.retired ? ' (retired)' : ''} ${label(a)}: ${a.sent} sent, ${a.n} old enough to judge, ${a.s} success${a.s === 1 ? '' : 'es'} (${pct(a.s, a.n)})${a.retired ? '' : a.n < ex.minPerArm ? ', still collecting data' : `, ${Math.round(100 * pb[a.id])}% chance it is best`}`);
  const live = stats.filter((a) => !a.retired);
  const ready = live.every((a) => a.n >= ex.minPerArm);
  const out = [];
  if (ready && live.length > 1) {
    for (const a of live) {
      if (pb[a.id] < 0.05 && ex.arms.filter((x) => !x.retired).length > 1) {
        ex.arms.find((x) => x.id === a.id).retired = true;
        out.push(`retired ${a.id} (${Math.round(100 * pb[a.id])}% chance of being best)`);
      }
    }
  }
  const stillLive = ex.arms.filter((a) => !a.retired);
  if (name === 'price' && ready) {
    const top = stillLive.reduce((a, b) => (b.multiplier > a.multiplier ? b : a));
    if ((pb[top.id] || 0) >= 0.8 || stillLive.length === 1) {
      const m = Math.round((top.multiplier + (ex.step || 0.5)) * 10) / 10;
      if (m <= (ex.maxMultiplier || 3) && !ex.arms.some((a) => a.multiplier === m)) {
        const id = 'P' + (ex.arms.length + 1);
        ex.arms.push({ id, multiplier: m, note: `added ${T}: the highest price was winning`, added: T });
        out.push(`added a higher price challenger ${id} (x${m}, US about $${Math.round((config.markets.US.tiers.standard * m) / 50) * 50} for a standard site)`);
      }
    }
  }
  if (out.length) { changes.push(`${name}: ${out.join(', ')}`); lines.push('', `**Changed today:** ${out.join('; ')}.`); }
  else if (!ready) lines.push('', 'Not enough data yet. Keep sending; never edit an arm that has been sent.');
  else lines.push('', 'No clear loser yet; the sampler keeps favoring the leader.');
  if (name !== 'price' && stillLive.length === 1) lines.push('', `**Action for today's run:** only ${stillLive[0].id} is left in the ${title} test. Add one new challenger to playbook/experiments.json (next id, new \`text\`) that changes one idea, following voice.md: plain words, no !, $, % or ALL CAPS.`);
  lines.push('');
}
lines.push('## Experiments', '');
const priceValue = priceArmValue(config, ev);
experiment('price', 'price', WON, priceValue, (a) => `x${a.multiplier} (US standard site about $${Math.round((config.markets.US.tiers.standard * a.multiplier) / 50) * 50})`);
experiment('subject', 'subject line', POS, undefined, (a) => `"${a.text}"`);
experiment('cta', 'call to action', POS, undefined, (a) => `"${a.text}"`);
experiment('format', 'email format', POS, undefined, (a) => a.note);

// ---------------------------------------------------------------- what is working + targeting
lines.push('## What is working', '');
lines.push(...table((e) => e.market, 'By market'), ...table((e) => e.category, 'By business type'), ...table((e) => e.channel, 'By channel'));
function rank(key) {
  const g = {};
  for (const e of aged) { const k = e[key] || 'unknown'; (g[k] = g[k] || []).push(outcomeOf(e.slug)); }
  return Object.entries(g).map(([k, o]) => ({ k, n: o.length, pos: o.filter((x) => x.positive).length, stop: o.filter((x) => x.stop).length, score: (0.5 + o.filter((x) => x.positive).length) / (15 + o.length) }));
}
lines.push('## Targeting (the prospect bank reads this)', '');
const cats = rank('category'), mkts = rank('market');
const favor = cats.filter((c) => c.n >= 20).sort((a, b) => b.score - a.score).slice(0, 3);
const avoid = [...cats, ...mkts].filter((c) => (c.n >= 20 && c.stop / c.n > 0.1) || (c.n >= 40 && c.pos === 0));
lines.push(favor.length ? `- Favor: ${favor.map((c) => `${c.k} (${pct(c.pos, c.n)} interested of ${c.n})`).join(', ')}. Give these about half of new research.` : '- Not enough data yet (needs 20 pitches per business type, 14+ days old). Keep the current mix.');
lines.push(avoid.length ? `- Avoid for now: ${avoid.map((c) => `${c.k} (${c.n} pitched, ${c.pos} interested, ${c.stop} STOP)`).join(', ')}.` : '- Nothing to avoid yet.');
const mk = mkts.filter((c) => c.n >= 20).sort((a, b) => b.score - a.score);
if (mk.length > 1) lines.push(`- Markets by interest: ${mk.map((c) => `${c.k} ${pct(c.pos, c.n)}`).join(', ')}.`);
lines.push('');

// ---------------------------------------------------------------- due today
// What people actually said: every reply is logged with a short --note (the reason, objection or question).
const said = ev.filter((e) => ['replied', 'interested', 'declined', 'stop', 'complaint'].includes(e.event) && e.note);
lines.push('## What people said (learn from every reply)', '');
if (said.length) {
  const tags = {};
  for (const e of said) for (const t of (e.note.match(/#[\w-]+/g) || [])) { const k = `${t} (${e.event})`; tags[k] = (tags[k] || 0) + 1; }
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) lines.push(`- Most common: ${top.map(([k, n]) => `${k} x${n}`).join(', ')}`);
  lines.push(...said.slice(-10).reverse().map((e) => `- ${e.date} ${e.slug} (${e.event}): ${e.note}`));
  lines.push('', 'Use these: answer the common questions inside the first email or the demo, add a mistake rule when one reply shows a problem, and turn a repeated objection into the next copy challenger.');
} else lines.push('- Nothing yet. Log every reply with a short note and tags, for example `node log.js <slug> declined --note "#price has a nephew who does sites"`. Tags: #price #trust #timing #has-site #facebook-enough #ai #not-owner #interested-later.');
lines.push('');

lines.push('## Due today', '');
const due = leads.filter((r) => r.status === 'pitched' && [r.followup_1_due, r.followup_2_due].some((d) => d && d !== 'done' && d <= T));
lines.push(...(due.length ? due.map((r) => `- Follow-up for ${r.name} (${r.followup_1_due !== 'done' ? 'first, day 4' : 'second and last, day 9'}). It must add something new: a demo tweak or a useful tip.`) : ['- No follow-ups due.']));
// client growth: every ask is drafted for the owner to approve, and asked once (log `offered --note <care|growth|annual|referral>`)
const offered = (slug, what) => by(slug).some((e) => e.event === 'offered' && (e.note || '').toLowerCase().includes(what));
const has = (slug, names) => by(slug).some((e) => names.includes(e.event));
const lastDate = (slug, names) => by(slug).filter((e) => names.includes(e.event)).map((e) => e.date).sort().pop();
const grow = [];
for (const slug of wonSlugs) {
  if (isStopped(slug)) continue; // STOP is permanent: no growth asks either
  const paidOn = lastDate(slug, ['paid']);
  if (paidOn && daysBetween(paidOn, T) >= 1 && !has(slug, ['care', 'carecancel']) && !offered(slug, 'care')) grow.push(`- ${slug}: offer the care plan, Basic or Local Growth, with the yearly option (closing.md step 8). Then \`node log.js ${slug} offered --note care\`.`);
  const c = care[slug];
  if (c && c.plan !== 'growth' && daysBetween(c.date, T) >= 45 && !offered(slug, 'growth')) grow.push(`- ${slug}: on Basic for ${daysBetween(c.date, T)} days. Offer Local Growth (closing.md step 10). Then \`node log.js ${slug} offered --note growth\`.`);
  if (c && !c.annual && daysBetween(c.date, T) >= 60 && !offered(slug, 'annual')) grow.push(`- ${slug}: offer to switch to yearly billing (${12 - config.markets[c.market || 'US'].careTiers.annualMonths} months free). Then \`node log.js ${slug} offered --note annual\`.`);
  if (paidOn && daysBetween(paidOn, T) >= 7 && !has(slug, ['testimonial', 'referral']) && !offered(slug, 'referral')) grow.push(`- ${slug}: ask for a testimonial and a referral (closing.md step 9). Then \`node log.js ${slug} offered --note referral\`.`);
}
if (grow.length) lines.push('', '### Grow existing clients (draft each one; the owner approves before it is sent)', '', ...grow);
lines.push('');

// care payments due: listed from CARE_SOON days before the due date, and every day while overdue.
// insights.md is committed to git, so these lines stay minimal: slug, due date, amount and link. Payment history,
// refunds and stop details never go in it; `node learn.js --links <slug>` prints those on screen only.
lines.push('## Care payments due', '');
lines.push(`The daily run drafts a reminder only for a client below that shows a Link, from playbook/closing.md "## Care payment reminder", with exactly this amount and link, for the owner to approve. Never for "Link: none" or anyone under the checks. Nothing is sent without the owner's yes, and Claude never creates invoices or payment links. Listed when due within ${CARE_SOON} days or overdue. When a payment arrives: \`node log.js <slug> carepaid --amount <amount> --currency <its currency>\`.`, '');
const careDue = carePlans.filter((c) => c.status !== 'check' && daysBetween(T, c.due) <= CARE_SOON).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
for (const c of careDue) {
  const d = daysBetween(T, c.due), s = (n) => (n === 1 ? '' : 's');
  const when = d > 0 ? `due ${c.due} (in ${d} day${s(d)})` : d === 0 ? `due today (${c.due})` : `due ${c.due} (**${-d} day${s(-d)} overdue**)`;
  lines.push(`- ${c.slug}: ${when}. Amount: **${fmt(c.periodPrice, c.market, c.cur)}**. Link: ${careLink(c)}`);
}
if (!careDue.length) lines.push(carePlans.length ? `- Nothing due in the next ${CARE_SOON} days.` : '- No care plans yet.');
const CHECK_TEXT = {
  nolaunch: 'not launched yet (no reminder until `paid` is logged)',
  pending: "first care payment not logged: check Marjorie's PayPal first, and log carepaid if it came in",
  price: 'the plan amount needs checking',
  ledger: 'the care log needs checking',
};
if (careChecks.length) lines.push('', '### Check the care log before billing', '', 'No reminder for these. Put each in the report for the owner as listed; `node learn.js --links <slug>` shows the details on screen.', '', ...careChecks.map((x) => `- ${x.slug}: ${x.tags.includes('stopped') ? 'skip: stopped' : x.tags.map((t) => CHECK_TEXT[t]).join('; ')}.`));
lines.push('');
const hot = leads.filter((r) => ['replied', 'interested'].includes(r.status));
if (hot.length) lines.push('## Waiting on you', '', ...hot.map((r) => `- ${r.name}: ${r.status}. Reply within the hour (playbook/replies.md).`), '');

// ---------------------------------------------------------------- warnings and mistakes
const allBounces = ev.filter((e) => e.event === 'bounced').length, allStops = pitched.length ? ev.filter((e) => ['stop', 'complaint'].includes(e.event)).length : 0;
if (pitched.length >= 20 && allStops / pitched.length > 0.1) lines.push(`**Warning:** ${pct(allStops, pitched.length)} of pitches got STOP or a complaint. Tighten targeting before sending more.`, '');
if (pitched.length >= 10 && allBounces / pitched.length > 0.05) lines.push(`**Warning:** ${pct(allBounces, pitched.length)} bounced. Only use emails published by the business itself.`, '');
lines.push('## Mistakes we will not repeat', '', ...(mistakes.length ? mistakes.map((m) => `- ${m.date}: ${m.what} → **${m.fix}**${m.pattern ? ' (auto-checked by qa.js)' : ''}`) : ['- None logged yet. Log one with `node log.js mistake "<what>" --fix "<rule>"`.']), '');
lines.push('## Changed by learn.js today', '', ...(changes.length ? changes.map((c) => `- ${c}`) : ['- Nothing.']), '');

fs.writeFileSync(P('playbook/insights.md'), lines.join('\n'));
if (!DRY) {
  writeJSON('data/send-state.json', state);
  if (JSON.stringify(experiments) !== experimentsAtStart) writeJSON('playbook/experiments.json', experiments);
}
console.log(lines.slice(0, 60).join('\n'));
if (DRY) console.log('\n(dry run: experiments.json and send-state.json not changed)');
