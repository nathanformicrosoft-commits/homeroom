> **Replaced (2026-11-15): don't use this file.** To pick up the work in a new chat, type `/visayaweb` instead. It loads STATE.md and checks the timed sends against what's really waiting. The prompt below is kept only as a record of the Nov 14 handover. It is out of date: don't paste it, and don't act on its step 1 (scheduling all 26 sends).

Paste everything below the line into a new Claude Code chat (project folder: C:\Users\natha\Projects\visaya-sales).

---

You're taking over the Visaya Web Studio sales pipeline from a previous chat. Keep usage low: don't re-read the whole repo. Read only what each step needs.

Context: repo C:\Users\natha\Projects\visaya-sales, folder sales-pipeline/, branch claude/daily-sales-pipeline-vlsx7w (git push works). The daily loop is playbook/RUNBOOK.md. The latest report is reports/2026-11-14.md. Three scheduled tasks already exist; do not recreate them: visaya-daily-pipeline (7:13 PM daily), visaya-reply-watch (hourly) and visaya-prospect-bank (2:17 AM and 1:17 PM, refills data/bank.json to 100).

Do these now:

1. TIMED SENDS. I, the owner, approve sending the 26 first-touch emails that are saved as Gmail drafts and listed in sales-pipeline/pitches/autosend.json, each at its scheduled time. For every entry whose time is still in the future, create a one-shot CronCreate job 3 minutes after its time (the previous chat's jobs fire at the exact time; the 3-minute offset lets the procedure see an email already went out and skip it, so nothing is sent twice). Prompt for each job: "Timed send for <slug> (approved by the owner): follow C:\Users\natha\Projects\visaya-sales\sales-pipeline\playbook\AUTOSEND.md for this slug." List any entries whose time has already passed without being sent, and ask me what to do with them. Then tell me to keep this chat and the app open until Wed Nov 18, 11:40 PM Manila time.

2. HEALTH CHECK, short: run `node learn.js`, `node qa.js` and `node bank.js status` in sales-pipeline/, and list_scheduled_tasks plus the last run of each task. The first prospect-bank run (Nov 14, 1:28 PM) produced no research files. Check whether the later runs fill data/bank.json. If they still don't, read that task's run transcript (list_task_runs, then list_events), find the cause, and fix the task prompt.

3. Report back in a few lines: what's scheduled, anything broken, and what I need to do (Messenger/SMS from send-list.md are mine to send).

Rules: write naturally and honestly, never invent facts, never claim to be local, never ask for card numbers or passwords, never spend money without asking me, and honor STOP immediately with `node log.js <slug> stop`. New pitches, follow-ups and replies written by the scheduled tasks stay as Gmail drafts until I approve sending them in chat.
