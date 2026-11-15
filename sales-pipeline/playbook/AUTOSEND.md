# Timed sends (owner-approved batches only)

`pitches/autosend.json` lists every email the owner has approved (slug, kind, address, Gmail draft id, send time, `approved` date). The first 26 first-touch emails were approved on 2026-11-14. **Nothing else may be sent**: an email is added only after the owner approves it in chat, in their own words. Every other message (new pitches, follow-ups, replies) stays a draft until then. Scheduled tasks never add entries and never send.

## Approving a batch (main chat session, after the owner says to)
1. The scheduled tasks record every Gmail draft they create: first-touch pitches in `pitches/drafts.json` (`{ "<slug>": "<draftId>" }`), and replies, follow-ups and client messages in `pitches/pending.json` (`{ slug, kind, draftId, to, summary, created }`). They notify the owner how many are waiting.
2. The owner can review them (`node autosend.js pending` lists them with a one-line summary; the drafts are in Gmail). Approval must come from the owner in chat, in their own words, for example "approve all" or "approve ftk-llc and ellis-clean". It covers only the drafts waiting at that moment, never later ones.
3. Run `node autosend.js approve all` (or `approve <slug...>`). It prints:
   - `CRON` lines for first-touch pitches: create a one-shot CronCreate job for each with the prompt `Timed send for <slug> (approved by the owner): follow C:\Users\natha\Projects\visaya-sales\sales-pipeline\playbook\AUTOSEND.md for this slug.`
   - `NOW` lines for replies, follow-ups and client messages: send each one straight away, using the checks below.
4. Commit and push `pitches/autosend.json`. Tell the owner what went out and the last timed send, so they know how long to keep the chat and the app open.
`node autosend.js list` shows every approved send and whether it went out.

## Sending a NOW draft (reply, followup1, followup2, growth)
1. It must be in `pitches/autosend.json` with that draftId. If not, stop: not approved.
2. Skip it if the draft no longer exists, or if a STOP/complaint arrived for that slug after it was drafted (only the one-line STOP confirmation may still go). Re-read the thread first: if the prospect wrote again after the draft was made, don't send. Tell the owner the draft needs updating.
3. Send it unchanged with `send_message` and the `draftId`. Then run `node autosend.js sent <draftId>`; for follow-ups also `node log.js <slug> followup1|followup2`, and for client messages `node log.js <slug> offered --note <care|growth|annual|referral>`.

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
