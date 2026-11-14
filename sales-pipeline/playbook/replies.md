# Replies

Speed wins: reply within the hour while they still have the demo open. Keep each reply short, answer exactly what they asked, and end with one next step. Adapt the wording to their message; these are starting points, not scripts to paste. Log every reply: `node log.js <slug> replied|interested|declined|stop`.

## "Yes" / "Interested"
Log `interested`, then send the scope confirmation in `closing.md` step 1. Same day.

## "How much?" (they missed it)
Always use the exact prices in their pitch: `pitches/queue.json` → `quote` and `careQuote` (also stored on the prospect as `offer.quote` / `offer.care`). Prices are being tested, so different businesses were quoted different amounts. Quote only theirs, and never mention the test or anyone else's price.
> It's $[QUOTE] one-time for the finished site, set up on your own domain, plus $[CARE] a month if you want me to handle hosting and small changes. You can skip the monthly plan and host it yourself. Want me to go ahead?

## "Too expensive"
Don't discount on the first push. Ask what they had in mind, and remind them what is included. If they still can't stretch, offer a smaller scope (fewer sections, no gallery) at a lower tier before any discount. If one of the first 3 clients: offer the founding-client price (`closing.md`) in exchange for a testimonial. Never go below `minQuote` in config.json without asking the owner. Log the objection with `--note "price"` so learn.js can see it.
> Totally fair. That price covers the page, the contact form, setting it up on your own domain, and two rounds of changes, and you own it outright. What budget did you have in mind?

## "Will this get me more customers?" / "Do you do Google?"
Be honest: a site helps people who already search for them, and there is no guarantee of more calls. If they want ongoing help, offer Local Growth (`closing.md` step 8).
> It helps people who already search for you find your hours and call you, but I won't promise a number. If you want me to keep your Google profile current too (posts, photos, hours) and set you up with a review-request link and QR card, that's my Local Growth plan at $[GROWTH] a month, cancel any month.

## "Is this a scam?" / "How did you get my email?"
> Fair question. Your email is listed on your [Facebook page / Google listing], which is where I found your reviews too. There's nothing to pay unless you decide you want the site, and payment goes through a PayPal invoice, so you're covered by PayPal. If you'd rather I didn't contact you again, just say so.

## "Is this AI?" / "Are you a bot?"
Always the truth. Never deny it. Turn it into the price advantage it is:
> Yes, I use AI tools to research and draft. That's how I can build you a demo for free and charge $[QUOTE] instead of the $2,000–$3,000 an agency would. But I'm a real person, Nathaniel, and I checked everything myself. Happy to jump on a quick call.

Why: people who ask usually suspect already, a caught lie turns a warm lead into a "scam" post and a PayPal dispute, and lying to make a sale can count as a deceptive practice in the US. The honest answer sells better.

## "We already have someone" / "We're fine with Facebook"
> No problem at all. Many of your customers search Google before they call, and a page with your hours and a call button helps there, but I get it. I'll leave it there. All the best with the [business].
Log `declined`. No follow-ups.

## "Not now" / "Maybe later"
> Understood. I'll keep the demo up for 30 days in case you want to come back to it. No more emails from me unless you reply.
Log `declined`, note "maybe later".

## STOP / unsubscribe / angry
Reply once, briefly, then never again:
> Done, you won't hear from me again. Sorry for the bother.
Run `node log.js <slug> stop`, rebuild and redeploy so their demo comes down. If they ask for their data to be deleted: `node log.js <slug> forget`.

## Questions you can't answer from the facts you have
Don't guess. Say you'll check, and ask the owner.
