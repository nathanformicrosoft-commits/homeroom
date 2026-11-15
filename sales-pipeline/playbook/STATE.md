# Visaya Web Studio: current state and decisions

The memory between chats. `/visayaweb` loads this file in any new chat. **Every session that changes something adds it here** (a decision, a status line, a log line), then commits and pushes. Keep it short: details belong in the other playbooks.

## The business
- Visaya Web Studio (owner Nathaniel Visaya, Antipolo City, Philippines) builds one-page websites for small US (and some AU) businesses with no website. The pitch is a free demo built from their public listing.
- Goals: ₱100,000 in sales first, then a $200,000-a-year pace by end of 2028, mostly from care plans.
- Repo: `C:\Users\natha\Projects\visaya-sales`, folder `sales-pipeline/`, branch `claude/daily-sales-pipeline-vlsx7w` (push works). The daily loop is `playbook/RUNBOOK.md`. Live numbers are in `playbook/insights.md` (from `node learn.js`), the latest day in `reports/`.

## Owner decisions (newest last; don't re-litigate these)
- 2026-11-14: approved the first 26 emails for timed sending (`pitches/autosend.json`).
- 2026-11-15: **one-line approvals.** All sends need the owner's OK in chat ("approve all" → `node autosend.js approve all`). Scheduled tasks only draft. Claude does not send unapproved messages, create invoices or move money.
- 2026-11-15: **email only.** The owner sends no Messenger or SMS (`settings.emailOnly`).
- 2026-11-15: **payments** through `paypal.me/MarjorieVisaya/<amount><CUR>` (checked: prefills the amount and currency). Money goes to Marjorie Visaya's PayPal. The owner reports payments in chat; Claude logs them with `log.js`.
- 2026-11-15: **prices are tested** (x1 / x1.4 / x2 of the tiers; ceiling x4). Care plans: Basic $49, Local Growth $99, 2 months free when paid yearly (older pitches quoted $39; honor that).
- 2026-11-15: **paid upgrades wait** until sales cover them (about $115: domain + Workspace). Then the budget plan in `DOMAIN-SETUP.md` applies (up to about $1,000 of first-month revenue), and each purchase is asked first.
- 2026-11-15: holidays skipped (US + AU, through 2027, `settings.skipDates`).
- 2026-11-15: **subagent workline** in `CLAUDE.md` / `.claude/agents/` (11 agents, each with its own model and effort). Research runs on Sonnet (`prospect-researcher`) to save usage.
- 2026-11-15: the owner is upgrading to the Claude Max plan. **When confirmed:** set `perRunMax` to 24 in `data/bank-state.json`.
- 2026-11-15 (revenue pass): approved and built: the reply watch reads emails and prices from `data/prospects.json` (never `queue.json`); research is two-stage and email first (`bank.js` stage A, then `enrich` at take time, using `playbook/photo-pool.json`); the one-email close in `closing.md`; a care ledger in `learn.js` that counts only paid-up plans (yearly = 10/12 of monthly) and adds "Care payments due"; `node learn.js --links <slug>` is the only source of payment amounts and links (market currency, AUD for AU).
- 2026-11-15: **demo pages use nathanformicrosoft@gmail.com** (the watched inbox), not the personal Gmail.
- 2026-11-15: **refund rule confirmed:** on a care cancel, every full unused month is refunded (yearly plan = 1/12 of its price a month). It's in the close terms and the cancel template.
- 2026-11-15: **targeting:** the perfect customer is an owner-run home or outdoor service business in a small town that works at the customer's place, gets its calls from Google and reviews, charges $250–600 a job, has 4.5+ stars and 25–150 reviews, and reads a Gmail. Trade groups and priors are in `playbook/trade-groups.json`. Hunt order: tree, exterior cleaning, home trades, pest/septic, pets, lawn (year-round states), auto, cleaning/junk. **Barbers and food are deprioritized** (at most 1 each per run or take). HVAC, roofing, plumbing, snow-only work and chains are skipped.
- 2026-11-15: **reinvest earnings into reach:** after the $115 own-domain setup, add one sending domain + inbox a month (about $95/yr each, up to 6 inboxes / about 240 emails a day) while cash covers it with a $300 cushion and every inbox is healthy. Each purchase still gets the owner's yes. Ladder in `DOMAIN-SETUP.md` "Reinvestment ladder". Projection (expected): ₱1M about May 2027, $200k pace about Dec 2027.
- 2026-11-15: **upgrade alerts:** the ladder is `playbook/upgrades.json` + `node upgrades.js status`. learn.js puts an "**Act on:**" line at the top of insights.md (ready to buy, renewals, dated reminders, ₱ milestones). The daily report and push notification lead with it. The owner buys; Claude logs it with `node upgrades.js bought <id> --amount N` (`data/spend.jsonl`). `settings.reinvestShare` (1.0) sets how much of collected money goes to upgrades; `settings.upgradeCushionUSD` is 300.
- 2026-11-15: **after Nov 18, widen `sendLocalHours` to 8–11 AM** (about 6 more slots per time zone). Not done yet: it's a sending change, frozen until the 26 are out. AU research stays off for now.
- 2026-11-15: **daily step 7 (pitch.js) is paused until 2026-11-19**, so the queue isn't rewritten while the 26 timed sends go out. Tonight's daily run was skipped (one-night skip line in its SKILL.md; remove it any time after today).

