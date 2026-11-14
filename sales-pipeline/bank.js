#!/usr/bin/env node
// Prospect bank: researched, vetted prospects waiting to be built and pitched.
// Refills toward `target` (100) once it drops to `low` (one day's worth), then stops until it runs low again.
//   node bank.js status                 count, refill mode, how many to research this run
//   node bank.js add <file.json> ...    vet research files and add the good records to the bank
//   node bank.js take [N|auto]          move N (or enough to keep the pitch queue full) into data/prospects.json
//   node bank.js skiplist               names, slugs and photo ids research subagents must avoid
const fs = require('fs');
const { P, readJSON, writeJSON, readCSV, today } = require('./lib');

const config = readJSON('config.json');
const state = Object.assign({ target: 100, low: 25, perRunMax: 16, buffer: 50, refilling: true }, readJSON('data/bank-state.json', {}));
// Everything researched before, including businesses that were dropped: never research them again.
const seen = fs.existsSync(P('data/incoming')) ? fs.readdirSync(P('data/incoming')).filter((f) => f.endsWith('.json') && !f.startsWith('verify')).flatMap((f) => { try { return [].concat(JSON.parse(fs.readFileSync(P('data/incoming', f), 'utf8'))); } catch (e) { return []; } }) : [];
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
  if (p.channel === 'messenger' && !/^https:\/\/m\.me\//.test(p.contactLink || '')) why.push('messenger link is not an m.me Page link');
  if (!p.phoneTel) why.push('no phone (demo is built around click-to-call)');
  if (!config.markets[p.market]) why.push('unknown market');
  return why;
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
    const waiting = readCSV('leads.csv').rows.filter((r) => r.status === 'found').length;
    n = Math.max(0, buffer - waiting);
  }
  const k = known();
  const moved = [];
  while (moved.length < n && bank.length) {
    const p = bank.shift();
    if (prospects.some((x) => x.slug === p.slug)) continue;
    delete p.banked;
    prospects.push(p); moved.push(p.slug);
  }
  writeJSON('data/prospects.json', prospects);
  updateMode(); save();
  console.log(`moved ${moved.length} into prospects.json: ${moved.join(', ') || '(none)'}; bank now ${bank.length}${state.refilling ? ' (refilling)' : ''}`);
} else {
  console.error('usage: node bank.js status | skiplist | add <file...> | take [N|auto]');
  process.exit(1);
}
