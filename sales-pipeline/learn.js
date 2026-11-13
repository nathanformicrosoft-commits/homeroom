#!/usr/bin/env node
// Turns logged outcomes into decisions: what is working, what to stop doing, what is due today.
// Writes playbook/insights.md, which every daily run reads first. Usage: node learn.js
const fs = require('fs');
const { P, readJSON, readJSONL, readCSV, today } = require('./lib');

const config = readJSON('config.json');
const ev = readJSONL('data/outcomes.jsonl');
const mistakes = readJSONL('data/mistakes.jsonl');
const experiments = readJSON('playbook/experiments.json', {});
const leads = readCSV('leads.csv').rows;

const pitched = ev.filter((e) => e.event === 'pitched');
const by = (slug) => ev.filter((e) => e.slug === slug);
const POS = ['interested', 'won', 'deposit', 'paid'];
const outcomeOf = (slug) => {
  const es = by(slug).map((e) => e.event);
  return { reply: es.some((x) => ['replied', 'interested', 'declined', 'stop', 'won', 'deposit', 'paid'].includes(x)), positive: es.some((x) => POS.includes(x)), stop: es.includes('stop') || es.includes('complaint'), won: es.some((x) => ['won', 'deposit', 'paid'].includes(x)), bounced: es.includes('bounced') };
};
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
function table(groupFn, title) {
  const g = {};
  for (const e of pitched) { const k = groupFn(e) || 'unknown'; (g[k] = g[k] || []).push(e.slug); }
  const rows = Object.entries(g).map(([k, slugs]) => {
    const o = slugs.map(outcomeOf);
    return `| ${k} | ${slugs.length} | ${pct(o.filter((x) => x.reply).length, slugs.length)} | ${pct(o.filter((x) => x.positive).length, slugs.length)} | ${o.filter((x) => x.won).length} | ${o.filter((x) => x.stop).length} |`;
  });
  return [`### ${title}`, '', '| Group | Sent | Replied | Positive | Won | STOP |', '| --- | --- | --- | --- | --- | --- |', ...(rows.length ? rows : ['| (no sends yet) | 0 | – | – | 0 | 0 |']), ''];
}

// experiment verdict: only call a winner with enough data per arm
const lines = [`# Insights (updated ${today()})`, '', 'Read this before every run. It is rebuilt from data/outcomes.jsonl by `node learn.js`.', ''];
const won = ev.filter((e) => ['deposit', 'paid'].includes(e.event) && e.amount);
const usd = won.filter((e) => e.currency === 'USD').reduce((a, e) => a + e.amount, 0);
const rate = config.settings.phpPerUSD;
lines.push('## Money', '', `- Collected: ${won.length ? won.map((e) => `${e.amount} ${e.currency}`).join(', ') : 'nothing yet'}`, `- Toward ₱${config.settings.goalPHP.toLocaleString()}: ${rate ? `₱${Math.round(usd * rate).toLocaleString()} (at ₱${rate}/USD)` : `$${usd} USD (set settings.phpPerUSD to convert)`}`, '');

lines.push('## Due today', '');
const due = leads.filter((r) => r.status === 'pitched' && [r.followup_1_due, r.followup_2_due].some((d) => d && d !== 'done' && d <= today()));
lines.push(...(due.length ? due.map((r) => `- Follow-up for ${r.name} (${r.followup_1_due !== 'done' ? 'first, day 4' : 'second and last, day 9'}). It must add something new: a demo tweak or a useful tip.`) : ['- No follow-ups due.']), '');
const hot = leads.filter((r) => ['replied', 'interested'].includes(r.status));
if (hot.length) lines.push('## Waiting on you', '', ...hot.map((r) => `- ${r.name}: ${r.status}. Reply within the hour (playbook/replies.md).`), '');

lines.push('## What is working', '');
lines.push(...table((e) => e.market, 'By market'), ...table((e) => e.category, 'By business type'), ...table((e) => e.channel, 'By channel'));
if (experiments.subject) {
  const ex = experiments.subject;
  lines.push(`### Experiment: subject line (needs ${ex.minPerArm} sends per version before calling it)`, '');
  const res = ex.arms.map((a) => { const s = pitched.filter((e) => e.variant && e.variant.subject === a.id).map((e) => e.slug); const o = s.map(outcomeOf); return { ...a, n: s.length, pos: o.filter((x) => x.positive).length, rep: o.filter((x) => x.reply).length }; });
  for (const r of res) lines.push(`- ${r.id}${r.retired ? ' (retired)' : ''} "${r.text}": ${r.n} sent, ${pct(r.rep, r.n)} replied, ${pct(r.pos, r.n)} positive`);
  const live = res.filter((r) => !r.retired);
  if (live.every((r) => r.n >= ex.minPerArm)) {
    const best = [...live].sort((a, b) => b.pos / b.n - a.pos / a.n || b.rep / b.n - a.rep / a.n)[0];
    lines.push('', `**Decision:** ${best.id} leads. Retire the others in playbook/experiments.json and add one new challenger to test against it.`);
  } else lines.push('', 'Not enough data yet. Keep sending; do not change the copy mid-test.');
  lines.push('');
}
const bounces = ev.filter((e) => e.event === 'bounced').length, stops = pitched.length ? ev.filter((e) => ['stop', 'complaint'].includes(e.event)).length : 0;
if (pitched.length >= 20 && stops / pitched.length > 0.1) lines.push(`**Warning:** ${pct(stops, pitched.length)} of pitches got STOP or a complaint. Tighten targeting before sending more.`, '');
if (pitched.length >= 10 && bounces / pitched.length > 0.05) lines.push(`**Warning:** ${pct(bounces, pitched.length)} bounced. Only use emails published by the business itself.`, '');

lines.push('## Mistakes we will not repeat', '', ...(mistakes.length ? mistakes.map((m) => `- ${m.date}: ${m.what} → **${m.fix}**${m.pattern ? ' (auto-checked by qa.js)' : ''}`) : ['- None logged yet. Log one with `node log.js mistake "<what>" --fix "<rule>"`.']), '');
fs.writeFileSync(P('playbook/insights.md'), lines.join('\n'));
console.log(lines.slice(0, 40).join('\n'));