## Status (update when it changes)
- Launch: first emails go out **Tue Nov 17** (AU 5:05–8:12 AM, US 9:03–10:28 PM Manila) and **Wed Nov 18** (9:05–11:26 PM Manila). Checked 2026-11-15: 26/26 Gmail drafts exist in nathanformicrosoft@gmail.com, 26/26 demos load, QA PASS.
- The timed-send jobs live only in the chat that created them (session-only CronCreate). If that chat is closed, `/visayaweb` finds waiting sends without jobs and offers to reschedule them. 2026-11-15 (evening): a /visayaweb chat rescheduled all 26 at +3 min (last one Wed Nov 18 11:29 PM Manila), so that chat and the app must stay open until then.
- Prospect bank: empty. The 2026-11-14 and both 2026-11-15 runs failed on the 5-hour usage limit. Now: Sonnet research, email-first stage-A leads (about a third of the old cost), still 16 per run (2 subagents x 8). The 2026-11-16 2:27 AM run is the first test of this; raise perRunMax only after a run finishes inside the limit. Daily step 4 now takes stage-A leads and enriches only those (Maps re-check + write-up).
- Demos redeployed 2026-11-15 8 PM: contact email is nathanformicrosoft@gmail.com; the finished-site price line is updated. QA PASS.
- Scheduled tasks: `visaya-daily-pipeline` (7:27 PM), `visaya-reply-watch` (hourly, Manila 9 PM to 5 PM; exits at once until the first send), `visaya-prospect-bank` (2:17 AM and 1:17 PM).

## Open items
- After the first sends: watch replies and approve fast. Redo the revenue forecast after about 2 weeks of real data.
- When sales reach about $115: tell the owner the upgrades are funded (`DOMAIN-SETUP.md`).
- Weekly growth review (`visaya-growth-review`, Sundays): designed but NOT created. The app's permission check blocked creating a new scheduled task. It would read STATE, insights, upgrades and the last 7 reports, write a scorecard and a ranked ideas list to `playbook/growth-ideas.md`, apply only allowed self-tuning (one copy challenger; trade-group priors ±0.3 for groups with 15+ pitches), and notify the owner. Waiting on the owner to allow it or create it.
- Before the second inbox is bought (expected about Jan 2027): build multi-inbox sending (caps and warm-up per inbox, drafts in the right mailbox, replies from the thread's inbox), and have learn.js say in insights.md when the next ladder rung is funded.
- By Oct 2027: add 2028 holidays to `settings.skipDates` (learn.js warns).
- Owner to confirm: the refund rule in the close terms (every full unused month comes back; yearly plan = 1/12 a month), that care starts on launch day, AUD prices for the founding-client discount and upsells (closing.md says "ask the owner"), and whether the close (about 330 words) should be trimmed.
- After Nov 18 (frozen until then): match leads by slug, not name (`pitch.js`, `log.js`); make `pitch.js` merge the queue instead of rewriting it; `replies.md` and config `payments.rules` still write `$`/`USD` examples without the currency code.
- Nov 19: set `settings.sendLocalHours` to [8,11] (owner approved 2026-11-15), and remove the one-night skip and step-7 pause lines from the daily SKILL.md.
- After the 2026-11-16 2:27 AM run proves stage A: add the optional research fields `serviceArea`, `fbLastPost` and `deadDomain` to PROSPECTING-BRIEF.md and prospect-researcher.md (`bank.js` already scores them).
- About Dec 1, once pitches are 14+ days old: learning by trade group weighted by first-year value with care counted most (`groupAdj` in bank.js, groups in learn.js "By business type"); planned, not built.
- Owner to check: whether PayPal buyer protection covers PayPal.me payments (the "Is this a scam?" reply no longer claims it).
- Not built yet (owner decision needed): nudges for leads who replied and then went quiet (+2/+5 days), a day-28 re-pitch, follow-ups timed to the lead's morning, a minimum-wins guard on the price-test rules, and a seasonal care pause plan.
- insights.md is committed; "What people said" still quotes STOP and complaint notes. Check whether the repo is private.

## Session log (one line per session: date, what changed)
- 2026-11-14/15: built the pipeline optimizer (price/copy/format tests, care tiers, revenue goal, send governor, lead scoring), one-line approvals, PayPal.me payments, email only, holiday skips, research fix, subagent workline, /visayaweb.
- 2026-11-15: improved /visayaweb: it pulls first, checks every unsent timed send (not just the last few), asks about late and NOW sends instead of scheduling them, and covers the care/carepaid/upsell and STOP logging. NEW-CHAT-PROMPT.md is marked replaced.
- 2026-11-15: /visayaweb check: no timed-send jobs found; owner approved rescheduling all 26 pitches at +3 min in this chat. Bank still empty (usage limit).
- 2026-11-15 (evening): revenue pass. Fixed the reply watch losing pitched leads, cheaper two-stage research, the one-email close, the care billing ledger plus `--links`, AUD links for AU, permanent STOP, a care-cancel path, and the demo inbox. Reviewed and audited, demos redeployed, step 7 paused to Nov 19. The 26 send jobs are still in the earlier /visayaweb chat.
- 2026-11-15 (night): targeting pass. Added trade groups plus an ICP lead score, a `take` spread across time zones and trades (35% zone cap, 40% trade cap, 20% exploration, barber/food at most 1, avoid list excluded, STOP-heavy trades at -5), the hunt list in the bank task, and care wording by trade (Local Growth first for Google-driven trades). Reviewed, and all 8 findings fixed.
- 2026-11-15 (late): reinvestment ladder (DOMAIN-SETUP), upgrade alerts (`upgrades.js`, spend log, "Act on:" line in insights, daily report and notification), /visayaweb shows Act on. Revenue outlook and summary pages updated for reinvesting. Growth-review task blocked by a permission check.
