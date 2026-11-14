#!/usr/bin/env node
// Records what happened, so the pipeline can learn from it.
//   node log.js <slug> <event> [--note "..."] [--amount 300] [--currency USD]
//     events: pitched followup1 followup2 replied interested declined stop bounced
//             won deposit paid testimonial referral complaint forget
//     money after the build:
//       care --amount 49 --plan basic|growth [--annual]   client started a care plan (amount = monthly price)
//       carepaid --amount 49                              a care payment arrived (monthly, or the yearly total)
//       carecancel                                        client stopped the care plan
//       upsell --amount 150 --note "extra page"           extra paid work (collected amount)
//       offered --note care|growth|annual|referral          you made that offer; learn.js stops reminding
//   node log.js mistake "<what went wrong>" --fix "<rule from now on>" [--pattern "<regex that catches it>"]
const fs = require('fs');
const { P, readJSON, writeJSON, readJSONL, appendJSONL, readCSV, writeCSV, today, addDays } = require('./lib');

const [a1, a2] = process.argv.slice(2);
const opt = (k) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : undefined; };
const config = readJSON('config.json');

if (a1 === 'mistake') {
  if (!a2 || !opt('fix')) { console.error('usage: node log.js mistake "<what>" --fix "<rule>" [--pattern "<regex>"]'); process.exit(1); }
  if (opt('pattern')) new RegExp(opt('pattern')); // throws if invalid
  appendJSONL('data/mistakes.jsonl', { date: today(), what: a2, fix: opt('fix'), pattern: opt('pattern') || null });
  console.log('Logged. qa.js will enforce it' + (opt('pattern') ? ' automatically.' : '; add --pattern to make it automatic.'));
  process.exit(0);
}

const EVENTS = { pitched: 'pitched', followup1: 'pitched', followup2: 'pitched', replied: 'replied', interested: 'interested', declined: 'declined', stop: 'do-not-contact', bounced: 'bounced', won: 'won', deposit: 'won', paid: 'won', testimonial: null, referral: null, complaint: 'do-not-contact', forget: 'do-not-contact', care: null, carepaid: null, carecancel: null, upsell: null, offered: null };
const slug = a1, event = a2;
if (!slug || !(event in EVENTS)) { console.error(`usage: node log.js <slug> <${Object.keys(EVENTS).join('|')}>`); process.exit(1); }
const prospects = readJSON('data/prospects.json', []);
const p = prospects.find((x) => x.slug === slug);
if (!p) { console.error(`unknown slug ${slug}`); process.exit(1); }

if (['care', 'carepaid', 'upsell'].includes(event) && !opt('amount')) { console.error(`${event} needs --amount`); process.exit(1); }
if (event === 'care' && opt('plan') && !['basic', 'growth'].includes(opt('plan'))) { console.error('--plan must be basic or growth'); process.exit(1); }
const queued = readJSON('pitches/queue.json', []).find((q) => q.slug === slug);
const amount = opt('amount') ? Number(opt('amount')) : null;
const currency = opt('currency') || (config.markets[p.market] || {}).currency;
appendJSONL('data/outcomes.jsonl', {
  date: today(), slug, event, market: p.market, category: p.category, channel: p.channel,
  variant: event === 'pitched' && queued ? queued.variant : undefined,
  amount, currency: amount ? currency : undefined, note: opt('note'),
  plan: event === 'care' ? opt('plan') || 'basic' : undefined, annual: event === 'care' && process.argv.includes('--annual') ? true : undefined,
});

// tracker
const leads = readCSV('leads.csv');
const row = leads.rows.find((r) => r.name === p.name);
if (row) {
  if (EVENTS[event]) row.status = EVENTS[event];
  if (event === 'pitched') {
    row.date_pitched = today();
    row.followup_1_due = addDays(today(), config.settings.followUpDays[0]);
    row.followup_2_due = addDays(today(), config.settings.followUpDays[1]);
  }
  if (['interested', 'replied', 'declined', 'won', 'deposit', 'paid'].includes(event)) { row.followup_1_due = ''; row.followup_2_due = ''; }
  if (event === 'followup1') row.followup_1_due = 'done';
  if (event === 'followup2') row.followup_2_due = 'done';
  if (amount && ['deposit', 'paid', 'carepaid', 'upsell'].includes(event)) {
    row.amount_won = String((Number(row.amount_won) || 0) + amount);
    row.currency = currency;
    const rate = currency === 'USD' ? config.settings.phpPerUSD : null;
    if (rate) row.amount_won_php = String(Math.round(Number(row.amount_won) * rate));
  }
  if (opt('note')) row.notes = `${row.notes ? row.notes + ' | ' : ''}${today()}: ${opt('note')}`;
}

// do-not-contact: permanent, and the demo page is no longer built
if (EVENTS[event] === 'do-not-contact') {
  const d = readCSV('data/do-not-contact.csv');
  if (!d.header.length) d.header = ['date', 'business', 'email', 'contact', 'domain', 'reason'];
  d.rows.push({ date: today(), business: p.name, email: p.email || '', contact: p.contactLink || '', domain: '', reason: event });
  writeCSV('data/do-not-contact.csv', d);
  p.status = 'do-not-contact';
  if (event === 'forget') { // data deletion request: keep only what is needed to never contact them again
    for (const k of Object.keys(p)) if (!['slug', 'name', 'status', 'market'].includes(k)) delete p[k];
    p.forgotten = today();
    if (row) for (const k of Object.keys(row)) if (!['name', 'market', 'status'].includes(k)) row[k] = '';
    for (const f of fs.readdirSync(P('screenshots'))) if (f.startsWith(slug + '-')) fs.unlinkSync(P('screenshots', f));
    if (fs.existsSync(P('pitches', slug + '.md'))) fs.unlinkSync(P('pitches', slug + '.md'));
  }
  writeJSON('data/prospects.json', prospects);
  console.log('Added to do-not-contact. Run node build.js and redeploy so their demo page is taken down.');
}
writeCSV('leads.csv', leads);
console.log(`logged ${event} for ${p.name}${row ? ` (status: ${row.status})` : ''}`);
