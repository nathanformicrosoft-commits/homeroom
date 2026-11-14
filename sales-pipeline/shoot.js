#!/usr/bin/env node
// Screenshots every demo. Usage: node shoot.js [baseUrl]   (default: local ./site via file server)
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const prospects = require('./data/prospects.json');
const SITE = path.join(__dirname, 'site'), OUT = path.join(__dirname, 'screenshots');
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch (e) { fallback(); return; }

// No Playwright installed: use the Chrome or Edge already on this computer in headless mode.
// Phone shot = 390px wide and tall enough to show most of the page; desktop thumb = 1280x800.
// Needs ImageMagick (`magick`) to convert PNG to JPG; keeps PNG otherwise.
function fallback() {
  const { execFileSync } = require('child_process');
  const browser = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((b) => b && fs.existsSync(b));
  if (!browser) { console.error('No Playwright and no Chrome/Edge found. Run: npm i playwright && npx playwright install chromium'); process.exit(1); }
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shoot-'));
  const base = process.argv[2];
  for (const p of prospects) {
    if (only && !only.includes(p.slug)) continue;
    const url = base ? `${base.replace(/\/$/, '')}/${p.slug}/` : 'file:///' + path.join(SITE, p.slug, 'index.html').replace(/\\/g, '/');
    for (const [name, size] of [['mobile', '390,2600'], ['thumb', '1280,800']]) {
      const png = path.join(OUT, `${p.slug}-${name}.png`);
      execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${size}`, '--virtual-time-budget=8000', `--screenshot=${png}`, url], { stdio: 'ignore' });
      try { execFileSync('magick', [png, '-quality', name === 'mobile' ? '72' : '70', png.replace(/\.png$/, '.jpg')], { stdio: 'ignore' }); fs.unlinkSync(png); } catch (e) { /* keep the PNG */ }
    }
    console.log('shot', p.slug);
  }
}
const types = { '.html': 'text/html', '.css': 'text/css', '.jpg': 'image/jpeg', '.txt': 'text/plain' };
(async () => {
  let base = process.argv[2], server;
  if (!base) {
    server = http.createServer((req, res) => {
      let f = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    }).listen(0);
    base = 'http://127.0.0.1:' + server.address().port;
  }
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const b = await chromium.launch();
  const phone = await b.newContext({ ...devices['iPhone 13'] });
  const desk = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  for (const p of prospects) {
    if (only && !only.includes(p.slug)) continue;
    const url = `${base.replace(/\/$/, '')}/${p.slug}/`;
    const pg = await phone.newPage();
    await pg.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('load issue', p.slug, e.message.slice(0, 80)));
    await pg.addStyleTag({ content: '.callbar{display:none!important}' });
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(OUT, `${p.slug}-mobile.jpg`), type: 'jpeg', quality: 72, fullPage: true });
    await pg.close();
    const dg = await desk.newPage();
    await dg.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await dg.waitForTimeout(1200);
    await dg.screenshot({ path: path.join(OUT, `${p.slug}-thumb.jpg`), type: 'jpeg', quality: 70 });
    await dg.close();
    console.log('shot', p.slug);
  }
  await b.close(); if (server) server.close();
})();
