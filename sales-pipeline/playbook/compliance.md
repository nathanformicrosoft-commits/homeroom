# Rules by market (summary, not legal advice)

Applies to every message. qa.js enforces the parts it can check.

**Everywhere:** real sender name and studio, an opt-out in every message, opt-outs honored immediately and permanently (`node log.js <slug> stop`), only contact details the business publishes itself, no misleading subject lines, no fake urgency.

**USA (CAN-SPAM):** every commercial email must include a valid physical postal address (a PO box or private mailbox works) and a clear way to opt out; it must be clear the message is an offer; honor opt-outs within 10 business days (we do it the same day). **No cold texts to US mobile numbers**: the TCPA makes unsolicited marketing texts risky, so US outreach is email and Facebook Messenger only. Messenger is still hand-sent by you, max 10 a day.

**Canada (CASL):** stricter than the US. Only email addresses the business publishes conspicuously, with no "no solicitations" note nearby, and the message must relate to their business. Postal address required.

**Australia (Spam Act):** accurate sender, a working unsubscribe, contact published by the business.

**UK (PECR / UK GDPR):** cold email to limited companies and LLPs only, never sole traders or partnerships. Delete data on request (`node log.js <slug> forget`).

**Payments:** PayPal invoices only, created and sent by the owner. Never ask for or accept card numbers or passwords in messages.
