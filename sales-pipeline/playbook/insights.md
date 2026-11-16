# Insights (updated 2026-11-16)

**Act on:** nothing new

Read this before every run. It is rebuilt from data/outcomes.jsonl by `node learn.js`, which also tunes prices, copy tests and sending volume.

## Money

- Collected so far: nothing yet
- Care plans: 0 active (0 Local Growth), $0/month
- Yearly pace: **$0** of the $200,000 goal (0%), 26 months left to 2028-12-31. Pace = care plans x 12 + last 90 days of build and extra-work revenue x 4.
- What the goal takes (60% from care plans, 40% from builds): about **163 paying care clients** at $62/month plus **19 new builds a month** at $367 (estimate from the live price arms).
- Paid upgrades (own domain + business email, about $115 a year): on hold until sales cover them. $0 collected so far.
- Toward ₱100,000: $0 USD (set settings.phpPerUSD to convert)

### Funnel (pitches at least 14 days old)

- No pitch is 14 days old yet. Rates appear here once one is.

## Sending volume

- Level 0 of 4: Tue–Thu, 30 emails a day after warm-up (email only). Up to about 90 new businesses a week.
- Last 21 days: 0 emails, 0 bounced, 0 STOP, 0 complaints, – replied.
- Holding at level 0. Next step needs: finish the 21-day warm-up (0 days so far); at least 60 emails in the last 21 days (0); 30 emails at least 5 days old to judge replies; 7 days at the current level.
- Rules: one level up at most every 7 days, only while healthy; any complaint, bounces over 3% (or 3 in one day) or STOPs over 5% halve the cap for a week. Never more than 40 emails a day from one inbox. Going beyond that needs your own domain and a second inbox (playbook/deliverability.md), which costs money, so ask the owner.

## Upgrades and milestones

Claude never buys, pays or signs up for anything: the owner buys, then tells Claude, who logs it. Whole ladder: `node upgrades.js status` (rules: playbook/upgrades.json and DOMAIN-SETUP.md "Reinvestment ladder").

- Money available for upgrades: **$0** ($0 collected x 100% reinvested - $0 spent). Cushion kept after an inbox or research upgrade: $300.
- Ladder: running. Sending inboxes: 1. Health, last 30 days: 0 emails, 0 bounced (0%), 0 STOP (0%), 0 complaint(s).
- Ready to buy: nothing yet.
- Next: own-domain (Own domain + Google Workspace inbox, about $115/yr): needs $115 more collected ($0 of $115).
- Renewals due within 30 days: none.
- Reminders due: none.
- Money milestones reached in the last 7 days: none. Next: ₱100,000 (₱0 so far, estimate at ₱58/USD; set settings.phpPerUSD for the real rate).

## Experiments

### Experiment: price

Success = won client (deposit or paid), weighed by first-year value: build price + expected care plan revenue. Balanced until each version has 40 pitches; after that most pitches go to the likely winner.

- P1 x1 (US standard site about $250): 0 sent, 0 old enough to judge, 0 successes (–), still collecting data
- P2 x1.4 (US standard site about $350): 0 sent, 0 old enough to judge, 0 successes (–), still collecting data
- P3 x2 (US standard site about $500): 0 sent, 0 old enough to judge, 0 successes (–), still collecting data

Not enough data yet. Keep sending; never edit an arm that has been sent.

### Experiment: subject line

Success = positive reply (interested, won or paid). Balanced until each version has 25 pitches; after that most pitches go to the likely winner.

- S1 "I built a free homepage for {name}": 0 sent, 0 old enough to judge, 0 successes (–), still collecting data
- S2 "{name} homepage (already built, free to look)": 0 sent, 0 old enough to judge, 0 successes (–), still collecting data

Not enough data yet. Keep sending; never edit an arm that has been sent.

### Experiment: call to action

Success = positive reply (interested, won or paid). Balanced until each version has 25 pitches; after that most pitches go to the likely winner.

- C1 "Reply "yes" and I'll finish it in 3 days.": 0 sent, 0 old enough to judge, 0 successes (–), still collecting data
- C2 "If you like it, reply "yes" and it can be live within 3 days of getting your photos.": 0 sent, 0 old enough to judge, 0 successes (–), still collecting data

Not enough data yet. Keep sending; never edit an arm that has been sent.

### Experiment: email format

Success = positive reply (interested, won or paid). Balanced until each version has 25 pitches; after that most pitches go to the likely winner.

- F1 demo link + price in the email (original): 0 sent, 0 old enough to judge, 0 successes (–), still collecting data
- F2 no link or price: "Want me to send you the link?" (link and price go in the reply): 0 sent, 0 old enough to judge, 0 successes (–), still collecting data
- F3 demo link, price only on the demo page: 0 sent, 0 old enough to judge, 0 successes (–), still collecting data

Not enough data yet. Keep sending; never edit an arm that has been sent.

## What is working

### By market

| Group | Sent | Replied | Positive | Won | STOP |
| --- | --- | --- | --- | --- | --- |
| (no sends yet) | 0 | – | – | 0 | 0 |

### By business type

| Group | Sent | Replied | Positive | Won | STOP |
| --- | --- | --- | --- | --- | --- |
| (no sends yet) | 0 | – | – | 0 | 0 |

### By channel

| Group | Sent | Replied | Positive | Won | STOP |
| --- | --- | --- | --- | --- | --- |
| (no sends yet) | 0 | – | – | 0 | 0 |

## Targeting (the prospect bank reads this)

- Not enough data yet (needs 20 pitches per business type, 14+ days old). Keep the current mix.
- Nothing to avoid yet.

## What people said (learn from every reply)

- Nothing yet. Log every reply with a short note and tags, for example `node log.js <slug> declined --note "#price has a nephew who does sites"`. Tags: #price #trust #timing #has-site #facebook-enough #ai #not-owner #interested-later.

## Due today

- No follow-ups due.

## Care payments due

The daily run drafts a reminder only for a client below that shows a Link, from playbook/closing.md "## Care payment reminder", with exactly this amount and link, for the owner to approve. Never for "Link: none" or anyone under the checks. Nothing is sent without the owner's yes, and Claude never creates invoices or payment links. Listed when due within 3 days or overdue. When a payment arrives: `node log.js <slug> carepaid --amount <amount> --currency <its currency>`.

- No care plans yet.

## Mistakes we will not repeat

- None logged yet. Log one with `node log.js mistake "<what>" --fix "<rule>"`.

## Changed by learn.js today

- Nothing.
