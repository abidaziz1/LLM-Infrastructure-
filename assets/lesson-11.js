/* Lesson 11: Splitting a model across GPUs for inference. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';

  /* Shared timing model. Toy values: one H100 reads 3.35 TB/s and has 72 GB usable. */
  const BW = 3350e9, USE = 72e9, F8 = 1979e12, F16 = 989e12, MFU = 0.6;
  const M70 = { P: 70e9, layers: 80, hid: 8192, kv: 2 * 80 * 8 * 128 * 2 };
  const M405 = { P: 405e9, layers: 126, hid: 16384, kv: 2 * 126 * 8 * 128 * 2 };
  /* One all-reduce on N GPUs: a launch cost, one latency per hop, and the data. Past 8 GPUs the ring crosses InfiniBand. */
  function arTime(N, m, hop) {
    if (N <= 1) return 0;
    const ib = N > 8, a = ib ? 2 * hop : hop, b = ib ? 50e9 : 450e9;
    return 5e-6 + 2 * (N - 1) * a + 2 * (N - 1) / N * m / b;
  }
  /* Time for one token to pass through the whole replica, plus memory per GPU. B users share the replica, each with L tokens of context. */
  function pass(M, wb, TP, PP, B, L, hop) {
    const W = M.P * wb, mem = (W / TP + B * M.kv * L / (TP * PP)) / BW;
    const comp = 2 * M.P * B / (TP * PP * (wb <= 1 ? F8 : F16) * MFU);
    const m = B / PP * M.hid * 2, comm = M.layers * 2 * arTime(TP, m, hop) + (PP - 1) * (5e-6 + m / 50e9);
    return { t: Math.max(mem, comp) + comm, mem, comp, comm, gb: (W + B * M.kv * L) / (TP * PP) / 1e9 };
  }

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'fit', tag: 'Why split',
    title: 'Memory sets the smallest number of GPUs',
    alt: 'A grid of GPU slots in rows of eight, one row per node. Slots in use show how much of the 72 GB of usable memory the weights and the KV cache take. Controls choose the model and the weight format. Counters show weights, KV cache, the GPU count needed and the ideal decode speed on that many GPUs.',
    text: 'An 80 GB GPU has about **72 GB usable** once the runtime takes its share. **Weights plus KV cache must fit across the GPUs**, and the count is usually rounded up to 1, 2, 4, 8 or 16 so the attention heads divide evenly. More GPUs also add up their **memory bandwidth**, so the ideal decode time falls as 1 ÷ N.',
    hint: 'Try the 405B model in each format.',
    mission: 'Fit the 405B model on one 8-GPU node.',
    takeaway: 'Bytes decide the GPU count. Fewer bits per weight can mean one node instead of two.',
    mount(c) {
      const MD = { 8: { P: 8e9, kv: 2 * 32 * 8 * 128 * 2 }, 70: { P: 70e9, kv: M70.kv }, 405: { P: 405e9, kv: M405.kv }, 671: { P: 671e9, kv: 70272 } };
      const f = c.fig(420, 164, '<g id="g"></g>');
      c.legend([['mem', 'Weights'], ['data', 'KV cache, 16 users at 8K tokens']]);
      const st = c.stats([{ k: 'w', label: 'Weights', value: '', cls: 'mem' }, { k: 'k', label: 'KV cache', value: '', cls: 'data' }, { k: 'n', label: 'GPUs needed', value: '', cls: 'cmp' }, { k: 'd', label: 'Ideal decode, one user', value: '', cls: 'ctl' }]);
      let key = 70, bytes = 2;
      function draw() {
        const m = MD[key], W = m.P * bytes, KV = 16 * 8192 * m.kv, need = W + KV, raw = need / USE, N = [1, 2, 4, 8, 16, 32, 64].find(v => v >= Math.ceil(raw));
        let g = '';
        for (let k = 0; k < 32; k++) {
          const x = 16 + (k % 8) * 40, y = 20 + Math.floor(k / 8) * 26, used = k < N;
          g += `<rect class="well" x="${x}" y="${y}" width="34" height="18" rx="4"/>`;
          if (used) { const fw = 34 * W / N / USE, fk = 34 * KV / N / USE; g += `<rect class="f-mem" x="${x}" y="${y}" width="${Math.max(1, fw).toFixed(1)}" height="18" rx="4"/><rect class="f-data" x="${(x + fw).toFixed(1)}" y="${y}" width="${Math.max(1, fk).toFixed(1)}" height="18" rx="2"/>`; }
        }
        for (let r = 0; r < 4; r++) g += `<text class="xs mute" x="344" y="${20 + r * 26 + 13}">Node ${r + 1}</text>`;
        g += `<text class="xs" x="16" y="136">Needs ${fmt.n(need / 1e9, 0)} GB. At 72 GB per GPU that is ${raw.toFixed(1)} GPUs, rounded up to ${N}.</text><text class="xs mute" x="16" y="154">Each slot is one GPU. The bar inside shows how full its 72 GB is.</text>`;
        f.q('#g').innerHTML = g;
        st.set('w', fmt.n(W / 1e9, 0) + ' GB', MD[key].P / 1e9 + 'B × ' + bytes + ' bytes'); st.set('k', fmt.n(KV / 1e9, 0) + ' GB', fmt.bytes(m.kv, 0) + ' per token');
        st.set('n', N + ' GPUs', N <= 8 ? 'one node' : N / 8 + ' nodes'); st.set('d', (N * BW / W).toFixed(0) + ' tok/s', N + ' × 3.35 TB/s ÷ weights');
        c.mission.set(key === 405 && N <= 8);
      }
      c.seg({ label: 'Model', options: [['8', '8B'], ['70', '70B'], ['405', '405B'], ['671', '671B MoE']], value: '70', onChange: v => { key = +v; draw(); } });
      const sF = c.seg({ label: 'Weight format', options: [['2', 'BF16'], ['1', 'FP8'], ['0.5', 'INT4']], value: '2', onChange: v => { bytes = +v; draw(); } });
      c.note('KV per token: 8B, 70B and 405B store 8 KV heads of 128 dims. The 671B model uses multi-head latent attention, which keeps the cache near 70 KB per token. MoE models store all experts even though each token uses a few.');
      draw();
      c.demo(1500, async () => { key = 405; bytes = 1; sF.set('1'); draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'four', tag: 'Four ways to split',
    title: 'Four ways to split a model and what each one sends',
    alt: 'Four small pictures. Tensor parallel cuts each matrix into four column strips. Pipeline parallel stacks four layer groups with arrows between them. Expert parallel spreads eight experts over four GPUs. Data parallel shows two full copies. Below, four splits on the left and four descriptions of what travels between GPUs on the right, in a different order. Clicking a split and then a description pairs them.',
    text: 'Each split trades memory, speed and traffic differently. [[tensor parallelism|TP]] cuts every matrix. [[pipeline parallelism|PP]] cuts the stack of layers. [[expert parallelism|EP]] spreads the experts of a mixture-of-experts model. [[replica|DP replicas]] copy the whole model. What each one **sends between GPUs** decides which link it needs.',
    hint: 'Click a split, then what it sends. Pair all four.',
    mission: 'Pair every split with what it sends.',
    takeaway: 'TP sends the most and needs the fastest link. PP and DP tolerate slow links. EP needs all-to-all bandwidth.',
    mount(c) {
      const gp = ['f-data', 'f-mem', 'f-cmp', 'f-ctl'];
      const panel = (k, body, name, sub) => `<g class="pn" id="p${k}" style="opacity:0"><rect class="box" x="${16 + k * 100}" y="16" width="88" height="76" rx="8"/>${body}<text class="sm b" x="${60 + k * 100}" y="110" text-anchor="middle">${name}</text><text class="xs mute" x="${60 + k * 100}" y="126" text-anchor="middle">${sub}</text></g>`;
      let tp = '', pp = '', ep = '', dp = '';
      for (let i = 0; i < 4; i++) tp += `<rect class="${gp[i]}" x="${24 + i * 18}" y="24" width="16" height="60" rx="3"/>`;
      for (let i = 0; i < 4; i++) { pp += `<rect class="${gp[i]}" x="${124}" y="${24 + i * 16}" width="72" height="12" rx="3"/>`; if (i < 3) pp += `<path class="ink-s" fill="none" d="M160 ${37 + i * 16} v3" style="stroke-width:1.6"/>`; }
      for (let i = 0; i < 8; i++) ep += `<rect class="${gp[Math.floor(i / 2)]}" x="${224 + (i % 4) * 18}" y="${30 + Math.floor(i / 4) * 28}" width="14" height="22" rx="3"/>`;
      dp += `<rect class="f-data" x="326" y="24" width="32" height="60" rx="4"/><rect class="f-mem" x="364" y="24" width="32" height="60" rx="4"/>`;
      const f = c.fig(420, 134, panel(0, tp, 'TP', 'matrices') + panel(1, pp, 'PP', 'layers') + panel(2, ep, 'EP', 'experts') + panel(3, dp, 'DP', 'whole copies'));
      c.legend([['data', 'Each color is one GPU or one group of GPUs']]);
      const left = ['Tensor parallel (TP)', 'Pipeline parallel (PP)', 'Expert parallel (EP)', 'Data parallel (DP) replicas'];
      const right = ['Two all-reduces per layer, for every token', 'Activations, once per stage boundary', 'Tokens to their experts and back, all-to-all', 'Nothing between replicas'];
      const nt = c.note('');
      const mt = kit.matcher(c, { left, right, answer: [0, 1, 2, 3], order: [2, 0, 3, 1], onChange: s => {
        c.mission.set(s.all && s.good === 4);
        nt.textContent = !s.all ? 'Pair every split. Click a linked item to unlink it.' : s.good === 4 ? 'All four match. TP needs NVLink. PP and DP can cross nodes. EP needs strong all-to-all bandwidth.' : s.good + ' of 4 match. Click a red item to unlink it and try again.';
      } });
      c.btn('Start over', () => mt.reset(), { small: true });
      c.play(async () => { for (let k = 0; k < 4; k++) { const el = f.q('#p' + k); await c.tween(380, p => { el.style.opacity = p; el.setAttribute('transform', `translate(0 ${((1 - p) * 8).toFixed(1)})`); }, c.ease.io); } });
      c.demo(2500, async () => { mt.solve(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'ab', tag: 'The cost of talking',
    title: 'A small message still pays the full latency',
    alt: 'A log-log chart of time against message size. A flat line shows the fixed latency. A rising line shows the transfer time, size divided by bandwidth. A bold curve shows their sum. A vertical marker shows the chosen message size. Controls set the size, the link and the latency. Counters show the latency, the transfer time and which one dominates.',
    text: 'Sending n bytes costs **latency + n ÷ bandwidth**. Below a few hundred kilobytes the **latency** dominates and a faster link does not help. A decode step moves only **batch × hidden × 2 bytes** per all-reduce: 16 KB for one user, about 1 MB for 64. Those are the sizes where **latency**, not bandwidth, sets the cost.',
    hint: 'Slide the size until the two costs meet.',
    mission: 'Find a size where transfer time and latency are about equal.',
    takeaway: 'For small messages, bandwidth is irrelevant. Fewer, larger messages and lower latency are what help.',
    mount(c) {
      const ch = kit.chart({ x: 52, y: 26, w: 352, h: 118, xmin: 1e3, xmax: 1e9, ymin: 1, ymax: 1e4, xlog: true, ylog: true, xt: [1e3, 1e5, 1e7, 1e9], xf: v => fmt.bytes(v, 0), yt: [10, 100, 1000, 10000], yf: v => fmt.n(v, 0), xlabel: 'Message size', ylabel: 'Microseconds' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      c.legend([['cmp', 'Latency'], ['mem', 'Transfer'], ['data', 'Total']]);
      const st = c.stats([{ k: 'a', label: 'Latency', value: '', cls: 'cmp' }, { k: 'b', label: 'Transfer', value: '', cls: 'mem' }, { k: 'r', label: 'Dominated by', value: '', cls: 'data' }]);
      let n = 1e6, link = 'nv', alpha = 5;
      const bw = () => link === 'nv' ? 450e9 : 50e9;
      function draw() {
        const xs = Array.from({ length: 61 }, (_, i) => Math.pow(10, 3 + i * 6 / 60)), b = bw();
        const lat = [[ch.X(1e3), ch.Y(alpha)], [ch.X(1e9), ch.Y(alpha)]], tr = xs.map(x => [ch.X(x), ch.Y(Math.max(1, x / b * 1e6))]), tot = xs.map(x => [ch.X(x), ch.Y(alpha + x / b * 1e6)]);
        const tA = alpha, tB = n / b * 1e6, x = ch.X(n);
        f.q('#g').innerHTML = `<path class="s-cmp s2 dash" fill="none" d="${kit.path(lat)}"/><path class="s-mem s2" fill="none" d="${kit.path(tr)}"/><path class="s-data s3" fill="none" d="${kit.path(tot)}"/><line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(tA + tB).toFixed(1)}" r="5" class="f-data" style="stroke:var(--stage);stroke-width:2"/>`;
        st.set('a', tA.toFixed(1) + ' µs', 'fixed per message'); st.set('b', tB < 10 ? tB.toFixed(2) + ' µs' : fmt.n(tB, 0) + ' µs', fmt.bytes(n, 0) + ' ÷ ' + (b / 1e9) + ' GB/s');
        st.set('r', tB < tA / 2 ? 'latency' : tB > tA * 2 ? 'bandwidth' : 'both about equal', 'transfer ÷ latency = ' + (tB / tA).toFixed(2));
        c.mission.set(tB / tA >= 0.5 && tB / tA <= 2);
      }
      const sl = c.slider({ label: 'Message size', min: 1e3, max: 1e9, log: true, round: true, value: 1e6, fmt: v => fmt.bytes(v, v < 1e4 ? 1 : 0), onInput: v => { n = v; draw(); } });
      c.seg({ label: 'Link', options: [['nv', 'NVLink, 450 GB/s'], ['ib', 'InfiniBand, 50 GB/s']], value: 'nv', onChange: v => { link = v; draw(); } });
      c.slider({ label: 'Latency per message', values: [1, 2, 5, 10, 20], value: 5, fmt: v => v + ' µs', onInput: v => { alpha = v; draw(); } });
      const row = c.row();
      c.btn('Decode, 1 user', () => { n = 16384; sl.set(n, true); draw(); }, { small: true, into: row });
      c.btn('Decode, 64 users', () => { n = 1048576; sl.set(n, true); draw(); }, { small: true, into: row });
      c.btn('Prefill, 8K tokens', () => { n = 134217728; sl.set(n, true); draw(); }, { small: true, into: row });
      c.note('Message sizes are for a model with hidden size 8192 and 2-byte activations. Latency values are assumptions: real systems vary with kernels and software.');
      draw();
      c.demo(1500, async () => { n = 2e6; sl.set(n, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'tpdec', tag: 'Tensor parallel',
    title: 'Tensor parallelism helps decode until communication dominates',
    alt: 'Five horizontal bars, one per tensor-parallel degree from 1 to 16, for a 70B model in FP8. Each bar is the time to produce one token: blue for reading weights and KV cache, red for communication. A black tick marks the ideal time with no communication. Degree 1 is marked as not fitting when memory is too small. A selector picks a degree, and a slider sets the latency of each hop.',
    text: 'Splitting the weights over TP GPUs cuts the **read time** to 1 ÷ TP. But every layer ends with **two all-reduces**, and each one pays the latency from the last scene. Inside a node the saving beats that fixed cost. Past 8 GPUs the ring crosses **InfiniBand**, and communication outweighs the reads.',
    hint: 'Pick a degree, then raise the hop latency.',
    mission: 'Pick the tensor-parallel degree with the fastest token.',
    takeaway: 'Ideal speed-up is 1 ÷ TP. Real speed-up flattens near 8 GPUs because communication does not shrink.',
    mount(c) {
      const TPS = [1, 2, 4, 8, 16], L = 4096;
      const f = c.fig(420, 204, '<g id="g"></g>');
      c.legend([['mem', 'Reading weights and KV cache'], ['bad', 'Communication']]);
      const st = c.stats([{ k: 't', label: 'Token time', value: '', cls: 'ctl' }, { k: 'c', label: 'Communication share', value: '', cls: 'bad' }, { k: 'e', label: 'Share of ideal speed', value: '', cls: 'ok' }]);
      let tp = 2, hop = 1.5e-6, users = 8;
      function draw() {
        const rows = TPS.map(t => ({ t, r: pass(M70, 1, t, 1, users, L, hop) })), fits = rows.filter(o => o.r.gb <= 72), best = fits.reduce((a, b) => b.r.t < a.r.t ? b : a);
        const X0 = 62, W = 290, mx = Math.max(10e-3, ...fits.map(o => o.r.t)) * 1.04;
        let g = '<text class="b sm" x="16" y="16">Milliseconds to produce one token, 70B in FP8</text>';
        rows.forEach((o, i) => {
          const y = 28 + i * 30, ok = o.r.gb <= 72, sel = o.t === tp, mw = o.r.mem / mx * W, cw = o.r.comm / mx * W, ideal = (M70.P / o.t / BW) / mx * W, op = sel ? 1 : 0.6;
          g += `<text class="xs ${sel ? 'b' : 'mute'}" x="16" y="${y + 14}">TP ${o.t}</text><rect class="well" x="${X0}" y="${y}" width="${W}" height="20" rx="5"/>`;
          if (ok) g += `<rect class="f-mem" x="${X0}" y="${y}" width="${Math.max(2, mw).toFixed(1)}" height="20" rx="5" style="opacity:${op}"/><rect class="f-bad" x="${(X0 + mw).toFixed(1)}" y="${y}" width="${Math.max(2, cw).toFixed(1)}" height="20" rx="3" style="opacity:${op}"/><line class="ln" x1="${(X0 + ideal).toFixed(1)}" x2="${(X0 + ideal).toFixed(1)}" y1="${y - 3}" y2="${y + 23}" style="stroke:var(--ink);stroke-width:2"/><text class="xs m b" x="${X0 + W + 6}" y="${y + 14}">${(o.r.t * 1e3).toFixed(1)}</text>`;
          else g += `<text class="xs mute" x="${X0 + 8}" y="${y + 14}">does not fit: ${o.r.gb.toFixed(0)} GB per GPU</text>`;
        });
        g += '<text class="xs mute" x="16" y="190">Black tick: the ideal time, weights read with no communication.</text>';
        f.q('#g').innerHTML = g;
        const sel = rows.find(o => o.t === tp), ok = sel.r.gb <= 72, ideal = M70.P / tp / BW;
        st.set('t', ok ? (sel.r.t * 1e3).toFixed(1) + ' ms' : 'does not fit', ok ? 'TP ' + tp + ', ' + users + ' users at 4K tokens' : sel.r.gb.toFixed(0) + ' GB needed per GPU');
        st.set('c', ok ? pct(sel.r.comm / sel.r.t) : '-', ok ? (sel.r.comm * 1e3).toFixed(1) + ' ms of ' + (sel.r.t * 1e3).toFixed(1) : ''); st.set('e', ok ? pct(ideal / sel.r.t) : '-', ok ? 'ideal ' + (ideal * 1e3).toFixed(1) + ' ms ÷ actual' : '');
        c.mission.set(ok && tp === best.t);
      }
      c.seg({ label: 'Tensor-parallel degree', options: TPS.map(t => [String(t), String(t)]), value: '2', onChange: v => { tp = +v; draw(); } });
      const sH = c.slider({ label: 'Latency per NVLink hop', values: [0.5, 1, 1.5, 2, 3], value: 1.5, fmt: v => v + ' µs', onInput: v => { hop = v * 1e-6; draw(); } });
      c.seg({ label: 'Users in the batch', options: [['1', '1'], ['8', '8'], ['32', '32']], value: '8', onChange: v => { users = +v; draw(); } });
      c.note('Toy model: 80 layers, 2 all-reduces per layer, 5 µs launch cost per all-reduce, InfiniBand hops cost twice as much, 450 GB/s NVLink and 50 GB/s InfiniBand. Real stacks overlap some of this.');
      draw();
      c.demo(1500, async () => { tp = 8; draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'pp', tag: 'Pipeline parallel',
    title: 'Pipeline parallelism fits the model but does not speed up one user',
    alt: 'A schedule with one row per pipeline stage and time running left to right. Numbered blocks are microbatches passing through the stages. With one microbatch only one stage works at a time. With as many microbatches as stages, every stage stays busy. With more microbatches than stages, the extra ones wait. Controls set the number of stages and microbatches. Counters show stage utilization, latency per token and throughput.',
    text: '[[pipeline parallelism|Pipeline parallelism]] gives each GPU group a few layers. A token must visit **every stage in turn**, so its latency is the **sum** of the stage times, and PP does not cut it. What PP adds is **capacity**: the weights spread over more GPUs. To keep every stage busy you need **as many microbatches in flight as stages**, each holding different users. More than that only adds waiting.',
    hint: 'Raise the microbatches until no stage idles.',
    mission: 'Keep every stage busy without adding waiting.',
    takeaway: 'PP needs microbatches equal to stages. Fewer leave stages idle. More make users wait.',
    mount(c) {
      const TS = 5, U = 16, WIN = 16, X0 = 56, CW = 352 / WIN;
      const f = c.fig(420, 188, '<g id="g"></g>');
      const st = c.stats([{ k: 'u', label: 'Stage utilization', value: '', cls: 'data' }, { k: 'l', label: 'Latency per token', value: '', cls: 'cmp' }, { k: 't', label: 'Throughput', value: '', cls: 'ok' }]);
      let P = 4, M = 1;
      const cls = ['f-data', 'f-mem', 'f-cmp'], on = ['--on-data', '--on-mem', '--on-cmp'];
      function sched() {
        const free = new Array(P).fill(0), ready = new Array(M).fill(0), blocks = [];
        for (let r = 0; r < 6; r++) for (let m = 0; m < M; m++) { let t = ready[m]; for (let s = 0; s < P; s++) { const start = Math.max(t, free[s]); free[s] = start + 1; t = start + 1; blocks.push({ s, start, m }); } ready[m] = t; }
        return blocks;
      }
      function draw() {
        const rh = 24, gap = 6; let g = '';
        for (let s = 0; s < P; s++) g += `<rect class="well" x="${X0}" y="${14 + s * (rh + gap)}" width="352" height="${rh}" rx="4"/><text class="xs m mute" x="${X0 - 6}" y="${14 + s * (rh + gap) + 16}" text-anchor="end">stage ${s + 1}</text>`;
        sched().filter(b => b.start < WIN).forEach(b => { const x = X0 + b.start * CW, y = 14 + b.s * (rh + gap); g += `<rect class="${cls[b.m % 3]}" x="${(x + 1).toFixed(1)}" y="${y}" width="${(CW - 2).toFixed(1)}" height="${rh}" rx="3"/><text class="xs b" x="${(x + CW / 2).toFixed(1)}" y="${y + 16}" text-anchor="middle" style="fill:var(${on[b.m % 3]})">${b.m + 1}</text>`; });
        const yb = 14 + P * (rh + gap) + 10;
        g += `<text class="xs mute" x="${X0}" y="${yb + 4}">time, one block = ${TS} ms</text><text class="xs mute" x="${X0}" y="${yb + 22}">Each block: one microbatch of ${U} users at one stage.</text>`;
        f.q('#g').innerHTML = g;
        const util = Math.min(M, P) / P, lat = Math.max(P, M) * TS, tps = Math.min(M, P) / (P * TS / 1e3) * U / P * P / P;
        const per = Math.min(M, P) / (P * TS) * 1000 * U;
        st.set('u', pct(util), M < P ? M + ' of ' + P + ' stages busy at once' : 'all stages busy'); st.set('l', lat + ' ms', M > P ? 'waiting adds ' + (lat - P * TS) + ' ms' : P + ' stages × ' + TS + ' ms');
        st.set('t', fmt.n(per, 0) + ' tok/s', U + ' users per microbatch');
        c.mission.set(M === P);
      }
      c.seg({ label: 'Pipeline stages', options: [['2', '2'], ['4', '4']], value: '4', onChange: v => { P = +v; draw(); } });
      const sM = c.slider({ label: 'Microbatches in flight', values: [1, 2, 3, 4, 6, 8], value: 1, fmt: v => v, onInput: v => { M = v; draw(); } });
      c.note('Toy: every stage takes 5 ms per microbatch and users re-enter at stage 1 right after sampling. Real pipelines add hand-off and scheduling gaps between stages.');
      draw();
      c.demo(1500, async () => { M = P; sM.set(P, true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'ep', tag: 'Expert parallel',
    title: 'With experts on different GPUs, the busiest GPU sets the pace',
    alt: 'Eight bars, one per GPU, show how many expert assignments each GPU processes in one step, with a dashed line at the average. The tallest bar is red. Controls set how uneven the routing is, how many tokens are in the step and how many of the hottest experts are copied to a second GPU. Counters show the imbalance, the extra memory and the share of the hottest expert.',
    text: 'In a [[moe|mixture-of-experts]] model, [[expert parallelism|expert parallelism]] puts different experts on different GPUs. Each token goes to its experts and back in an [[all-to-all]]. Every GPU must finish before the next layer starts, so the **busiest GPU sets the step time**. Bigger batches smooth out random noise but not **hot experts**. Copying hot experts to a second GPU does.',
    hint: 'Make routing uneven, then copy the hottest experts.',
    mission: 'Under very uneven routing, get the busiest GPU within 1.3 times the average.',
    takeaway: 'Step time follows the busiest GPU. Balance by copying hot experts, not by adding tokens.',
    mount(c) {
      const E = 64, G = 8, K = 2, cache = {};
      function run(s, T, rep) {
        const key = s + ':' + T + ':' + rep; if (cache[key]) return cache[key];
        const r = kit.rng(8), perm = [...Array(E).keys()];
        for (let i = E - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
        const w = new Array(E); perm.forEach((e, rank) => { w[e] = Math.pow(rank + 1, -s); });
        const hot = perm.slice(0, rep), home = e => Math.floor(e / 8), base = new Array(G).fill(0);
        for (let e = 0; e < E; e++) base[home(e)] += w[e] / (hot.includes(e) ? 2 : 1);
        const second = {}, l2 = base.slice();
        hot.forEach(e => { let best = -1, bl = 1e9; for (let g = 0; g < G; g++) { if (g === home(e)) continue; if (l2[g] < bl) { bl = l2[g]; best = g; } } second[e] = best; l2[best] += w[e] / 2; });
        const sum = w.reduce((a, b) => a + b, 0), cum = []; let acc = 0; w.forEach(v => { acc += v / sum; cum.push(acc); });
        const loads = new Array(G).fill(0);
        for (let t = 0; t < T; t++) {
          const chosen = new Set();
          while (chosen.size < K) { const u = r(); let lo = 0, hi = E - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] >= u) hi = mid; else lo = mid + 1; } chosen.add(lo); }
          chosen.forEach(e => { let g = home(e); if (second[e] != null && r() < 0.5) g = second[e]; loads[g]++; });
        }
        const mean = T * K / G;
        return (cache[key] = { loads, mean, imb: Math.max(...loads) / mean, hot: Math.max(...w) / sum });
      }
      const f = c.fig(420, 212, '<g id="g"></g>');
      const st = c.stats([{ k: 'i', label: 'Busiest GPU ÷ average', value: '', cls: 'bad' }, { k: 'm', label: 'Extra expert memory', value: '', cls: 'mem' }, { k: 'h', label: 'Hottest expert', value: '', cls: 'cmp' }]);
      let skew = 1, T = 256, rep = 0;
      function draw() {
        const o = run(skew, T, rep), top = Math.max(...o.loads), mx = Math.max(top, o.mean * 1.1), bi = o.loads.indexOf(top), base = 150, H = 108;
        let g = '<text class="b sm" x="16" y="16">Expert assignments each GPU handles this step</text>';
        o.loads.forEach((v, i) => { const h = v / mx * H; g += `<rect class="${i === bi ? 'f-bad' : 'f-cmp'}" x="${(40 + i * 44).toFixed(1)}" y="${(base - h).toFixed(1)}" width="34" height="${h.toFixed(1)}" rx="4"/><text class="xs m b" x="${(57 + i * 44).toFixed(1)}" y="${(base - h - 5).toFixed(1)}" text-anchor="middle">${v}</text><text class="xs m mute" x="${(57 + i * 44).toFixed(1)}" y="168" text-anchor="middle">GPU ${i + 1}</text>`; });
        const ym = base - o.mean / mx * H;
        g += `<line class="axis" x1="32" x2="404" y1="${base}" y2="${base}"/><line class="ln dash" x1="32" x2="404" y1="${ym.toFixed(1)}" y2="${ym.toFixed(1)}"/><text class="xs mute" x="16" y="186">Dashed line: the average, ${o.mean.toFixed(0)} per GPU. The step waits for the red GPU.</text><text class="xs mute" x="16" y="202">64 experts, 8 per GPU, each token picks 2.</text>`;
        f.q('#g').innerHTML = g;
        st.set('i', o.imb.toFixed(2) + '×', 'step time vs a perfect balance'); st.set('m', rep ? '+' + rep + ' experts' : 'none', rep ? '+' + (rep / E * 100).toFixed(0) + '% of expert weights' : 'one copy of each'); st.set('h', pct(o.hot), 'of all assignments');
        c.mission.set(skew === 1 && o.imb <= 1.3);
      }
      c.seg({ label: 'Routing', options: [['0', 'Even'], ['0.5', 'Uneven'], ['1', 'Very uneven']], value: '1', onChange: v => { skew = +v; draw(); } });
      c.slider({ label: 'Tokens in the step', values: [64, 256, 1024, 4096], value: 256, fmt: v => fmt.n(v, 0), onInput: v => { T = v; draw(); } });
      const sR = c.slider({ label: 'Hottest experts copied to a second GPU', values: [0, 4, 8, 16], value: 0, fmt: v => v === 0 ? 'none' : v, onInput: v => { rep = v; draw(); } });
      c.note('Toy routing: expert popularity falls off as 1 ÷ rank^s over a random order. DeepSeek’s V3 report describes duplicating high-load experts for this reason.');
      draw();
      c.demo(1500, async () => { rep = 8; sR.set(8, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'dp', tag: 'Replicas',
    title: 'Replicas trade speed for resilience',
    alt: 'Sixteen GPU slots in two rows of eight, colored by replica. A selector sets the tensor-parallel degree, so the number of replicas is 16 divided by that degree. A switch fails one GPU, which takes its whole replica offline. Counters show the token time, the capacity left after a failure and the memory per GPU.',
    text: '[[replica|Replicas]] are full copies of the model, each serving its own users. They need **no communication** with each other, so adding replicas scales throughput in a straight line. A smaller TP degree means **more replicas**: more capacity left when a GPU fails, but slower tokens. Choose the degree that meets your latency target and keeps the most replicas.',
    hint: 'Fail a GPU, then compare the degrees.',
    mission: 'Keep tokens under 10 ms and 75% of capacity after a GPU fails.',
    takeaway: 'A failure removes one replica, not the whole service. More, smaller replicas lose less.',
    mount(c) {
      const GX = 60, PITCH = 40, SW = 34, FAIL = 5, cls = ['f-data', 'f-mem', 'f-cmp', 'f-ctl'], on = ['--on-data', '--on-mem', '--on-cmp', '--on-accent'];
      const f = c.fig(420, 156, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Token time', value: '', cls: 'ctl' }, { k: 'c', label: 'Capacity after a failure', value: '', cls: 'ok' }, { k: 'm', label: 'Memory per GPU', value: '', cls: 'mem' }]);
      let tp = 2, failed = false;
      function draw() {
        const DP = 16 / tp, r = pass(M70, 1, tp, 1, 64 / DP, 4096, 1.5e-6), fits = r.gb <= 72, dead = Math.floor(FAIL / tp), cap = (DP - 1) / DP;
        let g = '<text class="b sm" x="16" y="16">16 GPUs, 64 users at 4K tokens, 70B in FP8</text>';
        for (let n = 0; n < 2; n++) g += `<text class="xs mute" x="16" y="${28 + n * 44 + 19}">Node ${n + 1}</text>`;
        for (let k = 0; k < 16; k++) {
          const x = GX + (k % 8) * PITCH, y = 28 + Math.floor(k / 8) * 44, rep = Math.floor(k / tp), off = failed && rep === dead;
          if (failed && k === FAIL) g += `<rect class="f-bad" x="${x}" y="${y}" width="${SW}" height="30" rx="5"/><path d="M${x + 12} ${y + 10} l10 10 M${x + 22} ${y + 10} l-10 10" fill="none" style="stroke:var(--on-bad);stroke-width:2.4;stroke-linecap:round"/>`;
          else if (off) g += `<rect class="well" x="${x}" y="${y}" width="${SW}" height="30" rx="5"/><text class="xs mute" x="${x + SW / 2}" y="${y + 19}" text-anchor="middle">off</text>`;
          else g += `<rect class="${cls[rep % 4]}" x="${x}" y="${y}" width="${SW}" height="30" rx="5"/><text class="xs b" x="${x + SW / 2}" y="${y + 19}" text-anchor="middle" style="fill:var(${on[rep % 4]})">R${rep + 1}</text>`;
        }
        g += `<text class="xs" x="16" y="124">${DP} replica${DP > 1 ? 's' : ''} of ${tp} GPU${tp > 1 ? 's' : ''}, ${64 / DP} users in each.</text><text class="xs ${failed ? 'b' : 'mute'}" x="16" y="142">${failed ? 'GPU 6 fails. Its replica goes offline. ' + (DP > 1 ? (DP - 1) + ' of ' + DP + ' replicas keep serving.' : 'No replica is left.') : 'Switch on the failure to see what is lost.'}</text>`;
        f.q('#g').innerHTML = g;
        st.set('t', fits ? (r.t * 1e3).toFixed(1) + ' ms' : 'does not fit', fits ? DP + ' replicas, no failure' : r.gb.toFixed(0) + ' GB needed per GPU'); st.set('c', pct(cap), (DP - 1) + ' of ' + DP + ' replicas'); st.set('m', r.gb.toFixed(0) + ' GB', 'of 72 GB usable');
        c.mission.set(failed && fits && r.t <= 10e-3 && cap >= 0.75);
      }
      const sT = c.seg({ label: 'Tensor-parallel degree', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], value: '2', onChange: v => { tp = +v; draw(); } });
      const tg = c.toggle({ label: 'One GPU has failed', value: false, onChange: v => { failed = v; draw(); } });
      c.note('Toy: users are split evenly over the replicas, and capacity counts the replicas still running. Token times come from the model of the last scenes.');
      draw();
      c.demo(1500, async () => { tp = 4; sT.set('4'); failed = true; if (tg && tg.set) tg.set(true, true); draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'puzzle', tag: 'Putting it together',
    title: 'Design the layout for a 405B model on 16 GPUs',
    alt: 'Sixteen GPU slots in two rows of eight, one row per node, colored by replica and outlined by tensor-parallel group. Selectors set the weight format, the tensor-parallel degree and the pipeline depth, and the data-parallel degree is what remains. Four checks show whether the layout fits in memory, keeps tensor parallelism inside one node, meets 30 milliseconds per token for 64 users and has at least two replicas.',
    text: 'You have **2 nodes of 8 H100s**. Serve a 405B model to **64 users with 8K tokens each**, at **30 ms per token or better**. Choose TP and PP, and DP takes the rest. This lesson’s rules decide: **fit in memory**, **keep TP inside a node**, **use PP only to fit**, and **replicate when you can**.',
    hint: 'Start with FP8, then try BF16.',
    mission: 'Pass all four checks with FP8 weights.',
    takeaway: 'If the model fits in one node, use TP inside the node and replicate. Add PP only when it does not fit.',
    mount(c) {
      const GX = 60, PITCH = 40, SW = 34, cls = ['f-data', 'f-mem', 'f-cmp', 'f-ctl'], on = ['--on-data', '--on-mem', '--on-cmp', '--on-accent'];
      const f = c.fig(420, 226, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Token time', value: '', cls: 'ctl' }, { k: 'p', label: 'Throughput, 64 users', value: '', cls: 'ok' }, { k: 'm', label: 'Memory per GPU', value: '', cls: 'mem' }]);
      const nt = c.note('');
      let wb = 1, tp = 2, pp = 1;
      function best() {
        let b = null;
        for (const t of [1, 2, 4, 8]) for (const p of [1, 2, 4, 8, 16]) { if (t * p > 16) continue; const dp = 16 / (t * p), r = pass(M405, wb, t, p, 64 / dp, 8192, 1.5e-6); if (r.gb > 72) continue; if (!b || r.t < b.r.t - 1e-9) b = { t, p, dp, r }; }
        return b;
      }
      const icon = (ok, y) => ok ? `<circle class="f-ok" cx="24" cy="${y - 4}" r="7"/><path d="M20.5 ${y - 4} l2.4 2.6 l4.4-5" fill="none" style="stroke:var(--on-ok);stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>` : `<circle class="f-bad" cx="24" cy="${y - 4}" r="7"/><path d="M21 ${y - 7} l6 6 M27 ${y - 7} l-6 6" fill="none" style="stroke:var(--on-bad);stroke-width:2;stroke-linecap:round"/>`;
      function draw() {
        const ok16 = tp * pp <= 16, dp = ok16 ? 16 / (tp * pp) : 0, r = ok16 ? pass(M405, wb, tp, pp, 64 / dp, 8192, 1.5e-6) : null;
        const fits = ok16 && r.gb <= 72, inNode = tp <= 8, fast = ok16 && r.t <= 30e-3, repl = dp >= 2;
        let g = '<text class="b sm" x="16" y="16">Two nodes of 8 GPUs</text>';
        for (let n = 0; n < 2; n++) g += `<text class="xs mute" x="16" y="${28 + n * 44 + 19}">Node ${n + 1}</text>`;
        for (let k = 0; k < 16; k++) {
          const x = GX + (k % 8) * PITCH, y = 28 + Math.floor(k / 8) * 44;
          if (!ok16) { g += `<rect class="well" x="${x}" y="${y}" width="${SW}" height="30" rx="5"/>`; continue; }
          const rep = Math.floor(k / (tp * pp));
          g += `<rect class="${cls[rep % 4]}" x="${x}" y="${y}" width="${SW}" height="30" rx="5"/><text class="xs b" x="${x + SW / 2}" y="${y + 19}" text-anchor="middle" style="fill:var(${on[rep % 4]})">R${rep + 1}</text>`;
        }
        if (ok16) for (let q = 0; q < 16 / tp; q++) for (let n = 0; n < 2; n++) {
          const a = Math.max(q * tp, 8 * n), b = Math.min((q + 1) * tp, 8 * n + 8);
          if (a < b) g += `<rect x="${GX + (a - 8 * n) * PITCH - 3}" y="${28 + n * 44 - 3}" width="${(b - a) * PITCH - 6 + 6}" height="36" rx="7" fill="none" class="${tp > 8 ? 's-bad dash' : 'ink-s'}" style="stroke-width:2"/>`;
        }
        const rows = [[fits, ok16 ? 'Fits: ' + r.gb.toFixed(0) + ' GB of 72 on each GPU' : 'TP × PP needs more than 16 GPUs'], [inNode, 'TP stays inside one node (TP ' + tp + ')'], [fast, 'Token time ' + (ok16 ? (r.t * 1e3).toFixed(1) : '-') + ' ms, target 30 ms'], [repl, 'Two or more replicas (DP ' + dp + ')']];
        rows.forEach((o, i) => { const y = 136 + i * 22; g += icon(o[0], y) + `<text class="xs ${o[0] ? '' : 'b'}" x="40" y="${y}">${o[1]}</text>`; });
        f.q('#g').innerHTML = g;
        st.set('t', fits ? (r.t * 1e3).toFixed(1) + ' ms' : 'does not fit', ok16 ? 'TP ' + tp + ', PP ' + pp + ', DP ' + dp : 'needs ' + tp * pp + ' GPUs'); st.set('p', fits ? fmt.n(64 / r.t, 0) + ' tok/s' : '-', '64 users ÷ token time'); st.set('m', ok16 ? r.gb.toFixed(0) + ' GB' : '-', 'of 72 GB usable');
        const all = fits && inNode && fast && repl, bs = best();
        nt.textContent = all ? 'All four pass. TP 8 with PP 2 also reaches about 28 ms, but it leaves one replica that spans both nodes. Two replicas of TP 8 fail separately and need no pipeline.' : wb === 2 ? 'Best fit for BF16 weights: TP ' + bs.t + ', PP ' + bs.p + ', DP ' + bs.dp + ' at ' + (bs.r.t * 1e3).toFixed(1) + ' ms. The weights alone take about 30 ms per token even at TP 8, so no layout meets the target.' : 'TP × PP × DP must equal 16. A layout that does not fit, or puts TP across nodes, fails a check.';
        c.mission.set(wb === 1 && all);
      }
      const sW = c.seg({ label: 'Weights', options: [['1', 'FP8, 405 GB'], ['2', 'BF16, 810 GB']], value: '1', onChange: v => { wb = +v; draw(); } });
      const sT = c.seg({ label: 'Tensor parallel (TP)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], value: '2', onChange: v => { tp = +v; draw(); } });
      const sP = c.seg({ label: 'Pipeline parallel (PP)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8']], value: '1', onChange: v => { pp = +v; draw(); } });
      draw();
      c.demo(1500, async () => { tp = 8; pp = 1; sT.set('8'); sP.set('1'); draw(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'Llama-3.1-405B in FP8 has about 405 GB of weights. Why can one 8-GPU H100 node hold it?', o: ['8 × 72 GB of usable memory is about 576 GB, enough for the weights and some KV cache', 'FP8 halves the number of parameters', 'The weights stay in CPU memory', 'Tensor cores need no memory in FP8'], a: 0, why: 'Eight GPUs with 72 GB usable each give 576 GB. The weights take 405 GB and the rest holds KV cache.' },
      { q: 'With hidden size 8192 in BF16, how big is one all-reduce message in a decode step for one user?', o: ['About 16 MB', 'About 16 KB', 'About 16 GB', 'About 160 bytes'], a: 1, why: '8,192 values × 2 bytes is 16 KB. At that size the cost is almost all latency, not bandwidth.' },
      { q: 'Why does tensor parallelism stop helping around 8 GPUs for decode?', o: ['Matrices cannot be split further', 'The GPUs run out of memory', 'Tensor cores slow down', 'The all-reduce leaves NVLink and communication outweighs the saved reads'], a: 3, why: 'Reads shrink as 1 ÷ TP, but each all-reduce keeps its fixed latency, and past one node the hops cross InfiniBand.' },
      { q: 'What does pipeline parallelism do to the time one token takes?', o: ['It divides it by the number of stages', 'It doubles it', 'It does not reduce it, since the token visits every stage in turn', 'It removes the all-reduce'], a: 2, why: 'Latency is the sum of the stage times. PP adds capacity, not speed for one user.' },
      { q: 'With 4 pipeline stages, how many microbatches keep every stage busy without adding waiting?', o: ['1', '4', '2', '16'], a: 1, why: 'Fewer than 4 leave stages idle. More than 4 queue behind the busiest stage and add latency.' },
      { q: 'In expert parallelism, what sets the time of a layer?', o: ['The average GPU', 'The fastest GPU', 'The number of experts per token', 'The busiest GPU'], a: 3, why: 'Every GPU must finish before the next layer starts, so the one with the most tokens decides.' },
      { q: 'A few experts get most of the tokens and overload one GPU. Which fix targets that, not random noise?', o: ['Copy the hottest experts to another GPU', 'Use a larger batch', 'Use fewer GPUs', 'Lower the precision'], a: 0, why: 'Larger batches average out random fluctuation but the hot experts stay hot. A second copy splits their traffic.' },
      { q: 'You have 16 GPUs in 2 nodes and a model that fits in one node. What is the usual layout?', o: ['TP 16 with one replica', 'PP 16', 'TP 8 in each node, as two replicas', 'TP 1 with 16 replicas'], a: 2, why: 'TP stays on NVLink inside a node, and two replicas double the capacity with no communication between them.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [0, 1].map(r => Array.from({ length: 8 }, (_, k) => `<rect x="${30 + k * 32}" y="${28 + r * 46}" width="26" height="32" rx="5" style="fill:var(${r ? '--mem' : '--data'});opacity:.9"/>`).join('')).join('')
    + [0, 1].map(r => `<rect x="${26}" y="${24 + r * 46}" width="256" height="40" rx="8" style="fill:none;stroke:var(--ink-3);stroke-width:1.5"/>`).join('')
    + '</g><text x="30" y="20" style="font:600 11px var(--font-mono);fill:var(--ink-3)">TP 8 x 2 replicas</text></svg>';

  window.LESSONS.push({
    id: 'parallel', n: 11, track: 'inference', order: 5,
    title: 'Splitting a Model Across GPUs',
    tagline: 'Tensor, pipeline, expert and data parallelism for serving: what each one sends and when it pays off.',
    preview,
    scenes: S
  });
})();
