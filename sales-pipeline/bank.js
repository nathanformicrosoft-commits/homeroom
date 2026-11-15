#!/usr/bin/env node
// Prospect bank: researched, vetted prospects waiting to be built and pitched.
// Refills toward `target` (100) once it drops to `low` (one day's worth), then stops until it runs low again.
//   node bank.js status                 count, refill mode, how many to research this run
//   node bank.js add <file.json> ...    vet research files and add the good records to the bank
//   node bank.js take [N|auto]          move N (or enough to keep the pitch queue full) into data/prospects.json
//   node bank.js skiplist               names, slugs and photo ids research subagents must avoid
//   node bank.js top [N]                the best-scored banked businesses (what `take` will move next)
// `take` moves the highest-scored businesses first: well-reviewed, well-rated, in the business types that
// answer most (learned from data/outcomes.jsonl), fresh. Pitching the best fits first gets more clients
// from the same number of emails, which is the only safe way to grow past the sending cap.
const fs = require('fs');
const path = require('path');
const { P, readJSON, writeJSON, readJSONL, readCSV, today, daysBetween } = require('./lib');

const config = readJSON('config.json');
const state = Object.assign({ target: 100, low: 25, perRunMax: 16, buffer: 50, refilling: true }, readJSON('data/bank-state.json', {}));
// Files passed to `add` are excluded, or their own records would be rejected as already seen.
const adding = new Set(process.argv[2] === 'add' ? process.argv.slice(3).map((f) => path.basename(f)) : []);
// Everything researched before, including businesses that were dropped: never research them again.
const seen = fs.existsSync(P('data/incoming')) ? fs.readdirSync(P('data/incoming')).filter((f) => f.endsWith('.json') && !f.startsWith('verify') && !adding.has(f)).flatMap((f) => { try { return [].concat(JSON.parse(fs.readFileSync(P('data/incoming', f), 'utf8'))); } catch (e) { return []; } }) : [];
const bank = readJSON('data/bank.json', []);
const prospects = readJSON('data/prospects.json', []);
const dnc = readCSV('data/do-not-contact.csv').rows;
const THEMES = ['lawn', 'lawn-sun', 'cafe', 'diner', 'detailing', 'mechanic', 'wash', 'sparky', 'barber', 'barber-classic'];
const REQ = ['slug', 'name', 'market', 'town', 'state', 'tz', 'category', 'theme', 'channel', 'phoneDisplay', 'phoneTel', 'mapQuery', 'rating', 'reviewCount', 'hours', 'kicker', 'headline', 'sub', 'servicesTitle', 'services', 'themes', 'cta', 'photo', 'pitch', 'complexity', 'sources'];

