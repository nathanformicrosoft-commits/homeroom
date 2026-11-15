#!/usr/bin/env node
// Owner-approved timed sends (playbook/AUTOSEND.md).
//   node autosend.js list                    approved sends and their state
//   node autosend.js approve all|<slug...>   add drafted, unsent emails to pitches/autosend.json
// Run `approve` ONLY after the owner approves those emails in chat. It needs the Gmail draft id of each
// email, which the daily run records in pitches/drafts.json ({ "<slug>": "<draftId>" }) when it creates drafts.
// It prints one cron line per new entry for the main chat session to schedule (CronCreate, one-shot).
const { readJSON, writeJSON, readJSONL, today } = require('./lib');

const [cmd, ...args] = process.argv.slice(2);
const auto = readJSON('pitches/autosend.json', []);
const queue = readJSON('pitches/queue.json', []);
const drafts = readJSON('pitches/drafts.json', {});
const pitched = new Set(readJSONL('data/outcomes.jsonl').filter((e) => e.event === 'pitched').map((e) => e.slug));
const manilaParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));

if (cmd === 'list') {
  const now = Date.now();
  for (const a of auto) {
    const state = pitched.has(a.slug) ? 'sent' : Date.parse(a.sendAtUTC) < now ? 'PAST, not logged as sent' : 'waiting';
    console.log(`${a.manila}  ${a.slug.padEnd(36)} ${state}`);
  }
  console.log(`${auto.length} approved, ${auto.filter((a) => pitched.has(a.slug)).length} sent`);
} else if (cmd === 'approve') {
  if (!args.length) { console.error('usage: node autosend.js approve all|<slug...>'); process.exit(1); }
  const want = args[0] === 'all' ? null : new Set(args);
  const have = new Set(auto.map((a) => a.slug));
  const added = [], skipped = [];
  for (const q of queue.filter((x) => x.channel === 'email' && (!want || want.has(x.slug)))) {
    const why = have.has(q.slug) ? 'already approved' : pitched.has(q.slug) ? 'already sent' : !drafts[q.slug] ? 'no Gmail draft id in pitches/drafts.json' : Date.parse(q.sendAt) < Date.now() + 15 * 60e3 ? 'send time already passed (re-run node pitch.js for a new time, then re-draft)' : null;
    if (why) { if (want) skipped.push(`${q.slug}: ${why}`); continue; }
    const m = manilaParts(q.sendAt);
    const entry = { slug: q.slug, to: q.to, draftId: drafts[q.slug], sendAtUTC: new Date(q.sendAt).toISOString(), manila: `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}`, cron: `${Number(m.minute)} ${Number(m.hour)} ${Number(m.day)} ${Number(m.month)} *`, approved: today() };
    auto.push(entry); added.push(entry);
  }
  if (want) for (const s of want) if (!queue.some((q) => q.slug === s && q.channel === 'email')) skipped.push(`${s}: not a queued email`);
  auto.sort((a, b) => a.sendAtUTC.localeCompare(b.sendAtUTC));
  writeJSON('pitches/autosend.json', auto);
  for (const a of added) console.log(`CRON ${a.cron}  ${a.slug}  (${a.manila} Manila)`);
  for (const s of skipped) console.log(`SKIP ${s}`);
  console.log(`approved ${added.length}; ${auto.length} in pitches/autosend.json. Schedule each CRON line as a one-shot job with the prompt in playbook/AUTOSEND.md.`);
} else {
  console.error('usage: node autosend.js list | approve all|<slug...>');
  process.exit(1);
}
