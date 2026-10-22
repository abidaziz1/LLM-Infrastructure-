/* Lesson 12: Mixture of Experts. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const bil = v => v >= 1e12 ? +(v / 1e12).toFixed(2) + 'T' : +(v / 1e9).toFixed(v < 1e10 ? 1 : 0) + 'B';

  /* 1 ---------------------------------------------------------------- */
  const MODELS = {
    mix: { name: 'Mixtral 8x7B', total: 46.7e9, active: 12.9e9, E: 8, k: 2, sh: 0 },
    q3: { name: 'Qwen3-235B', total: 235e9, active: 22e9, E: 128, k: 8, sh: 0 },
    ds: { name: 'DeepSeek-V3', total: 671e9, active: 37e9, E: 256, k: 8, sh: 1 },
    k2: { name: 'Kimi K2', total: 1000e9, active: 32e9, E: 384, k: 8, sh: 1 },
    oss: { name: 'gpt-oss-120b', total: 116.8e9, active: 5.1e9, E: 128, k: 4, sh: 0 },
    l4: { name: 'Llama 4 Maverick', total: 400e9, active: 17e9, E: 128, k: 1, sh: 1 }
  };
  S.push({
    id: 'sparse', tag: 'The idea',
    title: 'A token wakes only a few experts',
    alt: 'A grid of small squares, one per expert in a single layer of the chosen model. A few squares are lit orange: the experts the current token uses. Controls pick one of six published models. Counters show the parameters stored, the parameters used per token, their ratio and how many experts each token uses.',
    text: 'A dense model uses every weight for every token. A [[moe|mixture-of-experts]] model splits each feed-forward layer into many [[expert]] blocks, and a [[router]] picks a few for each token. DeepSeek-V3 stores **671B** parameters and uses **37B** for each token. **Memory follows the stored total. Compute follows the part that runs.**',
    hint: 'Switch between the six models.',
    mission: 'Find a model that stores at least 20 times more than it uses per token.',
    takeaway: 'Sparse models store far more than they use. You pay memory for the total and compute for the active part.',
    mount(c) {
      const f = c.fig(420, 236, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Stored', value: '', cls: 'mem' }, { k: 'a', label: 'Used per token', value: '', cls: 'cmp' }, { k: 'r', label: 'Stored ÷ used', value: '', cls: 'data' }, { k: 'e', label: 'Experts per token', value: '', cls: 'ctl' }]);
      let key = 'ds';
      const cells = [];
      function pick(m, seed) { const r = kit.rng(seed + m.E), s = new Set(); while (s.size < m.k) s.add(Math.floor(r() * m.E)); return s; }
      function light(set) { cells.forEach((el, i) => { el.setAttribute('class', set.has(i) ? 'f-cmp' : 'well'); }); }
      function draw() {
        const m = MODELS[key], cols = m.E <= 8 ? 8 : m.E <= 16 ? 16 : 32, pitch = 388 / cols, size = pitch - (cols === 8 ? 6 : 3), rows = Math.ceil(m.E / cols);
        let g = `<text class="b sm" x="16" y="18">${m.name}: one layer, ${m.E} experts</text>`;
        cells.length = 0;
        for (let i = 0; i < m.E; i++) g += `<rect id="x${i}" class="well" x="${(16 + (i % cols) * pitch).toFixed(1)}" y="${(30 + Math.floor(i / cols) * pitch).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="${cols === 8 ? 6 : 2}"/>`;
        const y1 = 30 + rows * pitch + 18;
        g += `<text class="xs" x="16" y="${y1}">Lit: the ${m.k} expert${m.k > 1 ? 's' : ''} this token uses${m.sh ? ', plus 1 shared' : ''}.</text>`;
        g += `<text class="xs mute" x="16" y="${y1 + 18}">Stored ${bil(m.total)} parameters, about ${fmt.n(m.total / 1e9, 0)} GB at 1 byte each.</text>`;
        f.q('#g').innerHTML = g;
        for (let i = 0; i < m.E; i++) cells.push(f.q('#x' + i));
        light(pick(m, 1));
        st.set('t', bil(m.total), 'published figure'); st.set('a', bil(m.active), pct(m.active / m.total) + ' of the total'); st.set('r', (m.total / m.active).toFixed(1) + '×', 'memory vs compute'); st.set('e', m.k + (m.sh ? ' + 1' : ''), 'of ' + m.E + (m.sh ? ' + 1 shared' : ''));
        c.mission.set(m.total / m.active >= 20);
      }
      const sM = c.seg({ label: 'Model', options: [['mix', 'Mixtral 8x7B'], ['q3', 'Qwen3-235B'], ['ds', 'DeepSeek-V3'], ['k2', 'Kimi K2'], ['oss', 'gpt-oss-120b'], ['l4', 'Llama 4 Maverick']], value: 'ds', onChange: v => { key = v; draw(); } });
      c.note('Figures are the rounded totals from each model’s published card or report. Expert counts are per MoE layer.');
      draw();
      c.play(async () => { for (let t = 2; t <= 4; t++) { light(pick(MODELS[key], t)); await c.wait(450); } light(pick(MODELS[key], 1)); });
      c.demo(1500, async () => { key = 'k2'; sM.set('k2'); draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'build', tag: 'The idea',
    title: 'Build a mixture-of-experts model',
    alt: 'A row of four boxes shows one MoE layer: attention, router, the experts with the number used, and an optional shared expert. Below, two bars show the parameters stored and the parameters used per token, with ticks marking DeepSeek-V3 at 671 billion and 37 billion. Controls set the number of experts, how many are used, the width of each expert and whether there is a shared expert. Counters show the totals and the number of ways to pick experts in a layer.',
    text: 'In the DeepSeek-V3 layout, each of **58 MoE layers** holds experts that each have **44 million parameters** (3 matrices of 7168 × 2048). Stored size grows with the **number of experts**. Used size grows with the **number picked**. Many small experts give the router far more **combinations** to choose from at the same cost.',
    hint: 'Raise the expert count, keep the number used small.',
    mission: 'Build a model that stores at least 600B and uses at most 40B per token.',
    takeaway: 'Total and active size are set by different knobs. That is the whole point of the design.',
    mount(c) {
      const D = 7168, N0 = 14.5e9, LAY = 58;
      const f = c.fig(420, 202, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Stored', value: '', cls: 'mem' }, { k: 'a', label: 'Used per token', value: '', cls: 'cmp' }, { k: 'w', label: 'Ways to pick, per layer', value: '', cls: 'ctl' }]);
      let E = 8, k = 2, w = 8192, sh = true;
      const comb = (n, r) => { let v = 1; for (let i = 1; i <= r; i++) v *= (n - r + i) / i; return v; };
      function draw() {
        const pe = 3 * D * w, total = N0 + LAY * (E + (sh ? 1 : 0)) * pe, act = N0 + LAY * (k + (sh ? 1 : 0)) * pe, cm = comb(E, k), mx = 1200e9;
        const box = (x, wd, t1, t2, cls) => `<rect class="${cls}" x="${x}" y="26" width="${wd}" height="40" rx="7"/><text class="xs b" x="${x + wd / 2}" y="43" text-anchor="middle">${t1}</text><text class="xs mute" x="${x + wd / 2}" y="58" text-anchor="middle">${t2}</text>`;
        let g = '<text class="b sm" x="16" y="18">One MoE layer</text>' + box(16, 74, 'Attention', 'dense', 't-mem') + box(104, 56, 'Router', 'scores', 't-ctl') + box(174, 140, E + ' experts', k + ' used per token', 't-cmp') + (sh ? box(328, 76, 'Shared', 'always on', 't-data') : '');
        g += '<path class="ink-s" fill="none" d="M92 46 h10 M162 46 h10 M316 46 h10" style="stroke-width:1.8"/>';
        g += kit.bar(16, 104, 388, 14, total / mx, 'f-mem', 'Stored parameters', bil(total)) + kit.bar(16, 148, 388, 14, act / mx, 'f-cmp', 'Used per token', bil(act));
        g += `<line class="ln" x1="${16 + 671 / 1200 * 388}" x2="${16 + 671 / 1200 * 388}" y1="100" y2="122" style="stroke:var(--ink);stroke-width:2"/><line class="ln" x1="${16 + 37 / 1200 * 388}" x2="${16 + 37 / 1200 * 388}" y1="144" y2="166" style="stroke:var(--ink);stroke-width:2"/><text class="xs mute" x="16" y="190">Black ticks: DeepSeek-V3 at 671B stored and 37B used.</text>`;
        f.q('#g').innerHTML = g;
        st.set('t', bil(total), 'about ' + fmt.n(total / 1e9, 0) + ' GB in FP8'); st.set('a', bil(act), pct(act / total) + ' of the total'); st.set('w', kit.sci(cm, 1), E + ' choose ' + k);
        c.mission.set(total >= 600e9 && act <= 40e9);
      }
      c.slider({ label: 'Experts per layer', values: [8, 16, 64, 128, 256, 512], value: 8, fmt: v => v, onInput: v => { E = v; draw(); } });
      const sK = c.slider({ label: 'Experts used per token', values: [1, 2, 4, 8, 16], value: 2, fmt: v => v, onInput: v => { k = v; draw(); } });
      const sW = c.seg({ label: 'Width of each expert', options: [['1024', '1024'], ['2048', '2048'], ['4096', '4096'], ['8192', '8192']], value: '8192', onChange: v => { w = +v; draw(); } });
      c.toggle({ label: 'Add a shared expert', value: true, onChange: v => { sh = v; draw(); } });
      c.note('Toy: hidden size 7168, 58 MoE layers and 14.5B parameters outside the experts. With 256 experts of width 2048, 8 used and one shared, this matches DeepSeek-V3.');
      draw();
      c.demo(1500, async () => { E = 256; k = 8; w = 2048; sK.set(8, true); sW.set('2048'); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'touch', tag: 'Inference',
    title: 'A big batch wakes almost every expert',
    alt: 'A grid of 256 squares, one per expert in a layer. A square is lit when at least one token in the batch uses that expert. A slider sets the batch size. At batch 1 eight squares are lit. By batch 128 nearly all are. Counters show how many experts are touched, how many gigabytes of weights one step reads and the time to read them on 16 GPUs.',
    text: 'Each token picks 8 of 256 experts, so one token needs about **37 GB** of weights. A batch needs every expert **any** of its tokens picked, and different tokens pick different ones. By a batch of 128 tokens nearly every expert is hit, so each step reads close to all **671 GB**. The weight-reading advantage of MoE **fades as the batch grows**.',
    hint: 'Raise the batch size and watch the grid fill.',
    mission: 'Find a batch size that touches at least 90% of the experts.',
    takeaway: 'MoE is cheapest at tiny batches. A busy server reads nearly all the weights on every step.',
    mount(c) {
      const E = 256, K = 8, N0 = 14.5e9, PER = 58 * 3 * 7168 * 2048, r = kit.rng(5), seen = new Set(), touched = [];
      for (let t = 0; t < 256; t++) { const s = new Set(); while (s.size < K) s.add(Math.floor(r() * E)); s.forEach(e => seen.add(e)); touched.push(new Set(seen)); }
      const f = c.fig(420, 150, '<g id="g"></g>');
      const st = c.stats([{ k: 'e', label: 'Experts touched', value: '', cls: 'cmp' }, { k: 'g', label: 'Weights read per step', value: '', cls: 'mem' }, { k: 't', label: 'Read time on 16 GPUs', value: '', cls: 'ctl' }]);
      let B = 1;
      function draw() {
        const set = touched[B - 1], n = set.size, bytes = N0 + PER * (1 + n);
        let g = '<text class="b sm" x="16" y="18">256 experts in one layer. Lit: used by at least one token.</text>';
        for (let i = 0; i < E; i++) g += `<rect class="${set.has(i) ? 'f-cmp' : 'well'}" x="${(16 + (i % 32) * 12.1).toFixed(1)}" y="${(28 + Math.floor(i / 32) * 12.1).toFixed(1)}" width="9.4" height="9.4" rx="2"/>`;
        g += `<text class="xs" x="16" y="142">Batch ${B}: ${n} of 256 experts touched, ${pct(n / E)}.</text>`;
        f.q('#g').innerHTML = g;
        st.set('e', n + ' of 256', pct(n / E) + ' of the experts'); st.set('g', fmt.n(bytes / 1e9, 0) + ' GB', 'shared + non-expert + ' + n + ' experts'); st.set('t', (bytes / (16 * 3.35e12) * 1e3).toFixed(1) + ' ms', 'at 3.35 TB/s per GPU');
        c.mission.set(n / E >= 0.9);
      }
      const sl = c.slider({ label: 'Tokens in the batch', values: [1, 2, 4, 8, 16, 32, 64, 128, 256], value: 1, fmt: v => v, onInput: v => { B = v; draw(); } });
      c.note('Toy: tokens pick 8 distinct experts at random and equally often. Real routing is uneven, which touches somewhat fewer experts. Weights are in FP8.');
      draw();
      c.play(async () => { for (const v of [1, 2, 4, 8, 16, 32, 64, 128]) { B = v; sl.set(v, true); draw(); await c.wait(280); } await c.wait(300); B = 1; sl.set(1, true); draw(); });
      c.demo(1500, async () => { B = 128; sl.set(128, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'intensity', tag: 'Inference',
    title: 'Each expert needs about 300 tokens to be worth reading',
    alt: 'A log-log roofline chart of achievable compute against the tokens routed to one expert. The line rises while memory-bound and flattens at the FP8 peak near 300 tokens. A marker shows the current tokens per expert. A slider sets the global batch and a selector picks the routing of DeepSeek-V3, Mixtral or Llama 4. Counters show tokens per expert, the share of peak reached and the batch needed to reach the knee.',
    text: 'An expert’s matrix multiply does **2 FLOPs per weight per token**, so at FP8 its [[arithmetic intensity|intensity]] is about **2 × tokens** FLOPs per byte. An H100 needs about **590 FLOPs per byte** to be compute-bound, so each expert needs roughly **300 tokens** in the step. With 8 of 256 experts used, tokens per expert is **batch ÷ 32**, so DeepSeek-V3 needs about **9,400 tokens** in flight to fill its experts.',
    hint: 'Raise the batch, then compare the three routings.',
    mission: 'Reach compute-bound experts with DeepSeek-V3 routing.',
    takeaway: 'Sparse models need very large batches to use the chip well. That is why they are served across many GPUs.',
    mount(c) {
      const PEAK = 1979, BWT = 3.35, KNEE = PEAK / (2 * BWT), RT = { ds: { E: 256, k: 8 }, mix: { E: 8, k: 2 }, l4: { E: 128, k: 1 } };
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 1, xmax: 1e4, ymin: 1, ymax: 4000, xlog: true, ylog: true, xt: [1, 10, 100, 1000, 10000], xf: v => fmt.n(v, 0), yt: [10, 100, 1000], yf: v => fmt.n(v, 0), xlabel: 'Tokens routed to one expert in a step', ylabel: 'TFLOPS reached' });
      const pts = Array.from({ length: 61 }, (_, i) => { const T = Math.pow(1e4, i / 60); return [ch.X(T), ch.Y(Math.min(PEAK, 2 * BWT * T))]; });
      const f = c.fig(420, 188, `<rect class="f-bad" x="${ch.x0}" y="${ch.y0}" width="${(ch.X(KNEE) - ch.x0).toFixed(1)}" height="${ch.y1 - ch.y0}" style="opacity:.1"/><rect class="f-ok" x="${ch.X(KNEE).toFixed(1)}" y="${ch.y0}" width="${(ch.x1 - ch.X(KNEE)).toFixed(1)}" height="${ch.y1 - ch.y0}" style="opacity:.1"/>` + ch.svg + `<text class="xs mute" x="${ch.x0 + 6}" y="${ch.y1 - 6}">memory-bound</text><text class="xs mute" x="${ch.x1 - 6}" y="${ch.y1 - 6}" text-anchor="end">compute-bound</text><path class="s-cmp s3" fill="none" d="${kit.path(pts)}"/><g id="m"></g>`);
      const st = c.stats([{ k: 't', label: 'Tokens per expert', value: '', cls: 'cmp' }, { k: 'p', label: 'Share of peak', value: '', cls: 'ok' }, { k: 'n', label: 'Batch to reach 300 each', value: '', cls: 'ctl' }]);
      let Bt = 64, rt = 'ds';
      function draw() {
        const { E, k } = RT[rt], T = Bt * k / E, perf = Math.min(PEAK, 2 * BWT * T), x = ch.X(Math.max(1, Math.min(1e4, T)));
        f.q('#m').innerHTML = `<line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(Math.max(1, perf)).toFixed(1)}" r="5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/>`;
        st.set('t', T < 10 ? T.toFixed(2) : fmt.n(T, 0), Bt + ' × ' + k + ' ÷ ' + E); st.set('p', pct(perf / PEAK), T >= KNEE ? 'compute-bound' : 'memory-bound'); st.set('n', fmt.n(Math.ceil(KNEE * E / k), 0), 'knee at about 295 tokens');
        c.mission.set(rt === 'ds' && T >= KNEE);
      }
      const sl = c.slider({ label: 'Tokens in flight, whole system', min: 1, max: 65536, log: true, round: true, value: 64, fmt: v => fmt.n(v, 0), onInput: v => { Bt = v; draw(); } });
      c.seg({ label: 'Routing', options: [['ds', 'DeepSeek-V3: 8 of 256'], ['mix', 'Mixtral: 2 of 8'], ['l4', 'Llama 4: 1 of 128']], value: 'ds', onChange: v => { rt = v; draw(); } });
      c.note('Roofline for FP8 weights on an H100: 1,979 TFLOPS dense and 3.35 TB/s. In BF16 the weights double in size and the peak halves, so the knee stays near 300 tokens. Real kernels reach a fraction of peak.');
      draw();
      c.demo(1500, async () => { Bt = 16384; sl.set(16384, true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'balance', tag: 'Training',
    title: 'Without balancing, a few experts win everything',
    alt: 'Sixteen bars show how much load each expert gets, as a multiple of the average, with a dashed line at 1. Below, two lines show the busiest expert over 100 training steps, one without balancing and one with a routing bias. A slider sets the training step and a switch turns the bias on. Without balancing, two experts end up with all the tokens. With the bias, every expert stays close to the average.',
    text: 'An expert that gets more tokens **trains more**, gets better, and then attracts **even more tokens**. Left alone, a router collapses onto a few experts and the rest go idle. DeepSeek-V3 adds a **bias to each expert’s routing score**. After every step the bias of overloaded experts is nudged **down** and underused ones **up**. No extra loss term is needed.',
    hint: 'Train to step 100 with and without the bias.',
    mission: 'After 100 steps, keep every expert between 0.5 and 1.5 times the average load.',
    takeaway: 'Routing collapses on its own. A small bias nudged after each step keeps every expert in use.',
    mount(c) {
      const E = 16, K = 2, N = 256, STEPS = 100, MEAN = N * K / E;
      function sim(bal) {
        const r = kit.rng(3), s = Array.from({ length: E }, () => 0.25 * kit.gauss(r)), b = new Array(E).fill(0), hist = [];
        for (let t = 0; t <= STEPS; t++) {
          const loads = new Array(E).fill(0);
          for (let i = 0; i < N; i++) { const sc = s.map((v, e) => v + b[e] + kit.gauss(r)), idx = sc.map((v, e) => e).sort((x, y) => sc[y] - sc[x]).slice(0, K); idx.forEach(e => { loads[e]++; }); }
          hist.push({ loads, max: Math.max(...loads) / MEAN, min: Math.min(...loads) / MEAN });
          for (let e = 0; e < E; e++) { s[e] += 0.018 * (loads[e] / MEAN - 1); if (bal) b[e] -= 0.03 * Math.sign(loads[e] - MEAN); }
        }
        return hist;
      }
      const H = { off: sim(false), on: sim(true) };
      const ch = kit.chart({ x: 40, y: 160, w: 364, h: 62, xmin: 0, xmax: STEPS, ymin: 0, ymax: 8, xt: [0, 50, 100], yt: [1, 4, 8], xlabel: 'Training step', ylabel: 'Busiest expert ÷ average' });
      const f = c.fig(420, 266, ch.svg + '<g id="g"></g>');
      c.legend([['ok', 'Within 0.5 to 1.5 times average'], ['bad', 'Overloaded'], ['warn', 'Starved']]);
      const st = c.stats([{ k: 'a', label: 'Busiest expert', value: '', cls: 'bad' }, { k: 'b', label: 'Idlest expert', value: '', cls: 'warn' }, { k: 'u', label: 'Experts in use', value: '', cls: 'ok' }]);
      let step = 0, bal = false;
      function draw() {
        const h = H[bal ? 'on' : 'off'][step], mx = 8.2; let g = '<text class="b sm" x="16" y="16">Load on each expert, as a multiple of the average</text>';
        h.loads.forEach((v, i) => { const q = v / MEAN, ht = Math.max(2, q / mx * 90); g += `<rect class="${q > 1.5 ? 'f-bad' : q < 0.5 ? 'f-warn' : 'f-ok'}" x="${(16 + i * 24).toFixed(1)}" y="${(112 - ht).toFixed(1)}" width="18" height="${ht.toFixed(1)}" rx="3"/>`; });
        const y1 = 112 - 1 / mx * 90;
        g += `<line class="axis" x1="12" x2="404" y1="112" y2="112"/><line class="ln dash" x1="12" x2="404" y1="${y1.toFixed(1)}" y2="${y1.toFixed(1)}"/><text class="xs mute" x="16" y="130">16 experts, each token picks 2. Dashed line: the average load.</text>`;
        const line = (k, cls, op, upto) => `<path class="${cls} s2" fill="none" d="${kit.path(H[k].slice(0, upto + 1).map((o, t) => [ch.X(t), ch.Y(o.max)]))}" style="opacity:${op}"/>`;
        g += line('off', 's-bad', bal ? 0.3 : 1, bal ? STEPS : step) + line('on', 's-ok', bal ? 1 : 0.3, bal ? step : STEPS);
        g += `<line class="ln dash" x1="${ch.X(step).toFixed(1)}" x2="${ch.X(step).toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/>`;
        f.q('#g').innerHTML = g;
        const used = h.loads.filter(v => v / MEAN > 0.05).length;
        st.set('a', h.max.toFixed(1) + '×', h.max > 1.5 ? 'overloaded' : 'within range'); st.set('b', h.min.toFixed(2) + '×', h.min < 0.5 ? 'starved' : 'within range'); st.set('u', used + ' of ' + E, step ? 'at step ' + step : 'before training');
        c.mission.set(bal && step === STEPS && h.max <= 1.5 && h.min >= 0.5);
      }
      const sl = c.slider({ label: 'Training step', min: 0, max: STEPS, step: 1, value: 0, fmt: v => v, onInput: v => { step = v; draw(); } });
      const tg = c.toggle({ label: 'Balance with a routing bias', value: false, onChange: v => { bal = v; draw(); } });
      c.note('Toy: 16 experts, 256 tokens per step, each expert’s score rises with the load it gets. Steps are arbitrary units, not real training steps.');
      draw();
      c.play(async () => { await c.wait(400); await c.tween(2600, p => { step = Math.round(p * STEPS); sl.set(step, true); draw(); }, c.ease.io); await c.wait(500); step = 0; sl.set(0, true); draw(); });
      c.demo(4500, async () => { bal = true; tg.set(true); step = STEPS; sl.set(STEPS, true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'a2a', tag: 'Inference',
    title: 'Sending tokens to experts costs more than computing them',
    alt: 'Two horizontal bars compare, for one MoE layer on one GPU, the time of the all-to-all that sends tokens to their experts and back with the time of the expert math. Controls pick the system, the number of GPUs that share the experts, the tokens per GPU and whether each token is limited to 4 nodes. Counters show the ratio of the two times, the traffic per GPU and the weights each GPU must hold.',
    text: 'With experts spread over EP GPUs, every token goes through an [[all-to-all]]: it is **sent to 8 destinations and back**. For DeepSeek-V3 that is 7168 values per copy, 1 byte out and 2 bytes back, so about **172 KB per token per layer**. Between 8-GPU nodes that traffic crosses a **50 GB/s** link. Inside one NVLink domain it stays on links that are **9 to 18 times faster**. Limiting each token to 4 nodes also cuts the slow traffic.',
    hint: 'Compare the two systems, then limit tokens to 4 nodes.',
    mission: 'Make the all-to-all no longer than the expert math, with the weights fitting on each GPU.',
    takeaway: 'The all-to-all decides how well experts spread. Wide NVLink domains and node-limited routing keep it off slow links.',
    mount(c) {
      const H = 7168, K = 8, F8 = 1979e12, FFN = 2048, EXP = 653.9e9, REST = 17.05e9;
      const SYS = { h100: 72e9, rack: 170e9 };
      function calc(sys, EP, T, limit) {
        const per = T * K * H * 3; let bi, bx, bwI = 450e9;
        if (sys === 'rack') { bi = per * (EP - 1) / EP; bx = 0; bwI = 900e9; }
        else { bi = per * Math.min(7, EP - 1) / EP; bx = per * Math.max(0, EP - 8) / EP; if (limit && EP > 8) bx = T * Math.min(3, EP / 8 - 1) * H * 3; }
        const lat = 2 * (sys === 'h100' && EP > 8 ? 25e-6 : 10e-6), comm = Math.max(bi / bwI, bx / 50e9) + lat, comp = T * K * 2 * 3 * H * FFN / (0.5 * F8), w = EXP / EP + REST;
        return { comm, comp, ratio: comm / comp, mb: (bi + bx) / 1e6, w, fits: w <= SYS[sys] };
      }
      const f = c.fig(420, 150, '<g id="g"></g>');
      const st = c.stats([{ k: 'r', label: 'All-to-all ÷ expert math', value: '', cls: 'bad' }, { k: 't', label: 'Traffic per GPU, per layer', value: '', cls: 'mem' }, { k: 'w', label: 'Weights per GPU', value: '', cls: 'ctl' }]);
      let sys = 'h100', EP = 16, T = 256, limit = false;
      function draw() {
        const o = calc(sys, EP, T, limit), mx = Math.max(o.comm, o.comp) * 1.08, us = v => v * 1e6 < 10 ? (v * 1e6).toFixed(1) : fmt.n(v * 1e6, 0);
        f.q('#g').innerHTML = kit.bar(16, 34, 388, 16, o.comm / mx, o.ratio <= 1 ? 'f-ok' : 'f-bad', 'All-to-all, send and return', us(o.comm) + ' µs') + kit.bar(16, 84, 388, 16, o.comp / mx, 'f-mem', 'Expert math, FP8 at half of peak', us(o.comp) + ' µs') +
          `<text class="xs" x="16" y="128">${o.ratio <= 1 ? 'The communication can hide behind the math.' : 'The math waits ' + ((o.comm - o.comp) * 1e6).toFixed(0) + ' µs for the network.'}</text><text class="xs ${o.fits ? 'mute' : 'b'}" x="16" y="144">${o.fits ? 'Weights fit: ' + (o.w / 1e9).toFixed(0) + ' GB of ' + (SYS[sys] / 1e9) + ' GB.' : 'Does not fit: ' + (o.w / 1e9).toFixed(0) + ' GB needed, ' + (SYS[sys] / 1e9) + ' GB usable.'}</text>`;
        st.set('r', o.ratio.toFixed(2) + '×', o.ratio <= 1 ? 'hidden' : 'exposed'); st.set('t', o.mb.toFixed(0) + ' MB', T + ' tokens × 8 copies × 3 bytes × 7168'); st.set('w', (o.w / 1e9).toFixed(0) + ' GB', o.fits ? 'fits' : 'does not fit');
        c.mission.set(o.fits && o.ratio <= 1);
      }
      c.seg({ label: 'System', options: [['h100', '8-GPU H100 nodes, InfiniBand between'], ['rack', '72-GPU NVLink rack']], value: 'h100', onChange: v => { sys = v; draw(); } });
      c.slider({ label: 'GPUs sharing the experts (EP)', values: [8, 16, 32, 64, 72], value: 16, fmt: v => v, onInput: v => { EP = v; draw(); } });
      c.slider({ label: 'Tokens per GPU', values: [16, 64, 256, 1024], value: 256, fmt: v => v, onInput: v => { T = v; draw(); } });
      const tg = c.toggle({ label: 'Limit each token to 4 nodes', value: false, onChange: v => { limit = v; draw(); } });
      c.note('Toy: 450 GB/s NVLink in H100 nodes, 50 GB/s InfiniBand, 900 GB/s NVLink in the rack, 10 to 25 µs latency per collective, 170 GB usable per rack GPU. It ignores overlap between two micro-batches. DeepSeek-V3 limits each token to 4 nodes.');
      draw();
      c.demo(1500, async () => { limit = true; tg.set(true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'DeepSeek-V3 stores 671B parameters and uses 37B per token. What does the 671B decide?', o: ['The memory needed for the weights', 'The compute per token', 'The context length', 'The number of layers'], a: 0, why: 'Every expert must be in memory even if a given token skips it. Compute follows the 37B that actually run.' },
      { q: 'What does the router in an MoE layer do?', o: ['Splits the sequence across GPUs', 'Scores the experts for each token and picks the top few', 'Compresses the KV cache', 'Rounds weights to fewer bits'], a: 1, why: 'The router is a small network that gives each expert a score for the token. The top k experts run and their outputs are combined.' },
      { q: 'With 256 experts and 8 per token, about how many experts does a batch of 128 tokens touch?', o: ['About 8', 'About 32', 'About 128', 'Nearly all of them'], a: 3, why: 'The chance an expert is missed by all 128 tokens is (1 − 8/256)^128, about 2%. So roughly 98% of experts are hit.' },
      { q: 'Why does MoE decode lose its weight-reading advantage at large batch?', o: ['Experts get slower', 'The router needs more time', 'More experts are touched, so more weights are read each step', 'The KV cache stops growing'], a: 2, why: 'One token reads 37 GB. A big batch reads nearly all 671 GB, so the per-step read time approaches that of a dense model of the full size.' },
      { q: 'About how many tokens must one expert receive per step to be compute-bound on an H100?', o: ['About 3', 'About 300', 'About 30', 'About 30,000'], a: 1, why: 'Intensity is about 2 × tokens FLOPs per byte, and the H100 ridge is near 590. So the knee is near 300 tokens per expert.' },
      { q: 'What happens to an MoE router during training if nothing balances the load?', o: ['It picks experts evenly', 'Every expert becomes identical', 'The loss drops to zero', 'A few experts get more tokens, improve, and win even more'], a: 3, why: 'More tokens mean more training for that expert, which raises its score. The rich get richer and the others go idle.' },
      { q: 'How does DeepSeek-V3’s auxiliary-loss-free balancing work?', o: ['It adds a per-expert bias to routing scores, raised for underused experts and lowered for overloaded ones', 'It drops tokens above a capacity', 'It trains a second model to route', 'It copies every expert to every GPU'], a: 0, why: 'The bias only changes which experts are picked. After each step it moves toward the experts that were underused.' },
      { q: 'Why does expert parallelism favor a large NVLink domain?', o: ['NVLink compresses tokens', 'Every token is sent to many GPUs, so slow links become the bottleneck', 'Experts must share one chip', 'InfiniBand cannot carry tokens'], a: 1, why: 'Each token fans out to 8 experts and comes back. That volume fits NVLink bandwidth but strains the 50 GB/s links between nodes.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + Array.from({ length: 48 }, (_, i) => { const x = 40 + (i % 12) * 20, y = 34 + Math.floor(i / 12) * 20, on = [5, 14, 22, 33, 41].includes(i); return `<rect x="${x}" y="${y}" width="15" height="15" rx="3" style="fill:${on ? 'var(--cmp)' : 'var(--well)'};opacity:${on ? 1 : 0.8}"/>`; }).join('')
    + '</g><text x="40" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">8 of 256 experts per token</text></svg>';

  window.LESSONS.push({
    id: 'moe', n: 12, track: 'inference', order: 6,
    title: 'Mixture of Experts',
    tagline: 'Big memory, small compute: how routers pick experts, why batches wake them all, and what the all-to-all costs.',
    preview,
    scenes: S
  });
})();
