/* Lesson 7: Training a 2-trillion-parameter model. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const lg = (v, lo, hi) => kit.clamp((Math.log10(v) - lo) / (hi - lo), 0.01, 1);
  const big = v => v >= 1e9 ? kit.sci(v, 1) : fmt.n(Math.round(v));
  const nfmt = v => v >= 1e12 ? +(v / 1e12).toFixed(2) + 'T' : v >= 1e9 ? +(v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : String(v);
  const tspan = s => s < 90 ? Math.round(s) + ' s' : s < 5400 ? (s / 60).toFixed(1) + ' min' : s < 172800 ? (s / 3600).toFixed(1) + ' h' : s < 6.3e7 ? fmt.n(s / 86400, s / 86400 < 10 ? 1 : 0) + ' days' : fmt.n(s / 3.156e7) + ' years';
  const H100 = 989e12, EFF = 0.4 * H100;

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'scale', tag: 'The problem',
    title: 'Two trillion parameters fit on no single GPU',
    alt: 'Two bars on log scales. The first shows the memory needed for the training state of the chosen model, with a marker at 80 gigabytes. The second shows the time one GPU would need to train it, with a marker at one year. Sliders set the parameter count and the number of training tokens.',
    text: 'Training needs far more than the weights. At **16 bytes per parameter**, a 2-trillion-parameter model holds **32 terabytes** of state: 400 GPUs of 80 GB before any activations. The compute is about **6 × parameters × tokens**. For 15 trillion tokens that is 1.8 × 10²⁶ operations, over **14,000 years** on one GPU.',
    hint: 'Shrink the model until it fits one GPU.',
    mission: 'Find a model small enough to train on one 80 GB GPU.',
    takeaway: 'Memory forces you to split the model. Compute forces you to use thousands of GPUs. Both need communication.',
    mount(c) {
      const f = c.fig(420, 218, '<g id="b"></g>');
      const st = c.stats([{ k: 'm', label: 'Training state', value: '', cls: 'mem' }, { k: 'g', label: 'GPUs just to hold it', value: '', cls: 'cmp' }, { k: 'f', label: 'Compute, 6 × N × D', value: '', cls: 'bad' }, { k: 'd', label: 'Days on 16,384 GPUs', value: '', cls: 'data' }]);
      let N = 2e12, D = 15e12;
      function draw() {
        const mem = 16 * N, flops = 6 * N * D, secs = flops / EFF, years = secs / 3.156e7, x1 = 16 + lg(80e9, 9, 14) * 388, x2 = 16 + lg(1, -2, 5) * 388;
        f.q('#b').innerHTML = kit.bar(16, 34, 388, 16, lg(mem, 9, 14), mem > 80e9 ? 'f-bad' : 'f-ok', 'Memory for the training state (log scale, 1 GB to 100 TB)', fmt.bytes(mem, 1)) +
          `<line class="ln" x1="${x1}" x2="${x1}" y1="36" y2="64" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x1}" y="78" text-anchor="middle">one GPU: 80 GB</text>` +
          kit.bar(16, 124, 388, 16, lg(years, -2, 5), years > 1 ? 'f-cmp' : 'f-ok', 'Time on one GPU (log scale, 4 days to 100,000 years)', years >= 1 ? fmt.n(years) + ' years' : tspan(secs)) +
          `<line class="ln" x1="${x2}" x2="${x2}" y1="126" y2="154" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x2}" y="168" text-anchor="middle">one year</text><text class="xs mute" x="16" y="206">400 TFLOPS sustained, about 40% of an H100’s 989 TFLOPS peak.</text>`;
        st.set('m', fmt.bytes(mem, 1), '16 bytes × ' + nfmt(N) + ' parameters'); st.set('g', fmt.n(Math.ceil(mem / 80e9)), 'of 80 GB each'); st.set('f', kit.sci(flops, 1), nfmt(D) + ' tokens'); st.set('d', secs / 16384 / 86400 >= 10 ? fmt.n(secs / 16384 / 86400) : (secs / 16384 / 86400).toFixed(1), 'with perfect scaling');
        c.mission.set(mem <= 80e9);
      }
      c.slider({ label: 'Parameters', values: [1e9, 3e9, 7e9, 13e9, 70e9, 405e9, 1e12, 2e12], value: 2e12, fmt: nfmt, onInput: v => { N = v; draw(); } });
      c.slider({ label: 'Training tokens', values: [1e12, 5e12, 15e12, 40e12], value: 15e12, fmt: nfmt, onInput: v => { D = v; draw(); } });
      draw();
      c.demo(1500, async () => { N = 3e9; draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'bytes', tag: 'Memory',
    title: '16 bytes for every parameter',
    alt: 'One horizontal bar split into five parts: bf16 weights, bf16 gradients, an fp32 master copy and the two Adam states. Controls change whether a master copy is kept and how precisely the Adam states are stored. Counters show the bytes per parameter and the state for two trillion parameters.',
    text: 'Mixed-precision training with Adam keeps **five numbers per parameter**: bf16 weights (2 bytes), bf16 gradients (2), an fp32 master copy (4), and Adam’s running mean (4) and variance (4). That is **16 bytes**. The master copy protects tiny updates from rounding away. Smaller optimizer states cut the bill.',
    hint: 'Change the master copy and the Adam precision.',
    mission: 'Get down to 10 bytes per parameter or less.',
    takeaway: 'Optimizer state is three quarters of the memory. Every byte saved here is multiplied by the parameter count.',
    mount(c) {
      const f = c.fig(420, 132, '<g id="seg"></g><g id="txt"></g>');
      c.legend([['data', 'Weights'], ['mem', 'Gradients'], ['cmp', 'Master copy'], ['ctl', 'Adam mean'], ['warn', 'Adam variance']]);
      const st = c.stats([{ k: 'b', label: 'Bytes per parameter', value: '', cls: 'mem' }, { k: 't', label: 'State for 2 trillion parameters', value: '', cls: 'cmp' }, { k: 'g', label: 'GPUs (80 GB) to hold it', value: '', cls: 'bad' }]);
      let master = 4, adam = 4;
      function draw() {
        const parts = [[2, 'f-data', 'weights'], [2, 'f-mem', 'grads'], [master, 'f-cmp', 'master'], [adam, 'f-ctl', 'mean'], [adam, 'f-warn', 'var']], tot = parts.reduce((a, p) => a + p[0], 0), U = 388 / 16;
        let x = 16, g = '', t = '';
        parts.forEach(p => { if (!p[0]) return; const w = p[0] * U; g += `<rect x="${x.toFixed(1)}" y="40" width="${(w - 2).toFixed(1)}" height="44" rx="6" class="${p[1]}"/>`; t += `<text class="xs b" x="${(x + w / 2 - 1).toFixed(1)}" y="67" text-anchor="middle" style="fill:var(--on-${p[1].slice(2) === 'warn' ? 'cmp' : p[1].slice(2) === 'ctl' ? 'accent' : p[1].slice(2)})">${p[0]} B</text>`; x += w; });
        f.q('#seg').innerHTML = g + `<rect x="16" y="40" width="388" height="44" rx="6" class="none-f" style="stroke:var(--line);stroke-dasharray:3 3"/>`;
        f.q('#txt').innerHTML = t + `<text class="xs mute" x="16" y="30">One parameter, ${tot} bytes. The dashed box is the standard 16.</text><text class="xs mute" x="16" y="104">${master ? 'The fp32 master copy is kept.' : 'No master copy: small updates can round to nothing.'}</text><text class="xs mute" x="16" y="120">Adam states: ${adam === 4 ? 'fp32' : adam === 2 ? 'bf16' : 'int8'}, ${adam} byte${adam > 1 ? 's' : ''} each.</text>`;
        st.set('b', tot, tot <= 10 ? 'down from 16' : tot === 16 ? 'the standard' : 'down from 16'); st.set('t', fmt.bytes(tot * 2e12, 0), '2 × 10¹² parameters'); st.set('g', fmt.n(Math.ceil(tot * 2e12 / 80e9)), 'before activations');
        c.mission.set(tot <= 10);
      }
      c.seg({ label: 'Master copy of the weights', options: [['4', 'fp32, 4 bytes'], ['0', 'none']], value: '4', onChange: v => { master = +v; draw(); } });
      c.seg({ label: 'Adam states (each)', options: [['4', 'fp32'], ['2', 'bf16'], ['1', 'int8']], value: '4', onChange: v => { adam = +v; draw(); } });
      draw();
      c.demo(1500, async () => { adam = 1; draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'sixnd', tag: 'Compute',
    title: 'Where 6 × N × D comes from',
    alt: 'A column of layers with a forward arrow labeled 2 operations per parameter and a backward arrow labeled 4 operations per parameter. Sliders set the parameter count and the number of tokens. Counters show the operations per token, the total, and the H100 years it needs at 400 TFLOPS.',
    text: 'Each parameter takes part in one multiply and one add per token on the way forward: **2 operations**. The backward pass computes a gradient for the inputs and one for the weights: **4 operations**. So training costs **6 operations per parameter per token**, and a run costs **6 × N × D**.',
    hint: 'Change the parameters and the tokens.',
    mission: 'Make the run cost about 10²⁴ operations, within 10%.',
    takeaway: 'Total compute is just parameters times tokens times 6. Everything else is how fast you can run it.',
    mount(c) {
      const f = c.fig(420, 188, `<g id="stack"></g><path class="ln s2" d="M92 40 V148" marker-end="url(#ah-ink)"/><path class="ln s2" d="M128 148 V40" marker-end="url(#ah-ink)"/>
        <text class="b sm" x="150" y="62" style="fill:var(--ink)">Forward</text><text class="xs" x="150" y="80">2 per parameter</text><text class="b sm" x="150" y="112">Backward</text><text class="xs" x="150" y="130">4 per parameter</text><text class="lg b m" x="150" y="168">6 per token</text><g id="bar"></g>`);
      const st = c.stats([{ k: 'p', label: 'Operations per token', value: '', cls: 'mem' }, { k: 't', label: 'Total operations', value: '', cls: 'cmp' }, { k: 'y', label: 'H100 years at 400 TFLOPS', value: '', cls: 'data' }]);
      let N = 70e9, D = 15e12;
      function draw() {
        let s = ''; ['Layer 1', 'Layer 2', '...', 'Layer L'].forEach((t, i) => { s += `<rect class="t-mem" x="20" y="${34 + i * 30}" width="62" height="24" rx="6"/><text class="xs b" x="51" y="${50 + i * 30}" text-anchor="middle">${t}</text>`; });
        f.q('#stack').innerHTML = s;
        const tot = 6 * N * D, yrs = tot / EFF / 3.156e7;
        st.set('p', kit.sci(6 * N, 1), '6 × ' + nfmt(N)); st.set('t', kit.sci(tot, 1), +(D / 1e12).toPrecision(2) + 'T tokens'); st.set('y', fmt.n(Math.round(yrs)), 'one GPU, no waiting');
        c.mission.set(tot >= 0.9e24 && tot <= 1.1e24);
      }
      c.slider({ label: 'Parameters N', values: [1e9, 7e9, 70e9, 405e9, 2e12], value: 70e9, fmt: nfmt, onInput: v => { N = v; draw(); } });
      c.slider({ label: 'Training tokens D', min: 1e11, max: 1e14, log: true, value: 15e12, fmt: v => +(v / 1e12).toPrecision(2) + 'T', onInput: v => { D = v; draw(); } });
      c.note('For reference: Llama 3 405B trained on 15.6 trillion tokens, about 3.8 × 10²⁵ operations.');
      draw();
      c.demo(1500, async () => { D = 2.4e12; draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'ring', tag: 'Data parallelism',
    title: 'Ring all-reduce adds gradients without a bottleneck',
    alt: 'GPUs arranged in a ring, each holding a strip of chunks. In each step every GPU sends one chunk to its right neighbor. The first half adds chunks until each GPU owns one fully summed chunk. The second half passes the finished chunks around until every GPU has all of them.',
    text: '[[data parallelism|Data parallelism]] gives every GPU a full model copy and a different batch. The gradients must then be **averaged across all GPUs** with an [[all-reduce]]. In a **ring**, each GPU splits its gradient into N chunks and passes one chunk to its neighbor per step: N − 1 steps to add, N − 1 to share. Each GPU sends **2(N − 1)/N** times the gradient size.',
    hint: 'Choose the number of GPUs, then step through or run it.',
    mission: 'Run the all-reduce to the end with 8 GPUs.',
    takeaway: 'Traffic per GPU stays near 2 gradients no matter how many GPUs join. Ring all-reduce scales.',
    mount(c) {
      const CX = 150, CY = 138, R = 100, COLS = ['var(--data)', 'var(--mem)', 'var(--cmp)', 'var(--ctl)', 'var(--warn)', 'var(--ok)', 'var(--bad)', 'var(--ink-3)'];
      const f = c.fig(420, 280, '<g id="links"></g><g id="dots"></g><g id="nodes"></g><g id="info"></g>');
      const st = c.stats([{ k: 's', label: 'Steps', value: '', cls: 'mem' }, { k: 't', label: 'Sent per GPU', value: '', cls: 'cmp' }]);
      let N = 8, cnt = [], step = 0, busy = false, byUser = false;
      const pos = i => [CX + R * Math.cos((-90 + i * 360 / N) * Math.PI / 180), CY + R * Math.sin((-90 + i * 360 / N) * Math.PI / 180)];
      function reset() { cnt = Array.from({ length: N }, () => Array(N).fill(1)); step = 0; busy = false; byUser = false; draw(); }
      const total = () => 2 * (N - 1);
      const sends = () => { const s = step, out = []; for (let i = 0; i < N; i++) out.push(s < N - 1 ? (i - s + 2 * N) % N : (i + 1 - (s - (N - 1)) + 2 * N) % N); return out; };
      function draw(active) {
        let nodes = '', links = '';
        for (let i = 0; i < N; i++) {
          const p = pos(i), q = pos((i + 1) % N), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, on = active && step < total();
          links += `<path class="ln s2" d="M${(p[0] + ux * 30).toFixed(1)} ${(p[1] + uy * 30).toFixed(1)} L${(q[0] - ux * 32).toFixed(1)} ${(q[1] - uy * 32).toFixed(1)}" marker-end="url(#ah-ink)" style="${on ? 'stroke:var(--ctl);stroke-width:3' : 'opacity:.55'}"/>`;
          nodes += `<rect class="box" x="${(p[0] - 27).toFixed(1)}" y="${(p[1] - 16).toFixed(1)}" width="54" height="32" rx="8"/><text class="xs b" x="${p[0].toFixed(1)}" y="${(p[1] - 5).toFixed(1)}" text-anchor="middle">GPU ${i}</text>`;
          const cw = Math.min(6.2, 46 / N);
          for (let k = 0; k < N; k++) nodes += `<rect x="${(p[0] - (N * (cw + 0.8)) / 2 + k * (cw + 0.8)).toFixed(1)}" y="${(p[1] + 2).toFixed(1)}" width="${cw.toFixed(1)}" height="10" rx="1.5" style="fill:${COLS[k % 8]};opacity:${(0.18 + 0.82 * cnt[i][k] / N).toFixed(2)}"/>`;
        }
        f.q('#links').innerHTML = links; f.q('#nodes').innerHTML = nodes;
        const phase = step >= total() ? 'Done: every GPU holds every summed chunk.' : step < N - 1 ? 'Phase 1, reduce-scatter: the neighbor adds the chunk it receives.' : 'Phase 2, all-gather: finished chunks are copied around the ring.';
        f.q('#info').innerHTML = `<text class="xs mute" x="16" y="270">${phase}</text>`;
        st.set('s', step + ' of ' + total(), 'N − 1 to add, N − 1 to share'); st.set('t', (2 * (N - 1) / N).toFixed(2) + ' × gradient', '2(N − 1) ÷ N');
        c.mission.set(N === 8 && step >= total() && byUser);
      }
      async function once() {
        if (busy || step >= total()) return; busy = true;
        const sd = sends(), dots = f.q('#dots'); let paint = '';
        const frm = []; for (let i = 0; i < N; i++) { const p = pos(i), q = pos((i + 1) % N); frm.push([p, q, sd[i]]); }
        draw(true);
        await c.tween(450, u => { let d = ''; frm.forEach(([p, q, k]) => { d += `<circle cx="${(p[0] + (q[0] - p[0]) * u).toFixed(1)}" cy="${(p[1] + (q[1] - p[1]) * u).toFixed(1)}" r="5" style="fill:${COLS[k % 8]};stroke:var(--stage);stroke-width:1.5"/>`; }); dots.innerHTML = d; }, c.ease.io);
        dots.innerHTML = '';
        const add = step < N - 1, before = cnt.map(r => r.slice());
        for (let i = 0; i < N; i++) { const j = (i + 1) % N, k = sd[i]; if (add) cnt[j][k] = before[j][k] + before[i][k]; else cnt[j][k] = N; }
        step++; busy = false; draw(false);
      }
      async function runAll() { while (step < total() && c.alive !== false) { await once(); await c.wait(60); } }
      c.slider({ label: 'GPUs in the ring', min: 3, max: 8, step: 1, value: 8, fmt: v => v, onInput: v => { N = v; reset(); } });
      c.btn('Step', () => { if (step >= total()) reset(); byUser = true; once(); }, { small: true }); c.btn('Run all steps', async () => { if (step >= total()) reset(); byUser = true; await runAll(); }, { small: true }); c.btn('Reset', reset, { small: true });
      c.note('Each GPU holds N chunks. Brighter means more GPUs’ contributions are summed in that chunk.');
      reset();
      c.play(async () => { await c.wait(500); await runAll(); await c.wait(500); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'bandwidth', tag: 'Data parallelism',
    title: 'The link decides how long the sum takes',
    alt: 'A bar on a log scale shows the time to all-reduce the gradients, with a marker at 3 seconds. Controls choose the model size, the link speed and the number of GPUs in the ring. Counters show the gradient size, the bytes each GPU sends, and the time.',
    text: 'Gradients in bf16 take **2 bytes per parameter**. A ring sends **2(N − 1)/N** times that per GPU, so time = traffic ÷ link bandwidth. A 405B model has **810 GB** of gradients. Over one 50 GB/s [[infiniband|InfiniBand]] link that is about **32 seconds** per step. Inside a node, [[nvlink|NVLink]] moves **450 GB/s** each way.',
    hint: 'Switch the link and the model size.',
    mission: 'Make the gradient all-reduce finish in under 3 seconds.',
    takeaway: 'Full-size gradients cannot cross slow links every step. That is why large runs shard the model instead of only copying it.',
    mount(c) {
      const f = c.fig(420, 150, '<g id="b"></g>');
      const st = c.stats([{ k: 's', label: 'Gradient size', value: '', cls: 'mem' }, { k: 't', label: 'Sent per GPU', value: '', cls: 'cmp' }, { k: 'd', label: 'All-reduce time', value: '', cls: 'data' }]);
      let P = 405, bw = 50, n = 1024;
      function draw() {
        const S_ = 2 * P * 1e9, tr = 2 * (n - 1) / n * S_, secs = tr / (bw * 1e9), x = 16 + lg(3, -2, 2) * 388;
        f.q('#b').innerHTML = kit.bar(16, 36, 388, 16, lg(secs, -2, 2), secs < 3 ? 'f-ok' : 'f-cmp', 'Time to sum the gradients (log scale, 0.01 s to 100 s)', secs < 1 ? Math.round(secs * 1000) + ' ms' : secs.toFixed(1) + ' s') +
          `<line class="ln" x1="${x}" x2="${x}" y1="38" y2="68" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x}" y="82" text-anchor="middle">3 s</text><text class="xs mute" x="16" y="120">${bw === 450 ? 'NVLink: one node, 8 GPUs.' : 'InfiniBand: between nodes, one NIC.'}</text><text class="xs mute" x="16" y="136">The ring runs at the speed of its slowest link.</text>`;
        st.set('s', fmt.bytes(S_, 0), P + 'B parameters × 2 bytes'); st.set('t', fmt.bytes(tr, 0), '2(N − 1) ÷ N × size'); st.set('d', secs < 1 ? Math.round(secs * 1000) + ' ms' : secs.toFixed(1) + ' s', bw + ' GB/s');
        c.mission.set(secs < 3);
      }
      c.seg({ label: 'Model', options: [['7', '7B'], ['70', '70B'], ['405', '405B']], value: '405', onChange: v => { P = +v; draw(); } });
      c.seg({ label: 'Link', options: [['450', 'NVLink, 450 GB/s'], ['50', 'InfiniBand, 50 GB/s']], value: '50', onChange: v => { bw = +v; draw(); } });
      c.slider({ label: 'GPUs in the ring', values: [8, 64, 1024, 16384], value: 1024, fmt: v => fmt.n(v), onInput: v => { n = v; draw(); } });
      draw();
      c.demo(1500, async () => { P = 7; draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'zero', tag: 'Sharding',
    title: 'ZeRO: do not keep copies you do not need',
    alt: 'A bar on a log scale shows the memory each GPU needs, with a marker at 80 gigabytes. A stacked bar below splits it into parameters, gradients and optimizer states. Controls choose the ZeRO stage, the model size and the number of GPUs.',
    text: 'Plain data parallelism stores the full 16 bytes per parameter on every GPU. [[zero|ZeRO]] shards it. **Stage 1** splits the optimizer states across GPUs. **Stage 2** also splits gradients. **Stage 3** also splits the parameters, so each GPU holds 16 ÷ N bytes per parameter and gathers weights layer by layer when it needs them.',
    hint: 'Raise the stage until the model fits.',
    mission: 'Fit a 70B model in 80 GB on every GPU.',
    takeaway: 'Each stage removes one kind of duplicate. Stage 3 trades about 1.5 times the communication for the smallest memory.',
    mount(c) {
      const f = c.fig(420, 188, '<g id="b"></g>');
      c.legend([['data', 'Parameters'], ['mem', 'Gradients'], ['cmp', 'Optimizer states']]);
      const st = c.stats([{ k: 'm', label: 'Memory per GPU', value: '', cls: 'mem' }, { k: 'r', label: 'Compared with plain data parallel', value: '', cls: 'data' }]);
      let stage = 0, P = 70e9, n = 64;
      function draw() {
        const parts = [stage >= 3 ? 2 * P / n : 2 * P, stage >= 2 ? 2 * P / n : 2 * P, stage >= 1 ? 12 * P / n : 12 * P], tot = parts[0] + parts[1] + parts[2], x80 = 16 + lg(80e9, 9, 13) * 388;
        const cols = ['f-data', 'f-mem', 'f-cmp']; let x = 16, seg = '';
        parts.forEach((v, i) => { const w = 388 * v / tot; seg += `<rect x="${x.toFixed(1)}" y="118" width="${Math.max(0, w - 1.5).toFixed(1)}" height="22" rx="4" class="${cols[i]}"/>`; if (w > 54) seg += `<text class="xs b" x="${(x + w / 2).toFixed(1)}" y="133" text-anchor="middle" style="fill:var(--on-${i === 0 ? 'data' : i === 1 ? 'mem' : 'cmp'})">${fmt.bytes(v, 0)}</text>`; x += w; });
        f.q('#b').innerHTML = kit.bar(16, 34, 388, 16, lg(tot, 9, 13), tot <= 80e9 ? 'f-ok' : 'f-bad', 'Memory per GPU (log scale, 1 GB to 10 TB)', fmt.bytes(tot, 1)) +
          `<line class="ln" x1="${x80}" x2="${x80}" y1="36" y2="64" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x80}" y="78" text-anchor="middle">80 GB</text><text class="b sm" x="16" y="108">What it is made of</text>${seg}<text class="xs mute" x="16" y="164">Without sharding: ${fmt.bytes(16 * P, 0)}. Activations are extra.</text>`;
        st.set('m', fmt.bytes(tot, 1), 'ZeRO stage ' + stage + ', ' + fmt.n(n) + ' GPUs'); st.set('r', (16 * P / tot).toFixed(1) + '× less', tot <= 80e9 ? 'fits in 80 GB' : 'does not fit in 80 GB');
        c.mission.set(P === 70e9 && tot <= 80e9);
      }
      c.seg({ label: 'ZeRO stage', options: [['0', '0: none'], ['1', '1: optimizer'], ['2', '2: + gradients'], ['3', '3: + parameters']], value: '0', onChange: v => { stage = +v; draw(); } });
      c.slider({ label: 'Parameters', values: [7.5e9, 13e9, 70e9, 405e9], value: 70e9, fmt: nfmt, onInput: v => { P = v; draw(); } });
      c.slider({ label: 'GPUs sharing the state', values: [8, 64, 512, 4096], value: 64, fmt: v => fmt.n(v), onInput: v => { n = v; draw(); } });
      c.note('Check: a 7.5B model on 64 GPUs takes 120 GB, then 31.4, 16.6 and 1.9 GB per GPU at stages 0 to 3 (Rajbhandari et al., 2020).');
      draw();
      c.demo(1500, async () => { stage = 3; draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'ckpt', tag: 'Sharding',
    title: 'Recompute instead of remembering',
    alt: 'Sixty-four layers drawn as small blocks. Every k-th block is marked as a checkpoint. A slider sets k. Two bars show activation memory in layers and the extra compute from recomputing. Memory is smallest when k is near the square root of the layer count.',
    text: 'The backward pass needs the activations from the forward pass. Storing all of them takes memory proportional to depth. [[activation checkpointing|Activation checkpointing]] keeps only every k-th layer and **recomputes** the rest during the backward pass. That costs one extra forward pass, about **33% more compute**. FlashAttention applies the same idea to attention scores.',
    hint: 'Change the spacing between checkpoints.',
    mission: 'Find the spacing that uses the least activation memory.',
    takeaway: 'Memory is L ÷ k + k layers, smallest near k = √L. About a third more compute buys a 4 times cut at 64 layers.',
    mount(c) {
      const L = 64, f = c.fig(420, 214, '<g id="cells"></g><g id="bars"></g>');
      const st = c.stats([{ k: 'm', label: 'Activation memory', value: '', cls: 'mem' }, { k: 'o', label: 'Extra compute', value: '', cls: 'cmp' }]);
      let k = 1;
      function draw() {
        let g = '';
        for (let i = 0; i < L; i++) { const x = 16 + (i % 32) * 12.1, y = 38 + Math.floor(i / 32) * 22, ck = k === 1 || i % k === 0, last = k > 1 && Math.floor(i / k) === Math.floor((L - 1) / k); g += `<rect x="${x.toFixed(1)}" y="${y}" width="10.4" height="16" rx="2" class="${ck ? 'f-ctl' : last ? 'f-cmp' : 'well'}" style="${!ck && !last ? 'opacity:.8' : ''}"/>`; }
        f.q('#cells').innerHTML = g + `<text class="xs mute" x="16" y="30">64 layers. Violet: stored. Orange: recomputed together. Gray: dropped.</text>`;
        const mem = k === 1 ? L : L / k + k, ov = k === 1 ? 0 : 33;
        f.q('#bars').innerHTML = kit.bar(16, 110, 388, 14, mem / 70, mem <= 16 ? 'f-ok' : 'f-mem', 'Activation memory, in layers', mem % 1 ? mem.toFixed(1) : String(mem)) + kit.bar(16, 154, 388, 14, ov / 100, 'f-cmp', 'Extra compute', '+' + ov + '%') + `<text class="xs mute" x="16" y="196">Checkpoint every ${k} layer${k > 1 ? 's' : ''}: stored ${k === 1 ? L : L / k} + live ${k === 1 ? 0 : k}.</text>`;
        st.set('m', mem + ' layers', (L / mem).toFixed(1) + '× less than storing all 64'); st.set('o', '+' + ov + '%', ov ? 'one extra forward pass' : 'none');
        c.mission.set(k === 8);
      }
      c.slider({ label: 'Layers between checkpoints', values: [1, 2, 4, 8, 16, 32, 64], value: 1, fmt: v => v, onInput: v => { k = v; draw(); } });
      draw();
      c.demo(1500, async () => { k = 8; draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'tp', tag: 'Splitting the model',
    title: 'Tensor parallelism splits every matrix',
    alt: 'A weight matrix drawn as columns, one column block per GPU. Below, a stacked bar shows compute time and communication time for one transformer layer. A selector sets the tensor-parallel degree. Beyond eight GPUs the communication moves from NVLink to InfiniBand and its share jumps.',
    text: '[[tensor parallelism|Tensor parallelism]] splits each weight matrix across GPUs. Each GPU computes part of every layer, and two all-reduces per layer in the forward pass and two in the backward pass sum the pieces. Those all-reduces sit on the critical path, so TP only works over [[nvlink|NVLink]] **inside one 8-GPU node**.',
    hint: 'Raise the degree and watch where the time goes.',
    mission: 'Pick the largest degree that keeps communication under 20% of layer time.',
    takeaway: 'Tensor parallelism is fast inside a node and slow across nodes. Llama 3 used 8-way TP.',
    mount(c) {
      const f = c.fig(420, 218, '<g id="m"></g><g id="b"></g>');
      c.legend([['data', 'Compute'], ['bad', 'Communication']]);
      const st = c.stats([{ k: 'c', label: 'Compute per layer', value: '', cls: 'data' }, { k: 'm', label: 'Communication per layer', value: '', cls: 'bad' }, { k: 's', label: 'Share in communication', value: '', cls: 'cmp' }]);
      let t = 1;
      const PL = 405e9 / 126, TOK = 8192, HID = 16384;
      function draw() {
        const flops = 6 * PL * TOK, comp = flops / t / EFF, bytes1 = TOK * HID * 2, traffic = t === 1 ? 0 : 4 * 2 * (t - 1) / t * bytes1, bw = t <= 8 ? 450e9 : 50e9, comm = traffic / bw, share = comm / (comm + comp);
        const cols = Math.min(t, 8), cw = 200 / cols; let g = `<text class="b sm" x="16" y="24">One weight matrix, split over ${t} GPU${t > 1 ? 's' : ''}</text>`;
        for (let i = 0; i < cols; i++) g += `<rect x="${(16 + i * cw).toFixed(1)}" y="34" width="${(cw - 3).toFixed(1)}" height="64" rx="5" style="fill:var(--${['data', 'mem', 'cmp', 'ctl'][i % 4]});opacity:.85"/><text class="xs b" x="${(16 + i * cw + cw / 2 - 1.5).toFixed(1)}" y="70" text-anchor="middle" style="fill:var(--on-${['data', 'mem', 'cmp', 'accent'][i % 4]})">${t > 8 ? '' : i}</text>`;
        g += `<text class="xs mute" x="236" y="52">${t === 1 ? 'No split.' : 'GPU i holds 1/' + t + ' of the columns.'}</text><text class="xs mute" x="236" y="70">${t <= 8 ? 'All on NVLink: 450 GB/s.' : 'Crosses nodes: 50 GB/s.'}</text>`;
        f.q('#m').innerHTML = g;
        const W = 388, total = comp + comm, cwid = W * comp / total;
        f.q('#b').innerHTML = `<text class="b sm" x="16" y="128">One layer, forward and backward</text><rect x="16" y="138" width="${Math.max(2, cwid - 1).toFixed(1)}" height="22" rx="5" class="f-data"/>` + (comm > 0 ? `<rect x="${(16 + cwid).toFixed(1)}" y="138" width="${Math.max(2, W - cwid).toFixed(1)}" height="22" rx="5" class="f-bad"/>` : '') + `<text class="xs mute" x="16" y="184">Assumes a 405B-class layer, 8,192 tokens per microbatch, 400 TFLOPS.</text><text class="xs mute" x="16" y="200">Four all-reduces of 268 MB each, per layer.</text>`;
        st.set('c', (comp * 1000).toFixed(comp * 1000 < 10 ? 1 : 0) + ' ms', 'per GPU'); st.set('m', t === 1 ? 'none' : (comm * 1000).toFixed(comm * 1000 < 10 ? 1 : 0) + ' ms', t <= 8 ? 'NVLink' : 'InfiniBand'); st.set('s', Math.round(share * 100) + '%', share < 0.2 ? 'acceptable' : 'too much waiting');
        c.mission.set(t === 8 && share < 0.2);
      }
      c.seg({ label: 'Tensor-parallel degree', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['32', '32']], value: '1', onChange: v => { t = +v; draw(); } });
      draw();
      c.demo(1500, async () => { t = 8; draw(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'pp', tag: 'Splitting the model',
    title: 'Pipeline parallelism and the bubble',
    alt: 'A schedule chart with one row per pipeline stage. Green blocks are forward passes of microbatches and blue blocks are backward passes. The empty space before, between and after them is the bubble where a GPU idles. Controls set the number of stages and microbatches and switch on interleaving.',
    text: '[[pipeline parallelism|Pipeline parallelism]] gives each GPU a **slice of the layers**. A batch is cut into **M** [[microbatch|microbatches]] that flow through P stages. The first and last stages must wait, which leaves a [[bubble]] of idle time: **(P − 1) ÷ (M + P − 1)** of the step. More microbatches shrink it. Interleaving, with 2 slices per GPU, halves the idle time again.',
    hint: 'Add microbatches, or switch on interleaving.',
    mission: 'Keep the bubble under 10% with 8 stages.',
    takeaway: 'A deep pipeline needs many microbatches. Bubble = (P − 1) ÷ (M + P − 1).',
    mount(c) {
      const f = c.fig(420, 232, '<g id="g"></g><g id="t"></g>');
      c.legend([['data', 'Forward'], ['mem', 'Backward'], ['bad', 'Idle: the bubble']]);
      const st = c.stats([{ k: 'b', label: 'Bubble', value: '', cls: 'bad' }, { k: 'u', label: 'GPU busy time', value: '', cls: 'ok' }]);
      let P = 4, M = 4, il = false;
      function draw() {
        const slots = 3 * (M + P - 1), X0 = 56, W = 352, rh = Math.min(16, 150 / P), gap = Math.min(4, rh * 0.25), u = W / slots; let g = '';
        for (let s = 0; s < P; s++) {
          const y = 14 + s * (rh + gap), fs = s, bs = (M + P - 1) + 2 * (P - 1 - s);
          g += `<rect x="${X0}" y="${y}" width="${W}" height="${rh}" rx="2" class="well"/><rect x="${X0 + 0}" y="${y}" width="${(fs * u).toFixed(1)}" height="${rh}" class="f-bad" style="opacity:.28"/><rect x="${(X0 + (fs + M) * u).toFixed(1)}" y="${y}" width="${((bs - fs - M) * u).toFixed(1)}" height="${rh}" class="f-bad" style="opacity:.28"/><rect x="${(X0 + (bs + 2 * M) * u).toFixed(1)}" y="${y}" width="${Math.max(0, (slots - bs - 2 * M) * u).toFixed(1)}" height="${rh}" class="f-bad" style="opacity:.28"/>`;
          g += `<rect x="${(X0 + fs * u).toFixed(1)}" y="${y}" width="${(M * u).toFixed(1)}" height="${rh}" rx="2" class="f-data"/><rect x="${(X0 + bs * u).toFixed(1)}" y="${y}" width="${(2 * M * u).toFixed(1)}" height="${rh}" rx="2" class="f-mem"/>`;
          if (P <= 8) g += `<text class="xs m mute" x="${X0 - 6}" y="${y + rh / 2 + 4}" text-anchor="end">stage ${s + 1}</text>`;
        }
        f.q('#g').innerHTML = g;
        const bub = il ? (P - 1) / (2 * M + P - 1) : (P - 1) / (M + P - 1);
        f.q('#t').innerHTML = `<text class="xs mute" x="${X0}" y="${14 + P * (rh + gap) + 14}">time →   ${slots} units: ${M + P - 1} forward + ${2 * (M + P - 1)} backward</text><text class="xs mute" x="${X0}" y="${14 + P * (rh + gap) + 30}">${il ? 'Plain schedule drawn; interleaving changes the numbers.' : 'Plain schedule.'}</text>`;
        st.set('b', (bub * 100).toFixed(bub < 0.1 ? 1 : 0) + '%', (il ? '(P − 1) ÷ (2M + P − 1)' : '(P − 1) ÷ (M + P − 1)') + ' = ' + (P - 1) + ' ÷ ' + (il ? 2 * M + P - 1 : M + P - 1)); st.set('u', ((1 - bub) * 100).toFixed(0) + '%', 'of the step');
        c.mission.set(P === 8 && bub < 0.1);
      }
      c.slider({ label: 'Pipeline stages P', values: [1, 2, 4, 8, 16], value: 4, fmt: v => v, onInput: v => { P = v; draw(); } });
      c.slider({ label: 'Microbatches M', values: [1, 2, 4, 8, 16, 32, 64, 128], value: 4, fmt: v => v, onInput: v => { M = v; draw(); } });
      c.toggle({ label: 'Interleave: 2 slices per GPU', value: false, onChange: v => { il = v; draw(); } });
      draw();
      c.demo(1500, async () => { P = 8; M = 64; draw(); });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'cp', tag: 'Splitting the model',
    title: 'Context parallelism splits the sequence',
    alt: 'A long bar represents the token sequence, cut into equal pieces for each GPU. Controls set the sequence length and the number of GPUs sharing it. Counters show the tokens per GPU and the attention pairs each GPU computes.',
    text: 'A 128K-token sequence is too long for one GPU’s activations. [[context parallelism|Context parallelism]] cuts the sequence into pieces. Each GPU keeps its own queries and passes **key and value blocks around a ring**, so every query still sees every earlier key. Llama 3 used **16-way** context parallelism for its 131,072-token training stage.',
    hint: 'Pick a sequence length and a split.',
    mission: 'Fit a 128K sequence with at most 8,192 tokens per GPU.',
    takeaway: 'Tokens per GPU = sequence ÷ CP. Attention work per GPU also falls by CP.',
    mount(c) {
      const f = c.fig(420, 170, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Tokens per GPU', value: '', cls: 'data' }, { k: 'a', label: 'Attention pairs per GPU', value: '', cls: 'cmp' }]);
      let seq = 131072, cp = 1; const COL = ['f-data', 'f-mem', 'f-cmp', 'f-ctl'];
      function draw() {
        const n = Math.min(cp, 16), w = 388 / n; let g = `<text class="b sm" x="16" y="24">${fmt.n(seq)} tokens${cp > 16 ? ', cut into ' + cp + ' pieces (16 drawn)' : ''}</text>`;
        for (let i = 0; i < n; i++) g += `<rect x="${(16 + i * w).toFixed(1)}" y="34" width="${(w - 2).toFixed(1)}" height="36" rx="5" class="${COL[i % 4]}"/><text class="xs b" x="${(16 + i * w + w / 2 - 1).toFixed(1)}" y="57" text-anchor="middle" style="fill:var(--on-${['data', 'mem', 'cmp', 'accent'][i % 4]})">${n <= 8 ? 'GPU ' + i : i}</text>`;
        g += `<text class="xs mute" x="16" y="96">${cp === 1 ? 'One GPU holds everything.' : 'Each GPU keeps its own queries and ring-passes keys and values.'}</text>`;
        if (cp > 1) g += `<path class="ln s2 dash" d="M${(16 + w / 2).toFixed(1)} 76 H${(16 + 388 - w / 2).toFixed(1)}" marker-end="url(#ah-ink)"/>`;
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="150">${cp > 1 ? cp + ' ring steps per attention layer, overlapped with compute.' : ''}</text>`;
        const loc = seq / cp, pairs = loc * seq;
        st.set('t', fmt.n(loc), seq === 131072 ? 'target: 8,192 or fewer' : 'sequence ÷ ' + cp); st.set('a', kit.sci(pairs, 1), 's × s ÷ CP, per head');
        c.mission.set(seq === 131072 && loc <= 8192);
      }
      c.seg({ label: 'Sequence length', options: [['8192', '8K'], ['32768', '32K'], ['131072', '128K'], ['1048576', '1M']], value: '131072', onChange: v => { seq = +v; draw(); } });
      c.seg({ label: 'Context-parallel degree', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['32', '32'], ['64', '64']], value: '1', onChange: v => { cp = +v; draw(); } });
      draw();
      c.demo(1500, async () => { cp = 16; draw(); });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'layout', tag: 'Putting it together',
    title: 'Design the layout for 16,384 GPUs',
    alt: 'Controls set the tensor, context and pipeline parallel degrees, the number of microbatches and the sequence length. The data-parallel degree follows from the 16,384 GPUs. Five check rows turn green or red: all GPUs used, tensor parallelism inside a node, model state fits, activations fit, and a pipeline bubble under 15 percent.',
    text: 'Big runs combine every split. **Tensor parallel** goes inside a node, **pipeline** and **context** parallel span nodes, and **data parallel** uses what is left. Llama 3 405B used **TP 8, CP 1, PP 16, DP 128** for 8K sequences and **TP 8, CP 16, PP 16, DP 8** for 128K. Find a layout that passes all five checks.',
    hint: 'Set the degrees. Then try the 128K sequence.',
    mission: 'Pass all five checks for the 8K sequence.',
    takeaway: 'Each axis fixes one problem and adds one cost. A layout is a trade between memory, communication and idle time.',
    mount(c) {
      const NG = 16384, PSI = 405e9, HID = 16384, LAY = 126;
      const f = c.fig(420, 262, '<g id="g"></g>');
      const st = c.stats([{ k: 'd', label: 'Data-parallel degree', value: '', cls: 'mem' }, { k: 'p', label: 'Checks passed', value: '', cls: 'ok' }]);
      let tp = 1, cpd = 1, pp = 1, M = 16, seq = 8192;
      function draw() {
        const prod = tp * cpd * pp, dp = NG / prod, valid = prod <= NG;
        const state = valid ? 4 * PSI / (tp * pp) + 12 * PSI / (tp * pp * dp) : Infinity, act = 34 * (seq / cpd) * HID * (LAY / pp) / tp, bub = (pp - 1) / (M + pp - 1);
        const checks = [
          [valid, 'Uses all 16,384 GPUs', valid ? 'DP = ' + fmt.n(dp) : 'needs ' + fmt.n(prod) + ' GPUs'],
          [tp <= 8, 'Tensor parallel stays in a node', 'TP ' + tp + (tp <= 8 ? ' of 8 on NVLink' : ': crosses nodes')],
          [state <= 50e9, 'Model state fits', valid ? fmt.bytes(state, 1) + ' of 50 GB' : 'not valid'],
          [act <= 30e9, 'Activations fit', fmt.bytes(act, 1) + ' of 30 GB'],
          [bub <= 0.15, 'Pipeline bubble under 15%', (bub * 100).toFixed(0) + '%']
        ];
        let g = `<text class="b sm" x="16" y="24">TP ${tp} × CP ${cpd} × PP ${pp} × DP ${valid ? fmt.n(dp) : '?'}</text><text class="xs mute" x="16" y="42">${seq / 1024}K tokens per sequence, ${M} microbatches, 405B dense model</text>`;
        checks.forEach((ch, i) => { const y = 62 + i * 38; g += `<rect x="16" y="${y}" width="388" height="32" rx="8" class="${ch[0] ? 't-ok' : 't-bad'}"/><text class="b sm" x="30" y="${y + 21}">${ch[0] ? '✓' : '×'}</text><text class="xs b" x="52" y="${y + 20}">${ch[1]}</text><text class="xs m" x="396" y="${y + 20}" text-anchor="end">${ch[2]}</text>`; });
        f.q('#g').innerHTML = g;
        const ok = checks.filter(x => x[0]).length;
        st.set('d', valid ? fmt.n(dp) : 'none', valid ? NG + ' ÷ (' + tp + ' × ' + cpd + ' × ' + pp + ')' : 'too many GPUs asked for'); st.set('p', ok + ' of 5', ok === 5 ? 'a valid layout' : 'keep adjusting');
        c.mission.set(seq === 8192 && ok === 5);
      }
      c.seg({ label: 'Tensor parallel (TP)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], value: '1', onChange: v => { tp = +v; draw(); } });
      c.seg({ label: 'Pipeline parallel (PP)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['32', '32']], value: '1', onChange: v => { pp = +v; draw(); } });
      c.seg({ label: 'Context parallel (CP)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], value: '1', onChange: v => { cpd = +v; draw(); } });
      c.slider({ label: 'Microbatches per step', values: [4, 8, 16, 32, 64, 128], value: 16, fmt: v => v, onInput: v => { M = v; draw(); } });
      c.seg({ label: 'Sequence length', options: [['8192', '8K'], ['131072', '128K']], value: '8192', onChange: v => { seq = +v; draw(); } });
      c.note('Simplified checks. State uses ZeRO-1 sharding over the data-parallel group. Activations are about 34 bytes per token per hidden unit per layer, without recomputation.');
      draw();
      c.demo(1500, async () => { tp = 8; pp = 8; M = 64; draw(); });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'moe', tag: 'Putting it together',
    title: 'Mixture of experts: big memory, small compute',
    alt: 'Two bars compare memory, which depends on all parameters, with compute per token, which depends only on the parameters a token uses. Controls set the total parameters and the active parameters, and buttons load real models. A counter shows how much cheaper a token is than in a dense model of the same size.',
    text: 'A [[moe|mixture of experts]] replaces each feed-forward block with many experts. A router sends each token to only a few. **Memory depends on all parameters. Compute depends only on the active ones.** DeepSeek-V3 has 671B parameters and uses 37B per token, so training compute per token is that of a 37B dense model. Experts sit on different GPUs and tokens travel to them by all-to-all.',
    hint: 'Load a real model, then change the sizes.',
    mission: 'Make a 2-trillion-parameter model cost no more per token than a 100B dense one.',
    takeaway: 'MoE buys parameters with memory and communication, not with compute.',
    mount(c) {
      const f = c.fig(420, 168, '<g id="b"></g>');
      const st = c.stats([{ k: 'a', label: 'Active share of parameters', value: '', cls: 'cmp' }, { k: 'c', label: 'Cheaper per token than dense', value: '', cls: 'data' }, { k: 'g', label: 'GPUs for the training state', value: '', cls: 'mem' }]);
      let total = 2e12, active = 2e12;
      function draw() {
        f.q('#b').innerHTML = kit.bar(16, 34, 388, 16, lg(16 * total, 10, 14), 'f-mem', 'Training memory, 16 bytes × total parameters (log scale)', fmt.bytes(16 * total, 1)) +
          kit.bar(16, 90, 388, 16, lg(6 * active, 9, 13), 'f-cmp', 'Compute per token, 6 × active parameters (log scale)', kit.sci(6 * active, 1)) +
          `<text class="xs mute" x="16" y="136">${nfmt(total)} parameters in total, ${nfmt(active)} used by each token.</text><text class="xs mute" x="16" y="152">Dense reference: every parameter is active.</text>`;
        st.set('a', (active / total * 100).toFixed(active / total < 0.1 ? 1 : 0) + '%', nfmt(active) + ' of ' + nfmt(total)); st.set('c', (total / active).toFixed(total / active >= 10 ? 0 : 1) + '×', 'same memory, less compute'); st.set('g', fmt.n(Math.ceil(16 * total / 80e9)), 'of 80 GB, before activations');
        c.mission.set(total === 2e12 && active <= 100e9);
      }
      const slT = c.slider({ label: 'Total parameters', values: [47e9, 671e9, 2e12], value: 2e12, fmt: nfmt, onInput: v => { total = v; if (active > total) active = total; draw(); } });
      const slA = c.slider({ label: 'Active per token', values: [13e9, 37e9, 100e9, 400e9, 2e12], value: 2e12, fmt: nfmt, onInput: v => { active = Math.min(v, total); draw(); } });
      c.btn('Mixtral 8×7B', () => { total = 47e9; active = 13e9; slT.set(47e9, true); slA.set(13e9, true); draw(); }, { small: true });
      c.btn('DeepSeek-V3', () => { total = 671e9; active = 37e9; slT.set(671e9, true); slA.set(37e9, true); draw(); }, { small: true });
      c.note('Mixtral 8×7B: about 47B total and 13B active. DeepSeek-V3: 671B total and 37B active. Router and shared layers are included in the totals.');
      draw();
      c.demo(1500, async () => { active = 100e9; slA.set(100e9, true); draw(); });
    }
  });

  /* 13 --------------------------------------------------------------- */
  const FMTS = {
    fp32: { n: 'FP32', e: 8, m: 23, bias: 127, max: 3.4028235e38 },
    bf16: { n: 'BF16', e: 8, m: 7, bias: 127, max: 3.3895314e38 },
    fp16: { n: 'FP16', e: 5, m: 10, bias: 15, max: 65504 },
    e4m3: { n: 'FP8 E4M3', e: 4, m: 3, bias: 7, max: 448 },
    e5m2: { n: 'FP8 E5M2', e: 5, m: 2, bias: 15, max: 57344 }
  };
  function roundTo(x, F) {
    if (x === 0) return 0;
    const minExp = 1 - F.bias; let e = Math.floor(Math.log2(x)); if (e < minExp) e = minExp;
    const q = Math.pow(2, e - F.m); let r = Math.round(x / q) * q;
    if (r > F.max) return Infinity;
    return r;
  }
  S.push({
    id: 'formats', tag: 'Precision',
    title: 'Range and precision in 16 bits and fewer',
    alt: 'A row of bit boxes shows how a number format splits its bits into sign, exponent and mantissa. A format selector and a slider set a value between ten to the minus twelve and ten to the six. The page shows the value as stored, the rounding error, and whether it underflowed to zero or overflowed.',
    text: 'A float has a **sign**, an **exponent** that sets the range, and a **mantissa** that sets the precision. [[bf16|BF16]] keeps FP32’s 8 exponent bits and has 7 mantissa bits, so it has range and little precision. **FP16** has more precision and a small range. **FP8** formats halve memory again and double tensor-core speed on an H100, with very little room.',
    hint: 'Pick a format, then slide the value.',
    mission: 'Find a 16-bit format that stores 10⁻¹⁰ without rounding it to zero.',
    takeaway: 'Gradients span many orders of magnitude. Range matters more than precision, which is why BF16 won.',
    mount(c) {
      const f = c.fig(420, 222, '<g id="bits"></g><g id="t"></g>');
      const st = c.stats([{ k: 'v', label: 'Stored value', value: '', cls: 'mem' }, { k: 'e', label: 'Relative error', value: '', cls: 'cmp' }, { k: 's', label: 'Status', value: '', cls: 'ok' }]);
      let key = 'fp16', lv = -3;
      const sciv = v => v === 0 ? '0' : !isFinite(v) ? 'infinity' : kit.sci(v, 2);
      let sl;
      function draw() {
        const F = FMTS[key], x = Math.pow(10, lv), r = roundTo(x, F), bits = 1 + F.e + F.m, bw = Math.min(11, 388 / bits);
        let b = `<text class="b sm" x="16" y="24">${F.n}: 1 sign, ${F.e} exponent, ${F.m} mantissa bits</text>`;
        for (let i = 0; i < bits; i++) b += `<rect x="${(16 + i * bw).toFixed(1)}" y="34" width="${(bw - 1.6).toFixed(1)}" height="22" rx="2" class="${i === 0 ? 'f-ink' : i <= F.e ? 'f-cmp' : 'f-data'}" style="${i === 0 ? 'fill:var(--ink)' : ''}"/>`;
        f.q('#bits').innerHTML = b;
        const minN = Math.pow(2, 1 - F.bias), minS = Math.pow(2, 1 - F.bias - F.m);
        f.q('#t').innerHTML = `<text class="xs" x="16" y="82">Largest value: ${sciv(F.max)}</text><text class="xs" x="16" y="98">Smallest normal: ${sciv(minN)}</text><text class="xs" x="16" y="114">Smallest subnormal: ${sciv(minS)}</text><text class="xs mute" x="16" y="140">Orange: exponent bits set the range.</text><text class="xs mute" x="16" y="156">Green: mantissa bits set the precision.</text><text class="b sm" x="16" y="190">You store ${sciv(x)}</text><text class="xs mute" x="16" y="208">It becomes ${sciv(r)} in ${F.n}.</text>`;
        const err = !isFinite(r) ? 1 : r === 0 ? 1 : Math.abs(r - x) / x, status = !isFinite(r) ? 'overflow' : r === 0 ? 'underflow' : x < minN ? 'subnormal' : 'ok';
        st.set('v', sciv(r), status === 'underflow' ? 'rounded to zero' : ''); st.set('e', status === 'ok' || status === 'subnormal' ? (err * 100 < 0.01 ? '< 0.01%' : (err * 100).toFixed(err * 100 < 10 ? 2 : 0) + '%') : '100%', ''); st.set('s', status, status === 'ok' ? 'stored fine' : status === 'subnormal' ? 'few bits of precision left' : 'the value is lost');
        c.mission.set((key === 'bf16' || key === 'fp16') && lv >= -10.3 && lv <= -9.7 && r !== 0);
      }
      c.seg({ label: 'Format', options: [['fp32', 'FP32'], ['bf16', 'BF16'], ['fp16', 'FP16'], ['e4m3', 'FP8 E4M3'], ['e5m2', 'FP8 E5M2']], value: 'fp16', onChange: v => { key = v; draw(); } });
      sl = c.slider({ label: 'Value to store (power of ten)', min: -12, max: 6, step: 0.1, value: -3, fmt: v => '10' + kit.sup(+v.toFixed(1)), onInput: v => { lv = v; draw(); } });
      c.btn('A gradient: 10⁻⁷', () => sl.set(-7), { small: true }); c.btn('A weight: 0.02', () => sl.set(-1.7), { small: true }); c.btn('An outlier: 5,000', () => sl.set(3.7), { small: true });
      draw();
      c.demo(1500, async () => { key = 'bf16'; lv = -10; sl.set(-10, true); draw(); });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'lossscale', tag: 'Precision',
    title: 'FP16 needs a loss scale to keep tiny gradients',
    alt: 'A histogram of gradient sizes on a log axis. Bars below the FP16 underflow line or above the overflow line are red and are lost. A slider sets the loss scale, a power of two, which moves both lines. Counters show the share lost to underflow and overflow. A switch shows that BF16 needs no scaling.',
    text: 'FP16 cannot store numbers below about **6 × 10⁻⁸**, and many gradients are smaller. [[loss scaling|Loss scaling]] multiplies the loss by a large factor S so gradients land in range, then divides the update by S. Too small and gradients vanish. Too large and the biggest overflow. PyTorch starts at S = 65,536 and adjusts it. **BF16** needs none.',
    hint: 'Slide the loss scale until the red bars disappear.',
    mission: 'Find a loss scale that loses under 1% of gradients and overflows none.',
    takeaway: 'Loss scaling is a workaround for FP16’s small range. BF16 has the range and skips it.',
    mount(c) {
      const MU = -8, SG = 1.6, X0 = 36, W = 368, Y1 = 150, HMAX = 100, LO = -14, HI = 2;
      const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
      function erf(x) { const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); }
      const f = c.fig(420, 218, '<g id="h"></g><g id="l"></g>');
      const st = c.stats([{ k: 'u', label: 'Lost to underflow', value: '', cls: 'bad' }, { k: 'o', label: 'Lost to overflow', value: '', cls: 'bad' }, { k: 's', label: 'Loss scale S', value: '', cls: 'mem' }]);
      let k = 0, bf = false;
      const xo = lv => X0 + (lv - LO) / (HI - LO) * W;
      function draw() {
        const S_ = Math.pow(2, k), lo = bf ? -42 : Math.log10(3e-8) - Math.log10(S_), hi = bf ? 38 : Math.log10(65504) - Math.log10(S_);
        let h = '', pu = Phi((lo - MU) / SG), po = 1 - Phi((hi - MU) / SG);
        for (let b = LO; b < HI; b += 0.5) {
          const p = Phi((b + 0.5 - MU) / SG) - Phi((b - MU) / SG), hgt = p / 0.095 * HMAX, mid = b + 0.25, bad = mid < lo || mid > hi;
          h += `<rect x="${(xo(b) + 0.5).toFixed(1)}" y="${(Y1 - hgt).toFixed(1)}" width="${(W / (HI - LO) * 0.5 - 1).toFixed(1)}" height="${hgt.toFixed(1)}" rx="1.5" class="${bad ? 'f-bad' : 'f-ok'}"/>`;
        }
        h += `<line class="axis" x1="${X0}" x2="${X0 + W}" y1="${Y1}" y2="${Y1}"/>`; for (let v = LO; v <= HI; v += 2) h += `<text class="xs m mute" x="${xo(v).toFixed(1)}" y="${Y1 + 16}" text-anchor="middle">${v === 0 ? '1' : '10' + kit.sup(v)}</text>`;
        f.q('#h').innerHTML = h + `<text class="xs mute" x="${X0}" y="${Y1 + 34}">size of each gradient value, before scaling</text>`;
        const lines = (lo > LO && lo < HI ? `<line class="ln" x1="${xo(lo).toFixed(1)}" x2="${xo(lo).toFixed(1)}" y1="14" y2="${Y1}" style="stroke:var(--ink);stroke-width:2;stroke-dasharray:4 3"/><text class="xs b" x="${(xo(lo) + 4).toFixed(1)}" y="26">underflow</text>` : '') + (hi > LO && hi < HI ? `<line class="ln" x1="${xo(hi).toFixed(1)}" x2="${xo(hi).toFixed(1)}" y1="14" y2="${Y1}" style="stroke:var(--ink);stroke-width:2;stroke-dasharray:4 3"/><text class="xs b" x="${(xo(hi) - 4).toFixed(1)}" y="26" text-anchor="end">overflow</text>` : '');
        f.q('#l').innerHTML = lines + (bf ? `<text class="xs b" x="${X0 + 6}" y="26">BF16 covers every size shown here.</text>` : '');
        st.set('u', (pu * 100 < 0.01 ? '< 0.01' : (pu * 100).toFixed(pu * 100 < 10 ? 1 : 0)) + '%', bf ? 'BF16: none' : 'smaller than 3 × 10⁻⁸ ÷ S'); st.set('o', (po * 100 < 0.01 ? '0' : (po * 100).toFixed(2)) + '%', bf ? 'BF16: none' : 'larger than 65,504 ÷ S'); st.set('s', bf ? 'not needed' : '2' + kit.sup(k), bf ? 'BF16 has the range' : fmt.n(S_));
        c.mission.set(!bf && pu < 0.01 && po < 0.0001);
      }
      const sl = c.slider({ label: 'Loss scale S, as a power of two', min: 0, max: 30, step: 1, value: 0, fmt: v => '2' + kit.sup(v), onInput: v => { k = v; draw(); } });
      c.toggle({ label: 'Use BF16 instead of FP16', value: false, onChange: v => { bf = v; draw(); } });
      c.note('Toy: gradient sizes follow a log-normal spread, centered on 10⁻⁸. Real spreads vary by layer and step.');
      draw();
      c.demo(1500, async () => { k = 16; sl.set(16, true); draw(); });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'failures', tag: 'Keeping it running',
    title: 'At this scale something breaks every few hours',
    alt: 'A chart of wasted time against the checkpoint interval on a log axis. The curve is high for very short intervals because of constant writing, and high for very long ones because of lost work. A dot marks the chosen interval and a hollow ring marks the best one. Controls set the GPU count, the checkpoint write time and the interval.',
    text: 'At 16,384 GPUs something fails about **every 3 hours**. Llama 3 logged 419 unexpected interruptions in 54 days, about 78% from hardware. A failure loses the work since the last checkpoint and the restart time. Checkpoint too rarely and you lose hours. Too often and you spend the run writing. The best interval is near **√(2 × write time × time between failures)**.',
    hint: 'Move the interval, the write time and the GPU count.',
    mission: 'Keep wasted time under 10%.',
    takeaway: 'Waste = write time ÷ interval + (interval ÷ 2 + restart) ÷ time between failures. Fast checkpoints matter more as the cluster grows.',
    mount(c) {
      const GPU_MTBF_H = 50700, R = 600;
      const ch = kit.chart({ x: 44, y: 16, w: 356, h: 118, xmin: 60, xmax: 86400, ymin: 0, ymax: 50, xlog: true, xt: [60, 600, 3600, 21600, 86400], xf: v => v === 60 ? '1 min' : v === 600 ? '10 min' : v === 3600 ? '1 h' : v === 21600 ? '6 h' : '24 h', yt: [10, 20, 30, 40, 50], yf: v => v + '%', xlabel: 'time between checkpoints (log scale)' });
      const f = c.fig(420, 206, `${ch.svg}<line class="ln dash" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(10)}" y2="${ch.Y(10)}" style="stroke:var(--ok)"/><path id="cv" class="s-cmp s3" fill="none"/><circle id="best" r="7" class="none-f" style="stroke:var(--ink);stroke-width:2"/><circle id="dot" r="5.5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/><text class="xs mute" x="${ch.x0 + 6}" y="${ch.Y(10) - 6}">10% target</text>`);
      const st = c.stats([{ k: 'm', label: 'Time between failures', value: '', cls: 'bad' }, { k: 'b', label: 'Best interval', value: '', cls: 'ok' }, { k: 'w', label: 'Wasted time now', value: '', cls: 'cmp' }]);
      let n = 16384, dl = 60, tau = 1800;
      const waste = (t, M) => dl / t + (t / 2 + R) / M;
      function draw() {
        const M = GPU_MTBF_H * 3600 / n, best = Math.sqrt(2 * dl * M), pts = [];
        for (let t = 60; t <= 86400.1; t *= 1.1) pts.push([ch.X(t), ch.Y(Math.min(50, waste(t, M) * 100))]);
        f.q('#cv').setAttribute('d', kit.path(pts));
        f.q('#best').setAttribute('cx', ch.X(kit.clamp(best, 60, 86400))); f.q('#best').setAttribute('cy', ch.Y(Math.min(50, waste(kit.clamp(best, 60, 86400), M) * 100)));
        f.q('#dot').setAttribute('cx', ch.X(tau)); f.q('#dot').setAttribute('cy', ch.Y(Math.min(50, waste(tau, M) * 100)));
        const w = waste(tau, M) * 100;
        st.set('m', (M / 3600).toFixed(M / 3600 < 10 ? 1 : 0) + ' h', fmt.n(n) + ' GPUs'); st.set('b', best < 5400 ? Math.round(best / 60) + ' min' : (best / 3600).toFixed(1) + ' h', 'waste there: ' + (waste(best, M) * 100).toFixed(1) + '%'); st.set('w', w.toFixed(w < 10 ? 1 : 0) + '%', w < 10 ? 'under the target' : 'over the target');
        c.mission.set(w < 10);
      }
      c.slider({ label: 'GPUs', values: [1024, 4096, 16384, 65536, 131072], value: 16384, fmt: v => fmt.n(v), onInput: v => { n = v; draw(); } });
      c.seg({ label: 'Checkpoint write time', options: [['5', '5 s'], ['15', '15 s'], ['60', '1 min'], ['300', '5 min']], value: '60', onChange: v => { dl = +v; draw(); } });
      c.slider({ label: 'Time between checkpoints', min: 60, max: 86400, log: true, value: 1800, fmt: v => v < 5400 ? Math.round(v / 60) + ' min' : (v / 3600).toFixed(1) + ' h', onInput: v => { tau = v; draw(); } });
      c.note('Assumes a 10-minute restart and a per-GPU failure rate matching Llama 3: one interruption per 3.1 hours on 16,384 GPUs.');
      draw();
      c.demo(1500, async () => { dl = 5; draw(); });
    }
  });

  /* 16 --------------------------------------------------------------- */
  S.push({
    id: 'data', tag: 'Keeping it running',
    title: 'What 15 trillion tokens looks like',
    alt: 'Four bars show how a training set is mixed: general knowledge, math and reasoning, code, and multilingual text, with token counts for the chosen total. A slider sets the total tokens. Counters show the words and the years one person would need to read them.',
    text: 'The data is a **pipeline**, not a download: crawl, extract text, remove duplicates, filter for quality, then mix sources. Llama 3’s published mix was about **50% general knowledge, 25% math and reasoning, 17% code and 8% multilingual**. 15 trillion tokens is about 11 trillion words. One person reading nonstop would need roughly **86,000 years**.',
    hint: 'Change the total number of tokens.',
    takeaway: 'Data quality and mix are design choices as large as the architecture.',
    mount(c) {
      const f = c.fig(420, 262, '<g id="b"></g>');
      const st = c.stats([{ k: 'w', label: 'Words', value: '', cls: 'mem' }, { k: 'y', label: 'Years for one person to read', value: '', cls: 'cmp' }, { k: 'b', label: 'Books of 90,000 words', value: '', cls: 'data' }]);
      let D = 15e12;
      function draw() {
        const mix = [['General knowledge', 0.5, 'f-data'], ['Math and reasoning', 0.25, 'f-mem'], ['Code', 0.17, 'f-cmp'], ['Multilingual', 0.08, 'f-ctl']];
        let b = `<text class="b sm" x="16" y="22">One crawl, five steps</text>`;
        ['Crawl', 'Extract text', 'Deduplicate', 'Filter quality', 'Mix'].forEach((s, i) => { b += `<rect class="t-ctl" x="${16 + i * 78}" y="32" width="72" height="26" rx="7"/><text class="xs b" x="${16 + i * 78 + 36}" y="49" text-anchor="middle">${s}</text>`; });
        mix.forEach((m, i) => { b += kit.bar(16, 98 + i * 40, 388, 14, m[1], m[2], m[0], nfmt(D * m[1]) + ' tokens'); });
        f.q('#b').innerHTML = b + `<text class="xs mute" x="16" y="${98 + 4 * 40 + 4}">Mix from the Llama 3 report. Share of the total.</text>`;
        const words = 0.75 * D, years = words / 250 / 60 / 24 / 365;
        st.set('w', nfmt(words), '0.75 words per token'); st.set('y', fmt.n(Math.round(years)), 'at 250 words a minute, no breaks'); st.set('b', fmt.n(Math.round(words / 9e4 / 1e6)) + ' million', 'about the size of a long novel');
      }
      c.slider({ label: 'Training tokens', values: [1e12, 5e12, 15e12, 40e12], value: 15e12, fmt: nfmt, onInput: v => { D = v; draw(); } });
      draw();
    }
  });

  /* 17 --------------------------------------------------------------- */
  S.push({
    id: 'cost', tag: 'Keeping it running',
    title: 'What the 2-trillion-parameter run costs',
    alt: 'A bar on a log scale shows training time in days with a marker at 100 days. Controls set the share of parameters active per token, the number of tokens, the number of GPUs, the utilization and the price per GPU-hour. Counters show GPU-hours, dollars and power.',
    text: 'Days = 6 × active parameters × tokens ÷ (GPUs × [[mfu|utilization]] × 989 TFLOPS). A **dense** 2T model on 15 trillion tokens needs 1.8 × 10²⁶ operations: **320 days on 16,384 GPUs**, over **120 million GPU-hours**. A mixture of experts with 5% of parameters active needs one twentieth of that. For scale, Llama 3 405B used 30.8 million GPU-hours.',
    hint: 'Change the active share, the GPUs and the utilization.',
    mission: 'Train the 2T model on 15 trillion tokens in under 100 days.',
    takeaway: 'Active parameters, tokens, GPUs and utilization all multiply. A run is a budget of GPU-hours.',
    mount(c) {
      const f = c.fig(420, 124, '<g id="b"></g>');
      const st = c.stats([{ k: 'g', label: 'GPU-hours', value: '', cls: 'mem' }, { k: 'd', label: 'Cost', value: '', cls: 'cmp' }, { k: 'p', label: 'Power draw', value: '', cls: 'bad' }]);
      let share = 1, D = 15e12, G = 16384, mfu = 0.4, price = 2;
      function draw() {
        const act = 2e12 * share, flops = 6 * act * D, secs = flops / (G * mfu * H100), days = secs / 86400, gh = G * secs / 3600, x = 16 + lg(100, 0, 3) * 388;
        f.q('#b').innerHTML = kit.bar(16, 34, 388, 16, lg(days, 0, 3), days < 100 ? 'f-ok' : 'f-cmp', 'Training time (log scale, 1 to 1,000 days)', days < 10 ? days.toFixed(1) + ' days' : fmt.n(Math.round(days)) + ' days') +
          `<line class="ln" x1="${x}" x2="${x}" y1="36" y2="64" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x}" y="78" text-anchor="middle">100 days</text><text class="xs mute" x="16" y="104">${nfmt(act)} active parameters × ${nfmt(D)} tokens = ${kit.sci(flops, 1)} operations.</text><text class="xs mute" x="16" y="120">Perfect scaling, no failures. Real runs lose more.</text>`;
        st.set('g', +(gh / 1e6).toPrecision(3) + ' million', fmt.n(G) + ' GPUs × ' + days.toFixed(0) + ' days'); st.set('d', '$' + (gh * price / 1e6 < 10 ? (gh * price / 1e6).toFixed(1) : fmt.n(Math.round(gh * price / 1e6))) + ' million', '$' + price + ' per GPU-hour'); st.set('p', (G * 1.4 / 1000).toFixed(G * 1.4 / 1000 < 10 ? 1 : 0) + ' MW', 'about 1.4 kW per GPU, all in (assumed)');
        c.mission.set(D === 15e12 && days < 100);
      }
      c.seg({ label: 'Active share of parameters', options: [['1', 'Dense, 100%'], ['0.25', '25%'], ['0.05', '5%']], value: '1', onChange: v => { share = +v; draw(); } });
      c.seg({ label: 'Training tokens', options: [['15000000000000', '15T'], ['30000000000000', '30T']], value: '15000000000000', onChange: v => { D = +v; draw(); } });
      c.slider({ label: 'GPUs', values: [16384, 32768, 65536, 100000], value: 16384, fmt: v => fmt.n(v), onInput: v => { G = v; draw(); } });
      c.seg({ label: 'Utilization of peak speed', options: [['0.3', '30%'], ['0.4', '40%'], ['0.5', '50%']], value: '0.4', onChange: v => { mfu = +v; draw(); } });
      c.seg({ label: 'Price per GPU-hour', options: [['2', '$2'], ['3', '$3']], value: '2', onChange: v => { price = +v; draw(); } });
      draw();
      c.demo(1500, async () => { share = 0.05; draw(); });
    }
  });

  /* 18 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'How much memory does mixed-precision Adam training need per parameter?', o: ['2 bytes', '4 bytes', '8 bytes', '16 bytes'], a: 3, why: 'bf16 weights 2, bf16 gradients 2, fp32 master copy 4, Adam mean 4 and variance 4 add up to 16 bytes.' },
      { q: 'About how many operations does training use per parameter per token?', o: ['6', '2', '12', '1'], a: 0, why: 'Forward costs 2 operations per parameter and backward costs 4, so a run costs 6 × N × D.' },
      { q: 'In a ring all-reduce over N GPUs, how much does each GPU send, compared with the gradient size?', o: ['N times as much', 'Half as much', 'About 2 times, as 2(N − 1) ÷ N', 'The same as one GPU alone'], a: 2, why: 'N − 1 steps to add and N − 1 to share, each moving 1 ÷ N of the gradient. The total stays near 2 gradients as N grows.' },
      { q: 'Which ZeRO stage lets a 70B model’s training state fit in 80 GB across 64 GPUs?', o: ['Stage 0', 'Stage 3', 'Stage 1', 'Stage 2'], a: 1, why: 'Stages 1 and 2 still keep 2 bytes per parameter for the weights, which is 140 GB. Only stage 3 shards the parameters too.' },
      { q: 'Why does tensor parallelism stay inside one node?', o: ['It cannot use more than 8 GPUs by design', 'It uses more memory across nodes', 'Its all-reduces are on the critical path and need NVLink speed', 'It only works with MoE models'], a: 2, why: 'Four all-reduces per layer sit between compute steps. At 50 GB/s between nodes, communication outweighs compute.' },
      { q: 'A pipeline has 8 stages and 64 microbatches. About how large is the bubble?', o: ['About 10%', 'About 50%', 'About 1%', 'About 25%'], a: 0, why: '(P − 1) ÷ (M + P − 1) = 7 ÷ 71, about 9.9%.' },
      { q: 'Why does BF16 not need loss scaling when FP16 does?', o: ['BF16 has more mantissa bits', 'BF16 is stored in 8 bits', 'BF16 keeps FP32’s 8 exponent bits, so tiny gradients stay in range', 'BF16 never rounds'], a: 2, why: 'Range comes from exponent bits. BF16 matches FP32’s range, while FP16 runs out below about 6 × 10⁻⁸.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g style="stroke:var(--ink-3);stroke-width:1.2;opacity:.55"><path d="M60 40 H260 M60 75 H260 M60 110 H260 M60 40 V110 M110 40 V110 M160 40 V110 M210 40 V110 M260 40 V110"/></g>'
    + [0, 1, 2, 3, 4].map(i => [0, 1, 2].map(j => `<rect x="${48 + i * 50}" y="${30 + j * 35}" width="24" height="20" rx="5" style="fill:var(--${['mem', 'cmp', 'data'][j]});opacity:.9"/>`).join('')).join('')
    + '<text x="48" y="20" style="font:600 11px var(--font-mono);fill:var(--ink-3)">TP × PP × DP</text><text x="48" y="142" style="font:600 11px var(--font-mono);fill:var(--ink-3)">16,384 GPUs</text></svg>';

  window.LESSONS.push({
    id: 'training', n: 7, track: 'training', order: 1,
    title: 'Training a 2-Trillion-Parameter Model',
    tagline: 'Memory, compute and the splits that let thousands of GPUs train one model.',
    preview,
    scenes: S
  });
})();
