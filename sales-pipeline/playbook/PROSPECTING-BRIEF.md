# Prospecting brief (for research subagents)

You research small US businesses for Visaya Web Studio (Nathaniel Visaya, Antipolo City, Philippines), who builds one-page websites. You only **research and write data**. You never contact anyone, never log in anywhere, never fill forms, never type into Facebook or Google, never spend money.

## What qualifies
- Town of roughly 10,000–80,000 people, away from big metros.
- Google Maps listing with real reviews (10 or more), open, **not a chain or franchise**.
- **No website**: the Maps listing shows "Add website" (and no "Website" link). If Maps or Facebook links a site, open it: a working site disqualifies them; a dead domain is a great pitch detail (note it). A Facebook page, Facebook group, Square booking page or Linktree is NOT a website.
- A published email, required: shown on their own Facebook page, Google listing or other page they control. The owner sends no Messenger or SMS (`settings.emailOnly`), so no email = skip, however good the business looks. Never use phone/SMS for US (TCPA).
- English-language business (owner posts in English).
- Skip anything in `sales-pipeline/leads.csv`, `sales-pipeline/data/prospects.json`, `sales-pipeline/data/do-not-contact.csv`, or already taken today (list in your task).
- Max one business of the same type per town.

## How (built-in browser tools, `mcp__Claude_Browser__*`)
Open **your own tab** first with `tabs_create` and pass that `tabId` on **every** browser call, so you don't collide with other agents. Background tabs don't render until screenshotted: after each `navigate`, wait 2–3 s, then take `computer screenshot` with `scale: 0.1` before running JavaScript.

1. Maps search: `https://www.google.com/maps/search/<type>+in+<Town>+<ST>?hl=en`, then run:
```js
JSON.stringify([...document.querySelectorAll('div[role=feed] a.hfpxzc')].map(a=>{const c=a.closest('div[role=article]')||a.parentElement;const t=c.innerText;const m=t.match(/(\d\.\d)\((\d[\d,]*)\)/);return{n:a.getAttribute('aria-label'),r:m?m[1]:'',c:m?+m[2].replace(',',''):0,web:!!c.querySelector('a[data-value="Website"]'),h:a.href.split('?')[0].split('/data=')[1]}}).filter(x=>!x.web&&x.c>=10).map(x=>x.n+' '+x.r+' ('+x.c+') '+x.h))
```
   The list filter misses some websites (restaurants especially), so always confirm on the place page.
2. Place page: navigate to `https://www.google.com/maps/place/data=<h from above>?hl=en`, wait, tiny screenshot, then:
```js
const L=[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')); const t=document.body.innerText; const it=s=>[...document.querySelectorAll(s)].map(e=>(e.getAttribute('aria-label')||'')+' '+(e.href||'')); const o=JSON.stringify({head:t.slice(t.indexOf('See photos'),t.indexOf('See photos')+90).replace(/\n+/g,' | '), addWeb:t.includes('Add website'), web:it('a[data-item-id="authority"]'), phone:it('[data-item-id^="phone"]'), addr:it('[data-item-id="address"]'), hours:L.filter(l=>/, Copy open hours/.test(l)).map(l=>l.replace(', Copy open hours','')), summ:(t.split('Review summary')[1]||'').split('Write a review')[0].replace(/\s+/g,' ').slice(0,400), chips:[...document.querySelectorAll('button[aria-label*="mentioned in"]')].map(b=>b.getAttribute('aria-label').replace(', mentioned in ',':').replace(' reviews',''))}); const tab=[...document.querySelectorAll('button[role=tab]')].find(b=>/Reviews/.test(b.innerText)||/^Reviews/.test(b.getAttribute('aria-label')||'')); tab&&tab.click(); o
```
   Then wait 2 s, tiny screenshot, and read the visible reviews:
