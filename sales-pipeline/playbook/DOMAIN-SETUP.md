# Own domain and business email: setup plan (drafted 2026-11-15)

Why: free `netlify.app` addresses are widely abused, so some spam filters distrust links to them. A domain also looks more professional, makes Google Postmaster Tools work, and is required before adding a second inbox to go past 40 emails a day.

Prices below were checked on 2026-11-15 on third-party and reseller pages. Check the live price before paying.

## Cost

| Item | Price | Notes |
| --- | --- | --- |
| `.com` domain | about $11–12 a year | Cloudflare Registrar charges cost price (about $10.50, rising about $0.70 because the registry raised its price on Nov 1, 2026). Porkbun is about $11. Free WHOIS privacy at both. |
| Google Workspace Business Starter | $7 per month (yearly plan) or $8.40 (monthly), one user | Philippine resellers list about ₱280 a month. **Pick Workspace over cheaper mail hosts:** the Gmail connector the pipeline uses for drafts, timed sends and reply watch only works with Google accounts, so everything keeps working. |
| **Year one total** | **about $95–115** | Nothing else is required. Don't buy paid "warm-up" services: they work by trading fake emails, which Google penalizes. |

## Steps for you (Claude can't buy, sign up or log in for you)

1. **Pick the name.** Short, no hyphens, easy to say on the phone. For example `visayawebstudio.com`, `visayaweb.com` or `visayastudio.com`. Check availability on the registrar's site.
2. **Buy it** at Cloudflare Registrar (needs a free Cloudflare account) or Porkbun. Turn on auto-renew and WHOIS privacy.
3. **Sign up for Google Workspace Business Starter** with that domain. Create one mailbox, for example `nathaniel@<domain>`, and an alias `hello@<domain>`. The setup wizard walks you through verifying the domain and adding the MX records.
4. **Authentication records** (in the registrar's DNS settings; Claude can check them once they're in):
   - SPF, a TXT record on the root: `v=spf1 include:_spf.google.com ~all`
   - DKIM: in the Workspace Admin console → Apps → Google Workspace → Gmail → Authenticate email, generate the key, add the TXT record it shows (`google._domainkey`), then click **Start authentication**.
   - DMARC, a TXT record on `_dmarc`: `v=DMARC1; p=none; rua=mailto:hello@<domain>`. After 4 clean weeks, change `p=none` to `p=quarantine`.
5. **Point the demos at it in Netlify:** on the demo site (id 690bd604…), Domain management → Add a domain → set it as primary, and add the DNS records Netlify shows. HTTPS is set up automatically. Old `netlify.app` links keep working and redirect to the new domain, so emails already sent don't break.
6. **Google Postmaster Tools:** add the domain and verify it with the TXT record it gives you.
7. **Connect the Gmail connector to the new account** in Claude's connector settings, so drafts are created in the new mailbox.
8. Tell the main chat "domain is set up: <domain>". Claude checks the DNS records and switches the pipeline over (below).

## What Claude changes once it's live

- `config.json`: `netlify.baseUrl` → `https://<domain>`, `studio.email` → the new address, rebuild and redeploy every demo.
- **The new inbox is warmed up again from scratch:** about 8 cold emails a day in week 1, 15 in week 2, 22 in week 3, then 30, with the same health rules. In the first week, use the new address for normal mail first (replies to clients and prospects).
- **The old Gmail keeps sending at its current level during that warm-up**, so total reach doesn't drop. After about 4 weeks, all new pitches move to the new inbox. Threads started from the old Gmail are always answered from the old Gmail.
- `qa.js` gets a check that blocks sending if SPF, DKIM or DMARC goes missing, or a demo link still points at `netlify.app`.
- The 26 approved emails (Nov 17–18) go out from the current Gmail as planned. The switch starts after them.
- **Later, past 40 emails a day:** a second sending domain and inbox (another about $11 a year plus $7 a month). Claude will ask first.

## Sources
- Google Workspace plans and prices: https://support.google.com/a/answer/1247360
- Philippine reseller pricing (Z.com): https://web.z.com/ph/google-workspace/
- .com registrar comparison: https://dev.to/pickuma/best-domain-registrars-for-developers-in-2026-porkbun-cloudflare-namecheap-and-squarespace-4n1k
- Porkbun .com cost calculator: https://porkbun.com/about/domain-cost-calculator/com
- New-domain warm-up schedules: https://www.warmy.io/blog/how-long-to-warm-up-new-domains-before-starting-to-send-campaigns/ and https://leadhaste.com/blog/email-warmup-for-new-domains
