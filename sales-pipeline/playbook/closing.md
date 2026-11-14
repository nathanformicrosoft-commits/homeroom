# From "yes" to paid

**Price:** use the exact quote and care price from their pitch (`pitches/queue.json` → `quote`, `careQuote`; also on the prospect as `offer`). Prices are being tested, so they differ between businesses; quote only theirs and never mention the test. Never below `minQuote` in config.json without asking the owner. [HALF] = half the quote. [CARE] = their care price. [GROWTH] = `careTiers.growth` for their market (US $99). Bigger jobs (extra pages, online ordering) are quoted separately, from $100 more, and logged with `node log.js <slug> upsell --amount <collected>`.

Payment is by **PayPal invoice** (address in `config.json` → `payments.paypalEmail`). You create and send every invoice yourself in PayPal. Claude only drafts the message. Never ask anyone for card numbers, bank logins or passwords in chat or email.

## 1. Confirm scope (within the hour)
> Great, glad you like it. Here's what you get:
> - One-page website, built for phones first
> - Your services, hours, map, click-to-call and a working contact form
> - Set up on your own domain (in your name)
> - Up to 2 rounds of changes
> - Live within 3 days of getting your photos and details
>
> The price is $[QUOTE]: $[HALF] to start and $[HALF] when you approve the finished site. I'll send a PayPal invoice for the first half. You can pay with a card or PayPal on the invoice page. Sound good?

## 2. Agreement (send with the first invoice)
> **Website agreement between [CLIENT BUSINESS] and [STUDIO NAME] ([OWNER NAME], [CITY], Philippines)**
> 1. **Scope:** one-page responsive website with services, hours, map, click-to-call and contact form. Up to 2 rounds of revisions. Extra pages or features are quoted separately before any work.
> 2. **Price:** $[TOTAL] USD. 50% ($[HALF]) before work continues; 50% when the client approves the finished site, before launch on their domain.
> 3. **Timeline:** live within 3 business days of receiving the client's content (logo, photos, prices, hours).
> 4. **Ownership:** the domain and hosting accounts are registered in the client's name. The client owns the website after the final payment.
> 5. **Care plan (optional):** $[CARE]/month for hosting, updates and small edits. Billed monthly, cancel any time by email.
> 6. **Content:** the client confirms they have the right to use the logo, photos and text they supply.
> 7. **Cancellation:** if the client cancels before launch, the deposit covers work done and is not refunded.
>
> Reply "I agree" to accept.

Their "I agree" by email is the record. Claude never signs or agrees to anything on the owner's behalf.

## 3. Invoice message (you send the actual invoice from PayPal)
> Here's the PayPal invoice for the first half ($[HALF]): [you paste the link PayPal gives you]. The invoice comes from PayPal under the name Marjorie Visaya, who handles payments for the studio. As soon as it's paid I'll start. Could you send these over too?

Then log: `node log.js <slug> deposit --amount [HALF] --currency USD`.

## 4. Collect content
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
> Here's the invoice for the second half ($[HALF]). Once it's paid I'll connect your domain and send you the logins.
Log `node log.js <slug> paid --amount [HALF] --currency USD`. Then connect their domain, transfer the Netlify site to an account in their name, and send the how-to below.

## 7. Handover how-to (send after launch)
> Your site is live at [domain].
> - **Messages** from the contact form go to [their email]. Check spam the first week and mark them "not spam".
> - **Changing hours or prices:** just email me while you're on the care plan, or log in to Netlify ([link]) if you'd rather do it yourself.
> - **Your logins:** domain at [registrar], hosting at Netlify. Both are in your name; I've been removed as owner.
> - **Google:** add the site link to your Google Business Profile so searchers can find it.

## 8. Care plan offer (same message or next day)
Two plans. Use [CARE] from their pitch for Basic (older pitches said $39; honor that).
> If you'd rather not deal with any of that, I can look after it for $[CARE] a month: hosting, updates and small edits like new hours or prices. Or for $[GROWTH] a month I'll also keep your Google Business Profile current (two posts a month, hours and photos), set you up with a review-request link and a printable QR card for the counter or truck, and send you a short monthly note on what came in through the site. Either one, cancel any month, and if you pay for a year up front you get 2 months free. Want me to set one up?

Log it: `node log.js <slug> care --amount <monthly price> --plan basic|growth [--annual]`, each payment with `carepaid --amount <amount>`, a cancellation with `carecancel`. Then `node log.js <slug> offered --note care` so the reminder stops. Local Growth needs them to add the studio email as a manager on their Google Business Profile; never ask for their Google password.

## 9. Testimonial and referral (a week after launch)
> Glad it's working for you. Would you write two or three sentences about how it went? I'd like to put it on my site with your business name, only if you're OK with that. And if you know another business owner who needs a site, I'd be grateful for the intro. If they go ahead, your next month of care is on me.

Real words only, and only with their written permission. Log `testimonial` / `referral`, and `offered --note referral` once asked. A referred business is contacted only if the client introduces you or the referred owner gets in touch; never cold-email a name a client mentioned.

## 10. Growing an existing client (learn.js lists who is due)
Ask once each, short, and only when it fits. Each is drafted for the owner to approve.
- **Basic for 45+ days → Local Growth:** "Your site's been live a while. Want me to start keeping your Google profile current too? It's $[GROWTH] a month, same cancel-any-month deal." Log `offered --note growth`.
- **Monthly for 60+ days → yearly:** "If it's easier, you can pay for the year up front and get 2 months free." Log `offered --note annual`.
- **Extra work** they mention (new page, booking, menu change beyond a small edit): quote it from $100, log `upsell --amount <collected>` when paid.

## Founding-client price (first 3 clients only)
Offer $50 off their quote (never below $100) in exchange for a testimonial and permission to show their site in the portfolio. Say it plainly; don't present it as a time-limited deal.
