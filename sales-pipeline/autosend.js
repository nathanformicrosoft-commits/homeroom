#!/usr/bin/env node
// Owner-approved sends (playbook/AUTOSEND.md). Nothing here sends anything: it only records what the owner
// approved in chat, so the main chat session can send exactly those Gmail drafts.
//   node autosend.js pending                 drafts waiting for the owner's approval
//   node autosend.js approve all|<slug...>   approve them: first-touch pitches become timed sends (CRON lines),
//                                            replies, follow-ups and client messages are sent right away (NOW lines)
//   node autosend.js list                    every approved send and whether it went out
// Inputs written by the scheduled tasks when they create drafts:
//   pitches/drafts.json   { "<slug>": "<draftId>" }  first-touch pitch drafts
//   pitches/pending.json  [{ slug, kind, draftId, to, summary, created }]  kind: reply | followup1 | followup2 | growth
const { readJSON, writeJSON, readJSONL, today } = require('./lib');

const [cmd, ...args] = process.argv.slice(2);
const auto = readJSON('pitches/autosend.json', []);
const queue = readJSON('pitches/queue.json', []);
const drafts = readJSON('pitches/drafts.json', {});
const pending = readJSON('pitches/pending.json', []);
const ev = readJSONL('data/outcomes.jsonl');
const pitched = new Set(ev.filter((e) => e.event === 'pitched').map((e) => e.slug));
const stopped = new Set(ev.filter((e) => ['stop', 'complaint', 'forget'].includes(e.event)).map((e) => e.slug));
const manilaParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
const manila = (iso) => { const m = manilaParts(iso); return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}`; };
const approvedIds = new Set(auto.map((a) => a.draftId));

// first-touch pitches that have a draft and are not approved, sent or stopped
const pitchCandidates = () => queue.filter((q) => q.channel === 'email' && drafts[q.slug] && !approvedIds.has(drafts[q.slug]) && !pitched.has(q.slug) && !stopped.has(q.slug));
const otherCandidates = () => pending.filter((p) => !approvedIds.has(p.draftId));

if (cmd === 'pending') {
  const ps = pitchCandidates(), os = otherCandidates();
  for (const q of ps) console.log(`pitch      ${q.slug.padEnd(36)} ${manila(q.sendAt)} Manila  "${q.subject}"`);
  for (const p of os) console.log(`${p.kind.padEnd(10)} ${p.slug.padEnd(36)} ${p.summary || ''}`);
  console.log(`${ps.length} pitch draft(s) and ${os.length} other draft(s) waiting for approval`);
} else if (cmd === 'list') {
  const now = Date.now();
  for (const a of auto) {
    const kind = a.kind || 'pitch';
    const state = a.sent ? 'sent' : kind === 'pitch' && pitched.has(a.slug) ? 'sent' : Date.parse(a.sendAtUTC) < now - 2 * 3600e3 ? 'PAST, not logged as sent' : 'waiting';
    console.log(`${a.manila}  ${kind.padEnd(10)} ${a.slug.padEnd(36)} ${state}`);
  }
  console.log(`${auto.length} approved`);
} else if (cmd === 'approve') {
  if (!args.length) { console.error('usage: node autosend.js approve all|<slug...>'); process.exit(1); }
  const want = args[0] === 'all' ? null : new Set(args);
  const pick = (slug) => !want || want.has(slug);
  const added = [], skipped = [];
  for (const q of pitchCandidates().filter((x) => pick(x.slug))) {
    if (Date.parse(q.sendAt) < Date.now() + 15 * 60e3) { skipped.push(`${q.slug}: send time already passed (re-run node pitch.js for a new time, then re-draft)`); continue; }
    const m = manilaParts(q.sendAt);
    const e = { slug: q.slug, kind: 'pitch', to: q.to, draftId: drafts[q.slug], sendAtUTC: new Date(q.sendAt).toISOString(), manila: manila(q.sendAt), cron: `${Number(m.minute)} ${Number(m.hour)} ${Number(m.day)} ${Number(m.month)} *`, approved: today() };
    auto.push(e); added.push(e);
  }
  for (const p of otherCandidates().filter((x) => pick(x.slug))) {
    if (stopped.has(p.slug) && p.kind !== 'reply') { skipped.push(`${p.slug}: on STOP/do-not-contact; only the one-line STOP confirmation may go`); continue; }
    const now = new Date().toISOString();
    const e = { slug: p.slug, kind: p.kind, to: p.to, draftId: p.draftId, summary: p.summary, sendAtUTC: now, manila: manila(now), cron: null, approved: today() };
    auto.push(e); added.push(e);
  }
  if (want) for (const s of want) if (!added.some((a) => a.slug === s) && !skipped.some((x) => x.startsWith(s + ':'))) skipped.push(`${s}: nothing waiting for approval`);
  auto.sort((a, b) => a.sendAtUTC.localeCompare(b.sendAtUTC));
  writeJSON('pitches/autosend.json', auto);
  for (const a of added) console.log(a.cron ? `CRON ${a.cron}  ${a.slug}  (${a.manila} Manila)` : `NOW  ${a.kind.padEnd(10)} ${a.slug}  draft ${a.draftId}`);
  for (const s of skipped) console.log(`SKIP ${s}`);
  console.log(`approved ${added.length}. CRON lines: schedule a one-shot job each. NOW lines: send now. Both follow playbook/AUTOSEND.md.`);
} else if (cmd === 'sent') {
  // node autosend.js sent <draftId>: mark a NOW send done (pitches are tracked by their `pitched` event)
  const a = auto.find((x) => x.draftId === args[0]);
  if (!a) { console.error('unknown draft id'); process.exit(1); }
  a.sent = today();
  writeJSON('pitches/autosend.json', auto);
  console.log(`marked sent: ${a.kind} ${a.slug}`);
} else {
  console.error('usage: node autosend.js pending | approve all|<slug...> | list | sent <draftId>');
  process.exit(1);
}
