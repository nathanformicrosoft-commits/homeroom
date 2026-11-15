#!/usr/bin/env node
// Prospect bank: researched, vetted prospects waiting to be built and pitched.
// Refills toward `target` (100) once it drops to `low` (one day's worth), then stops until it runs low again.
//   node bank.js status                 count, refill mode, how many to research this run
//   node bank.js add <file.json> ...    vet research files and add the good records to the bank
//   node bank.js take [N|auto]          move N (or enough to keep the pitch queue full) into data/prospects.json
//   node bank.js skiplist [ST,ST]       compact list of known businesses (optionally only those states) for ad-hoc use
//   node bank.js known "<name>" "<town>" [email]   lookup: prints KNOWN (exit 1) or NEW (exit 0). Researchers call this instead of carrying a skip list
//   node bank.js pending                stage-A leads that `take` moved out and that still need enrichment (JSON)
//   node bank.js enrich <file.json>     merge stage-B data (array of {slug, ...}) into pending leads and move them into prospects.json
//   node bank.js drop <slug> "<why>"    drop a pending lead (now has a website, closed...); it stays known so it is never researched again
// Two research stages. Stage A ("qualified", cheap, researchers): name, place, phone, rating, reviews, no website, a published email.
// Stage B ("enriched", at take time, only for leads actually taken): services, review themes, line1, hours, photo, headline...
// `take` moves stage-A leads into data/enrich-queue.json (NOT prospects.json, so build/pitch never see a half-built lead);
// `enrich` completes them and moves them into prospects.json. Fully written-up bank entries (older runs) go straight to prospects.json.
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
const queue = readJSON('data/enrich-queue.json', []);
const pool = readJSON('playbook/photo-pool.json', {});
const THEMES = ['lawn', 'lawn-sun', 'cafe', 'diner', 'detailing', 'mechanic', 'wash', 'sparky', 'barber', 'barber-classic'];
// Stage A: what a researcher must establish before a lead is worth banking (email first).
const REQ_A = ['slug', 'name', 'market', 'town', 'state', 'tz', 'category', 'theme', 'found', 'channel', 'email', 'emailSource', 'phoneDisplay', 'phoneTel', 'rating', 'reviewCount', 'noWebsite', 'sources'];
// Stage B (documentation): what build.js / pitch.js read besides stage A. address may be null for service-area businesses; then serviceArea is needed.
const REQ_B = ['mapQuery', 'hours', 'kicker', 'headline', 'sub', 'servicesTitle', 'services', 'themes', 'cta', 'photo', 'pitch', 'complexity'];
// Fields an enrich file may set (stage B + optional display fields build.js reads). slug only identifies the lead.
const ENRICH_OK = new Set([...REQ_B, 'address', 'serviceArea', 'hoursNote', 'servicesNote', 'sources', 'notes']);
// Full (what bank entries needed before the two-stage split; still accepted as-is).
const REQ = ['slug', 'name', 'market', 'town', 'state', 'tz', 'category', 'theme', 'channel', 'phoneDisplay', 'phoneTel', 'mapQuery', 'rating', 'reviewCount', 'hours', 'kicker', 'headline', 'sub', 'servicesTitle', 'services', 'themes', 'cta', 'photo', 'pitch', 'complexity', 'sources'];