```js
document.querySelectorAll('button.w8nwRe').forEach(b=>b.click()); await new Promise(r=>setTimeout(r,500)); JSON.stringify([...document.querySelectorAll('.jftiEf')].map(r=>{const s=r.querySelector('.kvMYJc');const w=r.querySelector('.rsqaWe');const tx=r.querySelector('.wiI7pd');const resp=r.querySelector('.CDe7pd');return (s?s.getAttribute('aria-label'):'')+' | '+(w?w.innerText:'')+' | '+(tx?tx.innerText:'')+(resp?' || OWNER: '+resp.innerText.slice(0,160):'')}))
```
3. Facebook: Bing search `https://www.bing.com/search?q=%22<Business+Name>%22+<Town>+facebook&setlang=en`, decode result links with:
```js
await new Promise(r=>setTimeout(r,1500)); const dec=h=>{try{const u=new URL(h).searchParams.get('u');return u?atob(u.slice(2).replace(/-/g,'+').replace(/_/g,'/')):h}catch(e){return h}}; JSON.stringify([...document.querySelectorAll('li.b_algo')].slice(0,6).map(li=>{const a=li.querySelector('h2 a');return (a?a.innerText:'')+' | '+(a?dec(a.href):'')+' | '+((li.querySelector('p, .b_caption')||{}).innerText||'').slice(0,200)}))
```
   Open the page (logged out is fine) and run `const t=document.body.innerText; JSON.stringify({emails:(t.match(/[\w.+-]+@[\w-]+\.[\w.]+/g)||[]), intro:t.slice(0,1400)})`. Make sure the page's town/phone matches the Maps listing (many businesses share names).
4. Hero photo from Unsplash: open `https://unsplash.com/s/photos/<query>` and pick a strong, relevant, non-cheesy photo (no visible brand logos, no faces as the focus). Get its id (the `photo-...` part of an `images.unsplash.com/photo-...` URL), photographer name and username. Verify with Bash: `curl -s -o /dev/null -w "%{http_code}" "https://images.unsplash.com/<id>?w=800"` must print 200. Never use photos from the business's own pages.

## Output
Write a JSON array to the file named in your task. One object per prospect, exactly this shape (US example):

```json
{
  "slug": "kebab-case-name",
  "name": "Exact business name",
  "market": "US",
  "town": "Town", "state": "ST", "tz": "America/Chicago",
  "category": "Google category",
  "theme": "one of: lawn, lawn-sun, cafe, diner, detailing, mechanic, wash, sparky, barber, barber-classic",
  "found": "YYYY-MM-DD",
  "channel": "email",
  "email": "only if published, else null",
  "emailSource": "Listed on their public Facebook page",
  "contactLink": "https://m.me/<page username or id> (messenger only)",
  "phoneDisplay": "(417) 622-0393", "phoneTel": "+14176220393",
  "address": "street address, or null for service-area businesses",
  "serviceArea": "Town and surrounding area (when address is null)",
  "mapQuery": "Name, address or town for the map embed",
  "rating": 4.9, "reviewCount": 198,
  "hours": [["Mon – Thu", "10am – 6pm"], ["Fri – Sat", "9am – 6pm"], ["Sunday", "Closed"]],
  "hoursNote": "Hours from your Google listing.",
  "kicker": "Service · Service · Town",
  "headline": "Short, plain, specific headline (under 60 chars)",
  "sub": "One sentence: what they do + rated X by N Google reviewers.",
  "servicesTitle": "What we do / On the menu",
  "services": [["Service", "One plain sentence, only from their listing, posts or reviews."]],
  "servicesNote": "Taken from your Google listing and reviews. Your full list and prices go here.",
  "themes": [["Theme title", "Paraphrase of what several reviewers say. Never quote."]],
  "cta": "Get a free quote / Book a cut / Order ahead",
  "photo": {"id": "photo-...", "by": "Photographer Name", "user": "username"},
  "pitch": {
    "greeting": "Hi <first name if the owner signs posts/replies with it>, or Hi <Business> team,",
    "line1": "ONE specific, true detail no one else could send. 1–2 short sentences. Paraphrase reviews, don't quote more than a few words.",
    "gap": "I couldn't find a website for <Business>"
  },
  "complexity": "simple | standard | menu (see below)",
  "sources": ["Google Maps listing (rating, hours, reviews, phone)", "facebook.com/... (email, description)"],
  "notes": "Owner name and how you know it, conflicts between sources, anything to confirm"
}
```

Rules for the content: every fact must come from the listing, their own posts or reviews (list each in `sources`). 3–6 services, 3 review themes. US spelling, plain words, no hype, no em dashes. Never invent services, prices, years in business or awards. If unsure, leave it out and say so in `notes`.

`complexity`: **simple** = a service business with a short service list (car wash, tree service, mowing). **standard** = more services, a before/after gallery or booking (barbers, cleaners, groomers, mechanics). **menu** = food: menu section, specials, catering or ordering.

`line1` examples of the bar: "One of your reviewers drove past for four years before stopping in, then compared your pastry to Chicago." / "Your Facebook page links to slayalldaypressurewashing.com, but the site doesn't load." Not: "Your reviews are amazing."

Finish with a short report: what you added, what you skipped and why, and anything uncertain.
