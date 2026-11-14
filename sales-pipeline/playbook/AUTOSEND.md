# Timed sends (approved batch only)

On 2026-11-14 the owner approved sending the 26 first-touch emails that were already saved as Gmail drafts. They are listed in `pitches/autosend.json` (slug, address, Gmail draft id, send time). This approval covers only those 26 drafts. Any other message (new pitches, follow-ups, replies) stays a draft until the owner approves it in chat.

When a timed job fires for `<slug>`:

1. Look up `<slug>` in `pitches/autosend.json`. If it isn't there, stop: not approved.
2. **Skip and don't send** if any of these is true (note the reason in the day's report):
   - `data/outcomes.jsonl` already has a `pitched` event for the slug (it was sent by hand).
   - Gmail `in:sent to:<address>` finds a message (the owner sent it).
   - The slug, address or business is on `data/do-not-contact.csv`, or has a `stop` event.
   - The draft no longer exists (`get_draft` fails). The owner deleted it on purpose.
   - The demo URL doesn't return 200 (`curl -s -o /dev/null -w "%{http_code}" <demoUrl>`).
3. Send the draft exactly as it is with the Gmail connector's `send_message` and `draftId`. Don't rewrite it.
4. Run `node log.js <slug> pitched`, then commit (with the Co-Authored-By line) and push.
5. If the send fails, don't retry in a loop. Leave the draft, add it to the report, and tell the owner.
