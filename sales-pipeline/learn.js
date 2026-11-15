#!/usr/bin/env node
// Turns logged outcomes into decisions, and keeps the pipeline improving on its own:
//   - money: collected, care plans, yearly pace toward settings.goalUSDPerYear, and what the goal takes
//   - experiments (price, subject, call to action): retires clear losers, raises the price ceiling when the
//     highest price is winning, and says when a copy test needs a new challenger
//   - targeting: which business types and markets answer, for the prospect bank
//   - send volume (data/send-state.json): reaches more businesses only while bounces, STOPs and complaints
//     stay low, and cuts back for a week at the first bad signal
//   - client growth: care plan, Local Growth, yearly prepay and referral asks that are due
// Writes playbook/insights.md, which every daily run reads first.
// Usage: node learn.js [--dry]   (--dry: write insights.md only; change no experiment or send settings)
const fs = require('fs');
const { P, readJSON, writeJSON, readJSONL, readCSV, today, addDays, toUSD, daysBetween, experimentStats, probBest, priceArmValue, careValueUSD } = require('./lib');

const DRY = process.argv.includes('--dry');
const config = readJSON('config.json');
const st = config.settings;
const ev = readJSONL('data/outcomes.jsonl');
const mistakes = readJSONL('data/mistakes.jsonl');
const experiments = readJSON('playbook/experiments.json', {});
const experimentsAtStart = JSON.stringify(experiments);
const leads = readCSV('leads.csv').rows;
const T = today();
const changes = [];

const pitched = ev.filter((e) => e.event === 'pitched');
const by = (slug) => ev.filter((e) => e.slug === slug);
const POS = ['interested', 'won', 'deposit', 'paid'];
const WON = ['won', 'deposit', 'paid'];
const outcomeOf = (slug) => {
  const es = by(slug).map((e) => e.event);
  return { reply: es.some((x) => ['replied', 'interested', 'declined', 'stop', 'won', 'deposit', 'paid'].includes(x)), positive: es.some((x) => POS.includes(x)), stop: es.includes('stop') || es.includes('complaint'), won: es.some((x) => WON.includes(x)), bounced: es.includes('bounced') };
};
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
function table(groupFn, title) {
  const g = {};
  for (const e of pitched) { const k = groupFn(e) || 'unknown'; (g[k] = g[k] || []).push(e.slug); }
  const rows = Object.entries(g).map(([k, slugs]) => {
    const o = slugs.map(outcomeOf);
    return `| ${k} | ${slugs.length} | ${pct(o.filter((x) => x.reply).length, slugs.length)} | ${pct(o.filter((x) => x.positive).length, slugs.length)} | ${o.filter((x) => x.won).length} | ${o.filter((x) => x.stop).length} |`;
  });
  return [`### ${title}`, '', '| Group | Sent | Replied | Positive | Won | STOP |', '| --- | --- | --- | --- | --- | --- |', ...(rows.length ? rows : ['| (no sends yet) | 0 | – | – | 0 | 0 |']), ''];
}

const lines = [`# Insights (updated ${T})`, '', 'Read this before every run. It is rebuilt from data/outcomes.jsonl by `node learn.js`, which also tunes prices, copy tests and sending volume.', ''];

// ---------------------------------------------------------------- money
const fx = (e) => toUSD(e.amount || 0, e.currency || 'USD', config);
const cash = ev.filter((e) => ['deposit', 'paid', 'carepaid', 'upsell'].includes(e.event) && e.amount);
const collected = cash.reduce((a, e) => a + fx(e), 0);
const builds90 = cash.filter((e) => e.event !== 'carepaid' && daysBetween(e.date, T) <= 90).reduce((a, e) => a + fx(e), 0);
const care = {};
for (const e of ev) { if (e.event === 'care') care[e.slug] = e; if (e.event === 'carecancel') delete care[e.slug]; }
const activeCare = Object.values(care);
const mrr = activeCare.reduce((a, e) => a + fx(e), 0);
const runRate = mrr * 12 + builds90 * 4;
const goal = st.goalUSDPerYear || 200000;
const goalBy = st.goalBy || '2028-12-31';
const monthsLeft = Math.max(1, Math.round(daysBetween(T, goalBy) / 30.4));
// averages, measured once there are clients, otherwise from today's price arms
const wonSlugs = [...new Set(ev.filter((e) => WON.includes(e.event)).map((e) => e.slug))];
const buildBySlug = {};
for (const e of cash) if (['deposit', 'paid'].includes(e.event)) buildBySlug[e.slug] = (buildBySlug[e.slug] || 0) + fx(e);
const paidBuilds = Object.values(buildBySlug);
const liveArms = (experiments.price ? experiments.price.arms.filter((a) => !a.retired) : [{ multiplier: 1 }]);
const defaultBuild = config.markets.US.tiers.standard * (liveArms.reduce((a, x) => a + x.multiplier, 0) / liveArms.length);
const avgBuild = paidBuilds.length >= 3 ? paidBuilds.reduce((a, b) => a + b, 0) / paidBuilds.length : defaultBuild;
const avgCare = activeCare.length >= 3 ? mrr / activeCare.length : (config.markets.US.careTiers.basic * 0.75 + config.markets.US.careTiers.growth * 0.25);
const careNeeded = Math.ceil((0.6 * goal) / 12 / avgCare);
const buildsNeeded = Math.ceil((0.4 * goal) / 12 / avgBuild);

