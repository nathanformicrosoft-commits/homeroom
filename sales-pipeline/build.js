#!/usr/bin/env node
// Builds every demo page, the studio one-pager and the portfolio page into ./site
// Usage: node build.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'site');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const prospects = JSON.parse(fs.readFileSync(process.env.PROSPECTS || path.join(ROOT, 'data/prospects.json'), 'utf8'));
const CLIENTS = process.env.CLIENTS_DIR || path.join(ROOT, 'clients');
const studio = config.studio;
const studioLabel = studio.studioName || 'a small web studio in the Philippines';
const { quoteFor, money } = require('./lib');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const THEMES = {
  lawn: { fonts: 'Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600', hf: "'Barlow Condensed'", bf: "'Barlow'", bg: '#F4F6EF', surface: '#FFFFFF', ink: '#14261A', muted: '#566458', line: '#DDE3D6', accent: '#2E7D32', accentInk: '#FFFFFF', tint: '16,34,22', upper: true },
  'lawn-sun': { fonts: 'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,800', hf: "'Bricolage Grotesque'", bf: "'Bricolage Grotesque'", bg: '#FFFBEA', surface: '#FFFFFF', ink: '#1F2A14', muted: '#5C6650', line: '#EADFB8', accent: '#F2B705', accentInk: '#1F2A14', accentText: '#7A5C00', tint: '26,38,16' },
  cafe: { fonts: 'Fraunces:opsz,wght@9..144,500;9..144,700&family=DM+Sans:wght@400;500;700', hf: "'Fraunces'", bf: "'DM Sans'", bg: '#FAF5EC', surface: '#FFFFFF', ink: '#2B2118', muted: '#6B5D50', line: '#E8DCC8', accent: '#C4552D', accentInk: '#FFFFFF', tint: '43,33,24' },
  diner: { fonts: 'Oswald:wght@500;700&family=DM+Sans:wght@400;500;700', hf: "'Oswald'", bf: "'DM Sans'", bg: '#FFF7EE', surface: '#FFFFFF', ink: '#1B1B1F', muted: '#5F5A57', line: '#F0DDCB', accent: '#D7263D', accentInk: '#FFFFFF', tint: '40,10,16', upper: true, checker: true },
  detailing: { dark: true, fonts: 'Sora:wght@600;700&family=Albert+Sans:wght@400;500;600', hf: "'Sora'", bf: "'Albert Sans'", bg: '#0D1117', surface: '#161B22', ink: '#F0F3F6', muted: '#9BA7B4', line: '#27303B', accent: '#3BA7FF', accentInk: '#06131F', tint: '6,10,16' },
  mechanic: { dark: true, fonts: 'Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600', hf: "'Barlow Condensed'", bf: "'Barlow'", bg: '#141618', surface: '#1D2023', ink: '#F3F1EC', muted: '#A6A39C', line: '#2E3236', accent: '#F28C28', accentInk: '#1A1206', tint: '12,13,14', upper: true },
  wash: { fonts: 'Outfit:wght@600;700&family=Figtree:wght@400;500;600', hf: "'Outfit'", bf: "'Figtree'", bg: '#F2F8FC', surface: '#FFFFFF', ink: '#0C2A3A', muted: '#4F6675', line: '#D5E6F0', accent: '#0A7CC0', accentInk: '#FFFFFF', tint: '8,34,50' },
  sparky: { dark: true, fonts: 'Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600', hf: "'Barlow Condensed'", bf: "'Barlow'", bg: '#0B1B2B', surface: '#12273C', ink: '#F4F7FA', muted: '#9FB3C6', line: '#1F3A55', accent: '#FFC629', accentInk: '#0B1B2B', tint: '8,20,34', upper: true },
  barber: { dark: true, fonts: 'Anton&family=Archivo:wght@400;500;600', hf: "'Anton'", bf: "'Archivo'", bg: '#0F0F10', surface: '#1A1A1C', ink: '#F5F2EA', muted: '#A8A39A', line: '#2B2B2E', accent: '#E0B04A', accentInk: '#14100A', tint: '10,10,10', upper: true },
  'barber-classic': { fonts: 'DM+Serif+Display&family=DM+Sans:wght@400;500;700', hf: "'DM Serif Display'", bf: "'DM Sans'", bg: '#F6F1E7', surface: '#FFFDF8', ink: '#1E2A22', muted: '#5E675F', line: '#E2D9C6', accent: '#8A2B2B', accentInk: '#FFFFFF', tint: '30,42,34' },
};

