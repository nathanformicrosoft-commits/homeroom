#!/usr/bin/env node
// Writes first-touch pitches for every prospect still at status "found":
//   pitches/<slug>.md      human-readable draft
//   pitches/queue.json     machine-readable queue (used for Gmail drafts and by log.js)
//   send-list.md           Messenger/SMS messages you send by hand
// and appends new prospects to leads.csv. Usage: node pitch.js [YYYY-MM-DD]
const fs = require('fs');
const { P, readJSON, writeJSON, readJSONL, readCSV, writeCSV, money, words, today, quoteFor, makeScheduler } = require('./lib');

const config = readJSON('config.json');
const prospects = readJSON('data/prospects.json', []);
const experiments = readJSON('playbook/experiments.json', {});
const outcomes = readJSONL('data/outcomes.jsonl');
const runDate = process.argv[2] || today();
const s = config.studio;
const v = (k, label) => s[k] || `[[${label}]]`;
const base = config.netlify.baseUrl || config.netlify.plannedUrl;

// --- A/B: give each new pitch the subject arm with the fewest sends so far ---
const subj = experiments.subject;
const armCount = Object.fromEntries((subj ? subj.arms : []).map((a) => [a.id, 0]));
for (const e of outcomes) if (e.event === 'pitched' && e.variant && e.variant.subject in armCount) armCount[e.variant.subject]++;
function pickArm() {
  if (!subj) return { id: 'S0', text: 'I built a free homepage for {name}' };
  const arm = subj.arms.filter((a) => !a.retired).sort((a, b) => armCount[a.id] - armCount[b.id])[0];
  armCount[arm.id]++;
  return arm;
}

function emailPitch(p, arm) {
  const m = config.markets[p.market];
  const url = `${base}/${p.slug}/`;
  const what = ['cafe', 'diner'].includes(p.theme) ? 'menu highlights' : 'services';
  const body = [
    p.pitch.greeting, '',
    p.pitch.line1, '',
    `I'm ${v('ownerName', 'YOUR NAME')} from ${v('studioName', 'STUDIO NAME')}, a small web design studio in ${v('city', 'CITY')}, Philippines. ${p.pitch.gap}, so I built you a free demo homepage: ${url}`, '',
    `It shows your ${what}, hours, a map, click-to-call and a contact form. The finished site with your own photos is ${money(p.market, quoteFor(p, config), config)} one-time, plus an optional ${money(p.market, m.careQuote, config)}/month care plan for hosting and edits.`, '',
    `Reply "yes" and I'll finish it in 3 days.`,
  ].join('\n');
  const sig = ['', v('ownerName', 'YOUR NAME'), `${v('studioName', 'STUDIO NAME')} · ${v('city', 'CITY')}, Philippines`];
  if (m.postalAddressRequired) sig.push(v('postalAddress', 'POSTAL ADDRESS (required by law for this market)'));
  sig.push('', `Not interested? Reply STOP and I won't contact you again.`);
  return { subject: arm.text.replace('{name}', p.name), body: body + '\n' + sig.join('\n'), bodyWords: words(body) };
}
function chatPitch(p) {
  const m = config.markets[p.market];
  return `${p.pitch.greeting} ${p.pitch.line1} I'm ${v('ownerName', 'YOUR NAME')} from ${v('studioName', 'STUDIO NAME')}, a small web design studio in the Philippines. ${p.pitch.gap}, so I built you a free preview homepage: ${base}/${p.slug}/ The finished site is ${money(p.market, quoteFor(p, config), config)}. Reply "yes" and I'll finish it in 3 days, or reply STOP and I won't message again.`;
}

const leads = readCSV('leads.csv');
const statusOf = Object.fromEntries(leads.rows.map((r) => [r.name, r.status]));
const queue = [];
const schedule = makeScheduler(config, outcomes, runDate);
const emails = [];
const chats = [];
for (const p of prospects) {
  const st = statusOf[p.name] || 'found';
  if (st !== 'found' || p.status === 'do-not-contact') continue;
  const m = config.markets[p.market];
  if (!m.channels.includes(p.channel)) { console.warn(`SKIP ${p.slug}: ${p.channel} is not allowed for ${p.market} (${m.law})`); continue; }
  const w = schedule(p);
  const when = { sendAt: w.utc, sendLocal: w.local, sendManila: w.manila };
  if (p.channel === 'email') {
    const arm = pickArm();
    const e = emailPitch(p, arm);
    queue.push({ slug: p.slug, market: p.market, channel: 'email', to: p.email, subject: e.subject, body: e.body, bodyWords: e.bodyWords, quote: quoteFor(p, config), variant: { subject: arm.id }, ...when, demoUrl: `${base}/${p.slug}/` });
    emails.push({ p, e, w });
    fs.writeFileSync(P('pitches', `${p.slug}.md`), `**To:** ${p.email} (${p.emailSource})\n**Subject:** ${e.subject}  _(variant ${arm.id})_\n**Send:** ${w.manila} (${w.local})\n**Body words:** ${e.bodyWords}\n\n---\n\n${e.body}\n`);
  } else {
    const msg = chatPitch(p);
    queue.push({ slug: p.slug, market: p.market, channel: p.channel, to: p.contactLink, body: msg, bodyWords: words(msg), quote: quoteFor(p, config), variant: {}, ...when, demoUrl: `${base}/${p.slug}/` });
    chats.push({ p, msg, w });
  }
}