lines.push('## Money', '');
lines.push(`- Collected so far: ${cash.length ? `${usd(collected)} USD from ${cash.length} payment(s)` : 'nothing yet'}`);
lines.push(`- Care plans: ${activeCare.length} active (${activeCare.filter((e) => e.plan === 'growth').length} Local Growth), ${usd(mrr)}/month`);
lines.push(`- Yearly pace: **${usd(runRate)}** of the ${usd(goal)} goal (${pct(runRate, goal)}), ${monthsLeft} months left to ${goalBy}. Pace = care plans x 12 + last 90 days of build and extra-work revenue x 4.`);
lines.push(`- What the goal takes (60% from care plans, 40% from builds): about **${careNeeded} paying care clients** at ${usd(avgCare)}/month plus **${buildsNeeded} new builds a month** at ${usd(avgBuild)}${paidBuilds.length >= 3 ? ' (measured)' : ' (estimate from the live price arms)'}.`);
// Paid upgrades (own domain + business email) wait until sales have paid for them (owner's rule, 2026-11-15).
const upgradeCost = st.upgradeCostUSD || 115;
const clients = new Set(cash.filter((e) => ['deposit', 'paid'].includes(e.event)).map((e) => e.slug)).size;
const domainLive = /^https:\/\/(?!.*netlify\.app)/.test(config.netlify.baseUrl || '');
if (!domainLive) lines.push(collected >= upgradeCost
  ? `- **Paid upgrades are funded:** ${usd(collected)} collected from ${clients} client(s) covers the domain and business email (about ${usd(upgradeCost)} for year one). Tell the owner, and ask before buying anything: playbook/DOMAIN-SETUP.md.`
  : `- Paid upgrades (own domain + business email, about ${usd(upgradeCost)} a year): on hold until sales cover them. ${usd(collected)} collected so far.`);
const rate = st.phpPerUSD;
lines.push(`- Toward ₱${st.goalPHP.toLocaleString()}: ${rate ? `₱${Math.round(collected * rate).toLocaleString()} (at ₱${rate}/USD)` : `${usd(collected)} USD (set settings.phpPerUSD to convert)`}`, '');

// funnel on pitches old enough to have answered
const aged = pitched.filter((e) => daysBetween(e.date, T) >= 14);
const ao = aged.map((e) => outcomeOf(e.slug));
const winRate = aged.length ? ao.filter((x) => x.won).length / aged.length : 0;
lines.push('### Funnel (pitches at least 14 days old)', '');
if (aged.length) {
  lines.push(`- ${aged.length} pitched → ${pct(ao.filter((x) => x.reply).length, aged.length)} replied → ${pct(ao.filter((x) => x.positive).length, aged.length)} interested → ${pct(ao.filter((x) => x.won).length, aged.length)} became clients`);
  lines.push(`- Care plan take-up: ${pct(new Set(ev.filter((e) => e.event === 'care').map((e) => e.slug)).size, wonSlugs.length)} of clients (expected first-year care value per client: ${usd(careValueUSD(config, ev))})`);
} else lines.push('- No pitch is 14 days old yet. Rates appear here once one is.');
lines.push('');

