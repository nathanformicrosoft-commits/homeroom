#!/usr/bin/env node
// Pre-send gate. Nothing goes out (Gmail draft, send list, Messenger) unless this prints PASS.
// Checks every queued message and its demo page against the rules, the banned-phrase list
// and every rule learned from past mistakes (data/mistakes.jsonl).
// Usage: node qa.js [--offline]   (--offline skips the live-URL check)
const fs = require('fs');
const { P, readJSON, readJSONL, readCSV, today } = require('./lib');

const offline = process.argv.includes('--offline');
const config = readJSON('config.json');
const prospects = Object.fromEntries(readJSON('data/prospects.json', []).map((p) => [p.slug, p]));
const queue = readJSON('pitches/queue.json', []);
const outcomes = readJSONL('data/outcomes.jsonl');
const mistakes = readJSONL('data/mistakes.jsonl').filter((m) => m.pattern);
const banned = fs.existsSync(P('playbook/banned-phrases.txt')) ? fs.readFileSync(P('playbook/banned-phrases.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
const dnc = readCSV('data/do-not-contact.csv').rows;
const dncSet = new Set(dnc.flatMap((r) => [r.email, r.business, r.contact].filter(Boolean).map((x) => x.toLowerCase())));

const results = []; // [level, scope, message]
const fail = (scope, msg) => results.push(['FAIL', scope, msg]);
const warn = (scope, msg) => results.push(['WARN', scope, msg]);

// --- global ---
for (const k of ['studioName', 'ownerName', 'city', 'email']) if (!config.studio[k]) fail('config', `studio.${k} is empty`);
if (!config.netlify.baseUrl) fail('config', 'netlify.baseUrl is empty: demos are not confirmed live');
if (!config.payments.paypalEmail) warn('config', 'payments.paypalEmail is empty (needed before the first invoice, not before pitching)');
const pitchedToday = outcomes.filter((e) => e.event === 'pitched' && e.date === today()).length;
if (pitchedToday + queue.length > config.settings.dailyCap) warn('cap', `${pitchedToday} sent today + ${queue.length} queued is over the daily cap of ${config.settings.dailyCap}; send the rest another day`);

// --- per message ---
const alreadyPitched = new Set(outcomes.filter((e) => e.event === 'pitched').map((e) => e.slug));
for (const q of queue) {
  const p = prospects[q.slug]; const sc = q.slug;
  if (!p) { fail(sc, 'not in prospects.json'); continue; }
  const m = config.markets[p.market];
  const text = `${q.subject || ''}\n${q.body}`;
  if (/\[\[/.test(text)) fail(sc, 'message still has [[placeholders]]');
  if (q.channel === 'email' && q.bodyWords > 110) fail(sc, `body is ${q.bodyWords} words (limit 110)`);
  if (!m.channels.includes(q.channel)) fail(sc, `${q.channel} not allowed in ${p.market} (${m.law})`);
  if (q.channel === 'email' && m.postalAddressRequired && !config.studio.postalAddress) fail(sc, `${m.law} needs your postal address in every email`);
  if (!/STOP/.test(q.body)) fail(sc, 'no opt-out line');
  if (alreadyPitched.has(q.slug)) fail(sc, 'already pitched; use a follow-up instead');
  if ([p.email, p.name, p.contactLink].filter(Boolean).some((x) => dncSet.has(x.toLowerCase()))) fail(sc, 'on the do-not-contact list');
  if (p.email && dnc.some((r) => r.domain && p.email.toLowerCase().endsWith('@' + r.domain.toLowerCase()))) fail(sc, 'email domain on the do-not-contact list');
  if (!p.sources || !p.sources.length) fail(sc, 'no sources recorded for the facts on the demo');
  if (!q.quote || q.quote < (m.minQuote || 0)) fail(sc, `quote ${q.quote} is below the ${p.market} minimum of ${m.minQuote} (ask the owner first)`);
  if (q.quote && !q.body.includes(String(q.quote))) fail(sc, 'message does not state the same price as the quote');
  if (!q.body.includes(q.demoUrl)) fail(sc, 'demo link missing from message');
  for (const b of banned) if (text.toLowerCase().includes(b.toLowerCase())) fail(sc, `uses banned phrase "${b}" (see playbook/voice.md)`);
  for (const mk of mistakes) if (new RegExp(mk.pattern, 'i').test(text)) fail(sc, `repeats a past mistake: ${mk.what} → ${mk.fix}`);
  if ((text.match(/!/g) || []).length > 1) warn(sc, 'more than one exclamation mark');
  if ((text.match(/—/g) || []).length > 0) warn(sc, 'contains an em dash; real people rarely type them in email');
  // demo page
  const f = P('site', q.slug, 'index.html');
  if (!fs.existsSync(f)) { fail(sc, 'demo page not built'); continue; }
  const html = fs.readFileSync(f, 'utf8');
  if (/\[\[|undefined|null<|NaN/.test(html)) fail(sc, 'demo page has an unfilled value');
  if (!html.includes(`tel:${p.phoneTel}`)) fail(sc, 'demo page click-to-call does not match the phone on file');
  if (!/Demo concept by (?!a small web studio in the Philippines)/.test(html)) fail(sc, 'demo footer does not name the studio yet (rebuild after filling config.json)');
  if (!html.includes('not the official website')) fail(sc, 'demo ribbon missing');
}

// --- live URL check ---
async function live() {
  if (offline || !config.netlify.baseUrl) return;
  for (const q of queue) {
    try {
      const r = await fetch(q.demoUrl, { method: 'GET', signal: AbortSignal.timeout(15000) });
      if (r.status !== 200) fail(q.slug, `demo URL returned ${r.status}`);
      else {
        const live = await r.text();
        const local = fs.existsSync(P('site', q.slug, 'index.html')) ? fs.readFileSync(P('site', q.slug, 'index.html'), 'utf8') : '';
        if (!live.includes(`Demo concept by ${config.studio.studioName}`)) fail(q.slug, 'live demo does not show the studio name yet: redeploy site/ to Netlify');
        else if (local && live.trim() !== local.trim()) warn(q.slug, 'live demo differs from the local build: redeploy site/ to Netlify');
      }
    }
    catch (e) { warn(q.slug, `could not reach demo URL from here (${e.cause ? e.cause.code || e.message : e.message}); open it yourself before sending`); }
  }
}
live().then(() => {
  const f = results.filter((r) => r[0] === 'FAIL'), w = results.filter((r) => r[0] === 'WARN');
  const out = [`# QA report ${new Date().toISOString().slice(0, 16)}Z`, '', f.length ? `**BLOCKED: ${f.length} problem(s). Nothing may be sent.**` : '**PASS**', '', ...results.map(([l, s, m]) => `- ${l} \`${s}\` ${m}`)].join('\n');
  fs.writeFileSync(P('pitches/qa-report.md'), out + '\n');
  const bySc = {}; for (const [l, s, m] of results) (bySc[`${l} ${s}`] = bySc[`${l} ${s}`] || []).push(m);
  for (const [k, ms] of Object.entries(bySc)) console.log(`${k}: ${[...new Set(ms)].join('; ')}`);
  console.log(f.length ? `\nBLOCKED (${f.length} fail, ${w.length} warn) → pitches/qa-report.md` : `\nPASS (${w.length} warnings)`);
  process.exit(f.length ? 1 : 0);
});
