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

## Status (update when it changes)
- Launch: first emails go out **Tue Nov 17** (AU 5:05–8:12 AM, US 9:03–10:28 PM Manila) and **Wed Nov 18** (9:05–11:26 PM Manila). Checked 2026-11-15: 26/26 Gmail drafts exist in nathanformicrosoft@gmail.com, 26/26 demos load, QA PASS.
- The timed-send jobs live only in the chat that created them (session-only CronCreate). If that chat is closed, `/visayaweb` finds waiting sends without jobs and offers to reschedule them. 2026-11-15 (evening): a /visayaweb chat rescheduled all 26 at +3 min (last one Wed Nov 18 11:29 PM Manila), so that chat and the app must stay open until then.
- Prospect bank: empty. The 2026-11-14 and both 2026-11-15 runs failed on the 5-hour usage limit (the 1:27 PM run died in 6 seconds, so the Sonnet fix is still untested). Fixed: research on Sonnet, 16 per run. Next runs at about 2:27 AM and 1:27 PM daily.
- Scheduled tasks: `visaya-daily-pipeline` (7:27 PM), `visaya-reply-watch` (hourly, Manila 9 PM to 5 PM; exits at once until the first send), `visaya-prospect-bank` (2:17 AM and 1:17 PM).

## Open items
- After the first sends: watch replies and approve fast. Redo the revenue forecast after about 2 weeks of real data.
- When sales reach about $115: tell the owner the upgrades are funded (`DOMAIN-SETUP.md`).
- When a second inbox exists: build multi-inbox sending (caps and warm-up per inbox).
- By Oct 2027: add 2028 holidays to `settings.skipDates` (learn.js warns).

## Session log (one line per session: date, what changed)
- 2026-11-14/15: built the pipeline optimizer (price/copy/format tests, care tiers, revenue goal, send governor, lead scoring), one-line approvals, PayPal.me payments, email only, holiday skips, research fix, subagent workline, /visayaweb.
- 2026-11-15: improved /visayaweb: it pulls first, checks every unsent timed send (not just the last few), asks about late and NOW sends instead of scheduling them, and covers the care/carepaid/upsell and STOP logging. NEW-CHAT-PROMPT.md is marked replaced.
- 2026-11-15: /visayaweb check: no timed-send jobs found; owner approved rescheduling all 26 pitches at +3 min in this chat. Bank still empty (usage limit).