// ---------------------------------------------------------------- send volume governor
const LEVELS = [
  { days: [2, 3, 4], email: 30, label: 'Tue–Thu, 30 emails a day' },
  { days: [1, 2, 3, 4], email: 30, label: 'Mon–Thu, 30 emails a day' },
  { days: [1, 2, 3, 4, 5], email: 30, label: 'Mon–Fri, 30 emails a day' },
  { days: [1, 2, 3, 4, 5], email: 35, label: 'Mon–Fri, 35 emails a day' },
  { days: [1, 2, 3, 4, 5], email: 40, label: 'Mon–Fri, 40 emails a day' },
];
const ceiling = st.emailCeiling || 40;
const state = readJSON('data/send-state.json', { level: 0, since: T, history: [] });
const emails = pitched.filter((e) => e.channel === 'email');
const firstEmail = emails.map((e) => e.date).sort()[0];
const warmDays = (st.emailWarmup || [[21, 30]]).slice(-1)[0][0];
const recent = emails.filter((e) => daysBetween(e.date, T) <= 21);
const recentSlugs = new Set(recent.map((e) => e.slug));
const recentEv = (name, days = 21) => ev.filter((e) => e.event === name && daysBetween(e.date, T) <= days);
const bounces = recentEv('bounced').filter((e) => recentSlugs.has(e.slug));
const stops = recentEv('stop').filter((e) => recentSlugs.has(e.slug));
const complaints = recentEv('complaint', 14);
const agedRecent = recent.filter((e) => daysBetween(e.date, T) >= 5);
const replies = agedRecent.filter((e) => outcomeOf(e.slug).reply).length;
const bouncesByDay = {};
for (const b of bounces) bouncesByDay[b.date] = (bouncesByDay[b.date] || 0) + 1;
const bad = [];
if (complaints.length) bad.push(`${complaints.length} spam complaint(s) in 14 days`);
if (recent.length >= 20 && bounces.length / recent.length > 0.03) bad.push(`bounce rate ${pct(bounces.length, recent.length)} (limit 3%)`);
if (Object.values(bouncesByDay).some((n) => n > 2)) bad.push('more than 2 bounces in one day');
if (recent.length >= 30 && stops.length / recent.length > 0.05) bad.push(`STOP rate ${pct(stops.length, recent.length)} (limit 5%)`);
const throttled = state.throttleUntil && state.throttleUntil >= T;
let decision = `Holding at level ${state.level}.`;
if (bad.length && !throttled) {
  state.throttleUntil = addDays(T, 7);
  state.level = Math.max(0, state.level - 1);
  state.since = T;
  decision = `**Cut back:** ${bad.join('; ')}. Email cap halved until ${state.throttleUntil} and dropped to level ${state.level}. Check list quality (only emails the business published) before then.`;
  changes.push('send volume cut back');
} else if (throttled) {
  decision = `Throttled until ${state.throttleUntil} (half the usual email cap). No increase until then.`;
} else {
  const need = [];
  if (!firstEmail || daysBetween(firstEmail, T) < warmDays) need.push(`finish the ${warmDays}-day warm-up (${firstEmail ? daysBetween(firstEmail, T) : 0} days so far)`);
  if (recent.length < 60) need.push(`at least 60 emails in the last 21 days (${recent.length})`);
  if (recent.length && bounces.length / recent.length > 0.02) need.push('bounces at 2% or less');
  if (recent.length && stops.length / recent.length > 0.03) need.push('STOPs at 3% or less');
  if (agedRecent.length >= 30 && replies / agedRecent.length < 0.02) need.push(`replies of at least 2% (now ${pct(replies, agedRecent.length)}): improve targeting and the first line before sending more`);
  else if (agedRecent.length < 30) need.push('30 emails at least 5 days old to judge replies');
  if (daysBetween(state.since, T) < 7) need.push('7 days at the current level');
  if (state.level >= LEVELS.length - 1) need.push('nothing: this is the top level for one inbox');
  if (!need.length && LEVELS[state.level + 1].email <= ceiling) {
    state.level++;
    state.since = T;
    decision = `**Stepped up** to level ${state.level} (${LEVELS[state.level].label}): last 21 days had ${recent.length} emails, ${pct(bounces.length, recent.length)} bounces, ${pct(stops.length, recent.length)} STOPs, no complaints, ${pct(replies, agedRecent.length)} replies.`;
    changes.push('send volume stepped up');
  } else decision = `Holding at level ${state.level}. Next step needs: ${need.join('; ')}.`;
}
const L = LEVELS[state.level];
state.sendDays = L.days;
state.emailCapAfterWarmup = Math.min(L.email, ceiling);
const chatPerDay = st.messengerPerDay ?? 10;
const perWeek = L.days.length * (state.emailCapAfterWarmup + chatPerDay);
state.updated = T;
state.history = [...(state.history || []), { date: T, level: state.level, throttleUntil: state.throttleUntil || null }].slice(-60);
lines.push('## Sending volume', '');
lines.push(`- Level ${state.level} of ${LEVELS.length - 1}: ${L.label} after warm-up${chatPerDay ? `, plus up to ${chatPerDay} Messenger/SMS a day sent by the owner` : ' (email only)'}. Up to about ${perWeek} new businesses a week.`);
lines.push(`- Last 21 days: ${recent.length} emails, ${bounces.length} bounced, ${stops.length} STOP, ${complaints.length} complaints, ${pct(replies, agedRecent.length)} replied.`);
lines.push(`- ${decision}`);
lines.push(`- Rules: one level up at most every 7 days, only while healthy; any complaint, bounces over 3% (or 3 in one day) or STOPs over 5% halve the cap for a week. Never more than ${ceiling} emails a day from one inbox. Going beyond that needs your own domain and a second inbox (playbook/deliverability.md), which costs money, so ask the owner.`);
const monthlyReach = perWeek * 4.3;
if (winRate > 0 && aged.length >= 100) {
  const needReach = buildsNeeded / winRate;
  lines.push(`- At the measured ${(winRate * 100).toFixed(1)}% client rate, ${buildsNeeded} builds a month needs about ${Math.round(needReach)} contacts a month; the top level allows about ${Math.round(LEVELS[LEVELS.length - 1].days.length * (ceiling + chatPerDay) * 4.3)}. ${needReach > monthlyReach ? 'Reach is the limit right now: raise conversion (copy, targeting) or price, or ask the owner about a second inbox.' : 'Reach is enough; focus on conversion and price.'}`);
}
if (perWeek > 200) lines.push(`- Research has to keep up: the prospect bank adds about 224 a week at most (16 per run, twice a day). If the bank keeps running dry, raise perRunMax in data/bank-state.json.`);
lines.push('');

