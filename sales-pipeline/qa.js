#!/usr/bin/env node
// Pre-send gate. Nothing goes out (Gmail draft, send list, Messenger) unless this prints PASS.
// Checks every queued message and its demo page against the rules, the banned-phrase list
// and every rule learned from past mistakes (data/mistakes.jsonl).
// Usage: node qa.js [--offline]   (--offline skips the live-URL check)
const fs = require('fs');
const { P, readJSON, readJSONL, readCSV } = require('./lib');

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
// Daily cap is per send day (pitch.js spreads the queue across days).
const perSendDay = {};
for (const q of queue) { const d = (q.sendAt || '').slice(0, 10); perSendDay[d] = (perSendDay[d] || 0) + 1; }
for (const [d, n] of Object.entries(perSendDay)) if (n > config.settings.dailyCap) warn('cap', `${n} messages scheduled for ${d}, over the daily cap of ${config.settings.dailyCap}`);

// --- deliverability: caps, spacing, uniqueness (see playbook/deliverability.md) ---
const perDay = {};
for (const q of queue) {
  const k = `${(q.sendAt || '').slice(0, 10)} ${q.channel === 'email' ? 'email' : 'chat'}`;
  perDay[k] = (perDay[k] || 0) + 1;
}
const maxEmailCap = Math.max(...(config.settings.emailWarmup || [[0, 15]]).map((x) => x[1]));
for (const [k, n] of Object.entries(perDay)) {
  if (k.endsWith('chat') && n > (config.settings.messengerPerDay || 10)) fail('cap', `${n} Messenger/SMS messages scheduled for ${k.slice(0, 10)} (max ${config.settings.messengerPerDay || 10})`);
  if (k.endsWith('email') && n > maxEmailCap) fail('cap', `${n} emails scheduled for ${k.slice(0, 10)} (max ${maxEmailCap})`);
}
const emailTimes = queue.filter((q) => q.channel === 'email').map((q) => Date.parse(q.sendAt)).sort((a, b) => a - b);
for (let i = 1; i < emailTimes.length; i++) if (emailTimes[i] - emailTimes[i - 1] < (config.settings.emailGapMinutes || 9) * 60e3) { fail('cap', 'two emails are scheduled closer together than settings.emailGapMinutes; rerun node pitch.js'); break; }
const line1s = {};
for (const q of queue) { const p = prospects[q.slug]; if (p && p.pitch) { const k = p.pitch.line1.trim().toLowerCase(); if (line1s[k]) fail(q.slug, `same opening line as ${line1s[k]}; every first line must be unique`); line1s[k] = q.slug; } }

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
  if ((q.body.match(/https?:\/\//g) || []).length > 1) fail(sc, 'more than one link in the message (spam filters count links; keep only the demo link)');
  if (q.channel === 'email' && q.subject && (/[A-Z]{5,}/.test(q.subject) || /[!$%]/.test(q.subject))) fail(sc, 'subject has shouting caps or !/$/% (spam trigger)');
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
  if (offline) return;
  // Bounces hurt the sender's reputation more than anything else: the email's domain must accept mail.
  const dns = require('dns').promises;
  for (const q of queue.filter((x) => x.channel === 'email')) {
    const domain = String(q.to || '').split('@')[1];
    if (!domain) { fail(q.slug, `"${q.to}" is not an email address`); continue; }
    try { const mx = await dns.resolveMx(domain); if (!mx.length) fail(q.slug, `${domain} has no mail server (would bounce)`); }
    catch (e) { if (['ENOTFOUND', 'ENODATA'].includes(e.code)) fail(q.slug, `${domain} has no mail server (would bounce)`); else warn(q.slug, `could not check the mail server for ${domain} (${e.code})`); }
  }
  if (!config.netlify.baseUrl) return;
  for (const q of queue) {
    try {
      const r = await fetch(q.demoUrl, { method: 'GET', signal: AbortSignal.timeout(15000) });
      if (r.status !== 200) fail(q.slug, `demo URL returned ${r.status}`);
      else {
        const live = await r.text();
        const local = fs.existsSync(P('site', q.slug, 'index.html')) ? fs.readFileSync(P('site', q.slug, 'index.html'), 'utf8') : '';
        // Netlify injects an HTML comment and a /.netlify/ script; ignore those when comparing.
        const norm = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[^>]*\/\.netlify\/[^>]*><\/script>/g, '').replace(/\s+/g, ' ').trim();
        if (!live.includes(`Demo concept by ${config.studio.studioName}`)) fail(q.slug, 'live demo does not show the studio name yet: redeploy site/ to Netlify');
        else if (local && norm(live) !== norm(local)) warn(q.slug, 'live demo differs from the local build: redeploy site/ to Netlify');
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
