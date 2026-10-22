/* Lesson 10: Quantization. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const lg = (v, lo, hi) => kit.clamp((Math.log10(v) - lo) / (hi - lo), 0.01, 1);
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'why', tag: 'Why',
    title: 'Fewer bytes per weight means faster decoding',
    alt: 'Two bars. The first shows the weight size of the chosen model and format against 80 gigabytes. The second shows the decode speed ceiling for one user on an H100, with a marker at 90 tokens per second. Controls choose the model size and the number format.',
    text: 'Decoding one token reads **every weight once**, so speed is **bandwidth ÷ weight bytes**. An H100 reads 3.35 TB/s. A 70B model takes **140 GB in BF16**, **70 GB in FP8** and **35 GB in 4 bits**. That is **24, 48 and 96 tokens per second** for one user. [[quantization|Quantization]] stores the same weights in fewer bits.',
    hint: 'Try each format on the 70B model.',
    mission: 'Reach 90 tokens per second on one H100 with a 70B model.',
    takeaway: 'At small batch, speed follows bytes. Halving the bits roughly doubles decode speed.',
    mount(c) {
      const f = c.fig(420, 150, '<g id="g"></g>');
      const st = c.stats([{ k: 'w', label: 'Weights', value: '', cls: 'mem' }, { k: 'd', label: 'Decode ceiling, one user', value: '', cls: 'data' }]);
      let P = 70, bytes = 2;
      function draw() {
        const w = P * bytes, fits = w <= 80, dec = fits ? 3350 / w : 0, x90 = 16 + 90 / 300 * 388;
        f.q('#g').innerHTML = kit.bar(16, 34, 388, 16, Math.min(1, w / 160), fits ? 'f-mem' : 'f-bad', 'Weights against one 80 GB GPU (scale 0 to 160 GB)', w + ' GB' + (fits ? '' : ' too big')) + `<line class="ln" x1="${(16 + 80 / 160 * 388).toFixed(1)}" x2="${(16 + 80 / 160 * 388).toFixed(1)}" y1="36" y2="58" style="stroke:var(--ink);stroke-width:2"/>` +
          kit.bar(16, 96, 388, 16, Math.min(1, dec / 300), dec >= 90 ? 'f-ok' : 'f-data', 'Decode tokens per second (scale 0 to 300)', fits ? Math.round(dec) : 'does not fit') + `<line class="ln" x1="${x90.toFixed(1)}" x2="${x90.toFixed(1)}" y1="98" y2="122" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x90.toFixed(1)}" y="136" text-anchor="middle">90</text>`;
        st.set('w', w + ' GB', P + 'B × ' + bytes + ' bytes'); st.set('d', fits ? Math.round(dec) + ' tok/s' : 'no fit', '3.35 TB/s ÷ weight bytes');
        c.mission.set(P === 70 && dec >= 90);
      }
      c.seg({ label: 'Model', options: [['8', '8B'], ['70', '70B']], value: '70', onChange: v => { P = +v; draw(); } });
      const sF = c.seg({ label: 'Weight format', options: [['2', 'BF16, 16 bits'], ['1', 'FP8, 8 bits'], ['0.5', 'INT4, 4 bits'], ['0.375', 'INT3, 3 bits']], value: '2', onChange: v => { bytes = +v; draw(); } });
      draw();
      c.demo(1500, async () => { bytes = 0.5; sF.set('0.5'); draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'uniform', tag: 'The basics',
    title: 'Quantizing is rounding to a grid',
    alt: 'A histogram of 4,096 weights with vertical ticks showing the levels of a quantization grid. Controls set the number of bits and the group size that shares one scale. Counters show the relative error, the number of levels and the real bits per weight including the scales.',
    text: 'Pick a [[quantization scale|scale]] from the largest weight, then **round every weight to the nearest multiple of it**. With b bits there are **2^b − 1** levels. Fewer bits mean a coarser grid and more error. Giving each small [[group size|group]] its own scale follows the data better, at a cost of one 16-bit scale per group.',
    hint: 'Change the bits and the group size.',
    mission: 'Get under 11% error with 4-bit weights.',
    takeaway: 'Each extra bit halves the error. Smaller groups cut it too, for a few extra bits per group.',
    mount(c) {
      const r = kit.rng(5), W = Array.from({ length: 4096 }, () => kit.gauss(r)), f = c.fig(420, 190, '<g id="g"></g>');
      const st = c.stats([{ k: 'e', label: 'Relative error', value: '', cls: 'bad' }, { k: 'l', label: 'Levels', value: '', cls: 'mem' }, { k: 'b', label: 'Real bits per weight', value: '', cls: 'cmp' }]);
      let bits = 4, grp = 4096;
      const cache = {};
      function err(b, g) {
        const key = b + ':' + g; if (cache[key] != null) return cache[key];
        const L = Math.pow(2, b - 1) - 1; let se = 0, sw = 0;
        for (let s = 0; s < W.length; s += g) { let am = 0; for (let i = s; i < s + g; i++) am = Math.max(am, Math.abs(W[i])); const sc = am / L; for (let i = s; i < s + g; i++) { const q = Math.round(W[i] / sc) * sc; se += (q - W[i]) ** 2; sw += W[i] * W[i]; } }
        return (cache[key] = Math.sqrt(se / sw));
      }
      function draw() {
        const L = Math.pow(2, bits - 1) - 1, e = err(bits, grp), HX0 = 16, HW = 388, bins = 48; const cnt = new Array(bins).fill(0); W.forEach(v => { const k = Math.floor((v + 4) / 8 * bins); if (k >= 0 && k < bins) cnt[k]++; });
        let am = 0; for (let i = 0; i < grp; i++) am = Math.max(am, Math.abs(W[i])); const step = am / L; let g = `<text class="b sm" x="16" y="20">4,096 weights, and the grid they are rounded to</text>`;
        cnt.forEach((v, k) => { const h = v / 330 * 90; g += `<rect x="${(HX0 + k * HW / bins + 1).toFixed(1)}" y="${(122 - h).toFixed(1)}" width="${(HW / bins - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="f-mem" style="opacity:.55"/>`; });
        if (L <= 31) for (let k = -L; k <= L; k++) { const x = HX0 + (k * step + 4) / 8 * HW; if (x >= HX0 && x <= HX0 + HW) g += `<line class="ln" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="36" y2="128" style="stroke:var(--cmp);stroke-width:1.6;opacity:.9"/>`; }
        g += `<line class="axis" x1="${HX0}" x2="${HX0 + HW}" y1="128" y2="128"/><text class="xs mute" x="${HX0}" y="144" >-4</text><text class="xs mute" x="${HX0 + HW / 2}" y="144" text-anchor="middle">0</text><text class="xs mute" x="${HX0 + HW}" y="144" text-anchor="end">4</text><text class="xs mute" x="16" y="166">${L > 31 ? 'Too many levels to draw: ' + (2 * L + 1) + '.' : 'Orange lines: the grid for ' + (grp === 4096 ? 'the whole tensor' : 'the first group of ' + grp) + '.'}</text>`;
        f.q('#g').innerHTML = g;
        st.set('e', pct(e), 'RMS error ÷ RMS weight'); st.set('l', 2 * L + 1, '2^' + bits + ' − 1'); st.set('b', (bits + (grp === 4096 ? 0 : 16 / grp)).toFixed(grp === 4096 ? 0 : 2), grp === 4096 ? 'one scale for everything' : '+ 16-bit scale per ' + grp);
        c.mission.set(bits === 4 && e < 0.11);
      }
      c.slider({ label: 'Bits per weight', values: [2, 3, 4, 5, 6, 8], value: 4, fmt: v => v, onInput: v => { bits = v; draw(); } });
      const sG = c.seg({ label: 'Weights sharing one scale', options: [['4096', 'Whole tensor'], ['128', '128'], ['32', '32']], value: '4096', onChange: v => { grp = +v; draw(); } });
      draw();
      c.demo(1500, async () => { grp = 32; sG.set('32'); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'outliers', tag: 'The basics',
    title: 'One giant value ruins the scale',
    alt: 'A bar for each of 64 activation channels, where one channel is much larger than the rest. A slider sets how large the outlier is, and a selector picks how the scale is chosen: one for the whole tensor, one per channel, or the outlier channel kept in FP16. A counter shows the error on the normal values.',
    text: 'LLM activations have a few [[outlier channel|outlier channels]] that are **tens to hundreds of times larger** than the rest. With **one scale for the whole tensor**, the outlier sets the scale and the normal values fall into a handful of levels. Scaling **per channel**, or **keeping the outlier channel in FP16** as LLM.int8() does, fixes it.',
    hint: 'Grow the outlier, then change the scaling.',
    mission: 'Keep the error on normal values under 5% with a 100 times outlier.',
    takeaway: 'Quantization error is set by the largest value in the group. Outliers must be handled, not averaged away.',
    mount(c) {
      const T = 32, C = 64, OC = 7, r = kit.rng(3), base = Array.from({ length: T }, () => Array.from({ length: C }, () => kit.gauss(r))), jit = Array.from({ length: T }, () => 0.9 + 0.2 * r());
      const f = c.fig(420, 188, '<g id="g"></g>');
      const st = c.stats([{ k: 'e', label: 'Error on normal values', value: '', cls: 'bad' }]);
      let M = 100, method = 'tensor';
      function draw() {
        const X = base.map((row, t) => row.map((v, j) => j === OC ? M * jit[t] : v)); let se = 0, sw = 0; const L = 127;
        const chMax = Array.from({ length: C }, (_, j) => Math.max(...X.map(row => Math.abs(row[j]))));
        let scT = Math.max(...chMax) / L; if (method === 'mixed') scT = Math.max(...chMax.filter((v, j) => j !== OC)) / L;
        for (let t = 0; t < T; t++) for (let j = 0; j < C; j++) { if (j === OC) continue; const sc = method === 'channel' ? chMax[j] / L : scT, v = X[t][j], q = Math.round(v / sc) * sc; se += (q - v) ** 2; sw += v * v; }
        const e = Math.sqrt(se / sw), top = Math.max(...chMax);
        let g = `<text class="b sm" x="16" y="20">Largest value in each of 64 channels (INT8, 127 levels)</text>`;
        chMax.forEach((v, j) => { const h = Math.max(2, v / top * 100); g += `<rect x="${(16 + j * 6).toFixed(1)}" y="${(130 - h).toFixed(1)}" width="4.4" height="${h.toFixed(1)}" rx="1.5" class="${j === OC ? 'f-bad' : 'f-mem'}"/>`; });
        g += `<line class="axis" x1="16" x2="404" y1="130" y2="130"/><text class="xs mute" x="16" y="148">Red: the outlier channel, ${M} × larger than typical.</text><text class="xs mute" x="16" y="166">${method === 'tensor' ? 'One scale: the outlier sets the step for every channel.' : method === 'channel' ? 'Each channel has its own scale. Fast hardware prefers fewer scales.' : 'Outlier channel stays in FP16. The rest share a scale set by normal values.'}</text>`;
        f.q('#g').innerHTML = g;
        st.set('e', pct(e), method === 'tensor' ? 'step = ' + (top / L).toFixed(2) + ' in units of the typical value' : 'step ≈ ' + (Math.max(...chMax.filter((v, j) => j !== OC)) / L).toFixed(2));
        c.mission.set(M === 100 && e < 0.05);
      }
      c.slider({ label: 'Outlier size, times typical', values: [1, 10, 30, 100, 200], value: 100, fmt: v => v + '×', onInput: v => { M = v; draw(); } });
      const sS = c.seg({ label: 'Scale', options: [['tensor', 'One per tensor'], ['channel', 'One per channel'], ['mixed', 'Outlier in FP16']], value: 'tensor', onChange: v => { method = v; draw(); } });
      draw();
      c.demo(1500, async () => { method = 'mixed'; sS.set('mixed'); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'smooth', tag: 'Activations',
    title: 'SmoothQuant moves the outlier into the weights',
    alt: 'Eight input channels, each with a bar for the largest activation and a bar for the largest weight, on a log scale. A slider sets the migration strength alpha. At zero, channel 5 keeps a huge activation range while every weight range is 1. At one half the two ranges match. Counters show the largest activation range, the largest weight range and their ratio.',
    text: '[[smoothquant|SmoothQuant]] divides each input channel of the activations by a factor **s** and multiplies the same channel of the weights by **s**. The matrix product is **unchanged**, but the outlier shrinks on the activation side and grows on the weight side, where it is easier to handle. With **s = max|X|^α ÷ max|W|^(1 − α)**, α = 0.5 balances the two.',
    hint: 'Slide alpha and watch the two ranges meet.',
    mission: 'Balance the largest activation and weight ranges within 25%.',
    takeaway: 'Weights can absorb a range increase that activations cannot. The product stays exactly the same.',
    mount(c) {
      const XM = [1, 1, 2, 1, 60, 1, 2, 1], WM = [1, 1, 1, 1, 0.5, 1, 1, 1], f = c.fig(420, 214, '<g id="g"></g>');
      c.legend([['mem', 'Activation range'], ['cmp', 'Weight range']]);
      const st = c.stats([{ k: 'x', label: 'Largest activation range', value: '', cls: 'mem' }, { k: 'w', label: 'Largest weight range', value: '', cls: 'cmp' }, { k: 'r', label: 'Ratio', value: '', cls: 'data' }]);
      let a = 0;
      function draw() {
        const s = XM.map((x, j) => Math.pow(x, a) / Math.pow(WM[j], 1 - a)), xs = XM.map((x, j) => x / s[j]), ws = WM.map((w, j) => w * s[j]), mx = Math.max(...xs), mw = Math.max(...ws), ratio = mx / mw;
        let g = `<text class="b sm" x="16" y="20">Largest value per input channel, after smoothing (log scale)</text>`; const L = v => 150 - kit.clamp((Math.log10(v) + 1) / 3, 0, 1) * 110;
        xs.forEach((v, j) => { const x = 20 + j * 48; g += `<rect x="${x}" y="${L(v).toFixed(1)}" width="18" height="${(150 - L(v)).toFixed(1)}" rx="2" class="f-mem"/><rect x="${x + 20}" y="${L(ws[j]).toFixed(1)}" width="18" height="${(150 - L(ws[j])).toFixed(1)}" rx="2" class="f-cmp"/><text class="xs m mute" x="${x + 19}" y="168" text-anchor="middle">ch ${j + 1}</text>`; });
        [0.1, 1, 10, 100].forEach(v => { g += `<line class="grid" x1="16" x2="404" y1="${L(v).toFixed(1)}" y2="${L(v).toFixed(1)}"/><text class="xs m mute" x="410" y="${(L(v) + 4).toFixed(1)}" text-anchor="end" style="display:none">${v}</text>`; });
        f.q('#g').innerHTML = g + `<line class="axis" x1="16" x2="404" y1="150" y2="150"/><text class="xs mute" x="16" y="190">Grid lines at 0.1, 1, 10 and 100. Channel 5 starts as the outlier.</text>`;
        st.set('x', mx.toFixed(1), 'max |X| ÷ s'); st.set('w', mw.toFixed(1), 'max |W| × s'); st.set('r', ratio.toFixed(ratio < 10 ? 2 : 0) + '×', ratio > 1.25 ? 'activations still harder' : ratio < 0.8 ? 'weights now harder' : 'balanced');
        c.mission.set(ratio >= 0.8 && ratio <= 1.25);
      }
      const sA = c.slider({ label: 'Migration strength α', min: 0, max: 1, step: 0.05, value: 0, fmt: v => v.toFixed(2), onInput: v => { a = v; draw(); } });
      c.note('Toy: 8 channels. Real layers have thousands, and α is tuned per model, often near 0.5.');
      draw();
      c.demo(1500, async () => { a = 0.5; sA.set(0.5, true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'gptq', tag: 'Weights',
    title: 'GPTQ rounds one weight at a time and repairs the rest',
    alt: 'Two bars compare the layer output error from plain rounding with the error from GPTQ-style rounding, for a chosen correlation between the inputs. A slider sets the correlation. With independent inputs both bars match. With strongly correlated inputs the compensated error is several times smaller.',
    text: 'Rounding each weight on its own ignores how inputs relate. [[gptq|GPTQ]] rounds weights **one at a time** and, after each, **adjusts the weights not yet rounded** so the layer’s output barely changes. It uses the **inverse Hessian** of the layer’s inputs. When inputs are correlated, the later weights can cancel the earlier rounding error.',
    hint: 'Raise the correlation between inputs.',
    mission: 'Make compensation cut the output error at least 3 times.',
    takeaway: 'Rounding errors in correlated weights can cancel. GPTQ finds the adjustment that makes them cancel.',
    mount(c) {
      const n = 16, step = 0.5, RHO = [0, 0.5, 0.8, 0.9, 0.95];
      function inv(M) { const m = M.length, A = M.map((row, i) => row.concat(Array.from({ length: m }, (_, j) => i === j ? 1 : 0))); for (let i = 0; i < m; i++) { let p = i; for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; const d = A[i][i]; for (let j = 0; j < 2 * m; j++) A[i][j] /= d; for (let k = 0; k < m; k++) if (k !== i) { const fct = A[k][i]; for (let j = 0; j < 2 * m; j++) A[k][j] -= fct * A[i][j]; } } return A.map(row => row.slice(m)); }
      const RES = {};
      RHO.forEach(rho => {
        const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.pow(rho, Math.abs(i - j)))), H0 = inv(H), r = kit.rng(11); let en = 0, eg = 0; const T = 200;
        for (let t = 0; t < T; t++) {
          const w = Array.from({ length: n }, () => kit.gauss(r)), d = w.map(v => Math.round(v / step) * step - v); let e1 = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) e1 += d[i] * H[i][j] * d[j]; en += e1;
          const Hi = H0.map(rw => rw.slice()), ww = w.slice(), q = new Array(n);
          for (let i = 0; i < n; i++) { q[i] = Math.round(ww[i] / step) * step; const er = (ww[i] - q[i]) / Hi[i][i]; for (let j = i + 1; j < n; j++) ww[j] -= er * Hi[i][j]; const col = Hi.map(rw => rw[i]), row = Hi[i].slice(), dd = Hi[i][i]; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) Hi[a][b] -= col[a] * row[b] / dd; }
          const dq = q.map((v, i) => v - w[i]); let e2 = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) e2 += dq[i] * H[i][j] * dq[j]; eg += e2;
        }
        RES[rho] = [en / T, eg / T];
      });
      const f = c.fig(420, 166, '<g id="g"></g>');
      const st = c.stats([{ k: 'r', label: 'Error cut by compensation', value: '', cls: 'ok' }]);
      let rho = 0;
      function draw() {
        const [en, eg] = RES[rho], mx = 0.4;
        f.q('#g').innerHTML = kit.bar(16, 34, 388, 16, en / mx, 'f-bad', 'Plain rounding: layer output error', en.toFixed(3)) + kit.bar(16, 84, 388, 16, eg / mx, 'f-ok', 'GPTQ: round, then repair the rest', eg.toFixed(3)) + `<text class="xs mute" x="16" y="120">Toy layer: 16 weights, rounding step 0.5.</text><text class="xs mute" x="16" y="136">Inputs correlate as ρ^distance between channels.</text><text class="xs mute" x="16" y="152">Error: squared output change, mean of 200 layers.</text>`;
        st.set('r', (en / eg).toFixed(2) + '×', 'at correlation ' + rho);
        c.mission.set(en / eg >= 3);
      }
      const sR = c.slider({ label: 'Correlation between neighboring inputs ρ', values: RHO, value: 0, fmt: v => v.toFixed(2), onInput: v => { rho = v; draw(); } });
      draw();
      c.demo(1500, async () => { rho = 0.9; sR.set(0.9, true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'awq', tag: 'Weights',
    title: 'AWQ protects the channels the activations care about',
    alt: 'A row of 128 bars, one per input channel, showing the typical activation size on a log scale. Protected channels are orange and the rest are blue. Below, two bars compare the output error of plain 4-bit rounding with the error after protecting the chosen channels. Controls pick how channels are chosen, how many are protected and how they are protected.',
    text: 'A weight matters in proportion to the **activation** that multiplies it. A few input channels carry activations **about 100 times** the median, so rounding errors on their weights get amplified. [[awq|AWQ]] finds these salient channels from **activation size, not weight size**. Keeping them in FP16 works best. **Scaling them up before rounding** keeps a single format but gains less, because the group’s range grows.',
    hint: 'Choose channels by activations, then raise the share.',
    mission: 'Cut the output error 3 times or more while protecting at most 5% of channels.',
    takeaway: 'A few percent of channels, chosen by activation size, account for most of the error. Weight size is the wrong guide.',
    mount(c) {
      const C = 128, R = 64, L = 7, ra = kit.rng(10), rw = kit.rng(17), rr = kit.rng(77);
      const a = Array.from({ length: C }, () => Math.exp(2 * kit.gauss(ra)));
      const W = Array.from({ length: R }, () => Array.from({ length: C }, () => kit.gauss(rw)));
      const cn = Array.from({ length: C }, (_, j) => Math.sqrt(W.reduce((s, row) => s + row[j] * row[j], 0) / R));
      const rd = Array.from({ length: C }, () => rr()), ix = [...Array(C).keys()];
      const order = { act: ix.slice().sort((x, y) => a[y] - a[x]), w: ix.slice().sort((x, y) => cn[y] - cn[x]), rand: ix.slice().sort((x, y) => rd[y] - rd[x]) };
      function err(P, how) {
        const inP = new Array(C).fill(false); P.forEach(j => { inP[j] = true; }); let se = 0, sw = 0;
        for (const row of W) {
          let m = 0;
          for (let j = 0; j < C; j++) { if (inP[j] && how === 'fp16') continue; const v = Math.abs(row[j]) * (inP[j] && how === 'scale' ? 2 : 1); if (v > m) m = v; }
          const d = m / L;
          for (let j = 0; j < C; j++) {
            let q;
            if (inP[j] && how === 'fp16') q = row[j]; else { const sc = inP[j] && how === 'scale' ? 2 : 1; q = Math.round(row[j] * sc / d) * d / sc; }
            se += (a[j] * (q - row[j])) ** 2; sw += (a[j] * row[j]) ** 2;
          }
        }
        return Math.sqrt(se / sw);
      }
      const e0 = err([], 'fp16'), lo = Math.log10(Math.min(...a)), hi = Math.log10(Math.max(...a));
      const f = c.fig(420, 214, '<g id="g"></g>');
      c.legend([['cmp', 'Protected channel'], ['mem', 'Other channel']]);
      const st = c.stats([{ k: 'r', label: 'Error cut', value: '', cls: 'ok' }, { k: 'p', label: 'Channels protected', value: '', cls: 'cmp' }, { k: 'f', label: 'Formats in the matrix', value: '', cls: 'mem' }]);
      let crit = 'rand', p = 0, how = 'fp16';
      function draw() {
        const n = Math.round(p / 100 * C), P = order[crit].slice(0, n), inP = new Set(P), e1 = n ? err(P, how) : e0, ratio = e0 / e1;
        let g = '<text class="b sm" x="16" y="20">Typical activation size of each input channel (log)</text>';
        a.forEach((v, j) => { const h = 6 + (Math.log10(v) - lo) / (hi - lo) * 62; g += `<rect x="${(16 + j * 3.03).toFixed(1)}" y="${(96 - h).toFixed(1)}" width="2.2" height="${h.toFixed(1)}" rx="1" class="${inP.has(j) ? 'f-cmp' : 'f-mem'}"/>`; });
        g += '<line class="axis" x1="16" x2="404" y1="96" y2="96"/><text class="xs mute" x="16" y="113">128 channels in layer order, 4-bit rounding.</text>';
        g += kit.bar(16, 146, 388, 14, 1, 'f-bad', 'Output error with plain rounding', pct(e0)) + kit.bar(16, 190, 388, 14, e1 / e0, ratio >= 3 ? 'f-ok' : 'f-data', 'Output error with protection', pct(e1));
        f.q('#g').innerHTML = g;
        st.set('r', ratio.toFixed(ratio < 10 ? 2 : 1) + '×', 'before ÷ after'); st.set('p', n + ' of ' + C, p + '% of channels');
        st.set('f', n && how === 'fp16' ? '2' : '1', n && how === 'fp16' ? 'FP16 and 4-bit mixed' : 'all 4-bit');
        c.mission.set(crit === 'act' && how === 'fp16' && p <= 5 && ratio >= 3);
      }
      const sC = c.seg({ label: 'Choose channels by', options: [['rand', 'Random'], ['w', 'Largest weights'], ['act', 'Largest activations']], value: 'rand', onChange: v => { crit = v; draw(); } });
      const sP = c.slider({ label: 'Share of channels protected', values: [0, 1, 2, 5, 10, 20], value: 0, fmt: v => v + '%', onInput: v => { p = v; draw(); } });
      c.seg({ label: 'How to protect them', options: [['fp16', 'Keep in FP16'], ['scale', 'Scale up ×2']], value: 'fp16', onChange: v => { how = v; draw(); } });
      c.note('Toy layer: 64 outputs by 128 inputs, one scale per row. Activation sizes are log-normal, so the top 1% are about 100 times the median.');
      draw();
      c.demo(1500, async () => { crit = 'act'; p = 5; sC.set('act'); sP.set(5, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'rotate', tag: 'Activations',
    title: 'A rotation spreads one outlier across many values',
    alt: 'Two rows of 64 bars. The top row is one activation vector with a single outlier near 100. The bottom row is the same vector after a Hadamard rotation of the chosen block size, where the outlier is spread over the coordinates of its block. Controls set the block size and the number of bits. Counters show the error on the normal values before and after.',
    text: 'A **rotation** by an orthogonal matrix keeps a vector’s length and can be undone exactly. A [[hadamard|Hadamard]] rotation mixes every coordinate with every other, so **one giant value becomes many moderate ones**. Rotate the activations, rotate the weights the opposite way, and the product stays the same. **QuaRot** and **SpinQuant** use this to make 4-bit activations workable.',
    hint: 'Raise the block size, then try INT4.',
    mission: 'Cut the INT8 error on the normal values at least 5 times.',
    takeaway: 'A rotation removes no information. It turns a shape that is hard to quantize into one that is easy.',
    mount(c) {
      const N = 64, OC = 7, T = 48, r = kit.rng(3), cache = {};
      const X = Array.from({ length: T }, () => { const x = Array.from({ length: N }, () => kit.gauss(r)); x[OC] = 100 * (0.9 + 0.2 * r()); return x; });
      const had = v => { v = v.slice(); let h = 1; while (h < v.length) { for (let i = 0; i < v.length; i += 2 * h) for (let j = i; j < i + h; j++) { const p = v[j], q = v[j + h]; v[j] = p + q; v[j + h] = p - q; } h *= 2; } return v.map(t => t / Math.sqrt(v.length)); };
      const rot = (x, n) => { if (n === 1) return x.slice(); let y = []; for (let s = 0; s < N; s += n) y = y.concat(had(x.slice(s, s + n))); return y; };
      function run(n, bits) {
        const key = n + ':' + bits; if (cache[key] != null) return cache[key];
        const L = Math.pow(2, bits - 1) - 1; let se = 0, sw = 0;
        for (const x of X) { const y = rot(x, n), am = Math.max(...y.map(Math.abs)), sc = am / L, z = rot(y.map(v => Math.round(v / sc) * sc), n); for (let j = 0; j < N; j++) { if (j === OC) continue; se += (z[j] - x[j]) ** 2; sw += x[j] * x[j]; } }
        return (cache[key] = Math.sqrt(se / sw));
      }
      const f = c.fig(420, 204, '<g id="g"></g>');
      const st = c.stats([{ k: 'a', label: 'Error, no rotation', value: '', cls: 'bad' }, { k: 'b', label: 'Error, rotated', value: '', cls: 'ok' }, { k: 'r', label: 'Error cut', value: '', cls: 'data' }]);
      let n = 1, bits = 8;
      function draw() {
        const x = X[0], y = rot(x, n), mx = Math.max(...y.map(Math.abs)), L = Math.pow(2, bits - 1) - 1, e0 = run(1, bits), e1 = run(n, bits), ratio = e0 / e1;
        const row = (arr, y0, cls, hot) => arr.map((v, j) => { const h = Math.max(1.5, Math.abs(v) / 100 * 52); return `<rect x="${(16 + j * 6.06).toFixed(1)}" y="${(y0 - h).toFixed(1)}" width="4.4" height="${h.toFixed(1)}" rx="1" class="${hot === j ? 'f-bad' : cls}"/>`; }).join('');
        f.q('#g').innerHTML = '<text class="b sm" x="16" y="18">Before: 64 values, one outlier near 100</text>' + row(x, 76, 'f-mem', OC) + '<line class="axis" x1="16" x2="404" y1="76" y2="76"/>' +
          `<text class="b sm" x="16" y="106">After: ${n === 1 ? 'no rotation' : 'rotated in blocks of ' + n}</text>` + row(y, 164, 'f-cmp', n === 1 ? OC : -1) + '<line class="axis" x1="16" x2="404" y1="164" y2="164"/>' +
          `<text class="xs mute" x="16" y="186">Largest value ${mx.toFixed(0)}. ${bits === 8 ? 'INT8' : 'INT4'} step ${(mx / L).toFixed(2)}, against a typical value of 1.</text>`;
        st.set('a', pct(e0), 'normal values'); st.set('b', pct(e1), n === 1 ? 'same as before' : 'block of ' + n); st.set('r', ratio.toFixed(1) + '×', bits === 4 && n === 64 ? '4 bits stay hard at 100×' : 'error before ÷ after');
        c.mission.set(bits === 8 && n === 64 && ratio >= 5);
      }
      const sB = c.seg({ label: 'Rotation block size', options: [['1', 'None'], ['8', '8'], ['16', '16'], ['64', '64']], value: '1', onChange: v => { n = +v; draw(); } });
      c.seg({ label: 'Bits', options: [['8', 'INT8'], ['4', 'INT4']], value: '8', onChange: v => { bits = +v; draw(); } });
      c.note('Toy: 48 tokens of 64 values, one channel about 100 times the typical value, one scale for the whole vector. Error is measured on the 63 normal channels after rotating back.');
      draw();
      c.demo(1500, async () => { n = 64; sB.set('64'); draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'kv', tag: 'Memory',
    title: 'Quantizing the KV cache lets more users fit',
    alt: 'A bar for the 640 GB of an 8-GPU node, split into weights, the KV cache of all users, free space and a reserve. Controls set the KV cache format, the context length and the number of users. Counters show the KV size per token and per user, the total and the time floor of one decode step.',
    text: 'The [[kv cache|KV cache]] grows with every token and every user. A Llama-3-70B-style model stores **about 164,000 values per token**: 2 × 80 layers × 8 KV heads × 128 dims. That is **328 KB in BF16**, or **43 GB for one 128K-token user**. [[fp8|FP8]] halves it. **4-bit with a scale per 32 values** takes it to about a quarter. A smaller cache also means **less to read on every step**.',
    hint: 'Add users, then switch the KV format.',
    mission: 'Fit 32 users at 128K tokens each.',
    takeaway: 'At long context the KV cache outweighs the weights. Shrinking it adds users and speeds up every step.',
    mount(c) {
      const GPUS = 8, HBM = 80, WGB = 70, VALS = 2 * 80 * 8 * 128, BWGB = 3350 * GPUS, FREE = GPUS * HBM * 0.9 - WGB, K = 388 / (GPUS * HBM);
      const f = c.fig(420, 116, '<g id="g"></g>');
      c.legend([['mem', 'Weights, FP8'], ['data', 'KV cache'], ['bad', 'Does not fit']]);
      const st = c.stats([{ k: 't', label: 'KV per token', value: '', cls: 'mem' }, { k: 'u', label: 'KV per user', value: '', cls: 'data' }, { k: 'a', label: 'KV, all users', value: '', cls: 'cmp' }, { k: 'd', label: 'Decode step floor', value: '', cls: 'ctl' }]);
      let bytes = 2, ctx = 32768, users = 8;
      const names = { 2: 'BF16', 1: 'FP8', 0.5625: '4-bit + scales' };
      function draw() {
        const perTok = VALS * bytes, perUser = perTok * ctx / 1e9, total = perUser * users, fits = total <= FREE, kw = Math.max(2, Math.min(total, GPUS * HBM - WGB) * K), fit = Math.floor(FREE / perUser);
        f.q('#g').innerHTML = '<rect class="well" x="16" y="30" width="388" height="26" rx="6"/>' +
          `<rect class="f-mem" x="16" y="30" width="${(WGB * K).toFixed(1)}" height="26" rx="6"/>` +
          `<rect class="${fits ? 'f-data' : 'f-bad'}" x="${(16 + WGB * K + 1.5).toFixed(1)}" y="30" width="${kw.toFixed(1)}" height="26" rx="6" style="clip-path:inset(0 0 0 0)"/>` +
          `<rect class="box" x="${(404 - 0.1 * GPUS * HBM * K).toFixed(1)}" y="30" width="${(0.1 * GPUS * HBM * K).toFixed(1)}" height="26" rx="6" style="opacity:.85"/>` +
          '<text class="xs b" x="16" y="20">One 8-GPU node, 640 GB (reserve at the right end)</text>' +
          `<text class="xs" x="16" y="80">Weights 70 GB + KV cache ${fmt.n(total, 0)} GB = ${fmt.n(WGB + total, 0)} GB of ${fmt.n(FREE + WGB, 0)} GB usable.</text>` +
          `<text class="xs b" x="16" y="98">${fits ? 'Free: ' + fmt.n(FREE - total, 0) + ' GB. At this context, ' + fit + ' users would fit.' : 'Over by ' + fmt.n(total - FREE, 0) + ' GB. At this context, only ' + fit + ' users fit.'}</text>`;
        st.set('t', fmt.bytes(perTok, 0), names[bytes]); st.set('u', fmt.bytes(perUser * 1e9, 1), 'at ' + (ctx / 1024) + 'K tokens'); st.set('a', fmt.n(total, 0) + ' GB', users + ' users');
        st.set('d', ((WGB + total) / (BWGB / 1000)).toFixed(1) + ' ms', 'weights + KV ÷ 26.8 TB/s');
        c.mission.set(users === 32 && ctx === 131072 && fits);
      }
      const sF = c.seg({ label: 'KV cache format', options: [['2', 'BF16'], ['1', 'FP8'], ['0.5625', '4-bit'] ], value: '2', onChange: v => { bytes = +v; draw(); } });
      c.slider({ label: 'Context per user', values: [4096, 8192, 32768, 131072], value: 32768, fmt: v => (v / 1024) + 'K tokens', onInput: v => { ctx = v; draw(); } });
      const sU = c.slider({ label: 'Users', values: [1, 4, 8, 16, 32, 64], value: 8, fmt: v => v, onInput: v => { users = v; draw(); } });
      c.note('FP8 caches are common with little quality loss. 4-bit needs care: KIVI and KVQuant scale keys per channel, because a few key channels are outliers. Toy node: 8 GPUs, 10% reserved, FP8 weights.');
      draw();
      c.demo(1500, async () => { bytes = 0.5625; sF.set('0.5625'); users = 32; sU.set(32, true); draw(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'mx', tag: 'Formats',
    title: 'Block scales let 4-bit numbers cover a wide range',
    alt: 'Bars for 32 consecutive values, with an orange marker on each bar for its 4-bit value and a dashed line per block for the largest level that block can reach. Controls set the block size and the scale format. A number line shows the eight FP4 magnitudes. Counters show the error over 65,536 values, the real bits per value and which named format the setting matches.',
    text: '[[fp4|FP4]] has only eight magnitudes: 0, 0.5, 1, 1.5, 2, 3, 4 and 6. A **block scale** stretches them to fit each small block. [[mxfp4|MXFP4]] uses blocks of 32 with a **power-of-two scale** (E8M0, 8 bits). [[nvfp4|NVFP4]] uses blocks of 16 with an **FP8 scale** (E4M3), which can take finer values. Smaller blocks and finer scales cost more bits and lose less.',
    hint: 'Shrink the block, then switch the scale format.',
    mission: 'Get the error under 10% with no more than 4.5 bits per value.',
    takeaway: 'Four bits only work with a scale that tracks the local range. Block size and scale precision trade bits for accuracy.',
    mount(c) {
      const G = [0, 0.5, 1, 1.5, 2, 3, 4, 6], N = 65536, r = kit.rng(29);
      const xs = Array.from({ length: N }, () => { const g = kit.gauss(r); return Math.abs(kit.gauss(r)) > 2.2 ? g * 5 : g; });
      const fp4 = v => { const a = Math.abs(v); let b = 0, bd = 1e9; for (const g of G) { const d = Math.abs(a - g); if (d < bd) { bd = d; b = g; } } return Math.sign(v) * b; };
      const e4m3 = s => { const e = Math.floor(Math.log2(s)), q = Math.pow(2, e - 3); return Math.round(s / q) * q; };
      const scaleOf = (blkMax, type) => { const s = blkMax / 6; return type === 'e8m0' ? Math.pow(2, Math.ceil(Math.log2(s))) : e4m3(s); };
      const cache = {};
      function err(blk, type) {
        const key = blk + type; if (cache[key] != null) return cache[key];
        let se = 0, sw = 0;
        for (let s = 0; s < N; s += blk) { let am = 0; for (let i = s; i < s + blk; i++) am = Math.max(am, Math.abs(xs[i])); const sc = scaleOf(am, type); for (let i = s; i < s + blk; i++) { const q = fp4(xs[i] / sc) * sc; se += (q - xs[i]) ** 2; sw += xs[i] * xs[i]; } }
        return (cache[key] = Math.sqrt(se / sw));
      }
      const f = c.fig(420, 214, '<g id="g"></g>');
      const st = c.stats([{ k: 'e', label: 'Error', value: '', cls: 'bad' }, { k: 'b', label: 'Real bits per value', value: '', cls: 'cmp' }, { k: 'n', label: 'Matches', value: '', cls: 'ctl' }]);
      let blk = 32, type = 'e8m0';
      function draw() {
        const U = 7, base = 112; let g = '<text class="b sm" x="16" y="18">32 consecutive values (magnitudes) and their 4-bit versions</text>', lines = '', marks = '';
        for (let s = 0; s < 32; s += Math.min(blk, 32)) {
          const b0 = Math.floor(s / blk) * blk; let am = 0; for (let i = b0; i < b0 + blk; i++) am = Math.max(am, Math.abs(xs[i]));
          const sc = scaleOf(am, type), top = 6 * sc * U, x0 = 16 + s * 12, x1 = 16 + Math.min(s + blk, 32) * 12 - 4;
          lines += `<line class="ln dash" x1="${x0}" x2="${x1}" y1="${(base - top).toFixed(1)}" y2="${(base - top).toFixed(1)}" style="stroke:var(--ctl);stroke-width:1.8"/>`;
          for (let i = s; i < Math.min(s + blk, 32); i++) { const q = Math.abs(fp4(xs[i] / sc) * sc); marks += `<rect x="${16 + i * 12}" y="${(base - q * U - 1.5).toFixed(1)}" width="8" height="3" rx="1" class="f-cmp"/>`; }
        }
        for (let i = 0; i < 32; i++) { const h = Math.max(1, Math.abs(xs[i]) * U); g += `<rect x="${16 + i * 12}" y="${(base - h).toFixed(1)}" width="8" height="${h.toFixed(1)}" rx="1.5" class="f-mem" style="opacity:.75"/>`; }
        g += lines + marks + `<line class="axis" x1="16" x2="404" y1="${base}" y2="${base}"/><text class="xs mute" x="16" y="128">Violet dashed: top level of each block (6 × scale). Orange: the 4-bit value.</text>`;
        g += '<text class="xs b" x="16" y="154">The eight FP4 magnitudes, before the scale is applied</text><line class="axis" x1="16" x2="404" y1="168" y2="168"/>';
        G.forEach(v => { const x = 16 + v / 6 * 388; g += `<line class="ln" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="162" y2="174" style="stroke:var(--cmp);stroke-width:2.2"/><text class="xs m mute" x="${x.toFixed(1)}" y="190" text-anchor="${v === 0 ? 'start' : v === 6 ? 'end' : 'middle'}">${v}</text>`; });
        f.q('#g').innerHTML = g;
        const e = err(blk, type), bits = 4 + 8 / blk, named = blk === 32 && type === 'e8m0' ? 'MXFP4' : blk === 16 && type === 'e4m3' ? 'NVFP4' : 'a custom mix';
        st.set('e', pct(e), 'over 65,536 values'); st.set('b', bits.toFixed(2), '4 + 8 ÷ ' + blk); st.set('n', named, type === 'e8m0' ? 'scale: powers of 2' : 'scale: FP8 E4M3');
        c.mission.set(e < 0.1 && bits <= 4.5);
      }
      const sB = c.slider({ label: 'Values per block', values: [16, 32, 64, 128], value: 32, fmt: v => v, onInput: v => { blk = v; draw(); } });
      const sT = c.seg({ label: 'Scale format', options: [['e8m0', 'E8M0, powers of 2'], ['e4m3', 'E4M3, FP8']], value: 'e8m0', onChange: v => { type = v; draw(); } });
      c.note('Toy data: bell-shaped values with about 3% of them 5 times larger. Real weights and activations differ, so treat the percentages as a shape, not a benchmark. NVFP4 also keeps one FP32 scale per tensor.');
      draw();
      c.demo(1500, async () => { blk = 16; type = 'e4m3'; sB.set(16, true); sT.set('e4m3'); draw(); });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'cross', tag: 'Choosing',
    title: 'Four-bit weights win small batches, FP8 wins large ones',
    alt: 'A log-log chart of tokens per second against batch size for a 70B model on one H100, with one curve for 4-bit weights with 16-bit math and one for FP8 weights and FP8 math. The 4-bit curve leads at small batch. The FP8 curve overtakes it near batch 150. A slider sets the batch size and counters show each curve’s value and whether it is limited by memory or compute.',
    text: 'Weight-only [[w4a16|W4A16]] reads **4 times fewer bytes** than BF16 but still **computes in BF16**. [[w8a8|W8A8]] reads 2 times fewer bytes and **computes in FP8 at twice the tensor-core rate**. At small batch, bytes decide, so W4A16 wins. As the batch grows, compute decides, so W8A8 wins. For a 70B model on an H100 the lines cross near **batch 150**.',
    hint: 'Slide the batch size past the crossing.',
    mission: 'Find a batch size where W8A8 beats W4A16.',
    takeaway: 'The best format depends on traffic. Few users per GPU favor fewer bytes. Many users favor faster math.',
    mount(c) {
      const BW = 3350e9, F16 = 989e12, F8 = 1979e12, P = 70e9;
      const mem4 = 35e9 / BW, mem8 = 70e9 / BW, t4 = B => Math.max(mem4, 2 * P * B / F16), t8 = B => Math.max(mem8, 2 * P * B / F8);
      const ch = kit.chart({ x: 52, y: 30, w: 352, h: 120, xmin: 1, xmax: 1024, ymin: 10, ymax: 20000, xlog: true, ylog: true, xt: [1, 4, 16, 64, 256, 1024], yt: [10, 100, 1000, 10000], yf: v => fmt.n(v, 0), xlabel: 'Batch size: users decoded together', ylabel: 'Tokens per second' });
      const pts = k => Array.from({ length: 61 }, (_, i) => { const B = Math.pow(1024, i / 60); return [ch.X(B), ch.Y(B / (k === 4 ? t4(B) : t8(B)))]; });
      const f = c.fig(420, 200, ch.svg + `<path class="s-mem s3" fill="none" d="${kit.path(pts(4))}"/><path class="s-cmp s3" fill="none" d="${kit.path(pts(8))}"/><g id="m"></g>`);
      c.legend([['mem', 'W4A16: 4-bit weights, BF16 math'], ['cmp', 'W8A8: FP8 weights, FP8 math']]);
      const st = c.stats([{ k: 'a', label: 'W4A16', value: '', cls: 'mem' }, { k: 'b', label: 'W8A8', value: '', cls: 'cmp' }, { k: 'w', label: 'Faster', value: '', cls: 'ok' }]);
      let B = 16;
      function draw() {
        const a = B / t4(B), b = B / t8(B), x = ch.X(B);
        f.q('#m').innerHTML = `<line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(a).toFixed(1)}" r="5" class="f-mem" style="stroke:var(--stage);stroke-width:2"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(b).toFixed(1)}" r="5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/>`;
        const m4 = 2 * P * B / F16 > mem4, m8 = 2 * P * B / F8 > mem8;
        st.set('a', fmt.n(a, 0) + ' tok/s', m4 ? 'compute-bound' : 'memory-bound'); st.set('b', fmt.n(b, 0) + ' tok/s', m8 ? 'compute-bound' : 'memory-bound');
        st.set('w', a > b ? 'W4A16' : 'W8A8', (a > b ? a / b : b / a).toFixed(2) + '× at batch ' + B);
        c.mission.set(b > a);
      }
      const sl = c.slider({ label: 'Batch size', values: [1, 4, 16, 64, 128, 256, 512, 1024], value: 16, fmt: v => v, onInput: v => { B = v; draw(); } });
      c.note('Idealized roofline for 70B parameters on one H100: 3.35 TB/s, 989 TFLOPS in BF16, 1,979 TFLOPS in FP8. It ignores the KV cache, attention, dequantization cost and kernel overheads. Real kernels reach a fraction of these peaks, so expect the crossing to move.');
      draw();
      c.demo(1500, async () => { B = 256; sl.set(256, true); draw(); });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'A 70B model has 4-bit weights. About how many bytes must be read to decode one token for one user?', o: ['About 35 GB', 'About 70 GB', 'About 140 GB', 'About 4 GB'], a: 0, why: '70 billion weights × 0.5 byte is 35 GB, a quarter of BF16. At 3.35 TB/s that is about 96 tokens per second on one H100.' },
      { q: 'Why does one outlier channel hurt INT8 quantization with a single scale?', o: ['It makes the matrix larger', 'It sets the scale, so normal values share only a few levels', 'INT8 cannot store large numbers', 'It slows down the multiplication'], a: 1, why: 'The scale follows the largest value. With a 100 times outlier, the step is about as big as a typical value, so normal values round to 0 or ±1.' },
      { q: 'What does SmoothQuant leave unchanged when it divides activations by s and multiplies weights by s?', o: ['The activation range', 'The weight range', 'The matrix product', 'The bit width'], a: 2, why: '(X ÷ s)(s × W) equals XW exactly. Only where the large values sit changes.' },
      { q: 'How does AWQ decide which channels to protect?', o: ['Random sampling', 'Largest weights', 'Layer depth', 'Largest activations'], a: 3, why: 'A weight error is multiplied by its input activation. Channels with large activations make the largest output errors, so they get the protection.' },
      { q: 'Why does a Hadamard rotation make activations easier to quantize?', o: ['It spreads one giant value over many coordinates', 'It deletes the smallest values', 'It adds bits to the format', 'It makes the weights sparse'], a: 0, why: 'The rotation keeps the length and spreads the energy. The largest value in a block drops from about 100 to about 12, so the step shrinks.' },
      { q: 'A 70B-class model stores about 164,000 KV values per token. In BF16, how big is one 128K-token user’s KV cache?', o: ['About 5 GB', 'About 320 MB', 'About 43 GB', 'About 140 GB'], a: 2, why: '164,000 values × 2 bytes × 131,072 tokens is about 43 GB.' },
      { q: 'How many bits per value does NVFP4 really use, with 4-bit values and an 8-bit scale per 16 values?', o: ['4', '4.25', '4.5', '5'], a: 2, why: '4 + 8 ÷ 16 = 4.5 bits. MXFP4 uses blocks of 32, so 4 + 8 ÷ 32 = 4.25 bits.' },
      { q: 'In the idealized model for a 70B model on an H100, where does W8A8 overtake W4A16?', o: ['At batch 1', 'Around batch 150', 'Around batch 10,000', 'Never'], a: 1, why: 'W4A16 turns compute-bound near batch 74 and keeps computing at the BF16 rate. FP8 math is twice as fast, so W8A8 pulls ahead near batch 148.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + Array.from({ length: 25 }, (_, k) => { const h = 6 + 62 * Math.exp(-Math.pow((k - 12) / 5, 2)); return `<rect x="${40 + k * 10}" y="${(112 - h).toFixed(1)}" width="7" height="${h.toFixed(1)}" rx="2" style="fill:var(--mem);opacity:.75"/>`; }).join('')
    + [0, 1, 2, 3, 4, 5, 6].map(k => `<line x1="${50 + k * 36}" x2="${50 + k * 36}" y1="30" y2="116" style="stroke:var(--cmp);stroke-width:2"/>`).join('')
    + '</g><text x="40" y="20" style="font:600 11px var(--font-mono);fill:var(--ink-3)">4 bits = 15 levels</text></svg>';

  window.LESSONS.push({
    id: 'quant', n: 10, track: 'inference', order: 4,
    title: 'Quantization',
    tagline: 'Fewer bits per number: why it speeds up decoding, what breaks, and the tricks that repair it.',
    preview,
    scenes: S
  });
})();
