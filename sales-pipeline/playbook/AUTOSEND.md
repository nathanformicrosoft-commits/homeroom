# Timed sends (owner-approved batches only)

`pitches/autosend.json` lists every email the owner has approved for timed sending (slug, address, Gmail draft id, send time, `approved` date). The first 26 first-touch emails were approved on 2026-11-14. **Nothing else may be sent**: an email is added only after the owner approves it in chat, in their own words. Any other message (new pitches, follow-ups, replies) stays a draft until then. Scheduled tasks never add entries.

## Approving a new batch (main chat session, after the owner says to)
1. The daily run records each Gmail draft it creates in `pitches/drafts.json` (`{ "<slug>": "<draftId>" }`).
2. When the owner approves ("approve today's emails", or names businesses): `node autosend.js approve all` (or `approve <slug...>`). It adds only drafted, unsent emails whose time is still ahead, and prints a `CRON` line for each.
3. For each CRON line, create a one-shot CronCreate job with that cron and the prompt: `Timed send for <slug> (approved by the owner): follow C:\Users\natha\Projects\visaya-sales\sales-pipeline\playbook\AUTOSEND.md for this slug.`
4. Commit and push `pitches/autosend.json`. Tell the owner the last send time, so they know how long to keep the chat and the app open.
`node autosend.js list` shows every approved send and whether it went out.

## When a timed job fires for `<slug>`
1. Look up `<slug>` in `pitches/autosend.json`. If it isn't there, stop: not approved.
2. **Skip and don't send** if any of these is true (note the reason in the day's report):
   - `data/outcomes.jsonl` already has a `pitched` event for the slug (it was sent by hand).
   - Gmail `in:sent to:<address>` finds a message (the owner sent it).
   - The slug, address or business is on `data/do-not-contact.csv`, or has a `stop` event.
   - The draft no longer exists (`get_draft` fails). The owner deleted it on purpose.
   - The demo URL doesn't return 200 (`curl -s -o /dev/null -w "%{http_code}" <demoUrl>`).
   - `data/send-state.json` has a `throttleUntil` date on or after today: a bounce spike, STOP spike or complaint was logged. Hold the send and tell the owner.
3. Send the draft exactly as it is with the Gmail connector's `send_message` and `draftId`. Don't rewrite it.
4. Run `node log.js <slug> pitched`, then commit (with the Co-Authored-By line) and push.
5. If the send fails, don't retry in a loop. Leave the draft, add it to the report, and tell the owner.
