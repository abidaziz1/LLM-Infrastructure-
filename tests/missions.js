// Mission checker. Needs Playwright with Chromium. Usage: node tests/missions.js [--lesson=5,6] [--scene=2,3]
// With no --lesson it checks every registered lesson.
// For each scene with a mission: (1) it must start unmet at rest, (2) a solver (custom or brute-force over sliders, segs and switches) must meet it, (3) a star must be earned.
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v = '1'] = a.replace(/^--/, '').split('='); return [k, v]; }));
let lessons = args.lesson ? args.lesson.split(',').map(Number) : null;
const only = args.scene ? args.scene.split(',').map(Number) : null;
const dispatchClick = (page, sel) => page.locator(sel).first().dispatchEvent('click');
const svgClick = (page, w, h, x, y) => page.evaluate(([w, h, x, y]) => { const svg = document.querySelector('#pStage svg.sv'); const r = svg.getBoundingClientRect(); svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * x / w, clientY: r.top + r.height * y / h })); }, [w, h, x, y]);
const setRange = (page, i, v) => page.evaluate(([i, v]) => { const el = document.querySelectorAll('#pCtrl input[type=range]')[i]; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [i, v]);
const realSvgClick = async (page, w, h, x, y) => { const svg = page.locator('#pStage svg.sv').first(); await svg.scrollIntoViewIfNeeded(); const b = await svg.boundingBox(); await page.mouse.click(b.x + b.width * x / w, b.y + b.height * y / h); };
const realClick = (page, sel) => page.locator(sel).first().click({ force: true });
async function touch(page) {                      /* one trusted gesture so the star can be earned */
  const r = page.locator('#pCtrl input[type=range]').first();
  if (await r.count()) { await r.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight'); return; }
  const b = page.locator('#pCtrl button').first(); if (await b.count()) await b.click();
}
const CUSTOM = {
  '5:5': async page => {
    await page.locator('#pCtrl button.sw').first().click();
    for (let g = 0; g < 40; g++) {
      const tags = await page.evaluate(() => Array.from(document.querySelectorAll('#pStage .clk')).map(e => { const t = e.querySelectorAll('text'); return +t[t.length - 1].textContent; }));
      const k = tags.findIndex((v, i) => v !== i + 1); if (k < 0) break; const j = tags.indexOf(k + 1);
      await realClick(page, `#pStage .clk[data-k="${k}"]`); await realClick(page, `#pStage .clk[data-k="${j}"]`);
    }
  },
  '5:8': async page => { const names = ['a red circle', 'a blue square', 'a green triangle', 'a yellow star']; for (let i = 0; i < 4; i++) { await realClick(page, `#pStage .clk[data-i="${i}"]`); await realClick(page, `#pStage .clk[aria-label="${names[i]}"]`); } },
  '5:13': async page => { await touch(page); await setRange(page, 0, 500); await setRange(page, 1, 100); },
  '5:18': async page => { const pts = [[120, 100], [100, 170], [170, 90], [150, 140], [90, 120], [180, 160], [136, 60], [60, 134], [210, 134], [136, 210]]; for (const [x, y] of pts) { await realSvgClick(page, 420, 270, x, y); await page.waitForTimeout(250); if (await isMet(page)) break; } await page.waitForTimeout(300); },
  '5:22': async page => { await realSvgClick(page, 420, 262, 144, 70); },
  '9:2': async page => { await page.locator('#pCtrl button.sw').first().click(); await page.locator('#pCtrl button', { hasText: 'Run all' }).first().click(); await page.waitForTimeout(2500); },
  '9:3': async page => { await page.locator('#pCtrl button.sw').first().click(); await page.locator('#pCtrl button', { hasText: 'Run all' }).first().click(); await page.waitForTimeout(2500); },
  '7:4': async page => { await page.locator('#pCtrl button', { hasText: 'Run all steps' }).first().click(); await page.waitForTimeout(2500); },
  '6:11': async page => { await realClick(page, '#pStage .clk[data-i="0"]'); await realClick(page, '#pStage .clk[data-i="11"]'); },
  '6:12': async page => { for (const i of [1, 2, 3, 5, 6]) await realClick(page, `#pStage .clk[data-i="${i}"]`); },
  '11:2': async page => { for (let i = 0; i < 4; i++) { await realClick(page, `.match [data-l="${i}"]`); await realClick(page, `.match [data-r="${i}"]`); } },
  '19:1': async page => { for (let i = 0; i < 4; i++) { await realClick(page, `.match [data-l="${i}"]`); await realClick(page, `.match [data-r="${i}"]`); } },
  '19:2': async page => { for (const s of [0, 1, 1, 1, 0, 0]) await realClick(page, `.match [data-s="${s}"]`); },
  '20:1': async page => { for (let i = 0; i < 4; i++) { await realClick(page, `.match [data-l="${i}"]`); await realClick(page, `.match [data-r="${i}"]`); } },
  '20:5': async page => { for (let k = 0; k < 7; k++) await realClick(page, `.match [data-e="${k}"]`); },
  '20:6': async page => { const v = ['Contradicted', 'Supported', 'Contradicted', 'Disputed', 'Supported', 'Disputed']; for (let k = 0; k < 6; k++) { await page.locator('#pCtrl button', { hasText: new RegExp('^' + v[k] + '$') }).first().click(); await page.waitForTimeout(80); await page.locator('#pCtrl button', { hasText: 'Next claim' }).first().click(); await page.waitForTimeout(80); } },
  '20:7': async page => { for (let i = 0; i < 5; i++) { await realClick(page, `.match [data-l="${i}"]`); await realClick(page, `.match [data-r="${i}"]`); } },
  '17:1': async page => { for (let i = 0; i < 4; i++) { await page.locator('#pCtrl button').filter({ hasNotText: /^$/ }).first().click(); await page.waitForTimeout(150); } },
  '15:1': async page => { for (let i = 0; i < 4; i++) await realClick(page, `#pStage .clk >> nth=${i}`); },
  '6:16': async page => { const order = [2, 0, 3, 1]; for (let i = 0; i < 4; i++) { await realClick(page, `.match [data-l="${i}"]`); await realClick(page, `.match [data-r="${i}"]`); } },
  '5:24': async page => { for (const n of ['Text encoder', 'Random noise', 'Denoise loop', 'VAE decoder', 'Finished image']) await realClick(page, `#pStage .clk[aria-label="${n}"]`); }
};
async function isMet(page) { return page.evaluate(() => { const m = document.querySelector('#pCtrl .mission'); return !!(m && m.classList.contains('met')); }); }
async function brute(page) {
  const desc = await page.evaluate(() => {
    const ctrl = document.getElementById('pCtrl'), out = [];
    ctrl.querySelectorAll('input[type=range]').forEach((r, i) => { const mn = +r.min, mx = +r.max, st = +r.step || 1, n = Math.round((mx - mn) / st) + 1; out.push({ kind: 'range', i, mn, mx, st, n, init: +r.value }); });
    ctrl.querySelectorAll('.seg').forEach((g, i) => out.push({ kind: 'seg', i, n: g.querySelectorAll('button').length, init: Array.from(g.querySelectorAll('button')).findIndex(b => b.getAttribute('aria-checked') === 'true') }));
    ctrl.querySelectorAll('button.sw').forEach((b, i) => out.push({ kind: 'sw', i, n: 2, init: b.getAttribute('aria-checked') === 'true' ? 1 : 0 }));
    return out;
  });
  const cand = d => { if (d.kind === 'range') { const k = Math.min(d.n, 41), vals = []; for (let j = 0; j < k; j++) { const idx = Math.round(j * (d.n - 1) / Math.max(1, k - 1)); vals.push(d.mn + idx * d.st); } return vals; } return Array.from({ length: d.n }, (_, j) => j); };
  const apply = async (d, v) => {
    if (d.kind === 'range') await setRange(page, d.i, v);
    else if (d.kind === 'seg') await page.evaluate(([i, k]) => document.querySelectorAll('#pCtrl .seg')[i].querySelectorAll('button')[k].click(), [d.i, v]);
    else await page.evaluate(([i, want]) => { const b = document.querySelectorAll('#pCtrl button.sw')[i]; if ((b.getAttribute('aria-checked') === 'true' ? 1 : 0) !== want) b.click(); }, [d.i, v]);
  };
  const reset = async () => { for (const d of desc) await apply(d, d.init); };
  const sets = desc.map(cand);
  const tryCombo = async idxs => {
    const prod = idxs.reduce((a, i) => a * sets[i].length, 1); if (prod > 2500) return null;
    const rec = async (k, chosen) => {
      if (k === idxs.length) { if (await isMet(page)) return chosen.slice(); return null; }
      const d = desc[idxs[k]];
      for (const v of sets[idxs[k]]) { await apply(d, v); chosen.push([d.kind + d.i, v]); const r = await rec(k + 1, chosen); if (r) return r; chosen.pop(); }
      return null;
    };
    const r = await rec(0, []); if (!r) await reset(); return r;
  };
  for (const size of [1, 2, 3]) {
    const combos = []; const pick = (start, cur) => { if (cur.length === size) { combos.push(cur.slice()); return; } for (let i = start; i < desc.length; i++) { cur.push(i); pick(i + 1, cur); cur.pop(); } }; pick(0, []);
    for (const idxs of combos) { const r = await tryCombo(idxs); if (r) return r; }
  }
  return null;
}
(async () => {
  const browser = await chromium.launch(), rows = [];
  if (!lessons) {
    const p0 = await browser.newPage(); await p0.goto(`file://${ROOT}/index.html`); await p0.waitForTimeout(300);
    lessons = await p0.evaluate(() => window.LESSONS.map(l => l.n).sort((a, b) => a - b)); await p0.close();
  }
  for (const n of lessons) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`file://${ROOT}/index.html?speed=14`); await page.waitForTimeout(300);
    const info = await page.evaluate(n => { const l = window.LESSONS.find(l => l.n === n); return l ? { id: l.id, missions: l.scenes.map((s, i) => s.mission ? i + 1 : 0).filter(Boolean), quiz: l.scenes.findIndex(s => s.quiz) + 1 } : null; }, n);
    if (!info) { console.log('lesson', n, 'missing'); continue; }
    await page.evaluate(id => { try { localStorage.removeItem('llmi:s:' + id); } catch (e) {} }, info.id);
    for (const s of info.missions) {
      if (only && !only.includes(s)) continue;
      errs.length = 0;
      await page.evaluate(([n, s]) => window.LLMI.goto(n, s - 1), [n, s]);
      const t0 = Date.now(); while (Date.now() - t0 < 9000) { const st = await page.evaluate(() => window.LLMI.state()); if (st.done) break; await page.waitForTimeout(100); }
      await page.waitForTimeout(300);
      const startMet = await isMet(page); let how = '';
      const custom = CUSTOM[n + ':' + s];
      if (custom) { await custom(page); how = 'custom'; } else { await touch(page); const r = await brute(page); how = r ? 'brute ' + r.map(x => x.join('=')).join(' ') : ''; }
      await page.waitForTimeout(400);
      const met = await isMet(page);
      const star = await page.evaluate(([id, s]) => { try { return JSON.parse(localStorage.getItem('llmi:s:' + id) || '[]').includes(s - 1); } catch (e) { return false; } }, [info.id, s]);
      const title = await page.evaluate(() => (document.querySelector('#pTitle') || {}).textContent);
      rows.push({ L: n, S: s, title: (title || '').slice(0, 34), start: startMet ? 'MET AT START' : 'unmet', solved: met ? 'yes' : 'NO', star: star ? 'yes' : 'NO', how: how.slice(0, 48), err: errs.length || '' });
    }
    await ctx.close();
  }
  console.table(rows);
  const bad = rows.filter(r => r.start !== 'unmet' || r.solved !== 'yes' || r.star !== 'yes' || r.err);
  console.log(bad.length ? 'MISSION PROBLEMS: ' + bad.length : 'ALL MISSIONS OK (' + rows.length + ')');
  process.exitCode = bad.length ? 1 : 0;
  await browser.close();
})().catch(e => { console.error('RUNNER FAIL', e); process.exit(1); });
