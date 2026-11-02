// node tools/screenshot.js [url-hash] — loads the app in headless Chromium, logs console errors, saves screenshots
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.dirname(__dirname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.kml': 'application/vnd.google-earth.kml+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
}).listen(8765);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [name, w, h] of [['desktop', 1400, 900], ['phone', 400, 800]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text().slice(0, 300)}`); });
    page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
    await page.goto('http://localhost:8765/index.html' + (process.argv[2] || ''), { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/tmp/claude-0/-home-claude/b858539e-d120-56f9-b079-a2d6f47dc31c/scratchpad/shot-${name}-1.png` });
    // drop a pin on North Kingston via the search box
    await page.fill('#searchBox', '51.4166, -0.2962'); await page.press('#searchBox', 'Enter');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/claude-0/-home-claude/b858539e-d120-56f9-b079-a2d6f47dc31c/scratchpad/shot-${name}-2.png` });
    const txt = await page.evaluate(() => document.querySelector('#tab-pin').innerText.slice(0, 1800));
    if (name === 'desktop') console.log(txt);
    await page.close();
  }
  await browser.close(); server.close();
  console.log('\nconsole errors:', errors.length); errors.slice(0, 20).forEach(e => console.log(' ', e));
})();