const CSS = `
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 var(--bf),system-ui,sans-serif;padding-bottom:130px}
h1,h2,h3{font-family:var(--hf),var(--bf),sans-serif;line-height:1.08;margin:0;text-wrap:balance}
.upper h1,.upper h2,.upper .brand{text-transform:uppercase;letter-spacing:.01em}
a{color:inherit}img{max-width:100%;display:block}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.ribbon{background:var(--ink);color:var(--bg);font-size:13px;text-align:center;padding:8px 16px;line-height:1.35}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;max-width:1080px;margin:0 auto}
.brand{font-family:var(--hf);font-size:22px;font-weight:700;text-decoration:none;line-height:1.1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:var(--accent-ink);font-weight:600;text-decoration:none;border:2px solid var(--accent);border-radius:999px;padding:14px 24px;font-size:17px;min-height:52px;cursor:pointer;font-family:inherit}
.btn:hover{filter:brightness(1.07)}.btn:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.btn-sm{padding:8px 16px;min-height:42px;font-size:15px;white-space:nowrap}
.btn-ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.75)}
.hero{position:relative;color:#fff;isolation:isolate;overflow:hidden;background:rgb(var(--tint))}
.hero img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
.hero::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(var(--tint),.55) 0%,rgba(var(--tint),.82) 62%,rgba(var(--tint),.94) 100%)}
.hero.plain::before{background:radial-gradient(900px 500px at 85% -10%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 70%),repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 14px,transparent 14px 28px)}
.hero .wrap{padding-top:64px;padding-bottom:56px}
.kicker{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin:0 0 16px;opacity:.92}
h1{font-size:clamp(38px,9.5vw,76px);max-width:15ch}
.sub{font-size:19px;max-width:44ch;margin:18px 0 26px;opacity:.95}
.cta-row{display:flex;flex-wrap:wrap;gap:12px}
.rating{display:inline-flex;align-items:center;gap:8px;margin:28px 0 0;font-weight:600;font-size:15px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:8px 14px}
.rating b{color:#FFD257;letter-spacing:2px}
.checker{height:18px;background:repeating-conic-gradient(var(--ink) 0 25%,var(--bg) 0 50%) 0 0/18px 18px}
section{padding:64px 0}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text);margin:0 0 10px}
h2{font-size:clamp(30px,6.5vw,46px);margin-bottom:28px}
.grid{display:grid;gap:14px;grid-template-columns:1fr}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px 22px}
.card h3{font-size:22px;margin-bottom:6px;font-family:var(--hf)}
.card p{margin:0;color:var(--muted)}
.svc{display:flex;gap:16px;align-items:flex-start}
.svc .n{flex:none;font-family:var(--hf);font-size:15px;font-weight:700;color:var(--accent-ink);background:var(--accent);width:34px;height:34px;border-radius:50%;display:grid;place-items:center;margin-top:2px}
.fine{font-size:13.5px;color:var(--muted);margin:18px 0 0}
.band{background:var(--surface);border-block:1px solid var(--line)}
.theme h3{font-size:24px}.theme{border-top:4px solid var(--accent)}
.visit{display:grid;gap:22px}
table.hours{width:100%;border-collapse:collapse;font-size:17px}
table.hours td{padding:12px 0;border-bottom:1px solid var(--line)}table.hours td:last-child{text-align:right;font-weight:600}
.addr{font-style:normal;margin:18px 0 0;font-weight:500}
.map{border-radius:16px;overflow:hidden;border:1px solid var(--line);background:linear-gradient(135deg,var(--line),var(--surface));min-height:300px}
.map iframe{width:100%;height:320px;border:0;display:block}
form{display:grid;gap:14px}
label{font-weight:600;font-size:15px;display:grid;gap:6px}
input,textarea{font:inherit;color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:12px;padding:14px;width:100%}
textarea{min-height:120px;resize:vertical}
.note{display:none;background:var(--bg);border:1.5px dashed var(--accent);border-radius:12px;padding:14px;font-size:15px}
.note.on{display:block}
footer{padding:36px 0 28px;font-size:14px;color:var(--muted);border-top:1px solid var(--line)}
footer p{margin:0 0 8px}footer strong{color:var(--ink)}
.callbar{position:fixed;left:12px;right:12px;bottom:64px;z-index:20;box-shadow:0 10px 30px rgba(0,0,0,.28)}
@media(min-width:760px){body{padding-bottom:0}.callbar{display:none}.grid{grid-template-columns:repeat(2,1fr)}.grid.three{grid-template-columns:repeat(3,1fr)}.visit{grid-template-columns:1fr 1.15fr;align-items:start;gap:40px}.hero .wrap{padding-top:110px;padding-bottom:96px}section{padding:88px 0}.contact-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:48px;align-items:start}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
.adds{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.adds li{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px 16px 12px 42px;position:relative}
.adds li::before{content:"+";position:absolute;left:16px;top:11px;font-weight:700;color:var(--accent-text)}
.price-line{margin:22px 0 0;font-size:18px}.price-line strong{font-family:var(--hf);font-size:26px;color:var(--ink)}
@media(min-width:760px){.adds{grid-template-columns:repeat(2,1fr)}}
`;