// ---------------------------------------------------------------- experiments
function experiment(name, title, success, valueFn, label) {
  const ex = experiments[name];
  if (!ex) return;
  const stats = experimentStats(name, ex, ev, T, success);
  const pb = probBest(stats, ex, valueFn, 4000, name + T);
  lines.push(`### Experiment: ${title}`, '', `Success = ${ex.metric}. Balanced until each version has ${ex.minPerArm} pitches; after that most pitches go to the likely winner.`, '');
  for (const a of stats) lines.push(`- ${a.id}${a.retired ? ' (retired)' : ''} ${label(a)}: ${a.sent} sent, ${a.n} old enough to judge, ${a.s} success${a.s === 1 ? '' : 'es'} (${pct(a.s, a.n)})${a.retired ? '' : a.n < ex.minPerArm ? ', still collecting data' : `, ${Math.round(100 * pb[a.id])}% chance it is best`}`);
  const live = stats.filter((a) => !a.retired);
  const ready = live.every((a) => a.n >= ex.minPerArm);
  const out = [];
  if (ready && live.length > 1) {
    for (const a of live) {
      if (pb[a.id] < 0.05 && ex.arms.filter((x) => !x.retired).length > 1) {
        ex.arms.find((x) => x.id === a.id).retired = true;
        out.push(`retired ${a.id} (${Math.round(100 * pb[a.id])}% chance of being best)`);
      }
    }
  }
  const stillLive = ex.arms.filter((a) => !a.retired);
  if (name === 'price' && ready) {
    const top = stillLive.reduce((a, b) => (b.multiplier > a.multiplier ? b : a));
    if ((pb[top.id] || 0) >= 0.8 || stillLive.length === 1) {
      const m = Math.round((top.multiplier + (ex.step || 0.5)) * 10) / 10;
      if (m <= (ex.maxMultiplier || 3) && !ex.arms.some((a) => a.multiplier === m)) {
        const id = 'P' + (ex.arms.length + 1);
        ex.arms.push({ id, multiplier: m, note: `added ${T}: the highest price was winning`, added: T });
        out.push(`added a higher price challenger ${id} (x${m}, US about $${Math.round((config.markets.US.tiers.standard * m) / 50) * 50} for a standard site)`);
      }
    }
  }
  if (out.length) { changes.push(`${name}: ${out.join(', ')}`); lines.push('', `**Changed today:** ${out.join('; ')}.`); }
  else if (!ready) lines.push('', 'Not enough data yet. Keep sending; never edit an arm that has been sent.');
  else lines.push('', 'No clear loser yet; the sampler keeps favoring the leader.');
  if (name !== 'price' && stillLive.length === 1) lines.push('', `**Action for today's run:** only ${stillLive[0].id} is left in the ${title} test. Add one new challenger to playbook/experiments.json (next id, new \`text\`) that changes one idea, following voice.md: plain words, no !, $, % or ALL CAPS.`);
  lines.push('');
}
lines.push('## Experiments', '');
const priceValue = priceArmValue(config, ev);
experiment('price', 'price', WON, priceValue, (a) => `x${a.multiplier} (US standard site about $${Math.round((config.markets.US.tiers.standard * a.multiplier) / 50) * 50})`);
experiment('subject', 'subject line', POS, undefined, (a) => `"${a.text}"`);
experiment('cta', 'call to action', POS, undefined, (a) => `"${a.text}"`);
experiment('format', 'email format', POS, undefined, (a) => a.note);

