#!/usr/bin/env node
// Renders email pitches, the tap-to-send list and new tracker rows from data/prospects.json + config.json.
// Usage: node pitch.js [YYYY-MM-DD run date]
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const prospects = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/prospects.json'), 'utf8'));
const s = config.studio, runDate = process.argv[2] || new Date().toISOString().slice(0, 10);
const missing = ['studioName', 'ownerName', 'city', 'email'].filter((k) => !s[k]);
const live = !!config.netlify.baseUrl;
const base = config.netlify.baseUrl || config.netlify.plannedUrl;
const v = (k, label) => s[k] || `[[${label}]]`;
const words = (t) => t.trim().split(/\s+/).length;

// next Tue-Thu 9am local, shown in Manila time
function sendWindow(tz) {
  const d = new Date(runDate + 'T00:00:00Z');
  do { d.setUTCDate(d.getUTCDate() + 1); } while (![2, 3, 4].includes(d.getUTCDay()));
  const day = d.toISOString().slice(0, 10);
  const off = (zone) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(day + 'T00:00:00Z')).find((x) => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00'; const [h, m] = p.split(':'); return Number(h) + Math.sign(Number(h)) * Number(m || 0) / 60; };
  const shift = 8 - off(tz); // Manila is UTC+8
  const fmt = (h) => { const t = h + shift; const hh = Math.floor(t), mm = Math.round((t - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}${hh < 12 ? 'am' : 'pm'}`; };
  return { day, ph: `${fmt(8)}–${fmt(10)} Manila time` };
}

const price = (p) => config.pricing[p.market];
function emailPitch(p) {
  const url = `${base}/${p.slug}/`;
  const what = ['cafe', 'diner'].includes(p.theme) ? 'menu highlights' : 'services';
  const body = [
    p.pitch.greeting, '',
    p.pitch.line1, '',
    `I'm ${v('ownerName', 'YOUR NAME')} from ${v('studioName', 'STUDIO NAME')}, a small web-design studio in ${v('city', 'CITY')}, Philippines. ${p.pitch.gap}, so I built you a free demo homepage: ${url}`, '',
    `It has your ${what}, hours, a map, click-to-call and a contact form. A finished version is ${price(p).site} one-off, with an optional care plan (${price(p).care}) for hosting, updates and small edits.`, '',
    `Reply "yes" and I'll finish it in 3 days.`,
  ].join('\n');
  const sign = ['', v('ownerName', 'YOUR NAME'), `${v('studioName', 'STUDIO NAME')}, ${v('city', 'CITY')}, Philippines`, v('email', 'EMAIL'), '', `Not interested? Reply STOP and I won't contact you again.`].join('\n');
  return { subject: `I built a free homepage for ${p.name}`, body: body + '\n' + sign, wc: words(body) };
}
function chatPitch(p) {
  const url = `${base}/${p.slug}/`;
  return `${p.pitch.greeting} ${p.pitch.line1} I'm ${v('ownerName', 'YOUR NAME')} from ${v('studioName', 'STUDIO NAME')}, a small web-design studio in the Philippines. ${p.pitch.gap}, so I built you a free demo homepage: ${url} A finished version is ${price(p).site}. Reply "yes" and I'll finish it in 3 days, or reply STOP and I won't message again.`;
}

const blockers = [];
if (missing.length) blockers.push(`config.json is missing: ${missing.join(', ')}`);
if (!live) blockers.push('demo site is not deployed yet, so the links below do not work');
const banner = blockers.length ? `> NOT READY TO SEND: ${blockers.join('; ')}.\n\n` : '';

fs.mkdirSync(path.join(ROOT, 'pitches'), { recursive: true });
const sendList = [`# Send list for ${runDate}`, '', banner + 'You tap Send yourself. Maximum 10 per day. Each message names who you are and how to opt out.', ''];
for (const p of prospects) {
  const w = sendWindow(p.tz);
  if (p.channel === 'email') {
    const e = emailPitch(p);
    if (e.wc > 110) console.warn(`WARN ${p.slug}: body is ${e.wc} words`);
    fs.writeFileSync(path.join(ROOT, 'pitches', `${p.slug}.md`), `${banner}**To:** ${p.email} (${p.emailSource})\n**Subject:** ${e.subject}\n**Send:** ${w.day}, 8–10am ${p.town} time (${w.ph})\n**Body words:** ${e.wc}\n\n---\n\n${e.body}\n`);
  } else {
    const m = chatPitch(p);
    const link = p.channel === 'sms' ? `${p.contactLink}?&body=${encodeURIComponent(m)}` : `${p.contactLink}?text=${encodeURIComponent(m)}`;
    sendList.push(`## ${p.name} (${p.town} ${p.state})`, '', `- Channel: ${p.channel === 'sms' ? 'SMS' : 'Facebook Messenger'}${p.altContact ? ` (or ${p.altContact})` : ''}`, `- Best time: ${w.day}, 8–10am ${p.town} time (${w.ph})`, `- [Open with message pre-filled](${link})`, `- Page or number: ${p.contactLink}`, '', '```', m, '```', '');
  }
}
fs.writeFileSync(path.join(ROOT, 'send-list.md'), sendList.join('\n'));

// tracker: append rows for prospects not already in leads.csv; never rewrite existing rows
const csvPath = path.join(ROOT, 'leads.csv');
const cols = ['name', 'market', 'town', 'category', 'contact', 'channel', 'demo_url', 'screenshot', 'date_found', 'date_pitched', 'followup_1_due', 'followup_2_due', 'status', 'google_rating', 'google_reviews', 'notes', 'amount_won', 'currency', 'amount_won_php'];
const q = (x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`;
let csv = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : cols.join(',') + '\n';
let added = 0;
for (const p of prospects) {
  if (csv.includes(q(p.name) + ',')) continue;
  const contact = p.email || `${p.contactLink}${p.altContact ? ' / ' + p.altContact : ''}`;
  csv += [p.name, p.market, `${p.town} ${p.state}`, p.category, contact, p.channel, live ? `${base}/${p.slug}/` : `(not live) ${base}/${p.slug}/`, `screenshots/${p.slug}-mobile.jpg`, p.found, '', '', '', 'found', p.rating, p.reviewCount, p.notes, '', '', ''].map(q).join(',') + '\n';
  added++;
}
fs.writeFileSync(csvPath, csv);
console.log(`pitches: ${prospects.filter((p) => p.channel === 'email').length} email, ${prospects.filter((p) => p.channel !== 'email').length} send-list; tracker rows added: ${added}; blockers: ${blockers.length ? blockers.join(' | ') : 'none'}`);