const img = (id, w) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;
const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

function finishedSection(p) {
  const m = config.markets[p.market] || {};
  const food = p.complexity === 'menu' || ['cafe', 'diner'].includes(p.theme);
  const adds = [
    'Your own photos and logo in place of the placeholder picture',
    food ? 'Your full menu with prices, worded your way' : 'Your full list of services and prices, worded your way',
    food ? 'Specials, catering or where-to-find-us updates you can change with one message' : (p.complexity === 'standard' ? 'A gallery of your work and a booking link' : 'A free-quote form that sends job details straight to you'),
    'A contact form that sends messages straight to your inbox',
    'Your own web address, registered in your name',
    'Two rounds of changes until it is right',
  ];
  return `<section id="finished" class="band"><div class="wrap">
  <p class="eyebrow">This is a preview</p>
  <h2>What your finished site adds</h2>
  <ul class="adds">${adds.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  <p class="price-line">Finished site for ${esc(p.name)}: <strong>${esc(money(p.market, quoteFor(p, config), config))}</strong> one-time. Optional care plan ${esc(money(p.market, m.careQuote, config))}/month for hosting and small edits.</p>
</div></section>`;
}

function demoPage(p) {
  const final = p.stage === 'final';
  const lang = (config.markets[p.market] || {}).lang || 'en';
  const t = THEMES[p.theme];
  const vars = `--bg:${t.bg};--surface:${t.surface};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--accent:${t.accent};--accent-ink:${t.accentInk};--accent-text:${t.accentText || t.accent};--tint:${t.tint};--hf:${t.hf};--bf:${t.bf}`;
  const hero = p.photo
    ? `<img class="bg" src="${img(p.photo.id, 1600)}" srcset="${img(p.photo.id, 800)} 800w, ${img(p.photo.id, 1600)} 1600w" sizes="100vw" alt="" fetchpriority="high" onerror="this.remove()">`
    : '';
  const services = p.services.map(([n, d], i) => `<div class="card svc"><span class="n">${i + 1}</span><div><h3>${esc(n)}</h3><p>${esc(d)}</p></div></div>`).join('\n');
  const themes = p.themes.map(([n, d]) => `<div class="card theme"><h3>${esc(n)}</h3><p>${esc(d)}</p></div>`).join('\n');
  const hours = p.hours.map(([d, h]) => `<tr><td>${esc(d)}</td><td>${esc(h)}</td></tr>`).join('');
  const where = p.address
    ? `<address class="addr">${esc(p.address)}</address>`
    : `<p class="addr">Service area: ${esc(p.serviceArea)}</p>`;
  const credit = p.photo
    ? `<p>Photo by <a href="https://unsplash.com/@${p.photo.user}?utm_source=demo_concept&utm_medium=referral">${esc(p.photo.by)}</a> on <a href="https://unsplash.com/?utm_source=demo_concept&utm_medium=referral">Unsplash</a>, used as a placeholder until you send your own photos.</p>`
    : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${final ? '' : '<meta name="robots" content="noindex, nofollow">\n'}<title>${esc(p.name)}${final ? ` | ${esc(p.category)} in ${esc(p.town)}, ${esc(p.state)}` : ' | demo concept'}</title>
<meta name="description" content="${final ? esc(p.sub) : `Demo homepage concept for ${esc(p.name)}, ${esc(p.town)} ${esc(p.state)}. Not the official website.`}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${t.fonts}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${final ? 'assets/site.css' : '../assets/demo.css'}">
</head>
<body style="${vars}" class="${t.upper ? 'upper' : ''}">
${final ? '' : `<div class="ribbon">Free preview for ${esc(p.name)}: a look at what your site could include, not the finished site. This is not the official website.</div>`}
<header class="top">
  <a class="brand" href="#top">${esc(p.name)}</a>
  <a class="btn btn-sm" href="tel:${p.phoneTel}">Call ${esc(p.phoneDisplay)}</a>
</header>
<main id="top">
<div class="hero${p.photo ? '' : ' plain'}">
  ${hero}
  <div class="wrap">
    <p class="kicker">${esc(p.kicker)}</p>
    <h1>${esc(p.headline)}</h1>
    <p class="sub">${esc(p.sub)}</p>
    <div class="cta-row">
      <a class="btn" href="tel:${p.phoneTel}">Call ${esc(p.phoneDisplay)}</a>
      <a class="btn btn-ghost" href="#contact">${esc(p.cta)}</a>
    </div>
    <p class="rating"><b>★</b> ${p.rating.toFixed(1)} from ${p.reviewCount} Google reviews</p>
  </div>
</div>
${t.checker ? '<div class="checker" aria-hidden="true"></div>' : ''}
<section id="services"><div class="wrap">
  <p class="eyebrow">${esc(p.category)}</p>
  <h2>${esc(p.servicesTitle)}</h2>
  <div class="grid">
${services}
  </div>
  ${p.servicesNote ? `<p class="fine">${esc(p.servicesNote)}</p>` : ''}
</div></section>
<section id="reviews" class="band"><div class="wrap">
  <p class="eyebrow">${p.rating.toFixed(1)} stars · ${p.reviewCount} Google reviews</p>
  <h2>What customers say</h2>
  <div class="grid three">
${themes}
  </div>
  <p class="fine">Themes summarised from public Google reviews, ${monthYear}. These are not direct quotes.</p>
</div></section>
<section id="visit"><div class="wrap visit">
  <div>
    <p class="eyebrow">${p.address ? 'Find us' : 'Where we work'}</p>
    <h2>Hours &amp; location</h2>
    <table class="hours"><tbody>${hours}</tbody></table>
    ${where}
    <p class="fine">${esc(p.hoursNote)}</p>
  </div>
  <div class="map"><iframe loading="lazy" title="Map of ${esc(p.address || p.serviceArea)}" src="https://www.google.com/maps?q=${encodeURIComponent(p.mapQuery)}&output=embed"></iframe></div>
</div></section>
${final ? '' : finishedSection(p)}
<section id="contact"${final ? ' class="band"' : ''}><div class="wrap contact-grid">
  <div>
    <p class="eyebrow">Contact</p>
    <h2>${esc(p.cta)}</h2>
    <p>Call <a href="tel:${p.phoneTel}"><strong>${esc(p.phoneDisplay)}</strong></a> or send a message and we will get back to you.</p>
  </div>
  ${final ? `<form name="contact" method="POST" action="/thanks/" data-netlify="true" netlify-honeypot="company">
    <input type="hidden" name="form-name" value="contact"><p hidden><label>Leave blank<input name="company"></label></p>` : '<form id="demo-form" novalidate>'}
    <label>Name<input name="name" autocomplete="name" required></label>
    <label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
    <label>How can we help?<textarea name="message"></textarea></label>
    <button class="btn" type="submit">Send message</button>
    ${final ? '' : '<p class="note" id="demo-note" role="status">This form is switched off on the demo, so nothing was sent. On the finished site, messages go straight to ' + esc(p.name) + '.</p>'}
  </form>
</div></section>
</main>
<footer><div class="wrap">${final ? `<p><strong>${esc(p.name)}</strong> · ${esc(p.address || p.serviceArea)} · <a href="tel:${p.phoneTel}">${esc(p.phoneDisplay)}</a></p>${credit}<p>© ${new Date().getFullYear()} ${esc(p.name)}. Website by ${esc(studioLabel)}.</p>` : `
  <p><strong>Demo concept by ${esc(studioLabel)}.</strong> Built as an unsolicited sample for ${esc(p.name)} using details from their public listings. Not affiliated with or endorsed by the business.</p>
  ${credit}
  <p>Want it changed or taken down? ${studio.email ? `Email <a href="mailto:${esc(studio.email)}">${esc(studio.email)}</a>` : 'Reply to the message that brought you here'} and it will be done straight away.</p>`}
</div></footer>
<a class="btn callbar" href="tel:${p.phoneTel}">Call ${esc(p.phoneDisplay)}</a>
${final ? '' : `<script>document.getElementById('demo-form').addEventListener('submit',function(e){e.preventDefault();document.getElementById('demo-note').classList.add('on')});</script>`}
</body>
</html>`;
}

// ---------- studio pages (one-pager + portfolio) ----------
const STUDIO_CSS = `
*{box-sizing:border-box}body{margin:0;background:#F7F5F0;color:#17202A;font:400 17px/1.65 'Bricolage Grotesque',system-ui,sans-serif}
h1,h2,h3{font-family:'Bricolage Grotesque','Bricolage Grotesque',sans-serif;line-height:1.1;margin:0;text-wrap:balance}
.wrap{max-width:920px;margin:0 auto;padding:0 20px}a{color:#0B5FFF}
header{padding:22px 0;font-weight:700;font-family:'Bricolage Grotesque';font-size:20px}
header a{text-decoration:none;color:inherit}nav{float:right;font:500 15px 'Bricolage Grotesque'}nav a{margin-left:16px}
.lead{padding:48px 0 40px}.lead h1{font-size:clamp(36px,8vw,64px);max-width:16ch}.lead p{font-size:20px;max-width:52ch;color:#44505C}
.btn{display:inline-block;background:#17202A;color:#fff;text-decoration:none;font-weight:600;border-radius:999px;padding:14px 24px;margin-top:8px}
section{padding:40px 0;border-top:1px solid #E2DED4}h2{font-size:clamp(26px,5vw,36px);margin-bottom:18px}
.cols{display:grid;gap:14px}.box{background:#fff;border:1px solid #E2DED4;border-radius:16px;padding:20px 22px}
.box h3{font-size:20px;margin-bottom:6px}.box p{margin:0;color:#44505C}
.price{font-family:'Bricolage Grotesque';font-size:30px;font-weight:800;color:#17202A}
ol{padding-left:20px;margin:0}li{margin-bottom:8px}
.shot{aspect-ratio:4/3;background:#DAD5C8 center top/cover;border-radius:12px;margin-bottom:14px;border:1px solid #E2DED4}
footer{padding:32px 0 48px;color:#5B6672;font-size:15px;border-top:1px solid #E2DED4}
.draft{background:#FFF3C4;border:1px solid #E5CF73;border-radius:12px;padding:12px 16px;font-size:15px;margin:16px 0}
@media(min-width:760px){.cols{grid-template-columns:repeat(2,1fr)}.cols.three{grid-template-columns:repeat(3,1fr)}}
`;
const complete = studio.studioName && studio.ownerName && studio.city && studio.email;
const studioName = studio.studioName || 'Web studio';
const where = studio.city ? `${studio.city}, ${studio.country}` : `the ${studio.country}`;
const contactBlock = complete
  ? `<p>Email <a href="mailto:${esc(studio.email)}">${esc(studio.email)}</a>${studio.chatLink ? ` or message us on <a href="${esc(studio.chatLink)}">WhatsApp / Messenger</a>` : ''}. ${esc(studio.ownerName)}, ${esc(studioName)}, ${esc(where)}.</p>`
  : `<p class="draft">Draft page. Studio name and contact details are not filled in yet (see config.json).</p>`;
const shell = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/studio.css"></head><body>
<div class="wrap"><header><a href="/">${esc(studioName)}</a><nav><a href="/">Pricing</a><a href="/work/">Work</a></nav></header></div>
${body}
<div class="wrap"><footer>${esc(studioName)} is a small web-design studio based in ${esc(where)}. We work remotely with local businesses overseas.</footer></div>
</body></html>`;

function onePager() {
  const m = config.markets;
  return shell(`${studioName} | one-page websites for local businesses`, `
<div class="wrap lead"><h1>A one-page website for your business, live in 3 days.</h1>
<p>We build simple, fast, mobile-first sites for plumbers, electricians, cleaners, landscapers, cafes, salons and mobile services. You see a working demo before you pay anything.</p>
<a class="btn" href="/work/">See demo sites</a></div>
<section><div class="wrap"><h2>What you get</h2><div class="cols">
<div class="box"><h3>One page that does the job</h3><p>Your services or menu, opening hours, a map, click-to-call and a contact form.</p></div>
<div class="box"><h3>Built for phones first</h3><p>Most local searches happen on a phone, so that is where the page is designed to work best.</p></div>
<div class="box"><h3>Two rounds of edits</h3><p>We adjust wording, photos and layout until it is right.</p></div>
<div class="box"><h3>You own it</h3><p>The domain and hosting are in your name, and the site is yours after the final payment.</p></div>
</div></div></section>
<section><div class="wrap"><h2>Pricing</h2><div class="cols">
<div class="box"><h3>Website</h3><p class="price">From ${m.US.tiers.simple}</p><p>One-time, in US dollars, priced by how much your site needs: ${m.US.tiers.simple} for a simple service page, ${m.US.tiers.standard} with a gallery or booking, ${m.US.tiers.menu} with a full menu. Includes the contact form, setup on your own domain and two rounds of edits. Paid 50% to start and 50% at launch, by PayPal invoice.</p></div>
<div class="box"><h3>Care plan (optional)</h3><p class="price">$${m.US.careQuote} / month</p><p>Hosting, updates and small edits. Cancel any month.</p></div>
</div></div></section>
<section><div class="wrap"><h2>How it works</h2><ol>
<li>We send you a free demo homepage built from your public listing.</li>
<li>If you like it, you confirm the scope and pay a 50% deposit.</li>
<li>You send your logo, photos, prices and hours. We finish the site within 3 days.</li>
<li>You approve it, pay the remaining 50%, and we connect your domain and hand over the logins.</li>
</ol></div></section>
<section><div class="wrap"><h2>Who we are</h2><p>${esc(studioName)} is a small web-design studio based in ${esc(where)}. We are not a local agency in your town. We work remotely, which is how we keep the price low.</p>${contactBlock}</div></section>`);
}

function portfolio() {
  const picks = (config.portfolio || []).map((s) => prospects.find((p) => p.slug === s && p.stage !== 'final' && p.status !== 'do-not-contact')).filter(Boolean);
  const cards = picks.map((p) => `<a class="box" style="text-decoration:none;color:inherit" href="/${p.slug}/"><div class="shot" style="background-image:url(/assets/shots/${p.slug}.jpg)"></div><h3>${esc(p.category)}, ${esc(p.town)} ${esc(p.state)}</h3><p>Demo concept for ${esc(p.name)}.</p></a>`).join('\n');
  return shell(`${studioName} | demo sites`, `
<div class="wrap lead"><h1>Demo sites</h1>
<p>These are unsolicited demo concepts built from each business's public listing. They are samples of our work, not paid client projects, and the businesses have not endorsed them.</p></div>
<section><div class="wrap"><div class="cols three">${cards}</div></div></section>
<section><div class="wrap"><h2>Want one for your business?</h2>${contactBlock}</div></section>`);
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets/shots'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets/demo.css'), CSS.trim());
fs.writeFileSync(path.join(OUT, 'assets/studio.css'), STUDIO_CSS.trim());
for (const p of prospects) {
  if (p.status === 'do-not-contact' || p.removed) continue; // honour removal requests: page is not rebuilt
  if (p.stage === 'final') { // client sites: their own folder, deployed to their own Netlify site
    const dir = path.join(CLIENTS, p.slug, 'site');
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'thanks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets/site.css'), CSS.trim());
    fs.writeFileSync(path.join(dir, 'index.html'), demoPage(p));
    fs.writeFileSync(path.join(dir, 'thanks/index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Thanks | ${esc(p.name)}</title><body style="font:18px/1.6 system-ui;max-width:560px;margin:15vh auto;padding:0 20px"><h1>Thanks, we got your message.</h1><p>${esc(p.name)} will get back to you soon. Need us sooner? Call <a href="tel:${p.phoneTel}">${esc(p.phoneDisplay)}</a>.</p><p><a href="/">Back to the homepage</a></p></body></html>`);
    continue;
  }
  fs.mkdirSync(path.join(OUT, p.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.slug, 'index.html'), demoPage(p));
}
fs.mkdirSync(path.join(OUT, 'work'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), onePager());
fs.writeFileSync(path.join(OUT, 'work/index.html'), portfolio());
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(OUT, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n');
// keep portfolio thumbnails across rebuilds
const shots = path.join(ROOT, 'screenshots');
for (const f of fs.existsSync(shots) ? fs.readdirSync(shots) : []) {
  if (/-thumb\.jpg$/.test(f)) fs.copyFileSync(path.join(shots, f), path.join(OUT, 'assets/shots', f.replace('-thumb', '')));
}
console.log(`Built ${prospects.length} demos + studio pages into ${path.relative(process.cwd(), OUT) || '.'}`);
