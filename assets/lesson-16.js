/* Lesson 16: Scaling laws. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const bil = v => v >= 1e12 ? +(v / 1e12).toFixed(2) + 'T' : +(v / 1e9).toFixed(v < 1e10 ? 1 : 0) + 'B';
  /* Chinchilla parametric fit, full-precision constants. */
  const E0 = 1.6934, A0 = 406.4, AL = 0.3392, B0 = 410.7, BE = 0.2849;
  const loss = (N, D) => E0 + A0 / Math.pow(N, AL) + B0 / Math.pow(D, BE);
  function best(C) { let b = null; for (let i = 0; i <= 600; i++) { const N = Math.pow(10, 8 + i * 6 / 600), D = C / (6 * N), l = loss(N, D); if (!b || l < b.l) b = { N, D, l }; } return b; }
  const sup10 = v => '10' + kit.sup(Math.round(Math.log10(v)));

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'fit', tag: 'Power laws',
    title: 'Loss falls as a straight line on log-log paper',
    alt: 'A log-log chart of reducible loss against training compute with five dots from training runs. A line that the reader positions with two sliders, slope and height. A marker shows the loss the line predicts for a run 100 times larger than the biggest dot. Counters show the slope, the fit error and the predicted loss.',
    text: 'Train models at larger and larger budgets and subtract the floor of about **1.69** that no model size or amount of data removes. What is left, the **reducible loss**, follows a [[power law]]: a **straight line** when both axes are logarithmic. Labs fit that line on small runs and read off the loss of a run **100 times bigger** before they pay for it.',
    hint: 'Set the slope, then the height, until the line runs through the dots.',
    mission: 'Fit the line through the dots to within 0.02 in log10 units.',
    takeaway: 'A straight line on log-log paper means a power law. Small runs predict big ones.',
    mount(c) {
      const r = kit.rng(7), CS = [1e18, 1e19, 1e20, 1e21, 1e22], Y = CS.map(C => (best(C).l - E0) * (1 + 0.01 * kit.gauss(r)));
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 124, xmin: 1e17, xmax: 1e24, ymin: 0.1, ymax: 10, xlog: true, ylog: true, xt: [1e18, 1e20, 1e22, 1e24], xf: sup10, yt: [0.1, 1, 10], yf: v => v, xlabel: 'Training compute, FLOPs', ylabel: 'Loss minus 1.69' });
      const dots = CS.map((C, i) => `<circle cx="${ch.X(C).toFixed(1)}" cy="${ch.Y(Y[i]).toFixed(1)}" r="4.5" class="f-cmp" style="stroke:var(--stage);stroke-width:1.5"/>`).join('');
      const f = c.fig(420, 200, ch.svg + dots + '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Slope', value: '', cls: 'mem' }, { k: 'e', label: 'Fit error', value: '', cls: 'bad' }, { k: 'p', label: 'Predicted loss, 10²⁴ FLOPs', value: '', cls: 'ok' }]);
      let s = -0.05, b = 0.1;
      const yAt = lc => Math.pow(10, b + s * (lc - 20));
      function draw() {
        const pts = []; for (let i = 0; i <= 60; i++) { const lc = 17 + i * 7 / 60, y = yAt(lc); if (y >= 0.1 && y <= 10) pts.push([ch.X(Math.pow(10, lc)), ch.Y(y)]); }
        const rms = Math.sqrt(CS.reduce((a, C, i) => a + (Math.log10(Y[i]) - Math.log10(yAt(Math.log10(C)))) ** 2, 0) / CS.length), py = yAt(24), ok = rms <= 0.02;
        f.q('#g').innerHTML = (pts.length > 1 ? `<path class="s-mem s3" fill="none" d="${kit.path(pts)}"/>` : '') + (py >= 0.1 && py <= 10 ? `<circle cx="${ch.X(1e24).toFixed(1)}" cy="${ch.Y(py).toFixed(1)}" r="5" class="f-ok" style="stroke:var(--ink);stroke-width:2"/>` : '');
        st.set('s', s.toFixed(3), 'loss falls as C^' + s.toFixed(3)); st.set('e', rms.toFixed(3), ok ? 'a good fit' : 'in log10 units'); st.set('p', (E0 + py).toFixed(2), ok ? 'the fitted formula says about 1.90' : 'line height + 1.69');
        c.mission.set(ok);
      }
      c.slider({ label: 'Slope of the line', min: -0.3, max: -0.05, step: 0.0025, value: -0.05, fmt: v => v.toFixed(3), onInput: v => { s = v; draw(); } });
      const sB = c.slider({ label: 'Height of the line at 10²⁰ FLOPs', min: -0.6, max: 0.2, step: 0.005, value: 0.1, fmt: v => Math.pow(10, v).toFixed(2), onInput: v => { b = v; draw(); } });
      c.note('Dots: the best loss reachable at each budget, from the Chinchilla fit, with 1% noise added. The 1.69 floor and the shape come from that paper. A later replication refit the constants and got somewhat different numbers, so trust the straight-line shape more than the digits.');
      draw();
      c.demo(1500, async () => { s = -0.1575; b = -0.065; draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'terms', tag: 'The formula',
    title: 'Loss has three parts: a floor, a size term and a data term',
    alt: 'A horizontal stacked bar shows the two reducible terms of the predicted loss: a model-size term in blue and a data term in green, drawn on a scale from 0 to 1.2. A marker shows how much room remains before the total loss reaches 1.9. The floor of 1.693 is written above the bar. Two sliders set the number of parameters and the number of training tokens. Counters show each term and the tokens per parameter.',
    text: 'The Chinchilla fit writes loss as **L = E + A ÷ N^0.34 + B ÷ D^0.28**. **E** is a floor that nothing removes. The second term shrinks as the model gets **more parameters N**. The third shrinks as it sees **more tokens D**. A model can be held back by either one, and spending on the wrong one wastes compute.',
    hint: 'Grow the model, then the data, and watch which term moves.',
    mission: 'Get the total loss under 1.9.',
    takeaway: 'More parameters only help the size term. More tokens only help the data term. Both have to grow.',
    mount(c) {
      const f = c.fig(420, 124, '<g id="g"></g>');
      c.legend([['mem', 'Model size term'], ['data', 'Data term']]);
      const st = c.stats([{ k: 'n', label: 'Size term', value: '', cls: 'mem' }, { k: 'd', label: 'Data term', value: '', cls: 'data' }, { k: 'r', label: 'Tokens per parameter', value: '', cls: 'cmp' }]);
      let N = 7e9, D = 1e12;
      function draw() {
        const tn = A0 / Math.pow(N, AL), td = B0 / Math.pow(D, BE), tot = E0 + tn + td, X0 = 16, W = 388, mx = 1.2, lim = 1.9 - E0;
        let g = `<text class="b sm" x="16" y="18">Loss ${tot.toFixed(3)} = floor 1.693 + ${(tn + td).toFixed(3)}</text><rect class="well" x="${X0}" y="30" width="${W}" height="28" rx="6"/>`;
        const wn = Math.min(tn, mx) / mx * W, wd = Math.min(td, Math.max(0, mx - tn)) / mx * W;
        g += `<rect class="f-mem" x="${X0}" y="30" width="${Math.max(1.5, wn).toFixed(1)}" height="28"/><rect class="f-data" x="${(X0 + wn).toFixed(1)}" y="30" width="${Math.max(1.5, wd).toFixed(1)}" height="28"/>`;
        g += `<line class="ln" x1="${(X0 + lim / mx * W).toFixed(1)}" x2="${(X0 + lim / mx * W).toFixed(1)}" y1="24" y2="64" style="stroke:var(--ok);stroke-width:2.4"/><text class="xs b" x="${(X0 + lim / mx * W + 5).toFixed(1)}" y="76" style="fill:var(--ok)">room for total loss 1.9: 0.207</text><text class="xs mute" x="16" y="104">Scale 0 to 1.2. The floor is the same in every case.</text>`;
        f.q('#g').innerHTML = g;
        st.set('n', tn.toFixed(3), 'A ÷ N^0.34 at ' + bil(N)); st.set('d', td.toFixed(3), 'B ÷ D^0.28 at ' + bil(D)); st.set('r', fmt.n(D / N, 0), bil(D) + ' ÷ ' + bil(N));
        c.mission.set(tot < 1.9);
      }
      const sN = c.slider({ label: 'Parameters N', values: [1e8, 4e8, 1e9, 7e9, 7e10, 4e11, 1e12], value: 7e9, fmt: bil, onInput: v => { N = v; draw(); } });
      const sD = c.slider({ label: 'Training tokens D', values: [1e10, 1e11, 1e12, 1.5e13, 1e14], value: 1e12, fmt: bil, onInput: v => { D = v; draw(); } });
      c.note('The blue segment shrinks with N and the green one with D. Past the green line the total loss is above 1.9.');
      draw();
      c.demo(1500, async () => { N = 7e10; D = 1.5e13; sN.set(7e10, true); sD.set(1.5e13, true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'chinchilla', tag: 'The formula',
    title: 'For a fixed budget, there is a best model size',
    alt: 'A chart of loss against model size for a fixed compute budget. The curve falls, reaches a flat minimum and rises again, because bigger models see fewer tokens. A slider sets the model size and a selector sets the budget. At the Gopher budget two labeled dots mark Gopher and Chinchilla. Counters show tokens per parameter, the loss and the gap to the best loss.',
    text: 'With compute fixed at **C = 6 × N × D**, a bigger model means fewer tokens. Loss falls, bottoms out, then rises again. At Gopher’s budget the **280B** Gopher saw 300B tokens and landed above the minimum. The **70B** Chinchilla saw **1.4T tokens** on the same compute and beat it. The bottom of the curve is the [[compute-optimal]] size, and it is wide, so a model near it loses little.',
    hint: 'Slide the model size to the bottom of the curve.',
    mission: 'Get within 0.005 of the best loss for the chosen budget.',
    takeaway: 'Model size and tokens should grow together. A huge model on few tokens wastes the budget.',
    mount(c) {
      const NA = 1e9, NB = 2e12, CS = { '1e21': 1e21, '1e22': 1e22, '1e23': 1e23, '5.9e23': 5.9e23, '1e25': 1e25 };
      const f = c.fig(420, 204, '<g id="g"></g>');
      const st = c.stats([{ k: 'r', label: 'Tokens per parameter', value: '', cls: 'cmp' }, { k: 'l', label: 'Loss', value: '', cls: 'bad' }, { k: 'g', label: 'Gap to the best', value: '', cls: 'ok' }]);
      let C = 1e23, N = 1e11;
      function draw() {
        const o = best(C), ymin = o.l - 0.01, ymax = o.l + 0.3, step = 0.05;
        const ch = kit.chart({ x: 52, y: 26, w: 336, h: 124, xmin: NA, xmax: NB, ymin, ymax, xlog: true, xt: [1e9, 1e10, 1e11, 1e12], xf: v => bil(v), yt: [0, 1, 2, 3, 4, 5].map(i => +(Math.ceil(ymin / step) * step + i * step).toFixed(2)).filter(v => v <= ymax), yf: v => v.toFixed(2), xlabel: 'Model parameters N (tokens D = C ÷ 6N)', ylabel: 'Loss' });
        const pts = []; for (let i = 0; i <= 80; i++) { const n = NA * Math.pow(NB / NA, i / 80), l = loss(n, C / (6 * n)); if (l <= ymax) pts.push([ch.X(n), ch.Y(l)]); }
        const L = loss(N, C / (6 * N)), mk = (n, lab, dy) => { const l = loss(n, C / (6 * n)); return l <= ymax ? `<circle cx="${ch.X(n).toFixed(1)}" cy="${ch.Y(l).toFixed(1)}" r="3.6" class="f-mem"/><text class="xs b" x="${ch.X(n).toFixed(1)}" y="${(ch.Y(l) + dy).toFixed(1)}" text-anchor="middle">${lab}</text>` : ''; };
        f.q('#g').innerHTML = ch.svg + `<path class="s-bad s3" fill="none" d="${kit.path(pts)}"/>` + (C === 5.9e23 ? mk(70e9, 'Chinchilla', -8) + mk(280e9, 'Gopher', -8) : '') + `<circle cx="${ch.X(o.N).toFixed(1)}" cy="${ch.Y(o.l).toFixed(1)}" r="4" class="f-ok" style="stroke:var(--stage);stroke-width:1.5"/><line class="ln dash" x1="${ch.X(N).toFixed(1)}" x2="${ch.X(N).toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${ch.X(N).toFixed(1)}" cy="${Math.min(ch.y1, ch.Y(L)).toFixed(1)}" r="5.5" class="f-cmp" style="stroke:var(--ink);stroke-width:2"/><text class="xs mute" x="16" y="196">Green dot: the best size for this budget, about ${bil(o.N)}.</text>`;
        st.set('r', fmt.n(C / (6 * N * N), C / (6 * N * N) < 10 ? 1 : 0), bil(C / (6 * N)) + ' tokens ÷ ' + bil(N)); st.set('l', L.toFixed(3), 'at ' + bil(N)); st.set('g', '+' + (L - o.l).toFixed(3), L - o.l <= 0.005 ? 'near the bottom' : 'above the best');
        c.mission.set(L - o.l <= 0.005);
      }
      c.seg({ label: 'Compute budget, FLOPs', options: [['1e21', '10²¹'], ['1e22', '10²²'], ['1e23', '10²³'], ['5.9e23', 'Gopher: 5.9 × 10²³'], ['1e25', '10²⁵']], value: '1e23', onChange: v => { C = CS[v]; draw(); } });
      const sl = c.slider({ label: 'Model size N', min: 1e9, max: 2e12, log: true, round: true, value: 1e11, fmt: bil, onInput: v => { N = v; draw(); } });
      c.note('Constants are the full-precision Chinchilla fit. The paper’s other two methods give a rule of about 20 tokens per parameter. This fit asks for more tokens at large budgets, about 60 per parameter at Gopher’s. All agree that size and tokens should grow together.');
      draw();
      c.demo(1500, async () => { N = best(C).N; sl.set(N, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  const MODELS = [
    { k: 'gpt3', name: 'GPT-3', N: 175e9, D: 300e9 }, { k: 'gopher', name: 'Gopher', N: 280e9, D: 300e9 }, { k: 'chin', name: 'Chinchilla', N: 70e9, D: 1.4e12 }, { k: 'l1', name: 'Llama 1 65B', N: 65e9, D: 1.4e12 },
    { k: 'l2', name: 'Llama 2 70B', N: 70e9, D: 2e12 }, { k: 'l38', name: 'Llama 3 8B', N: 8e9, D: 15e12 }, { k: 'l370', name: 'Llama 3 70B', N: 70e9, D: 15e12 }, { k: 'l31', name: 'Llama 3.1 405B', N: 405e9, D: 15e12 }
  ];
  S.push({
    id: 'models', tag: 'In practice',
    title: 'Where real models sit: from starved to stuffed',
    alt: 'A log-log chart of training tokens against parameters with eight published models as dots. A dashed line marks 20 tokens per parameter and a dotted line marks 200. Dots are red below 10 tokens per parameter, green between 10 and 100 and blue above 100. A selector picks a model and the chart labels it. Counters show tokens per parameter, the regime and the training compute.',
    text: 'GPT-3 and Gopher saw about **1 to 2 tokens per parameter**, far short of what the budget could buy. Chinchilla and the first Llamas moved to **20 or more**. Llama 3 then went further: its 8B model saw about **15T tokens, nearly 1,900 per parameter**. A model that will serve billions of requests is cheaper to run when it is **small and well fed**, even if the extra tokens cost more to train.',
    hint: 'Pick each model and read its tokens per parameter.',
    mission: 'Find a model trained on more than 1,000 tokens per parameter.',
    takeaway: 'Compute-optimal is the cheapest way to reach a loss. The cheapest model to serve is usually trained far past it.',
    mount(c) {
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 124, xmin: 1e9, xmax: 1e12, ymin: 1e11, ymax: 1e14, xlog: true, ylog: true, xt: [1e9, 1e10, 1e11, 1e12], xf: bil, yt: [1e11, 1e12, 1e13, 1e14], yf: bil, xlabel: 'Parameters', ylabel: 'Training tokens' });
      const ln = (k, cls) => { const n0 = Math.max(1e9, 1e11 / k), n1 = Math.min(1e12, 1e14 / k); return `<line class="ln ${cls}" x1="${ch.X(n0).toFixed(1)}" x2="${ch.X(n1).toFixed(1)}" y1="${ch.Y(n0 * k).toFixed(1)}" y2="${ch.Y(n1 * k).toFixed(1)}"/>`; };
      const f = c.fig(420, 226, ch.svg + ln(20, 'dash') + ln(200, 'dash') + '<g id="g"></g>');
      c.legend([['bad', 'Under 10 tokens per parameter'], ['ok', '10 to 100'], ['mem', 'Over 100']]);
      const st = c.stats([{ k: 'r', label: 'Tokens per parameter', value: '', cls: 'cmp' }, { k: 'g', label: 'Regime', value: '', cls: 'ctl' }, { k: 'c', label: 'Training compute, 6ND', value: '', cls: 'mem' }]);
      let key = 'gpt3';
      const reg = r => r < 10 ? ['f-bad', 'under-trained'] : r <= 100 ? ['f-ok', 'near compute-optimal'] : ['f-mem', 'over-trained on purpose'];
      function draw() {
        let g = ''; MODELS.forEach(m => { const r = m.D / m.N, sel = m.k === key; g += `<circle cx="${ch.X(m.N).toFixed(1)}" cy="${ch.Y(m.D).toFixed(1)}" r="${sel ? 7 : 4.5}" class="${reg(r)[0]}" style="stroke:${sel ? 'var(--ink)' : 'var(--stage)'};stroke-width:${sel ? 2.4 : 1.5}"/>`; });
        const m = MODELS.find(q => q.k === key), x = ch.X(m.N), tx = Math.min(Math.max(x, ch.x0 + 40), ch.x1 - 40);
        g += `<text class="xs b" x="${tx.toFixed(1)}" y="${(ch.Y(m.D) - 11).toFixed(1)}" text-anchor="middle">${m.name}</text><text class="xs mute" x="16" y="202">Dashed lines: 20 and 200 tokens per parameter.</text><text class="xs mute" x="16" y="218">Published counts. Llama 3.1 405B: about 15T tokens.</text>`;
        f.q('#g').innerHTML = g;
        const r = m.D / m.N;
        st.set('r', fmt.n(r, r < 10 ? 1 : 0), bil(m.D) + ' tokens ÷ ' + bil(m.N)); st.set('g', reg(r)[1], r > 1000 ? 'far past 20 per parameter' : r > 100 ? 'past 20 per parameter' : r >= 10 ? 'around the rule of thumb' : 'too few tokens'); st.set('c', kit.sci(6 * m.N * m.D, 1) + ' FLOPs', '6 × ' + bil(m.N) + ' × ' + bil(m.D));
        c.mission.set(r > 1000);
      }
      c.seg({ label: 'Model', options: MODELS.map(m => [m.k, m.name]), value: 'gpt3', onChange: v => { key = v; draw(); } });
      draw();
      c.demo(1500, async () => { key = 'l38'; draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'overtrain', tag: 'In practice',
    title: 'If a model will serve a lot, train a smaller one for longer',
    alt: 'A log-log chart of total cost against model size for one target loss. A dashed curve counts training only and its minimum is the Chinchilla-style optimum. A solid curve adds the cost of serving a chosen number of tokens and its minimum lies at a smaller model trained on more tokens. Controls set the target loss and the tokens served over the model’s life. Counters show the cheapest model size, its training tokens, tokens per parameter and the saving.',
    text: 'The training-only optimum ignores what comes after. Serving costs about **2 × N FLOPs per token**, so a **big model gets expensive** to run. For one target loss you can trade size for tokens: a smaller model trained on more tokens reaches the same loss. Add the serving bill and the cheapest choice moves toward **fewer parameters and far more training tokens**.',
    hint: 'Raise the tokens served and watch the minimum move left.',
    mission: 'Find a case where the cheapest model sees over 500 tokens per parameter.',
    takeaway: 'Heavy serving shifts the best choice to a smaller model on many more tokens.',
    mount(c) {
      const NA = 1e9, NB = 4e11, ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: NA, xmax: NB, ymin: 1e22, ymax: 1e26, xlog: true, ylog: true, xt: [1e9, 1e10, 1e11], xf: bil, yt: [1e22, 1e24, 1e26], yf: sup10, xlabel: 'Model parameters N', ylabel: 'Total FLOPs' });
      const f = c.fig(420, 196, ch.svg + '<g id="g"></g>');
      c.legend([['mute', 'Training only'], ['cmp', 'Training plus serving']]);
      const st = c.stats([{ k: 'n', label: 'Cheapest model', value: '', cls: 'mem' }, { k: 'd', label: 'Training tokens', value: '', cls: 'data' }, { k: 'r', label: 'Tokens per parameter', value: '', cls: 'cmp' }, { k: 's', label: 'Saved vs training-only pick', value: '', cls: 'ok' }]);
      let Ls = 2.0, I = 0;
      const dOf = (N, l) => { const rem = l - E0 - A0 / Math.pow(N, AL); return rem > 0 ? Math.pow(B0 / rem, 1 / BE) : null; };
      const cost = (N, l, inf) => { const D = dOf(N, l); return D == null ? null : 6 * N * D + 2 * N * inf; };
      function argmin(l, inf) { let b = null; for (let i = 0; i <= 1500; i++) { const N = NA * Math.pow(NB / NA, i / 1500), v = cost(N, l, inf); if (v != null && (!b || v < b.v)) b = { N, v, D: dOf(N, l) }; } return b; }
      function draw() {
        const o0 = argmin(Ls, 0), o1 = argmin(Ls, I), curve = inf => { const p = []; for (let i = 0; i <= 120; i++) { const N = NA * Math.pow(NB / NA, i / 120), v = cost(N, Ls, inf); if (v != null && v >= 1e22 && v <= 1e26) p.push([ch.X(N), ch.Y(v)]); } return p; };
        const c0 = o0.v === undefined ? 0 : 6 * o0.N * o0.D + 2 * o0.N * I;
        f.q('#g').innerHTML = `<path class="ink-s s2 dash" fill="none" d="${kit.path(curve(0))}" style="opacity:.6"/><path class="s-cmp s3" fill="none" d="${kit.path(curve(I))}"/><circle cx="${ch.X(o0.N).toFixed(1)}" cy="${ch.Y(o0.v).toFixed(1)}" r="4" class="f-mem" style="stroke:var(--stage);stroke-width:1.5"/><circle cx="${ch.X(o1.N).toFixed(1)}" cy="${ch.Y(Math.min(1e26, o1.v)).toFixed(1)}" r="6" class="f-cmp" style="stroke:var(--ink);stroke-width:2"/><text class="xs mute" x="16" y="188">Blue dot: training-only optimum. Orange dot: cheapest with serving.</text>`;
        st.set('n', bil(o1.N), 'vs ' + bil(o0.N) + ' training-only'); st.set('d', bil(o1.D), 'at loss ' + Ls.toFixed(2)); st.set('r', fmt.n(o1.D / o1.N, 0), 'Chinchilla-style: ' + fmt.n(o0.D / o0.N, 0)); st.set('s', I ? pct(1 - o1.v / c0) : '0%', I ? 'of total FLOPs' : 'nothing served');
        c.mission.set(o1.D / o1.N >= 500);
      }
      c.seg({ label: 'Target loss', options: [['1.95', '1.95'], ['2', '2.00'], ['2.1', '2.10']], value: '2', onChange: v => { Ls = +v; draw(); } });
      const sI = c.slider({ label: 'Tokens served over the model’s life', values: [0, 1e11, 1e12, 1e13, 1e14, 1e15], value: 0, fmt: v => v === 0 ? 'none' : bil(v), onInput: v => { I = v; draw(); } });
      c.note('Total FLOPs = 6 × N × D to train + 2 × N per served token. Constants are the Chinchilla fit. Sardana and Frankle analyze this trade in “Beyond Chinchilla-Optimal”.');
      draw();
      c.demo(1500, async () => { I = 1e13; sI.set(1e13, true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'repeat', tag: 'The data wall',
    title: 'Repeating data helps, with fading returns',
    alt: 'A chart of effective tokens, in multiples of the unique tokens, against the number of epochs. A diagonal line shows the value if every repeat were as good as fresh data. A curve below it rises and flattens near 16 times the unique tokens. A marker shows the chosen number of epochs. Controls set the epochs and the number of unique tokens. Counters show the effective tokens, the tokens processed and the share of value kept.',
    text: 'Fresh text is finite. Epoch AI estimated in 2024 that public human text holds about **300 trillion tokens**, with a plausible range of 100 to 1,000 trillion. Repeating data for more [[epoch|epochs]] stretches it. Muennighoff and colleagues found that **up to about 4 epochs** is nearly as good as fresh data, and that **each extra epoch is worth less**. Their fit gives the value of the data after E epochs as **U × (1 + 15.4 × (1 − e^(−(E − 1) ÷ 15.4)))**.',
    hint: 'Raise the epochs and compare effective tokens with tokens processed.',
    mission: 'Get 100T effective tokens from 15T unique tokens.',
    takeaway: 'Repeating data buys a few more epochs at nearly full value. After that the compute is mostly wasted.',
    mount(c) {
      const R = 15.4, ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 0, xmax: 64, ymin: 0, ymax: 20, xt: [0, 16, 32, 48, 64], yt: [0, 5, 10, 15, 20], yf: v => v + '×', xlabel: 'Epochs over the same data', ylabel: 'Effective data, in unique datasets' });
      const eff = e => 1 + R * (1 - Math.exp(-(e - 1) / R));
      const crv = Array.from({ length: 64 }, (_, i) => [ch.X(i + 1), ch.Y(eff(i + 1))]), dia = [[ch.X(1), ch.Y(1)], [ch.X(20), ch.Y(20)]];
      const f = c.fig(420, 188, ch.svg + `<path class="ink-s s2 dash" fill="none" d="${kit.path(dia)}" style="opacity:.6"/><path class="s-data s3" fill="none" d="${kit.path(crv)}"/><g id="g"></g>`);
      c.legend([['data', 'Effective data'], ['mute', 'If every repeat were fresh']]);
      const st = c.stats([{ k: 'e', label: 'Effective tokens', value: '', cls: 'data' }, { k: 'p', label: 'Tokens processed', value: '', cls: 'cmp' }, { k: 'v', label: 'Value kept', value: '', cls: 'ok' }]);
      let ep = 1, U = 15;
      function draw() {
        const e = eff(ep);
        f.q('#g').innerHTML = `<line class="ln dash" x1="${ch.X(ep).toFixed(1)}" x2="${ch.X(ep).toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${ch.X(ep).toFixed(1)}" cy="${ch.Y(e).toFixed(1)}" r="5.5" class="f-data" style="stroke:var(--ink);stroke-width:2"/>`;
        st.set('e', fmt.n(U * e, 0) + 'T', U + 'T × ' + e.toFixed(2)); st.set('p', fmt.n(U * ep, 0) + 'T', U + 'T × ' + ep + ' epochs'); st.set('v', pct(e / ep), 'of what fresh data would give');
        c.mission.set(U === 15 && U * e >= 100);
      }
      const sE = c.slider({ label: 'Epochs', min: 1, max: 64, step: 1, value: 1, fmt: v => v, onInput: v => { ep = v; draw(); } });
      c.seg({ label: 'Unique tokens available', options: [['15', '15T'], ['30', '30T'], ['300', '300T, all public text']], value: '15', onChange: v => { U = +v; draw(); } });
      c.note('The decay constant is from the fit in Muennighoff et al., which used models up to 9B parameters. Treat the curve as a guide, not a guarantee for frontier runs. Epoch AI’s 300T figure is an estimate with a wide range.');
      draw();
      c.demo(1500, async () => { ep = 9; sE.set(9, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'What does a power law look like on a log-log plot?', o: ['A straight line', 'A parabola', 'A flat line', 'A circle'], a: 0, why: 'If y = a × x^k, then log y = log a + k log x, which is a line with slope k.' },
      { q: 'In L(N, D) = E + A ÷ N^α + B ÷ D^β, what does E stand for?', o: ['The energy used in training', 'The loss that no model size or data amount removes', 'The number of epochs', 'The embedding size'], a: 1, why: 'E is the floor. The other two terms shrink as N and D grow, but E stays.' },
      { q: 'At a fixed compute budget, what happens if you make the model much bigger than the best size?', o: ['Loss always falls', 'The data term disappears', 'Compute drops', 'It sees too few tokens, so loss rises again'], a: 3, why: 'Compute equals 6 × N × D. A bigger N leaves a smaller D, and the data term grows faster than the size term shrinks.' },
      { q: 'Chinchilla (70B, 1.4T tokens) beat Gopher (280B, 300B tokens) on about the same compute. Why?', o: ['It used a better optimizer', 'Gopher had too many parameters for the tokens it saw', 'It had more layers', 'It was trained on code'], a: 1, why: 'Gopher’s size term was already small while its data term was large. Spending the same compute on tokens was the better trade.' },
      { q: 'Why would a company train a model on far more tokens than compute-optimal?', o: ['A smaller model that reaches the same loss is cheaper to serve to many users', 'Loss cannot go lower otherwise', 'Fewer GPUs are needed for training', 'The data is free'], a: 0, why: 'Serving costs about 2 × N FLOPs per token. Training a smaller model longer moves cost from serving to training.' },
      { q: 'Llama 3 8B saw about 15T tokens. About how many tokens per parameter is that?', o: ['About 20', 'About 190', 'About 19,000', 'About 1,900'], a: 3, why: '15 trillion ÷ 8 billion is about 1,875.' },
      { q: 'Compared with fresh data, training for about 4 epochs on repeated data is…', o: ['Useless', 'Half as good', 'Nearly as good', 'Better'], a: 2, why: 'Muennighoff and colleagues found about 4 epochs behave almost like unique data. Returns fall after that.' },
      { q: 'Epoch AI estimated roughly how many tokens of public human text exist?', o: ['About 3 trillion', 'About 300 trillion', 'About 30 trillion', 'About 30 quadrillion'], a: 1, why: 'The 2024 estimate is about 300 trillion tokens, with a range from 100 to 1,000 trillion.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + '<line x1="44" y1="120" x2="290" y2="120" style="stroke:var(--line);stroke-width:1.5"/><line x1="44" y1="30" x2="44" y2="120" style="stroke:var(--line);stroke-width:1.5"/>'
    + '<path d="M50 40 L286 108" fill="none" style="stroke:var(--mem);stroke-width:3"/>'
    + [[60, 45], [110, 56], [160, 70], [212, 85], [262, 101]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" style="fill:var(--cmp)"/>`).join('')
    + '</g><text x="44" y="20" style="font:600 11px var(--font-mono);fill:var(--ink-3)">loss = a straight line in log-log</text></svg>';

  window.LESSONS.push({
    id: 'scaling', n: 16, track: 'training', order: 2,
    title: 'Scaling Laws',
    tagline: 'How loss falls with compute, parameters and data, and why real models are trained past the optimum.',
    preview,
    scenes: S
  });
})();