// ---------------------------------------------------------------- what is working + targeting
lines.push('## What is working', '');
lines.push(...table((e) => e.market, 'By market'), ...table((e) => e.category, 'By business type'), ...table((e) => e.channel, 'By channel'));
function rank(key) {
  const g = {};
  for (const e of aged) { const k = e[key] || 'unknown'; (g[k] = g[k] || []).push(outcomeOf(e.slug)); }
  return Object.entries(g).map(([k, o]) => ({ k, n: o.length, pos: o.filter((x) => x.positive).length, stop: o.filter((x) => x.stop).length, score: (0.5 + o.filter((x) => x.positive).length) / (15 + o.length) }));
}
lines.push('## Targeting (the prospect bank reads this)', '');
const cats = rank('category'), mkts = rank('market');
const favor = cats.filter((c) => c.n >= 20).sort((a, b) => b.score - a.score).slice(0, 3);
const avoid = [...cats, ...mkts].filter((c) => (c.n >= 20 && c.stop / c.n > 0.1) || (c.n >= 40 && c.pos === 0));
lines.push(favor.length ? `- Favor: ${favor.map((c) => `${c.k} (${pct(c.pos, c.n)} interested of ${c.n})`).join(', ')}. Give these about half of new research.` : '- Not enough data yet (needs 20 pitches per business type, 14+ days old). Keep the current mix.');
lines.push(avoid.length ? `- Avoid for now: ${avoid.map((c) => `${c.k} (${c.n} pitched, ${c.pos} interested, ${c.stop} STOP)`).join(', ')}.` : '- Nothing to avoid yet.');
const mk = mkts.filter((c) => c.n >= 20).sort((a, b) => b.score - a.score);
if (mk.length > 1) lines.push(`- Markets by interest: ${mk.map((c) => `${c.k} ${pct(c.pos, c.n)}`).join(', ')}.`);
lines.push('');