function save() { writeJSON('data/bank.json', bank); writeJSON('data/bank-state.json', state); }
function updateMode() {
  if (bank.length <= state.low) state.refilling = true;
  if (bank.length >= state.target) state.refilling = false;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function known() {
  const all = [...prospects, ...bank, ...queue, ...seen];
  return {
    slugs: new Set(all.map((p) => p.slug)),
    names: new Set(all.map((p) => norm(p.name) + '|' + norm(p.town)).concat(dnc.map((r) => norm(r.business)))),
    emails: new Set(all.map((p) => (p.email || '').toLowerCase()).filter(Boolean).concat(dnc.map((r) => (r.email || '').toLowerCase()).filter(Boolean))),
    photos: new Set(all.map((p) => p.photo && p.photo.id).filter(Boolean)),
  };
}

const isFull = (p) => REQ.every((f) => p[f] != null);
const COMPLEXITY = ['simple', 'standard', 'menu'];
const poolIds = new Set(Object.values(pool).flat().filter((x) => x && x.id).map((x) => x.id));
function vet(p, k, req) {
  const why = [];
  req = req || (isFull(p) ? REQ : REQ_A);
  const miss = req.filter((f) => p[f] == null);
  if (req === REQ_A && p.noWebsite !== true) why.push('noWebsite must be true (confirmed on the Maps listing)');
  if (req === REQ_A && !p.email) why.push('stage A needs a published email');
  if (req !== REQ_A && p.address == null && p.serviceArea == null) miss.push('address or serviceArea');
  if (p.complexity && !COMPLEXITY.includes(p.complexity)) why.push('bad complexity');
  if (req !== REQ_A && p.pitch && !(p.pitch.greeting && p.pitch.line1 && p.pitch.gap)) why.push('pitch needs greeting, line1, gap');
  if (miss.length) why.push('missing ' + miss.join(','));
  if (p.theme && !THEMES.includes(p.theme)) why.push('bad theme ' + p.theme);
  if (JSON.stringify(p).includes('—')) why.push('em dash');
  if (k.slugs.has(p.slug)) why.push('slug already used');
  if (k.names.has(norm(p.name) + '|' + norm(p.town))) why.push('business already known');
  if (p.email && k.emails.has(p.email.toLowerCase())) why.push('email already known or on do-not-contact');
  if (p.photo && k.photos.has(p.photo.id) && !poolIds.has(p.photo.id)) why.push('photo already used');
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
  // Compact: optional state filter (e.g. "TX,OK"); no photo ids (the photo pool replaces per-lead photo search).
  const sts = args[0] ? args[0].toUpperCase().split(',') : null;
  const all = [...prospects, ...bank, ...queue, ...seen.filter((x) => !prospects.some((p) => p.slug === x.slug))].filter((p) => !sts || sts.includes(String(p.state).toUpperCase()))
    .concat(dnc.filter((r) => r.business).map((r) => ({ name: r.business, town: 'do-not-contact', state: '' }))); // do-not-contact is always listed
  console.log('BUSINESSES: ' + [...new Set(all.map((p) => `${p.name} (${p.town}${p.state ? ' ' + p.state : ''})`))].join('; '));
} else if (cmd === 'known') {
  // Exit 1 = already known (researched, pitched, banked or do-not-contact): skip it. Exit 0 = new.
  const [name, town, email] = args;
  if (!name) { console.error('usage: node bank.js known "<name>" "<town>" [email]'); process.exit(2); }
  const k = known();
  const hit = [];
  if (k.names.has(norm(name) + '|' + norm(town))) hit.push('business');
  if (dnc.some((r) => norm(r.business) === norm(name))) hit.push('do-not-contact');
  if (email && k.emails.has(email.toLowerCase())) hit.push('email');
  console.log(hit.length ? 'KNOWN (' + hit.join(', ') + '): skip' : 'NEW');
  process.exit(hit.length ? 1 : 0);
} else if (cmd === 'pending') {
  console.log(JSON.stringify(queue, null, 2));
  console.error(`${queue.length} lead(s) waiting for enrichment`);
  for (const p of queue) { // taken but never enriched (rejected at enrich?): they count as waiting forever
    const age = p.takenOn ? daysBetween(p.takenOn, today()) : 0;
    if (age > 3) console.error(`WARN ${p.slug} has waited ${age} days: enrich it or run: node bank.js drop ${p.slug} "<why>"`);
  }
} else if (cmd === 'drop') {
  const [slug, ...why] = args;
  const i = queue.findIndex((p) => p.slug === slug);
  if (i < 0) { console.error('not in enrich queue: ' + slug); process.exit(1); }
  const [p] = queue.splice(i, 1);
  p.dropped = why.join(' ') || 'dropped at enrichment';
  const df = P('data/incoming/dropped.json'); // stays "seen", so it is never researched again
  const dropped = fs.existsSync(df) ? JSON.parse(fs.readFileSync(df, 'utf8')) : [];
  dropped.push(p); fs.writeFileSync(df, JSON.stringify(dropped, null, 2) + '\n');
  writeJSON('data/enrich-queue.json', queue);
  console.log('dropped ' + slug + ': ' + p.dropped);
} else if (cmd === 'enrich') {
  let done = 0;
  for (const f of args) {
    for (const b of [].concat(JSON.parse(fs.readFileSync(f, 'utf8')))) {
      const i = queue.findIndex((p) => p.slug === b.slug);
      if (i < 0) { console.log(`REJECT ${b.slug}: not in the enrich queue (node bank.js pending)`); continue; }
      const bad = Object.keys(b).filter((x) => x !== 'slug' && !ENRICH_OK.has(x));
      if (bad.length) { console.log(`REJECT ${b.slug}: enrich file may not set ${bad.join(', ')} (allowed: stage-B fields only)`); continue; }
      const q0 = queue[i];
      const p = Object.assign({}, q0, b);
      p.sources = [...new Set([].concat(q0.sources || [], b.sources || []))]; // keep the stage-A email source
      if (q0.notes || b.notes) p.notes = [q0.notes, b.notes].filter(Boolean).join(' | ');
      if (!p.mapQuery) p.mapQuery = p.address || `${p.name}, ${p.town} ${p.state}`;
      if (!p.photo && pool[p.theme] && pool[p.theme].length) { // vetted pool: least-used photo for the theme, no search or curl
        const use = {}; for (const x of [...prospects, ...bank]) if (x.photo) use[x.photo.id] = (use[x.photo.id] || 0) + 1;
        const c = pool[p.theme].filter((x) => x && x.id).sort((a, b2) => (use[a.id] || 0) - (use[b2.id] || 0))[0];
        if (c) p.photo = { id: c.id, by: c.by, user: c.user };
      }
      if ((p.hours || []).some((h) => /24 hours/i.test(h[1]))) { p.hours = []; p.hoursNote = 'Your Google listing says open 24 hours, which Google often shows when hours were never set. Your real hours go here.'; }
      // the lead is already known (it is queued); only report problems that are new
      const why = vet(p, known(), REQ).filter((w) => !/slug already used|business already known|email already known/.test(w));
      if (!p.photo) why.push('no photo and no vetted pool photo for theme ' + p.theme + ' (do a per-lead Unsplash search + curl, then retry)');
      if (why.length) { console.log(`REJECT ${p.slug}: ${why.join('; ')}`); continue; }
      p.enriched = true; p.enrichedOn = today(); delete p.noWebsite; delete p.takenOn;
      prospects.push(p); queue.splice(i, 1); done++;
      console.log(`ENRICHED ${p.slug}`);
    }
  }
  writeJSON('data/prospects.json', prospects); writeJSON('data/enrich-queue.json', queue);
  console.log(`enriched ${done}; ${queue.length} still waiting for enrichment`);
} else if (cmd === 'add') {
  let added = 0;
  for (const f of args) {
    for (const p of [].concat(JSON.parse(fs.readFileSync(f, 'utf8')))) {
      const k = known();
      if ((p.hours || []).some((h) => /24 hours/i.test(h[1]))) { p.hours = []; p.hoursNote = 'Your Google listing says open 24 hours, which Google often shows when hours were never set. Your real hours go here.'; }
      if (!isFull(p)) delete p.pitch; // stage A: pitch lines are written at enrichment; drop any partial one
      const why = vet(p, k);
      if (why.length) { console.log(`REJECT ${p.slug || p.name}: ${why.join('; ')}`); continue; }
      p.banked = today();
      p.enriched = isFull(p); // full write-ups from older runs stay enriched; stage-A leads are enriched at take time
      bank.push(p); added++;
      console.log(`ADD ${p.slug}${p.enriched ? '' : ' (stage A)'}`);
    }
  }
  updateMode(); save();
  console.log(`added ${added}; bank now ${bank.length}${state.refilling ? ' (still refilling)' : ''}`);
} else if (cmd === 'take') {
  let n = Number(args[0]);
  if (!args[0] || args[0] === 'auto') {
    // Keep about `buffer` unsent pitches waiting; the warm-up caps in pitch.js space them out.
    const buffer = state.buffer;
    const foundRows = readCSV('leads.csv').rows.filter((r) => r.status === 'found' && (!config.settings.emailOnly || r.channel === 'email'));
    // Enriched leads sit in prospects.json with no leads.csv row until pitch.js runs: count those too (not pitched, not do-not-contact, not already a found row).
    const pitched = new Set(outcomes.filter((e) => e.event === 'pitched').map((e) => e.slug));
    const foundNames = new Set(foundRows.map((r) => norm(r.name)));
    const dncNames = new Set(dnc.map((r) => norm(r.business)));
    const dncEmails = new Set(dnc.map((r) => (r.email || '').toLowerCase()).filter(Boolean));
    const unpitched = prospects.filter((p) => !pitched.has(p.slug) && !dncNames.has(norm(p.name)) && !(p.email && dncEmails.has(p.email.toLowerCase())) && !foundNames.has(norm(p.name))).length;
    const waiting = foundRows.length + unpitched + queue.length;
    n = Math.max(0, buffer - waiting);
  }
  const k = known();
  const moved = [], needEnrich = [];
  bank.sort((a, b) => score(b) - score(a)); // best fits first
  while (moved.length < n && bank.length) {
    const p = bank.shift();
    if (prospects.some((x) => x.slug === p.slug) || queue.some((x) => x.slug === p.slug)) continue;
    delete p.banked;
    if (!isFull(p)) { p.enriched = false; p.takenOn = today(); queue.push(p); needEnrich.push(p.slug); } // stage A: enrich before build/pitch can see it
    else prospects.push(p);
    moved.push(p.slug);
  }
  writeJSON('data/prospects.json', prospects); writeJSON('data/enrich-queue.json', queue);
  updateMode(); save();
  console.log(`took ${moved.length}: ${moved.length - needEnrich.length} ready in prospects.json; ${needEnrich.length} need enrichment (node bank.js pending): ${needEnrich.join(', ') || '(none)'}; bank now ${bank.length}${state.refilling ? ' (refilling)' : ''}`);
} else if (cmd === 'top') {
  const n = Number(args[0]) || 15;
  for (const p of [...bank].sort((a, b) => score(b) - score(a)).slice(0, n)) console.log(`${String(score(p)).padStart(5)}  ${p.slug}  (${p.category}, ${p.rating} stars, ${p.reviewCount} reviews, ${p.town} ${p.state})`);
  if (Object.keys(catAdj).length) console.log('learned type adjustments: ' + Object.entries(catAdj).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(', '));
} else {
  console.error('usage: node bank.js status | skiplist [ST,ST] | known "<name>" "<town>" [email] | add <file...> | take [N|auto] | pending | enrich <file...> | drop <slug> "<why>" | top [N]');
  process.exit(1);
}
