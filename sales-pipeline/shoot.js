#!/usr/bin/env node
// Screenshots every demo. Usage: node shoot.js [baseUrl]   (default: local ./site via file server)
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const prospects = require('./data/prospects.json');
const SITE = path.join(__dirname, 'site'), OUT = path.join(__dirname, 'screenshots');
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
