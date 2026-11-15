# Replies

Speed wins: reply within the hour while they still have the demo open. Keep each reply short, answer exactly what they asked, and end with one next step. Adapt the wording to their message; these are starting points, not scripts to paste. Log every reply: `node log.js <slug> replied|interested|declined|stop`.

**Care plans in a reply:** take [CARE] and [GROWTH] from `node learn.js --links <slug>` (market currency; older pitches that said 39 for Basic keep it). Lead with the plan from `careLead` in `playbook/trade-groups.json`, as in `closing.md` step 1: growth trades hear about Local Growth and calls from Google first, basic trades hear about Basic (hours, prices, menu and photos kept current) first, with Local Growth as the step up. If `seasonal` is true and the yearly plan comes up, it's 2 months free, which covers their slow season. Cancel any time by email; nothing is charged automatically.

[CARE LINE], by `careLead`:
- growth: "Local Growth at [GROWTH] a month, built around calls from Google (your Google profile, posts and a review-request link), or Basic at [CARE] a month for hosting and small edits"
- basic: "Basic at [CARE] a month, where I keep your hours, prices, menu and photos current (menu for food only), or Local Growth at [GROWTH] a month if you also want your Google profile looked after"

## "Sure, send it" (format F2: their first email had no link)
Check `offer.format` on the prospect. If it is F2 and they haven't seen the demo yet, "yes" means "send the link", not "I'll buy". Log `replied --note "#sent-link"` and send the link with the price, short:
> Here it is: [DEMO LINK]. It has your [services/menu], hours, a map and a call button. The finished site with your own photos is [QUOTE] one-time, plus an optional care plan: [CARE LINE]. If you like it, reply "yes" and it can be live within 3 days of getting your photos.

## "Yes" / "Interested"
Log `interested`, then send the scope confirmation in `closing.md` step 1. Same day.

## "We get all our work from word of mouth"
Agree, then ask how those referrals check them out. Don't argue.
> That makes sense. Most of your work coming from referrals says a lot. One thing I've noticed: when someone gets your name from a friend, they usually look you up before calling. The page just makes sure they find your hours and a call button when they do. Is that something that happens with your customers?

## "Our Facebook page is enough"
Facebook is fine. The site works alongside it, it doesn't replace it.
> Totally fair, and your page clearly works for you. The site isn't meant to replace it. It's for people who search Google rather than Facebook, and it's yours, without ads or competitors shown next to it. It can link straight to your page too. Happy to leave it there if it's not a fit.

## "Too busy" / "Not right now"
Make it easy and honest: almost nothing is needed from them.
> No problem. It really doesn't need much from you: a few photos and your hours, and I do the rest. I'll keep the demo up for 30 days if you want to come back to it.
Log `declined --note "#timing"`. No more follow-ups unless they write back.

## "Send me more info"
Answer in the email; don't push for a call.
> Sure. It's a one-page site built for phones: your services, hours, map, click-to-call and a contact form, on your own domain and in your name. [QUOTE] one-time, half to start and half when you approve it, paid by PayPal. Optional care: [CARE LINE]. You can see the demo here: [DEMO LINK]. Anything you'd want changed on it?

## "How much?" (they missed it)
Always use the exact prices in their pitch, as `node learn.js --links <slug>` prints them in their currency. They come from `data/prospects.json` → `offer.quote` and `offer.care`, never from `pitches/queue.json` (pitch.js drops pitched leads from it). Prices are being tested, so different businesses were quoted different amounts. Quote only theirs, and never mention the test or anyone else's price.
> It's [QUOTE] one-time for the finished site, set up on your own domain. After that there's an optional care plan: [CARE LINE]. You can skip the monthly plan and host it yourself. Want me to go ahead?

## "Too expensive"
Don't discount on the first push. Ask what they had in mind, and remind them what is included. If they still can't stretch, offer a smaller scope (fewer sections, no gallery) at a lower tier before any discount. If one of the first 3 clients: offer the founding-client price (`closing.md`) in exchange for a testimonial. Never go below `minQuote` in config.json without asking the owner. Log the objection with `--note "price"` so learn.js can see it.
> Totally fair. That price covers the page, the contact form, setting it up on your own domain, and two rounds of changes, and you own it outright. What budget did you have in mind?

## "Will this get me more customers?" / "Do you do Google?"
Be honest: a site helps people who already search for them, and there is no guarantee of more calls. If they want ongoing help, offer Local Growth (`closing.md` step 8).
> It helps people who already search for you find your hours and call you, but I won't promise a number. If you want me to keep your Google profile current too (posts, photos, hours) and set you up with a review-request link and QR card, that's my Local Growth plan at [GROWTH] a month, cancel any time by email.

## "Is this a scam?" / "How did you get my email?"
> Fair question. Your email is listed on your [Facebook page / Google listing], which is where I found your reviews too. There's nothing to pay unless you decide you want the site, and nothing is charged automatically: if you go ahead, you get a PayPal link to pay by card or PayPal, and it goes to Marjorie Visaya, who handles payments for the studio. If you'd rather I didn't contact you again, just say so.

## "Is this AI?" / "Are you a bot?"
Always the truth. Never deny it. Turn it into the price advantage it is:
> Yes, I use AI tools to research and draft. That's how I can build you a demo for free and charge [QUOTE] instead of the thousands an agency would. But I'm a real person, Nathaniel, and I checked everything myself. Happy to jump on a quick call.

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
