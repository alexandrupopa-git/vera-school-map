// node tools/functional.js — exercises pin, school card, compare, requirements, share link
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.dirname(__dirname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); }).listen(8766);
const OUT = '/tmp/claude-0/-home-claude/b858539e-d120-56f9-b079-a2d6f47dc31c/scratchpad/';
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html', { waitUntil: 'load' }); await page.waitForTimeout(800);
  // 1. TW1 pin (walking-route borough)
  await page.fill('#searchBox', '51.4545, -0.315'); await page.press('#searchBox', 'Enter'); await page.waitForTimeout(1500);
  let txt = await page.evaluate(() => document.querySelector('#tab-pin').innerText);
  console.log('--- TW1 verdict:', txt.split('\n').slice(6, 8).join(' | '));
  const orleans = txt.indexOf('Orleans Park School'); console.log('--- Orleans Park row:', txt.slice(orleans, orleans + 600).replace(/\n/g, ' | '));
  const grey = txt.indexOf('Grey Court'); console.log('--- Grey Court row:', txt.slice(grey, grey + 420).replace(/\n/g, ' | '));
  // 2. school card
  await page.click('.school-row'); await page.waitForTimeout(400);
  txt = await page.evaluate(() => document.querySelector('#tab-pin').innerText); console.log('--- school card head:', txt.slice(0, 300).replace(/\n/g, ' | '));
  const rings = await page.evaluate(() => G.rings.getLayers().length); console.log('rings drawn:', rings);
  await page.click('#btnBackPin'); await page.waitForTimeout(300);
  // 3. compare: add TW1 and Kingston
  await page.click('#btnCmp'); await page.fill('#searchBox', '51.4166, -0.2962'); await page.press('#searchBox', 'Enter'); await page.waitForTimeout(1200); await page.click('#btnCmp');
  await page.click('.tab[data-tab="compare"]'); await page.waitForTimeout(300);
  txt = await page.evaluate(() => document.querySelector('#tab-compare').innerText); console.log('--- compare:', txt.slice(0, 700).replace(/\n/g, ' | '));
  await page.screenshot({ path: OUT + 'shot-compare.png' });
  // 4. save to shortlist
  await page.click('.tab[data-tab="pin"]'); await page.click('#btnSave'); await page.waitForTimeout(200);
  const saved = await page.evaluate(() => STATE.shortlist.length); console.log('shortlist:', saved);
  // 5. requirements: rent ≤ 2500 and 2 good primaries
  await page.click('.tab[data-tab="explore"]'); await page.selectOption('select[data-k="R.min_prim_high"]', '2'); await page.selectOption('select[data-k="R.rent_max"]', '2500'); await page.waitForTimeout(800);
  const hex = await page.evaluate(() => { const ls = G.hex.getLayers(); let grey = 0; ls.forEach(l => { if (l.options.fillColor === '#9a9a9a') grey++; }); return { n: ls.length, grey }; }); console.log('hex cells:', hex);
  // 6. stress test slider
  await page.evaluate(() => { const el = document.querySelector('input[data-k="cfg.stress_pct"]'); el.value = 20; el.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(800);
  const sc = await page.evaluate(() => SM.score(51.4166, -0.2962, STATE.F)); console.log('Kingston under -20% stress:', sc.n_prim_high, sc.n_prim_med, sc.n_sec_high, sc.n_sec_med);
  // 7. share link roundtrip
  const link = await page.evaluate(() => location.href.split('#')[0] + (function () { return document.querySelector('#btnShare') && window.STATE ? '' : ''; })());
  await page.click('#btnShare'); await page.waitForTimeout(300);
  const hash = await page.evaluate(() => location.hash); console.log('hash length:', hash.length);
  const page2 = await browser.newPage({ viewport: { width: 400, height: 800 } });
  page2.on('pageerror', e => errors.push('p2 pageerror: ' + e.message));
  await page2.goto('http://localhost:8766/index.html' + hash, { waitUntil: 'load' }); await page2.waitForTimeout(1500);
  const st2 = await page2.evaluate(() => ({ pins: STATE.pins.length, cmp: STATE.compare.length, stress: STATE.cfg.stress_pct, req: STATE.req.min_prim_high, tab: STATE.tab }));
  console.log('reopened state:', st2);
  await page2.screenshot({ path: OUT + 'shot-phone-reopen.png' });
  await browser.close(); server.close();
  console.log('errors:', errors);
})();