function save() { writeJSON('data/bank.json', bank); writeJSON('data/bank-state.json', state); }
function updateMode() {
  if (bank.length <= state.low) state.refilling = true;
  if (bank.length >= state.target) state.refilling = false;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function known() {
  const all = [...prospects, ...bank, ...seen];
  return {
    slugs: new Set(all.map((p) => p.slug)),
    names: new Set(all.map((p) => norm(p.name) + '|' + norm(p.town)).concat(dnc.map((r) => norm(r.business)))),
    emails: new Set(all.map((p) => (p.email || '').toLowerCase()).filter(Boolean).concat(dnc.map((r) => (r.email || '').toLowerCase()).filter(Boolean))),
    photos: new Set(all.map((p) => p.photo && p.photo.id).filter(Boolean)),
  };
}

function vet(p, k) {
  const why = [];
  const miss = REQ.filter((f) => p[f] == null);
  if (miss.length) why.push('missing ' + miss.join(','));
  if (p.theme && !THEMES.includes(p.theme)) why.push('bad theme ' + p.theme);
  if (JSON.stringify(p).includes('—')) why.push('em dash');
  if (k.slugs.has(p.slug)) why.push('slug already used');
  if (k.names.has(norm(p.name) + '|' + norm(p.town))) why.push('business already known');
  if (p.email && k.emails.has(p.email.toLowerCase())) why.push('email already known or on do-not-contact');
  if (p.photo && k.photos.has(p.photo.id)) why.push('photo already used');
  if (p.channel === 'email' && !p.email) why.push('email channel without email');
  if (config.settings.emailOnly && p.channel !== 'email') why.push('no published email (email-only mode: the owner sends no Messenger/SMS)');
  if (p.channel === 'messenger' && !/^https:\/\/m\.me\//.test(p.contactLink || '')) why.push('messenger link is not an m.me Page link');
  if (!p.phoneTel) why.push('no phone (demo is built around click-to-call)');
  if (!config.markets[p.market]) why.push('unknown market');
  return why;
}

// ---- lead score ----
const outcomes = readJSONL('data/outcomes.jsonl');
const POS = ['interested', 'won', 'deposit', 'paid'];
const catAdj = (() => {
  const evs = {};
  for (const e of outcomes) (evs[e.slug] = evs[e.slug] || []).push(e.event);
  const g = {};
  for (const e of outcomes.filter((x) => x.event === 'pitched' && daysBetween(x.date, today()) >= 14)) {
    const c = (g[e.category] = g[e.category] || { n: 0, pos: 0, stop: 0 });
    c.n++;
    if ((evs[e.slug] || []).some((x) => POS.includes(x))) c.pos++;
    if ((evs[e.slug] || []).some((x) => ['stop', 'complaint'].includes(x))) c.stop++;
  }
  const all = Object.values(g).reduce((a, c) => ({ n: a.n + c.n, pos: a.pos + c.pos }), { n: 0, pos: 0 });
  const base = (0.5 + all.pos) / (15 + all.n);
  const out = {};
  for (const [k, c] of Object.entries(g)) {
    if (c.n >= 20 && c.stop / c.n > 0.1) { out[k] = -5; continue; }
    out[k] = Math.max(-2, Math.min(2, 3 * (((0.5 + c.pos) / (15 + c.n)) / base - 1)));
  }
  return out;
})();
function score(p) {
  const r = Number(p.rating) || 0, n = Number(p.reviewCount) || 0;
  let s = r >= 4.7 ? 2 : r >= 4.4 ? 1.2 : r >= 4.0 ? 0.5 : -1; // happy customers, owner who cares
  s += Math.min(Math.log10(n + 1), 2.5); // established enough to pay: 10 reviews = 1, 100 = 2
  s += catAdj[p.category] || 0; // learned from real replies
  if (p.market === (config.settings.marketOrder || ['US'])[0]) s += 0.5;
  if (p.banked && daysBetween(p.banked, today()) > 45) s -= 1; // may have a website by now
  return Math.round(s * 100) / 100;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'status' || !cmd) {
  updateMode(); save();
  const need = state.refilling ? Math.min(state.perRunMax, state.target - bank.length) : 0;
  console.log(JSON.stringify({ banked: bank.length, target: state.target, low: state.low, refilling: state.refilling, researchThisRun: need }));
} else if (cmd === 'skiplist') {
  const all = [...prospects, ...bank, ...seen.filter((x) => !prospects.some((p) => p.slug === x.slug))];
  console.log('BUSINESSES: ' + all.map((p) => `${p.name} (${p.town} ${p.state})`).concat(dnc.map((r) => r.business).filter(Boolean)).join('; '));
  console.log('PHOTO IDS: ' + all.map((p) => p.photo && p.photo.id).filter(Boolean).join(', '));
} else if (cmd === 'add') {
  let added = 0;
  for (const f of args) {
    for (const p of [].concat(JSON.parse(fs.readFileSync(f, 'utf8')))) {
      const k = known();
      if ((p.hours || []).some((h) => /24 hours/i.test(h[1]))) { p.hours = []; p.hoursNote = 'Your Google listing says open 24 hours, which Google often shows when hours were never set. Your real hours go here.'; }
      const why = vet(p, k);
      if (why.length) { console.log(`REJECT ${p.slug || p.name}: ${why.join('; ')}`); continue; }
      p.banked = today();
      bank.push(p); added++;
      console.log(`ADD ${p.slug}`);
    }
  }
  updateMode(); save();
  console.log(`added ${added}; bank now ${bank.length}${state.refilling ? ' (still refilling)' : ''}`);
} else if (cmd === 'take') {
  let n = Number(args[0]);
  if (!args[0] || args[0] === 'auto') {
    // Keep about `buffer` unsent pitches waiting; the warm-up caps in pitch.js space them out.
    const buffer = state.buffer;
    const waiting = readCSV('leads.csv').rows.filter((r) => r.status === 'found' && (!config.settings.emailOnly || r.channel === 'email')).length;
    n = Math.max(0, buffer - waiting);
  }
  const k = known();
  const moved = [];
  bank.sort((a, b) => score(b) - score(a)); // best fits first
  while (moved.length < n && bank.length) {
    const p = bank.shift();
    if (prospects.some((x) => x.slug === p.slug)) continue;
    delete p.banked;
    prospects.push(p); moved.push(p.slug);
  }
  writeJSON('data/prospects.json', prospects);
  updateMode(); save();
  console.log(`moved ${moved.length} into prospects.json: ${moved.join(', ') || '(none)'}; bank now ${bank.length}${state.refilling ? ' (refilling)' : ''}`);
} else if (cmd === 'top') {
  const n = Number(args[0]) || 15;
  for (const p of [...bank].sort((a, b) => score(b) - score(a)).slice(0, n)) console.log(`${String(score(p)).padStart(5)}  ${p.slug}  (${p.category}, ${p.rating} stars, ${p.reviewCount} reviews, ${p.town} ${p.state})`);
  if (Object.keys(catAdj).length) console.log('learned type adjustments: ' + Object.entries(catAdj).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(', '));
} else {
  console.error('usage: node bank.js status | skiplist | add <file...> | take [N|auto] | top [N]');
  process.exit(1);
}
