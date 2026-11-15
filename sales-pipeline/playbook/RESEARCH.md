# What outside research says (checked 2026-11-15)

Most sources are vendors selling email or SEO tools, so treat the numbers as rough market signals, not proof. Our own numbers in `insights.md` win once we have them.

## Outreach
- **Reply rates:** a typical cold sequence gets about 3–5% replies, and 5–10% counts as good (Hunter's 2025 data: 4.5% average; Woodpecker: 3.4% average). Personalized emails reply roughly twice as often as generic ones (Woodpecker). Our free demo built from their own listing is about as personal as cold email gets, so aim for the top of that range.
- **Follow-ups:** the first email brings most replies, but two follow-ups nearly double the total. Three messages in all does best; a fourth tends to lower replies (Hunter). That matches our day 0 / day 4 / day 9 plan. Don't add a fourth.
- **Small lists work better:** campaigns under 50 contacts average higher reply rates (Woodpecker), which supports one-at-a-time, researched sends over volume.

## Staying out of spam
- Google's line: keep the spam-complaint rate **under 0.1%** and never reach **0.3%**. Since November 2025 Gmail rejects or delays mail that breaks its sender rules. At our volume a single complaint is already above 0.1%, which is why learn.js cuts back at the first one.
- Google Postmaster Tools only works for your own domain and hides data at low volume. With a plain @gmail.com sender, the only warning signs are bounces, STOPs and replies, so log every one the same day.

## Prices (US)
- Small-business websites commonly run **$1,000–$5,000**; templates or DIY run $0–200. Our tested range ($150–$700 for a standard site) is well below agency prices. That's a selling point, and it leaves room for the price test to go higher, so `maxMultiplier` is 4 (about $1,000 for a standard site).
- Maintenance is often **$300–$1,200 a year** (about $25–$100 a month). The $49 Basic plan sits in the middle.
- Google Business Profile management alone is commonly **$125–$400 a month**, and full local SEO $400–$1,500. Our $99 Local Growth is cheap for what it includes. Once 10 or more clients are on care plans, test $149.

## How to sell: what works and what doesn't (researched 2026-11-15)

Mostly vendor and practitioner data, not independent studies. Where a point is unproven for us, it is set up as an experiment instead of a rule.

**What works (already built in)**
- **Short emails:** 50–125 words is the consensus. One 500-email study found 50–100 words replied 9.7% vs 1.9% for 200+. Ours are about 100 (qa.js caps at 110). The no-link format is 57.
- **One soft ask:** a single low-pressure question beats two asks or a hard ask (one dataset: 1 ask 9.1% vs 2+ asks 2.4%). Every email ends with exactly one.
- **Real personalization:** emails built on a specific fact about the business reply 2–5x more than generic ones. That's `pitch.line1` plus a demo built from their own listing.
- **Short subjects:** about 2–7 words do best; very long subjects reply far less. Keep challengers short.
- **No open or click tracking:** Hunter found sequences with tracking replied 4.4% vs 7.4% without. We never track.
- **Morning, midweek:** Tue–Thu, about 8 AM–noon in their time, replies best (Belkins, 7.5M emails). Mondays and Fridays are a bit weaker, so the volume governor adds them only after Tue–Thu is healthy.
- **Three messages total:** the first email brings most replies and two follow-ups add the rest; a fourth hurts.
- **Lead with the demo:** practitioners agree a live demo beats a proposal or "quick call?" because the owner can see the result. A founding-client deal in exchange for a testimonial helps the first sales.
- **Answer fast:** leads answered within the hour qualify far more often than ones answered the next day (the 2011 HBR "short life of online sales leads" finding; the exact multipliers quoted online are vendor numbers). Reply watch drafts within the hour, so approve quickly.

**What doesn't**
- Long emails, several asks, tracking pixels, attachments, generic openers, and "just checking in" follow-ups.
- Arguing with "word of mouth" or "Facebook is enough". Agree, then ask how referred customers check them out (scripts in replies.md).
- Care plans sold on technical fear. Sell peace of mind and missed calls instead, and mention the plan in the very first scope confirmation, not only after launch.

**Unproven, so we test it (playbook/experiments.json)**
- **Link in the first email (format test):** one vendor A/B test saw a link cut first-email replies from 9.4% to 5.1%. F1 = link + price, F2 = no link ("Want me to send you the link?"), F3 = link without price.
- **Price up front:** no study settles it; advice is "show it for small, low-risk offers". F1 vs F3 tests it.
- **Price level, subject line, call to action:** already running.

## Sources
- Hunter, The State of Cold Email: https://hunter.io/the-state-of-cold-email
- Woodpecker reply-rate data: https://woodpecker.co/blog/?p=3948
- Instantly reply-rate benchmarks: https://instantly.ai/blog/cold-email-reply-rate-benchmarks
- Palisade, Google sender requirements (Nov 2025): https://www.palisade.email/learning/google-is-making-email-sender-requirements-stricter-starting-nov-2025
- Suped, Gmail 0.3% enforcement and Postmaster data: https://www.suped.com/knowledge/email-deliverability/compliance/how-likely-is-gmail-to-enforce-the-less03percent-spam-rate-limit-within-the-next-year
- Shopify, website cost: https://www.shopify.com/blog/how-much-does-a-website-cost
- WebFX, small-business website cost: https://webfx.com/blog/web-design/how-much-does-it-cost-to-build-a-website-for-a-small-business
- Merchynt, Google Business Profile management pricing: https://merchynt.com/post/google-my-business-management-pricing
- SEO.com, local SEO pricing 2025: https://www.seo.com/blog/local-seo-pricing
- Word count and replies (500-email study): https://getgangly.com/blog/cold-email-reply-rate-study
- Optimal cold email length (3M emails): https://howlongshouldacoldemailbe.com/blog/optimal-cold-email-length-data/
- Subject line length (Belkins): https://belkins.io/blog/b2b-cold-email-subject-line-statistics
- Best time to send (Belkins): https://belkins.io/blog/best-time-to-send-email
- Link in first email A/B (Overloop): https://overloop.com/blog/cold-emailing-link-building
- Price in a cold email (FirstSales): https://firstsales.io/blog/pricing-in-cold-email
- Demo-first web design outreach: https://skipthepitch.app/resources/demo-first-web-design-outreach
- Objections web designers face (SiteSwan): https://siteswan.com/5-common-sales-objections-web-designers-face-and-how-to-overcome-them
- Speed to lead summary: https://www.verse.ai/blog/speed-to-lead-statistics
- Selling care plans (The Admin Bar): https://theadminbar.com/three-reasons-your-customers-dont-buy-care-plans-aint-none-of-them-price/
- Care plans and recurring revenue (Seahawk): https://seahawkmedia.com/agency/sell-more-website-care-plans-recurring-revenue/
