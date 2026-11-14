# Daily run

Whoever runs the day (you or Claude) follows these steps in order. Commands run from `sales-pipeline/`.

## 0. Learn first (2 minutes)
- `node learn.js`, then read `playbook/insights.md`: money, what is due, what is working, and the mistakes list.
- Apply its decisions before doing anything else (retire a losing subject line, drop a business type that keeps saying STOP, and so on).

## 1. Replies (always before new outreach)
- Search Gmail: `in:inbox newer_than:3d -category:promotions` plus `from:` each pitched address. Read each thread in full.
- Log each one (`node log.js <slug> replied|interested|declined|stop|bounced`) and draft a response from `playbook/replies.md`. Anything that says yes goes to the top of the day's report.
- Replies pasted in from Messenger: same thing.

## 2. Follow-ups due
`insights.md` lists them. Max 2, on day 4 and day 9, and each must add something new: a tweak to their demo (their real menu item, a better photo) or one useful tip (for example: "add your site to your Google profile"). Never "just checking in". Log `followup1` / `followup2`. After day 9, stop.

## 3. Find new prospects (up to the daily cap minus today's follow-ups)
**Prospect bank:** research lands in `data/bank.json` first (`node bank.js add <files>`), refilled to 100 by the visaya-prospect-bank task whenever it drops to 25. The daily run pulls from it with `node bank.js take auto` and re-checks each business is still website-less before building. `node bank.js status` shows the count.

Markets in `config.json → settings.marketOrder`; **USA first**.
- Pick small towns (about 10,000–80,000 people), away from big metros, for example Dothan AL, Joplin MO, Kearney NE, Twin Falls ID, Bowling Green KY, Hattiesburg MS, Grand Junction CO. Vary the towns; don't pitch two businesses of the same type in the same town on the same day.
- Search Google Maps through TinyFish: `https://www.google.com/maps/search/<type>+in+<town>+<ST>?hl=en`. Keep listings with real reviews (ideally 10 or more), no "Website" button, open, not a chain or franchise.
- Find a published email: search `site:facebook.com "gmail.com" <type> <town>`, or the business's Facebook About page. No email means Messenger (US) or skip.
- Skip anyone already in `leads.csv` or `data/do-not-contact.csv`.

## 4. Research and build
- Add each to `data/prospects.json` with every fact sourced in `sources`. Review themes are paraphrased, never quoted. If a fact conflicts between sources, note it and ask on the call; never guess.
- Unsplash photo for the hero (credit is automatic). Never use photos from their pages.
- `node build.js`, then `node shoot.js` for screenshots. Look at the screenshot before pitching.

## 5. Pitch
Target: 30 new businesses a day across email + Messenger, within the warm-up caps in `playbook/deliverability.md`. Never exceed them to hit the number.
- Write `pitch.line1` yourself: one specific, true detail. Follow `playbook/voice.md`.
- `node pitch.js`, then **`node qa.js`. It must say PASS.** Fix every FAIL; never edit around the check.
- Email: create Gmail drafts from `pitches/queue.json` (draft mode), or use the one-click Gmail links in `send-list.md`. Each has its own scheduled time (Tue–Thu 8–10am their time, spaced apart); use Gmail's Schedule send. After the owner sends each one: `node log.js <slug> pitched`.
- Messenger: `send-list.md`, sent by the owner.

## 6. When something goes wrong
Any mistake (wrong fact, bounce, a complaint, an awkward phrase): `node log.js mistake "<what happened>" --fix "<the rule from now on>" --pattern "<regex>"`. qa.js then blocks it forever. Phrases that sounded canned go into `banned-phrases.txt`.

## 7. Wrap up
`node learn.js`, write `reports/<date>.md` (prospects found, demos built with links, drafts to approve, send list, replies, hot leads, payments, total toward ₱100,000), then commit and push.
