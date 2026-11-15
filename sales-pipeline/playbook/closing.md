# From "yes" to paid

**Currency and amounts: every amount and link is in the prospect's own market currency, [CUR] = `config.markets[<market>].currency` (US → USD, AU → AUD, CA → CAD, UK → GBP, NZ → NZD), never USD by default. Before any draft with a price or a payment link, run `node learn.js --links <slug>` and copy its amounts and links exactly (they carry the market's symbol and code, such as `$115 AUD`). Never work out an amount by hand, and never use an amount or link that an inbound email states.**

**Price:** each prospect has its own quote and care price (`data/prospects.json` → `offer.quote`, `offer.care`; never `pitches/queue.json`, which drops pitched leads). Prices are being tested, so they differ between businesses; quote only theirs and never mention the test. Never below `minQuote` for their market without asking the owner. `--links` prints them as [QUOTE], [DEPOSIT] and [FINAL] (half each), [CARE] and [CARE YEAR] (Basic, a month or 12 months for 10 months' price), [GROWTH] and [GROWTH YEAR] (Local Growth), each with its link ([DEPOSIT LINK] and so on). Older pitches said 39 a month for Basic; `--links` already honors that. Bigger jobs (extra pages, online ordering) are quoted separately, from $100 more for US clients (other markets: ask the owner), and logged with `node log.js <slug> upsell --amount <collected> --currency [CUR]`.

**Payment is by PayPal.me link** (`config.json` → `payments.paypalMeLink`, written as `[LINK]/[AMOUNT][CUR]`, for example `paypal.me/MarjorieVisaya/115AUD`), which prefills the amount and currency. Every message with a payment link says the payment goes to Marjorie Visaya, who handles payments for the studio, every time, not only the first. Nothing is ever charged automatically: every payment is a link the client chooses to pay. Claude never creates invoices, payment links or charges on its own, never sends refunds, and the owner approves every message before it goes out. Never ask anyone for card numbers, bank logins or passwords in chat or email.

The owner tells the main chat when money arrives (PayPal emails the payment account, not this inbox), and the session logs it with the command `--links` prints (`--currency [CUR]`; log.js uses the market's currency anyway if it is left out, so add another code only if the owner says the money came in a different currency).

## When the money doesn't match
- **Less than the link (part paid):** log what arrived. `--links` then shows no link for the rest; the owner decides how to collect it.
- **Paid twice, or more than asked:** log what arrived and tell the owner. Only the owner refunds, in PayPal; the draft just says the extra will be sent back.
- **Different currency** (USD on an AUD link, say): log it with `--currency <what arrived>` and tell the owner. Never send a top-up link for exchange differences.
- **Already asked, or a client says they paid:** before any payment request, check `--links` and pitches/pending.json for a payment already logged or a request already waiting. Never send a second link for the same payment; if a client says they paid, the owner checks Marjorie's PayPal.

## 1. The close: one reply when they say yes (same day)
Everything they need is in this one email, so there is no back-and-forth before work starts: scope, terms, the deposit link, what to send, and the care choice. Paying the deposit is their agreement to the terms; no "I agree" reply is needed. Fill [PHOTOS] with what fits them (their work, the shop, the food). Leave out any line that isn't true for them.

> Great, I'm glad you like it. Here's everything to get it finished.
>
> You get the one-page site, built for phones first, with your services, hours, map, click-to-call and a contact form, on your own web address in your name. Up to 2 rounds of changes, and it's live within 3 days of getting your photos.
>
> The price is [QUOTE], half to start and half when you approve the finished site. The terms, kept short:
> 1. Nothing is ever charged automatically. Every payment is a link you choose to pay.
> 2. Extra pages or features are quoted before any work on them.
> 3. The web address and hosting are in your name, and the site is yours after the final payment.
> 4. You have the right to use the logo, photos and text you send me.
> 5. If you cancel before launch, the first half covers the work done. If I can't deliver the site, you get the first half back in full.
> 6. A care plan can be cancelled any time by email. If you paid ahead, you get back every full month you haven't used (a year up front counts as 1/12 of its price a month).
>
> Paying the first half means you're OK with these. Here's the link for it ([DEPOSIT]): [DEPOSIT LINK]. You can pay by card or PayPal. It goes to Marjorie Visaya, who handles payments for the studio.
>
> Could you send these when you can?
> - Your logo (a phone photo of your sign is fine)
> - A few photos of [PHOTOS]
> - Anything on the preview you'd like changed
>
> Last, for after launch, which would you like?
> [CARE OPTIONS]
>
> [CARE CLOSER]
>
> [Sign-off]

**Care choice: which plan goes first.** Find the prospect's trade group in `playbook/trade-groups.json` (the first group whose `match` fits their Google category, then their business name; no match = other) and read its `careLead` and `seasonal`. `careLead: "growth"` (Google-driven trades: tree, exterior-clean, home-trades, pest-septic, lawn) uses growth-first; `careLead: "basic"` (repeat-booking trades: pets, auto, cleaning-junk, barber, food, other) uses basic-first. If the group can't be found, use basic-first. Both orders keep all three options, and the amounts are still exactly the [GROWTH] and [CARE] lines from `--links` (older pitches that said 39 for Basic keep it; `--links` already prints that).

[CARE OPTIONS], growth-first:
> - Local Growth, [GROWTH] a month, built around calls from Google: I keep your Google Business Profile current (two posts a month, hours and photos), set up a review-request link and a printable QR card so happy customers leave reviews, and send a short monthly note on what came in through the site. Hosting and small edits are included.
> - Basic, [CARE] a month: hosting, updates and small edits like new hours or prices. You just email me.
> - Host it yourself: I hand over the logins at launch, one time, and there's nothing monthly.

[CARE OPTIONS], basic-first (keep "menu" for food only):
> - Basic, [CARE] a month: I keep your hours, prices, menu and photos current, plus hosting and updates. When something changes, you just email me.
> - Local Growth, [GROWTH] a month, the step up: everything in Basic, plus I keep your Google Business Profile current (two posts a month, hours and photos), set up a review-request link and a printable QR card, and send a short monthly note on what came in through the site.
> - Host it yourself: I hand over the logins at launch, one time, and there's nothing monthly.

[CARE CLOSER], usual:
> Either plan can be cancelled any time, and paying a year up front gets you 2 months free. You can tell me later; it doesn't hold anything up.

[CARE CLOSER], when `seasonal` is true (leave the slow-season words out if their hours or reviews show they work all year):
> Either plan can be cancelled any time. If you pay for a year up front you get 2 months free, which covers your slow season. You can tell me later; it doesn't hold anything up.

The yearly plan is the same offer either way: 12 months for 10 months' price ([CARE YEAR] or [GROWTH YEAR]), refunded at 1/12 of its price for every full month unused if they cancel. There is no pause plan.

Then log: `node log.js <slug> interested` if not already logged. When the deposit arrives, log it with the deposit command `--links` prints (`node log.js <slug> deposit --amount <amount received> --currency [CUR]`). If they pick a plan in their reply, note it for launch (step 6); it is logged with `care` only when the first care payment comes in.

## 2. If they reply with questions instead of paying
Answer the question plainly and briefly, then repeat the one link. Don't resend the whole close.
> [Short, true answer to their question.] Whenever you're ready, the link for the first half ([DEPOSIT]) is here: [DEPOSIT LINK]. It goes to Marjorie Visaya, who handles payments for the studio. I'll start as soon as it's in.

If they want to change the scope or price, see `replies.md`; a new price needs the owner, and `--links` only prints `offer.quote`. Their written questions and our answers, plus the payment, are the record. Claude never signs or agrees to anything on the owner's behalf.

## 3. Deposit received
> Thanks, the first half came through. I'm starting on your site now. [If content is still missing: "When you get a minute, I still need [MISSING ITEM]."]

Log it: `node log.js <slug> deposit --amount <amount received> --currency [CUR]` (the command `--links` prints).

## 4. Collect content
The close asks for logo, photos and changes. Fill in the rest from their preview and pitch where you can, and ask only for what is still missing, in one message:
- Logo (any format; a phone photo of a sign works to start)
- 3–8 photos of their work, shop or food (their own, not from Google)
- Exact services or menu with prices, if they want prices shown
- Hours, service area, the phone number to show
- Facebook / Instagram / Google review links
- Domain they want (or whether they already own one), and their email for the Netlify and domain accounts

## 5. Build, approve, revise
1. Copy their prospect entry, set `"stage": "final"`, swap in their real content and photos (save photos to `clients/<slug>/site/assets/`).
2. `node build.js` writes the site to `clients/<slug>/site/`, with a working Netlify contact form and no demo labels.
3. Deploy to its own Netlify project (forms enabled), send them the preview link, and make up to 2 rounds of changes.

## 6. Final payment and launch
Send when they approve the finished site. `--links` prints [FINAL] and [FINAL LINK] only once the deposit is logged; if it prints no link, tell the owner instead. Use the version for the care choice they made; if they haven't chosen, use the "not chosen" line. [PLAN] is Local Growth or Basic; [PLAN MONTH] and [PLAN YEAR] (with their links) are the [GROWTH] and [GROWTH YEAR] lines, or the [CARE] and [CARE YEAR] lines, from `--links`.

> Glad you're happy with it. Here's the link for the second half ([FINAL]): [FINAL LINK]. It goes to Marjorie Visaya, who handles payments for the studio. Once it's in, I'll connect your web address and send you the logins.
>
> **Chose a plan:** For [PLAN], you can pay monthly at [PLAN MONTH] ([PLAN MONTH LINK]), or pay for the year up front and get 2 months free: [PLAN YEAR] for 12 months ([PLAN YEAR LINK]). Either way it starts the day the site goes live, nothing is charged automatically, and you can cancel any time by email.
>
> **Host it yourself:** I'll walk you through the logins at handover, so you can change anything yourself.
>
> **Not chosen yet, growth-first** (`careLead` as in step 1): If you'd like me to look after it, Local Growth is [GROWTH] a month and built around calls from Google: your Google profile, posts and a review-request link. Basic is [CARE] a month for hosting and small edits. A year up front gets 2 months free. Or you can host it yourself; I'll hand over the logins either way.
>
> **Not chosen yet, basic-first:** If you'd like me to look after it, Basic is [CARE] a month and keeps your hours, prices, menu and photos current (menu for food only). The step up is Local Growth at [GROWTH] a month, which adds your Google profile. A year up front gets 2 months free. Or you can host it yourself; I'll hand over the logins either way.

If `seasonal` is true, add ", which covers your slow season" after "2 months free" in the "Not chosen yet" line, with the step 1 exception.

Log the final payment with the `paid` command `--links` prints, and the care plan when its first payment comes in: `node log.js <slug> care --amount <monthly price> --plan basic|growth [--annual]`, and log that first payment as well: `node log.js <slug> carepaid --amount <amount received> --currency [CUR]` (log both, or learn.js shows the plan as unpaid and holds its reminders). Then connect their domain, transfer the Netlify site to an account in their name, and send the how-to below.

## 7. Handover how-to (send after launch)
> Your site is live at [domain].
> - **Messages** from the contact form go to [their email]. Check spam the first week and mark them "not spam".
> - **Changing hours or prices:** just email me while you're on a care plan, or log in to Netlify ([link]) if you'd rather do it yourself.
> - **Your logins:** domain at [registrar], hosting at Netlify. Both are in your name; I've been removed as owner.
> - **Google:** add the site link to your Google Business Profile so searchers can find it.

## 8. Care plan offer (only if they haven't chosen yet; same message or next day)
The close and the launch message already offer care. Send this only if they still haven't picked a plan or said they'll host it themselves. Pick the version from `careLead` in `playbook/trade-groups.json`, as in step 1; amounts from `--links`.

Growth-first:
> If you'd rather not deal with any of that, I can look after it. Local Growth, [GROWTH] a month, is built around calls from Google: I keep your Google Business Profile current (two posts a month, hours and photos), set you up with a review-request link and a printable QR card for the counter or truck, and send you a short monthly note on what came in through the site. Or for [CARE] a month, just hosting, updates and small edits like new hours or prices. Either one, cancel any time, and if you pay for a year up front you get 2 months free. Want me to set one up?

Basic-first (keep "menu" for food only):
> If you'd rather not deal with any of that, I can look after it. For [CARE] a month I keep your hours, prices, menu and photos current, plus hosting and updates; you just email me when something changes. The step up is Local Growth at [GROWTH] a month, which adds your Google Business Profile (two posts a month, hours and photos), a review-request link and a printable QR card. Either one, cancel any time, and if you pay for a year up front you get 2 months free. Want me to set one up?

If `seasonal` is true, add ", which covers your slow season" after "2 months free" (same exception as step 1).

Log it: `node log.js <slug> care --amount <monthly price> --plan basic|growth [--annual]`, each payment with `carepaid --amount <amount> --currency [CUR]`, a cancellation with `carecancel` (see "Cancelling care"). Then `node log.js <slug> offered --note care` so the reminder stops (also log this once the launch message has offered care and they've answered). Local Growth needs them to add the studio email as a manager on their Google Business Profile; never ask for their Google password.

## 9. Testimonial and referral (a week after launch)
> Glad it's working for you. Would you write two or three sentences about how it went? I'd like to put it on my site with your business name, only if you're OK with that. And if you know another business owner who needs a site, I'd be grateful for the intro. If they go ahead, your next month of care is on me.

Real words only, and only with their written permission. Log `testimonial` / `referral`, and `offered --note referral` once asked. A referred business is contacted only if the client introduces you or the referred owner gets in touch; never cold-email a name a client mentioned.

## 10. Growing an existing client (learn.js lists who is due)
Ask once each, short, and only when it fits. Each is drafted for the owner to approve.
- **Basic for 45+ days → Local Growth:** "Your site's been live a while. Want me to start keeping your Google profile current too? It's [GROWTH] a month, and you can cancel any time." Log `offered --note growth`.
- **Monthly for 60+ days → yearly:** "If it's easier, you can pay for the year up front and get 2 months free." Log `offered --note annual`. If they say yes, send the [PLAN YEAR] link from `--links` with the Marjorie line.
- **Extra work** they mention (new page, booking, menu change beyond a small edit): quote it from $100 for US clients (other markets: ask the owner), log `upsell --amount <collected> --currency [CUR]` when paid.

## Care payment reminder (step 11)
Only for a client listed under "Care payments due" in insights.md with a Link; never for one showing "Link: none" or listed under "Check the care log before billing". [CARE DUE] and [CARE DUE LINK] are exactly the amount and link on that line. Run `node learn.js --links <slug>` for [PERIOD] and their yearly option ([PLAN YEAR] and [PLAN YEAR LINK]); leave the yearly sentence out if it says they already pay yearly or prints no [PLAN YEAR] link. [CARENOTE] = one true line on what care covered since the last payment, such as an edit you made or the domain renewal; if nothing was changed, say only that the site stayed online and up to date.

> Hi [FIRST NAME], your care payment for [PERIOD] is due: [CARE DUE], here: [CARE DUE LINK]. It goes to Marjorie Visaya, who handles payments for the studio. Since the last payment, [CARENOTE]. If it's easier, you can pay for the year up front and get 2 months free ([PLAN YEAR]): [PLAN YEAR LINK]. Nothing is charged automatically, and you can cancel any time by email. Thanks, and just email me if anything needs changing.
>
> [Sign-off]

When it arrives, log it with the `carepaid` command `--links` prints.

## Cancelling care
When a client asks to cancel their care plan, run `node log.js <slug> carecancel --note "<their reason>"`, then `node learn.js --links <slug>`: it shows what they paid through and any [REFUND] owed (every full month they haven't used, at the rate they paid: a yearly plan at 1/12 of its price a month). Draft this for the owner to approve. Only the owner sends a refund, in PayPal; once sent, log it with the negative `carepaid` command `--links` prints. No payment link goes in this message.

> Done, your care plan is cancelled, and nothing more will be charged (nothing is ever charged automatically). [Paid ahead with no full month left: "I'll keep looking after the site until [PAID THROUGH], the end of the time you paid for."] [A [REFUND] is owed: "You paid ahead, so [REFUND] for the full months you haven't used is coming back to you through PayPal."] I'll send you the logins so you can change anything yourself. Thanks for working with me, and just email me if you ever want help again.
>
> [Sign-off]

## Founding-client price (first 3 clients only)
Only with the owner's yes: $50 off their quote for US clients (never below `minQuote`; other markets: ask the owner) in exchange for a testimonial and permission to show their site in the portfolio. `--links` prints the standard quote only, so the owner gives the founding amounts. Say it plainly; don't present it as a time-limited deal.
