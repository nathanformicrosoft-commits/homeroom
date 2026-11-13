# Replies

Speed wins: reply within the hour while they still have the demo open. Keep each reply short, answer exactly what they asked, and end with one next step. Adapt the wording to their message; these are starting points, not scripts to paste. Log every reply: `node log.js <slug> replied|interested|declined|stop`.

## "Yes" / "Interested"
Log `interested`, then send the scope confirmation in `closing.md` step 1. Same day.

## "How much?" (they missed it)
Use the price in their pitch (`pitches/queue.json` → `quote`): $150 simple, $250 with gallery or booking, $350 with a full menu.
> It's $[QUOTE] one-time for the finished site, set up on your own domain, plus $39 a month if you want me to handle hosting and small changes. You can skip the monthly plan and host it yourself. Want me to go ahead?

## "Too expensive"
Don't discount on the first push. Ask what they had in mind, and remind them what is included. If one of the first 3 clients: offer the founding-client price (`closing.md`) in exchange for a testimonial. Never go below the bottom of the range in config.json without asking the owner.
> Totally fair. That price covers the page, the contact form, setting it up on your own domain, and two rounds of changes, and you own it outright. What budget did you have in mind?

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
