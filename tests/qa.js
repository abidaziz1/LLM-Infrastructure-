// Scene test runner. Needs Playwright with Chromium (npm i -D playwright, or a global install with NODE_PATH set).
// Usage: node tests/qa.js [--lesson=1,2] [--scene=3,4] [--view=desktop|mobile] [--theme=dark|light] [--speed=14] [--fuzz] [--reduce] [--shots] [--nodone]
// It opens every scene, waits for its animation to finish, optionally clicks every control (--fuzz), and reports
// console errors, page overflow, controls pushed outside the screen, SVG text clipped by its figure and SVG text boxes that overlap.
// With no --lesson it tests every registered lesson.
// Screenshots go to tests/shots (ignored by git).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v = '1'] = a.replace(/^--/, '').split('='); return [k, v]; }));
let lessons = args.lesson ? args.lesson.split(',').map(Number) : null;   // default: every registered lesson
const view = args.view || 'desktop';
const theme = args.theme || 'dark';
const speed = args.speed || 14;
const only = args.scene ? args.scene.split(',').map(Number) : null;

(async () => {
  const browser = await chromium.launch();
  const mobile = view === 'mobile';
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    reducedMotion: args.reduce ? 'reduce' : 'no-preference', colorScheme: theme
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  await page.goto(`file://${ROOT}/index.html?speed=${speed}${args.reduce ? '&reduce=1' : ''}`);
  await page.waitForTimeout(300);
  if (!lessons) lessons = await page.evaluate(() => (window.LESSONS || []).map(l => l.n).sort((a, b) => a - b));
  const rows = [];
  for (const n of lessons) {
    const count = await page.evaluate(n => { const l = (window.LESSONS || []).find(l => l.n === n); return l ? l.scenes.length : 0; }, n);
    if (!count) { console.log(`lesson ${n}: no scenes`); continue; }
    for (let i = 0; i < count; i++) {
      if (only && !only.includes(i + 1)) continue;
      errors = [];
      await page.evaluate(([n, i]) => window.LLMI.goto(n, i), [n, i]);
      const hasHint = await page.evaluate(() => !!document.querySelector('#pHint').textContent.trim());
      const t0 = Date.now(); let st = {};
      while (Date.now() - t0 < (hasHint ? 7000 : 40000)) { st = await page.evaluate(() => window.LLMI.state()); if (st.done) break; await page.waitForTimeout(100); }
      await page.waitForTimeout(args.settle ? +args.settle : 300);
      const tag = `l${n}-s${String(i + 1).padStart(2, '0')}-${view}-${theme}`;
      if (args.shots) await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: mobile });
      let fuzzed = 0;
      if (args.fuzz) {
        fuzzed = await page.evaluate(async () => {
          let k = 0;
          const els = ['#pStage', '#pCtrl'].flatMap(s => Array.from(document.querySelector(s).querySelectorAll('button:not(.term):not([disabled]), input[type=range]')));
          for (const el of els) {
            if (!el.isConnected) continue;
            if (el.tagName === 'INPUT') { const mn = +el.min, mx = +el.max; for (const f of [0, 1, 0.5, 0.25]) { el.value = mn + (mx - mn) * f; el.dispatchEvent(new Event('input', { bubbles: true })); } }
            else el.click();
            k++; await new Promise(r => setTimeout(r, 60));
          }
          return k;
        });
        await page.waitForTimeout(900);
        st = await page.evaluate(() => window.LLMI.state());
        if (args.shots === '2') await page.screenshot({ path: `${OUT}/${tag}-fuzz.png`, fullPage: mobile });
      }
      const clip = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('#pStage svg').forEach(svg => {
          const sr = svg.getBoundingClientRect();
          svg.querySelectorAll('text').forEach(tx => {
            const cs = getComputedStyle(tx); if (cs.display === 'none' || +cs.opacity === 0 || cs.visibility === 'hidden') return;
            let el = tx, hidden = false; while (el && el !== svg) { if (el.style && el.style.opacity === '0') { hidden = true; break; } el = el.parentNode; }
            if (hidden) return;
            const r = tx.getBoundingClientRect(); if (!r.width) return;
            if (r.left < sr.left - 1.5 || r.right > sr.right + 1.5) out.push((tx.textContent || '').trim().slice(0, 24) + ' [' + Math.round(r.left - sr.left) + ',' + Math.round(r.right - sr.right) + ']');
          });
        });
        return out.slice(0, 4);
      });
      const coll = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('#pStage svg').forEach(svg => {
          const items = [];
          svg.querySelectorAll('text').forEach(tx => {
            const cs = getComputedStyle(tx); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
            let el = tx, hidden = false; while (el && el !== svg) { if (el.style && (el.style.opacity === '0' || el.style.display === 'none')) { hidden = true; break; } el = el.parentNode; }
            if (hidden) return;
            const r = tx.getBoundingClientRect(); if (r.width < 2) return;
            items.push({ t: (tx.textContent || '').trim().slice(0, 18), r });
          });
          for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
            const a = items[i].r, b = items[j].r;
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 3 && h > 4) out.push(items[i].t + ' x ' + items[j].t);
          }
        });
        return out.slice(0, 4);
      });
      const info = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        title: (document.querySelector('#pTitle') || {}).textContent,
        wide: Array.from(document.querySelectorAll('#pStage *, #pCtrl *')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2); }).slice(0, 3).map(e => e.tagName + '.' + (e.getAttribute('class') || '').toString().slice(0, 30))
      }));
      rows.push({ n, i: i + 1, clip: clip.join(' | '), coll: coll.join(' | '), title: info.title, done: !!st.done, err: errors.length, ovf: info.sw > info.iw + 1 ? `${info.sw}>${info.iw}` : '', wide: info.wide.join(' '), fuzz: fuzzed });
      if (errors.length) console.log(`  L${n} S${i + 1} ERRORS:`, errors.slice(0, 4));
    }
  }
  console.table(rows.map(r => ({ L: r.n, S: r.i, title: (r.title || '').slice(0, 38), done: r.done ? 'y' : 'NO', err: r.err || '', ovf: r.ovf, wide: r.wide, clip: r.clip || '', fuzz: r.fuzz || '' })));
  const bad = rows.filter(r => (!r.done && !args.nodone) || r.err || r.ovf || r.coll);
  const clipped = rows.filter(r => r.clip);
  const colls = rows.filter(r => r.coll);
  if (colls.length) { console.log('TEXT COLLISIONS:'); colls.forEach(r => console.log(`  L${r.n} S${r.i}: ${r.coll}`)); }
  if (clipped.length) { console.log('SVG TEXT CLIPPED:'); clipped.forEach(r => console.log(`  L${r.n} S${r.i}: ${r.clip}`)); }
  console.log(bad.length ? `PROBLEMS: ${bad.length}` : 'ALL CLEAN', `(${rows.length} scenes, ${view}, ${theme})`);
  process.exitCode = bad.length || clipped.length ? 1 : 0;
  await browser.close();
})().catch(e => { console.error('RUNNER FAIL', e); process.exit(1); });