// ---------------------------------------------------------------- due today
// What people actually said: every reply is logged with a short --note (the reason, objection or question).
const said = ev.filter((e) => ['replied', 'interested', 'declined', 'stop', 'complaint'].includes(e.event) && e.note);
lines.push('## What people said (learn from every reply)', '');
if (said.length) {
  const tags = {};
  for (const e of said) for (const t of (e.note.match(/#[\w-]+/g) || [])) { const k = `${t} (${e.event})`; tags[k] = (tags[k] || 0) + 1; }
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) lines.push(`- Most common: ${top.map(([k, n]) => `${k} x${n}`).join(', ')}`);
  lines.push(...said.slice(-10).reverse().map((e) => `- ${e.date} ${e.slug} (${e.event}): ${e.note}`));
  lines.push('', 'Use these: answer the common questions inside the first email or the demo, add a mistake rule when one reply shows a problem, and turn a repeated objection into the next copy challenger.');
} else lines.push('- Nothing yet. Log every reply with a short note and tags, for example `node log.js <slug> declined --note "#price has a nephew who does sites"`. Tags: #price #trust #timing #has-site #facebook-enough #ai #not-owner #interested-later.');
lines.push('');

lines.push('## Due today', '');
const due = leads.filter((r) => r.status === 'pitched' && [r.followup_1_due, r.followup_2_due].some((d) => d && d !== 'done' && d <= T));
lines.push(...(due.length ? due.map((r) => `- Follow-up for ${r.name} (${r.followup_1_due !== 'done' ? 'first, day 4' : 'second and last, day 9'}). It must add something new: a demo tweak or a useful tip.`) : ['- No follow-ups due.']));
// client growth: every ask is drafted for the owner to approve, and asked once (log `offered --note <care|growth|annual|referral>`)
const offered = (slug, what) => by(slug).some((e) => e.event === 'offered' && (e.note || '').toLowerCase().includes(what));
const has = (slug, names) => by(slug).some((e) => names.includes(e.event));
const lastDate = (slug, names) => by(slug).filter((e) => names.includes(e.event)).map((e) => e.date).sort().pop();
const grow = [];
for (const slug of wonSlugs) {
  const paidOn = lastDate(slug, ['paid']);
  if (paidOn && daysBetween(paidOn, T) >= 1 && !has(slug, ['care', 'carecancel']) && !offered(slug, 'care')) grow.push(`- ${slug}: offer the care plan, Basic or Local Growth, with the yearly option (closing.md step 8). Then \`node log.js ${slug} offered --note care\`.`);
  const c = care[slug];
  if (c && c.plan !== 'growth' && daysBetween(c.date, T) >= 45 && !offered(slug, 'growth')) grow.push(`- ${slug}: on Basic for ${daysBetween(c.date, T)} days. Offer Local Growth (closing.md step 10). Then \`node log.js ${slug} offered --note growth\`.`);
  if (c && !c.annual && daysBetween(c.date, T) >= 60 && !offered(slug, 'annual')) grow.push(`- ${slug}: offer to switch to yearly billing (${12 - config.markets[c.market || 'US'].careTiers.annualMonths} months free). Then \`node log.js ${slug} offered --note annual\`.`);
  if (paidOn && daysBetween(paidOn, T) >= 7 && !has(slug, ['testimonial', 'referral']) && !offered(slug, 'referral')) grow.push(`- ${slug}: ask for a testimonial and a referral (closing.md step 9). Then \`node log.js ${slug} offered --note referral\`.`);
}
if (grow.length) lines.push('', '### Grow existing clients (draft each one; the owner approves before it is sent)', '', ...grow);
lines.push('');
const hot = leads.filter((r) => ['replied', 'interested'].includes(r.status));
if (hot.length) lines.push('## Waiting on you', '', ...hot.map((r) => `- ${r.name}: ${r.status}. Reply within the hour (playbook/replies.md).`), '');

// ---------------------------------------------------------------- warnings and mistakes
const allBounces = ev.filter((e) => e.event === 'bounced').length, allStops = pitched.length ? ev.filter((e) => ['stop', 'complaint'].includes(e.event)).length : 0;
if (pitched.length >= 20 && allStops / pitched.length > 0.1) lines.push(`**Warning:** ${pct(allStops, pitched.length)} of pitches got STOP or a complaint. Tighten targeting before sending more.`, '');
if (pitched.length >= 10 && allBounces / pitched.length > 0.05) lines.push(`**Warning:** ${pct(allBounces, pitched.length)} bounced. Only use emails published by the business itself.`, '');
lines.push('## Mistakes we will not repeat', '', ...(mistakes.length ? mistakes.map((m) => `- ${m.date}: ${m.what} → **${m.fix}**${m.pattern ? ' (auto-checked by qa.js)' : ''}`) : ['- None logged yet. Log one with `node log.js mistake "<what>" --fix "<rule>"`.']), '');
lines.push('## Changed by learn.js today', '', ...(changes.length ? changes.map((c) => `- ${c}`) : ['- Nothing.']), '');

fs.writeFileSync(P('playbook/insights.md'), lines.join('\n'));
if (!DRY) {
  writeJSON('data/send-state.json', state);
  if (JSON.stringify(experiments) !== experimentsAtStart) writeJSON('playbook/experiments.json', experiments);
}
console.log(lines.slice(0, 60).join('\n'));
if (DRY) console.log('\n(dry run: experiments.json and send-state.json not changed)');
