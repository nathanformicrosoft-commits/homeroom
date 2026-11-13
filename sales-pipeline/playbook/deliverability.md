# Reaching 30 businesses a day without landing in spam

The goal is 30 new businesses contacted per day. Do it by **spreading across channels and time**, not by blasting one inbox. Spam filters (and Facebook) flag patterns: many near-identical messages, sent fast, with links, from a new sender, that people ignore or report.

## The daily mix (30 a day)

| Channel | Per day | Why |
| --- | --- | --- |
| Email (Gmail, scheduled) | 15 at first, rising to 20 → 25 → 30 over 3 weeks (`settings.emailWarmup`) | A new sender who jumps to 30 cold emails on day one is a classic spam signal. Ramp up while bounces and complaints stay at zero. |
| Facebook Messenger (US/AU) | up to 10 (`settings.messengerPerDay`) | More than ~10 messages to strangers a day can get a personal account restricted. |
| SMS (Australia only) | counts inside the Messenger 10 | Never cold-text US numbers (TCPA). |

So on day one: 15 emails + 10 Messenger = 25. From week 2: 20 + 10 = 30. Email-only is never more than 30.

## What the scripts already enforce

- **Spacing:** `pitch.js` gives every email its own send time inside the recipient's 8–10am window, at least `emailGapMinutes` (9) apart, and rolls overflow to the next Tue–Thu. You schedule each one with Gmail's **Schedule send**; never send a batch by hand at once.
- **Caps:** qa.js fails if a day has more emails than the warm-up cap or more than 10 Messenger/SMS.
- **Unique first line:** qa.js fails if two messages open the same way. Every message leads with one true detail about that business, so no two emails look alike.
- **Bounce check:** qa.js looks up each email domain's mail server; no mail server means it would bounce, and bounces hurt the sender more than anything.
- **One link only, plain text:** no images, attachments, tracking pixels or link shorteners. Only the demo link.
- **No spammy subject:** no ALL CAPS, `!`, `$` or `%` in subjects; banned phrases list covers the body.
- **Opt-out + honest sender in every message**, and STOP is honored the same day (`node log.js <slug> stop`).

## What you do

1. **Send from your own Gmail, by hand, with Schedule send.** Gmail treats scheduled, individually composed mail as normal mail. Don't use mail-merge tools or a new account on day one.
2. **Answer every reply fast.** Replies are the strongest "this is wanted mail" signal there is.
3. **Watch three numbers in the daily report:** bounces, STOP/complaints, replies. If bounces go over 2 in a day, or anyone marks it as spam or complains, **halve the email cap for a week** and check the list quality.
4. **Messenger:** send from your personal account, a few minutes apart, never copy-paste the same text twice (each message has its own first line already). If Facebook shows a warning, stop Messenger for 48 hours.
5. **Never buy lists or guess addresses.** Only emails the business publishes itself (Facebook About, Google listing).

## Upgrades worth paying for later (ask before spending)

- **Your own domain** for the demos (for example a `.com` for Visaya Web Studio, around $10–15 a year). Free `netlify.app` addresses are widely abused by phishers, so some filters distrust links to them. A custom domain also looks more professional in the pitch.
- **Email on that domain** with SPF, DKIM and DMARC set up (Google Workspace or Zoho, a few dollars a month). This lets you check your reputation in Google Postmaster Tools and protects your personal Gmail.
- **A US postal address** (PO box or virtual mailbox). Required by CAN-SPAM in every US email; until you have one, US outreach is Messenger only, which caps US contacts at 10 a day.