// --- send list: emails (one-click Gmail compose, scheduled), then Messenger/SMS ---
const byTime = (a, b) => a.w.utc.localeCompare(b.w.utc);
const held = (p) => config.markets[p.market].postalAddressRequired && !s.postalAddress;
const sendList = [`# Send list for ${runDate}`, '', 'Run `node qa.js` first: it must say PASS. Rules for staying out of spam folders: playbook/deliverability.md.', ''];
const ready = emails.filter((x) => !held(x.p)).sort(byTime);
if (ready.length) {
  sendList.push('# Emails', '', `Each link opens Gmail with the email filled in. Click the arrow next to Send, choose **Schedule send**, and pick the Manila time shown. The times are already ${config.settings.emailGapMinutes || 9}+ minutes apart; never send a batch at once.`, '');
  for (const { p, e, w } of ready) {
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(p.email)}&su=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;
    sendList.push(`## ${p.name} (${p.town} ${p.state})`, '', `- To: ${p.email}`, `- Schedule for: **${w.manila}** (${w.local})`, `- [Open in Gmail, filled in](${gmail})`, `- After it goes out: \`node log.js ${p.slug} pitched\``, '');
  }
}
const onHold = emails.filter((x) => held(x.p));
if (onHold.length) {
  sendList.push('# Emails on hold', '', `${onHold.length} US email(s) are written (pitches/<slug>.md) but can't be sent yet: US law (CAN-SPAM) requires your postal address in every commercial email. Add it to config.json under studio.postalAddress, then run node pitch.js and node qa.js again.`, '');
  for (const { p } of onHold) sendList.push(`- ${p.name} (${p.town} ${p.state}): pitches/${p.slug}.md`);
  sendList.push('');
}
if (chats.length) {
  sendList.push('# Messenger / SMS', '', `You tap Send yourself, at most ${config.settings.messengerPerDay || 10} a day, a few minutes apart.`, '');
  for (const { p, msg, w } of chats.sort(byTime)) {
    const link = p.channel === 'sms' ? `${p.contactLink}?&body=${encodeURIComponent(msg)}` : `${p.contactLink}?text=${encodeURIComponent(msg)}`;
    sendList.push(`## ${p.name} (${p.town} ${p.state})`, '', `- Channel: ${p.channel === 'sms' ? 'SMS' : 'Facebook Messenger'}${p.altContact ? ` (or ${p.altContact})` : ''}`, `- Send: ${w.manila} (${w.local})`, `- [Open with message pre-filled](${link})`, `- After sending: \`node log.js ${p.slug} pitched\``, '', '```', msg, '```', '');
  }
}
fs.mkdirSync(P('pitches'), { recursive: true });
writeJSON('pitches/queue.json', queue);
fs.writeFileSync(P('send-list.md'), sendList.join('\n'));

// tracker: add rows for new prospects only
const cols = ['name', 'market', 'town', 'category', 'contact', 'channel', 'demo_url', 'screenshot', 'date_found', 'date_pitched', 'followup_1_due', 'followup_2_due', 'status', 'google_rating', 'google_reviews', 'notes', 'amount_won', 'currency', 'amount_won_php'];
if (!leads.header.length) leads.header = cols;
let added = 0;
for (const p of prospects) {
  if (statusOf[p.name] !== undefined) continue;
  leads.rows.push({ name: p.name, market: p.market, town: `${p.town} ${p.state}`, category: p.category, contact: p.email || `${p.contactLink}${p.altContact ? ' / ' + p.altContact : ''}`, channel: p.channel, demo_url: `${base}/${p.slug}/`, screenshot: `screenshots/${p.slug}-mobile.jpg`, date_found: p.found, status: 'found', google_rating: p.rating, google_reviews: p.reviewCount, notes: p.notes });
  added++;
}
writeCSV('leads.csv', leads);
console.log(`queued ${queue.filter((q) => q.channel === 'email').length} email + ${queue.filter((q) => q.channel !== 'email').length} hand-sent; tracker rows added: ${added}. Next: node qa.js`);
