/* Lesson 9: FlashAttention and kernel fusion. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const lg = (v, lo, hi) => kit.clamp((Math.log10(v) - lo) / (hi - lo), 0.01, 1);
  const kfmt = v => v >= 1e6 ? (v / 1048576) + 'M' : (v / 1024) + 'K';
  const tms = s => s >= 1 ? s.toFixed(2) + ' s' : s >= 1e-3 ? (s * 1e3).toFixed(s * 1e3 < 10 ? 2 : 1) + ' ms' : (s * 1e6).toFixed(0) + ' µs';

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'naive', tag: 'The problem',
    title: 'Attention builds an N × N matrix nobody needs to keep',
    alt: 'Three boxes show the three steps of standard attention: scores, softmax and the weighted sum of values. Two of them hold a square N by N matrix. A bar on a log scale shows the memory those matrices need for 32 heads, with a marker at 80 gigabytes. A slider sets the sequence length.',
    text: 'Standard attention runs three steps: **S = QKᵀ**, **P = softmax(S)**, **O = PV**. S and P are **N × N**: one score for every pair of tokens. In BF16 that is **2N² bytes per head**. At 32K tokens it is 2 GB per head and 69 GB for 32 heads. At 64K it no longer fits in an 80 GB GPU.',
    hint: 'Raise the sequence length.',
    mission: 'Find a length where 32 heads of scores exceed 80 GB.',
    takeaway: 'The N × N matrix is a temporary. If it never has to exist in memory, long sequences stop costing N² bytes.',
    mount(c) {
      const f = c.fig(420, 208, '<g id="g"></g>');
      const st = c.stats([{ k: 'h', label: 'Scores for one head', value: '', cls: 'mem' }, { k: 'a', label: 'All 32 heads', value: '', cls: 'bad' }, { k: 'n', label: 'Matrix entries per head', value: '', cls: 'cmp' }]);
      let N = 4096;
      function draw() {
        const one = 2 * N * N, all = 32 * one, x80 = 16 + lg(80e9, 6, 12) * 388;
        let g = `<rect class="t-mem" x="16" y="16" width="112" height="40" rx="8"/><text class="xs b" x="72" y="40" text-anchor="middle">S = Q Kᵀ  (N × N)</text><path class="ln s2" d="M130 36 H146" marker-end="url(#ah-ink)"/><rect class="t-cmp" x="150" y="16" width="112" height="40" rx="8"/><text class="xs b" x="206" y="40" text-anchor="middle">P = softmax(S)</text><path class="ln s2" d="M264 36 H280" marker-end="url(#ah-ink)"/><rect class="t-data" x="284" y="16" width="120" height="40" rx="8"/><text class="xs b" x="344" y="40" text-anchor="middle">O = P V</text>`;
        g += kit.bar(16, 92, 388, 16, lg(all, 6, 12), all > 80e9 ? 'f-bad' : 'f-mem', 'Memory for the scores of 32 heads (log scale, 1 MB to 1 TB)', fmt.bytes(all, 1)) + `<line class="ln" x1="${x80.toFixed(1)}" x2="${x80.toFixed(1)}" y1="94" y2="124" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x80.toFixed(1)}" y="138" text-anchor="middle">80 GB</text><text class="xs mute" x="16" y="172">${kfmt(N)} tokens, BF16, 2 bytes per score, one layer.</text><text class="xs mute" x="16" y="188">Training also needs them for the backward pass.</text>`;
        f.q('#g').innerHTML = g;
        st.set('h', fmt.bytes(one, 1), '2 × N²'); st.set('a', fmt.bytes(all, 1), all > 80e9 ? 'over 80 GB' : 'fits, barely useful'); st.set('n', kit.sci(N * N, 1), fmt.n(N) + ' × ' + fmt.n(N));
        c.mission.set(all > 80e9);
      }
      c.slider({ label: 'Sequence length N', values: [1024, 4096, 8192, 16384, 32768, 65536, 131072, 262144], value: 4096, fmt: kfmt, onInput: v => { N = v; draw(); } });
      draw();
      c.demo(1500, async () => { N = 65536; draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'tiling', tag: 'The idea',
    title: 'Tiling: compute the matrix in blocks that stay on chip',
    alt: 'An eight by eight grid of tiles. Each row is a block of queries and each column a block of keys and values. Stepping or running processes one tile at a time. Finished tiles turn green, the current tile is orange, and with causal masking the tiles above the diagonal are skipped.',
    text: '[[flashattention|FlashAttention]] cuts the work into **tiles**. A block of queries stays in **shared memory**. Blocks of keys and values stream through one at a time. For each tile it computes scores, softmax and the weighted sum **entirely on chip** and folds the result into a running output. The N × N matrix **never reaches HBM**.',
    hint: 'Step through the tiles, or run them all.',
    mission: 'Run a full causal attention and see how many tiles are skipped.',
    takeaway: 'One output block is written to HBM once, after all its tiles finish. The scores stay in SRAM.',
    mount(c) {
      const T = 8, X0 = 70, Y0 = 36, CS = 32;
      const f = c.fig(420, 304, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Tiles computed', value: '', cls: 'data' }, { k: 's', label: 'Tiles skipped', value: '', cls: 'mem' }]);
      let i = 0, j = 0, done = false, causal = false, busy = false, userRan = false;
      const reset = () => { i = 0; j = 0; done = false; busy = false; userRan = false; draw(); };
      function draw() {
        let g = `<text class="xs mute" x="${X0}" y="26">K and V blocks →</text>`; let comp = 0, skip = 0;
        for (let r = 0; r < T; r++) { g += `<text class="xs m mute" x="${X0 - 8}" y="${Y0 + r * (CS - 2) + 18}" text-anchor="end">Q${r}</text>`; for (let q = 0; q < T; q++) {
          const sk = causal && q > r, fin = !sk && (r < i || (r === i && q < j) || done), cur = !done && r === i && q === j && !sk; if (sk && (done || r < i || (r === i && q <= j))) skip++; if (fin) comp++;
          g += `<rect x="${X0 + q * 36}" y="${Y0 + r * (CS - 2)}" width="33" height="${CS - 5}" rx="4" class="${sk ? 'well' : cur ? 'f-cmp' : fin ? 'f-data' : 'box'}" style="${sk ? 'opacity:.4;stroke-dasharray:3 3' : ''}"/>`;
        } }
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="${Y0 + T * (CS - 2) + 14}">${done ? 'All tiles done. The output blocks were written to HBM once.' : 'Orange: the tile in flight. Green: finished. Query block ' + i + ' stays in SRAM.'}</text>`;
        const total = causal ? T * (T + 1) / 2 : T * T;
        st.set('t', comp + ' of ' + total, causal ? 'causal: lower triangle only' : 'all tile pairs'); st.set('s', causal ? T * (T - 1) / 2 : 0, causal ? 'above the diagonal' : 'masking is off');
        c.mission.set(causal && done && userRan);
      }
      async function once() {
        if (busy || done) return; busy = true;
        do { j++; if (j >= T) { j = 0; i++; } if (i >= T) { done = true; break; } } while (causal && j > i);
        busy = false; draw();
      }
      async function runAll() { while (!done) { await once(); await c.wait(40); } }
      c.btn('Step', () => { if (done) reset(); userRan = true; once(); }, { small: true });
      c.btn('Run all', async () => { if (done) reset(); userRan = true; await runAll(); }, { small: true });
      c.btn('Reset', reset, { small: true });
      c.toggle({ label: 'Causal mask: skip tiles above the diagonal', value: false, onChange: v => { causal = v; reset(); } });
      c.note('A real kernel uses tiles of 64 to 256 tokens. Eight tiles per side is a drawing, not a size.');
      reset();
      c.play(async () => { await c.wait(500); await runAll(); await c.wait(300); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'online', tag: 'The idea',
    title: 'Online softmax: fix the answer as new blocks arrive',
    alt: 'Eight attention scores shown as bars, split into blocks. Stepping processes one block at a time and updates a running maximum and a running sum. A switch turns the rescaling of the old sum on or off. At the end the computed probabilities are compared with the exact softmax and the error is shown.',
    text: '[[softmax|Softmax]] needs the **maximum** and the **sum of exponentials** of the whole row, but a tile sees only part of it. Keep a **running maximum m** and **running sum l**. When a block raises the maximum, **multiply the old sum by e^(m_old − m_new)** before adding. The result matches the exact softmax, with one pass over the data. This is [[online softmax]].',
    hint: 'Step through the blocks with rescaling off, then on.',
    mission: 'Process the row in blocks of 2 with rescaling on and match the exact softmax.',
    takeaway: 'Without the rescale factor the sum is wrong. With it, blocks can arrive in any order and the answer is exact.',
    mount(c) {
      const X = [1.2, 0.4, 2.5, 3.1, 0.9, 4.0, 2.2, 1.7], BX0 = 36, BW = 40, BASE = 118, f = c.fig(420, 262, '<g id="g"></g>');
      const st = c.stats([{ k: 'm', label: 'Running maximum m', value: '', cls: 'mem' }, { k: 'l', label: 'Running sum l', value: '', cls: 'cmp' }, { k: 'e', label: 'Largest error at the end', value: '', cls: 'bad' }]);
      let bs = 2, resc = false, b = 0, m = -Infinity, l = 0;
      const exact = (() => { const mx = Math.max(...X), s = X.reduce((a, v) => a + Math.exp(v - mx), 0); return X.map(v => Math.exp(v - mx) / s); })();
      function reset() { b = 0; m = -Infinity; l = 0; draw(); }
      function step() {
        const nb = X.length / bs; if (b >= nb) return;
        const blk = X.slice(b * bs, b * bs + bs), mb = Math.max(...blk), mn = Math.max(m, mb), add = blk.reduce((a, v) => a + Math.exp(v - mn), 0);
        l = (resc ? l * Math.exp((m === -Infinity ? mn : m) - mn) : l) + add; m = mn; b++; draw();
      }
      function draw() {
        const nb = X.length / bs, finished = b >= nb; let g = `<text class="xs mute" x="16" y="18">Eight attention scores in blocks of ${bs}. Block ${Math.min(b + 1, nb)} of ${nb} next.</text>`;
        X.forEach((v, k) => { const blk = Math.floor(k / bs), done = blk < b, h = v * 18, x = BX0 + k * BW; g += `<rect x="${x}" y="${BASE - h}" width="${BW - 8}" height="${h}" rx="3" class="${done ? 'f-data' : 'f-mem'}" style="opacity:${done ? 1 : 0.4}"/><text class="xs m" x="${x + (BW - 8) / 2}" y="${BASE + 14}" text-anchor="middle">${v}</text>`; if (k % bs === 0 && k > 0) g += `<line class="ln" x1="${x - 4}" x2="${x - 4}" y1="30" y2="${BASE + 2}" style="stroke:var(--ink-3);stroke-dasharray:3 3"/>`; });
        let pr = ''; if (finished) { const p = X.map(v => Math.exp(v - m) / l); let err = 0; p.forEach((v, k) => { err = Math.max(err, Math.abs(v - exact[k])); const x = BX0 + k * BW; pr += `<rect x="${x}" y="${236 - v * 150}" width="${BW - 8}" height="${v * 150}" rx="3" class="${err > 1e-9 ? 'f-bad' : 'f-ok'}" style="opacity:.9"/><circle cx="${x + (BW - 8) / 2}" cy="${236 - exact[k] * 150}" r="3.5" class="ink-f"/><text class="xs m" x="${x + (BW - 8) / 2}" y="${252}" text-anchor="middle">${v.toFixed(2)}</text>`; });
          g += `<text class="xs mute" x="16" y="${156}">Computed probabilities (bars) and exact softmax (dots)</text>`; }
        f.q('#g').innerHTML = g + pr;
        let err = 0; if (finished) { const p = X.map(v => Math.exp(v - m) / l); p.forEach((v, k) => err = Math.max(err, Math.abs(v - exact[k]))); }
        st.set('m', m === -Infinity ? 'none yet' : m.toFixed(2), 'max seen so far'); st.set('l', l ? l.toFixed(3) : '0', resc ? 'rescaled when m grows' : 'never rescaled'); st.set('e', finished ? (err < 1e-9 ? '0' : err.toFixed(3)) : 'unfinished', finished ? (err < 1e-9 ? 'exact' : 'wrong sum') : 'step to the end');
        c.mission.set(bs === 2 && resc && finished && err < 1e-9);
      }
      c.seg({ label: 'Block size', options: [['8', '8'], ['4', '4'], ['2', '2'], ['1', '1']], value: '2', onChange: v => { bs = +v; reset(); } });
      c.toggle({ label: 'Rescale the old sum when the maximum grows', value: false, onChange: v => { resc = v; reset(); } });
      c.btn('Next block', () => { if (b >= X.length / bs) reset(); step(); }, { small: true }); c.btn('Run all', async () => { reset(); const nb = X.length / bs; for (let i = 0; i < nb; i++) { step(); await c.wait(200); } }, { small: true });
      reset();
      c.demo(1500, async () => { resc = true; reset(); for (let i = 0; i < 4; i++) { step(); await c.wait(250); } });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'traffic', tag: 'The idea',
    title: 'How much HBM traffic tiling really saves',
    alt: 'Two bars on a log scale compare the HBM traffic of standard attention with FlashAttention for one head. Controls set the head dimension, the tile size and the sequence length. A check shows whether the tile fits in shared memory, and a counter shows the traffic cut.',
    text: 'Standard attention moves about **4N²** values through HBM: S written and read, P written and read. FlashAttention reads K and V once per query block, about **2N²d ÷ B** values for tiles of B query rows. The cut is roughly **2B ÷ d**. With d = 128 and B = 128 that is **2 times**. Narrow heads and bigger tiles save more, if the tile fits.',
    hint: 'Change the head dimension and the tile size.',
    mission: 'Cut HBM traffic by 4 times or more with a tile that fits in shared memory.',
    takeaway: 'The saving is modest at d = 128. The bigger win is memory: O(N) instead of O(N²), which is what makes 128K contexts possible.',
    mount(c) {
      const f = c.fig(420, 160, '<g id="g"></g>');
      const st = c.stats([{ k: 'r', label: 'Traffic cut', value: '', cls: 'ok' }, { k: 't', label: 'Tile in shared memory', value: '', cls: 'mem' }]);
      let d = 128, B = 128, N = 16384;
      function draw() {
        const naive = (4 * N * N + 4 * N * d) * 2, flash = (2 * N * d + 2 * N * N * d / B) * 2, tile = (B + 2 * B) * d * 2 + B * B * 4, fits = tile <= 227 * 1024, r = naive / flash;
        f.q('#g').innerHTML = kit.bar(16, 34, 388, 16, lg(naive, 7, 11), 'f-bad', 'Standard attention, one head (log scale)', fmt.bytes(naive, 1)) + kit.bar(16, 84, 388, 16, lg(flash, 7, 11), fits ? 'f-ok' : 'f-warn', 'FlashAttention, tile ' + B + ' × ' + B, fmt.bytes(flash, 1)) +
          `<text class="xs mute" x="16" y="132">Tile needs ${fmt.bytes(tile, 0)}: Q, K, V blocks in BF16 plus the score tile in FP32.</text><text class="xs mute" x="16" y="148">${fits ? 'It fits in the 227 KB of shared memory.' : 'It does not fit in 227 KB. A real kernel would use a smaller tile.'}</text>`;
        st.set('r', r.toFixed(r < 10 ? 1 : 0) + '×', '2B ÷ d = ' + (2 * B / d).toFixed(1)); st.set('t', fmt.bytes(tile, 0), fits ? 'fits in 227 KB' : 'too big for 227 KB');
        c.mission.set(fits && r >= 3.9);
      }
      c.seg({ label: 'Head dimension d', options: [['32', '32'], ['64', '64'], ['128', '128'], ['256', '256']], value: '128', onChange: v => { d = +v; draw(); } });
      c.seg({ label: 'Tile rows B', options: [['32', '32'], ['64', '64'], ['128', '128'], ['256', '256']], value: '128', onChange: v => { B = +v; draw(); } });
      c.slider({ label: 'Sequence length N', values: [4096, 16384, 65536, 131072], value: 16384, fmt: kfmt, onInput: v => { N = v; draw(); } });
      draw();
      c.demo(1500, async () => { d = 64; draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'causal', tag: 'The idea',
    title: 'Causal masking skips half the tiles',
    alt: 'A square grid of tiles. A slider sets how many tiles fit along each side. Tiles above the diagonal are masked and skipped. A counter shows the share of tiles skipped, which approaches half as the grid grows.',
    text: 'In a language model, token i may only attend to tokens up to i, which is a [[causal mask]]. Tile pairs **above the diagonal** are fully masked, so a tiled kernel can **skip them entirely**, instead of computing and then masking. With T tiles per side, it computes **T(T + 1) ÷ 2 of T²** tiles. The saving approaches **2 times** as sequences grow.',
    hint: 'Increase the number of tiles per side.',
    mission: 'Find a grid where more than 45% of the tiles are skipped.',
    takeaway: 'A causal kernel does about half the matrix work of a full one at long sequence length.',
    mount(c) {
      const f = c.fig(420, 252, '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Tiles skipped', value: '', cls: 'mem' }, { k: 'x', label: 'Speedup from skipping', value: '', cls: 'ok' }]);
      let T = 4;
      function draw() {
        const SZ = 200, cs = SZ / T; let g = '';
        for (let r = 0; r < T; r++) for (let q = 0; q < T; q++) g += `<rect x="${(110 + q * cs).toFixed(1)}" y="${(24 + r * cs).toFixed(1)}" width="${(cs - Math.min(2, cs * 0.12)).toFixed(1)}" height="${(cs - Math.min(2, cs * 0.12)).toFixed(1)}" rx="${Math.min(4, cs / 5).toFixed(1)}" class="${q > r ? 'well' : 'f-data'}" style="${q > r ? 'opacity:.35' : ''}"/>`;
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="40">Query</text><text class="xs mute" x="16" y="54">blocks ↓</text><text class="xs mute" x="16" y="108">Green:</text><text class="xs mute" x="16" y="122">computed</text><text class="xs mute" x="16" y="144">Gray:</text><text class="xs mute" x="16" y="158">skipped</text>`;
        const tot = T * T, comp = T * (T + 1) / 2, sk = (tot - comp) / tot;
        st.set('s', (sk * 100).toFixed(1) + '%', (tot - comp) + ' of ' + tot + ' tiles'); st.set('x', (tot / comp).toFixed(2) + '×', 'limit: 2×');
        c.mission.set(sk > 0.45);
      }
      c.slider({ label: 'Tiles per side T', values: [2, 4, 8, 16, 32, 64], value: 4, fmt: v => v, onInput: v => { T = v; draw(); } });
      draw();
      c.demo(1500, async () => { T = 16; draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'fusion', tag: 'Kernels',
    title: 'Kernel fusion: one trip to memory instead of six',
    alt: 'A chain of elementwise operations. Without fusion each operation reads its input from HBM and writes its output back. With fusion one kernel reads the input once, applies every operation in registers, and writes the result once. Controls set the number of operations, the tensor size and whether fusion is on. A bar shows the time at 3.35 terabytes per second.',
    text: 'Bias, GELU, dropout, residual add and scaling each do a few operations per value, so each is **limited by memory, not math**. Run as separate kernels, every one reads the tensor from HBM and writes it back. [[kernel fusion|Fused]] into one kernel, the tensor is read once and written once, and the operations run in registers. Traffic falls by the number of operations.',
    hint: 'Switch fusion on and change the number of operations.',
    mission: 'Finish 6 operations on a 4 GB tensor in under 3 ms.',
    takeaway: 'For memory-bound chains, time is bytes moved. Fusion removes the intermediate trips.',
    mount(c) {
      const f = c.fig(420, 186, '<g id="g"></g>');
      const st = c.stats([{ k: 'b', label: 'HBM traffic', value: '', cls: 'mem' }, { k: 't', label: 'Time at 3.35 TB/s', value: '', cls: 'data' }]);
      let ops = 6, GB = 4, fused = false;
      const NAMES = ['bias', 'GELU', 'dropout', 'add', 'scale', 'cast', 'norm', 'clip'];
      function draw() {
        const trips = fused ? 1 : ops, bytes = 2 * trips * GB * 1e9, t = bytes / 3.35e12, x3 = 16 + lg(3e-3, -4, -1) * 388;
        let g = `<rect class="box" x="16" y="16" width="48" height="26" rx="6"/><text class="xs b" x="40" y="33" text-anchor="middle">HBM</text>`;
        if (fused) g += `<path class="ln s2" d="M66 29 H84" marker-end="url(#ah-ink)"/><rect class="t-ok" x="88" y="14" width="${Math.min(260, 40 + ops * 30)}" height="30" rx="8"/><text class="xs b" x="${88 + Math.min(260, 40 + ops * 30) / 2}" y="33" text-anchor="middle">one fused kernel: ${ops} ops</text><path class="ln s2" d="M${92 + Math.min(260, 40 + ops * 30)} 29 H${110 + Math.min(260, 40 + ops * 30)}" marker-end="url(#ah-ink)"/>`;
        else for (let i = 0; i < ops; i++) g += `<rect class="t-cmp" x="${72 + i * 42}" y="14" width="38" height="30" rx="6"/><text class="xs" x="${91 + i * 42}" y="33" text-anchor="middle">${NAMES[i]}</text><path class="ln thin" d="M${91 + i * 42} 44 V54 M${91 + i * 42} 54 H${80 + i * 42}" style="opacity:.6"/>`;
        g += `<text class="xs mute" x="16" y="70">${fused ? '1 read + 1 write' : ops + ' reads + ' + ops + ' writes'} of ${GB} GB each way</text>`;
        g += kit.bar(16, 104, 388, 16, lg(t, -4, -1), t < 3e-3 ? 'f-ok' : 'f-cmp', 'Time (log scale, 0.1 ms to 100 ms)', tms(t)) + `<line class="ln" x1="${x3.toFixed(1)}" x2="${x3.toFixed(1)}" y1="106" y2="136" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x3.toFixed(1)}" y="150" text-anchor="middle">3 ms</text><text class="xs mute" x="16" y="174">Each trip moves the whole tensor in and out. The math itself is nearly free.</text>`;
        f.q('#g').innerHTML = g;
        st.set('b', fmt.bytes(bytes, 0), trips + ' trip' + (trips > 1 ? 's' : '') + ' × 2 × ' + GB + ' GB'); st.set('t', tms(t), fused ? 'fused' : 'separate kernels');
        c.mission.set(ops === 6 && GB === 4 && t < 3e-3);
      }
      c.slider({ label: 'Elementwise operations in a row', min: 1, max: 8, step: 1, value: 6, fmt: v => v, onInput: v => { ops = v; draw(); } });
      c.seg({ label: 'Tensor size', options: [['1', '1 GB'], ['4', '4 GB']], value: '4', onChange: v => { GB = +v; draw(); } });
      c.toggle({ label: 'Fuse into one kernel', value: false, onChange: v => { fused = v; draw(); } });
      draw();
      c.demo(1500, async () => { fused = true; draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'versions', tag: 'Kernels',
    title: 'FlashAttention 1 to 4: same idea, newer hardware',
    alt: 'A selector chooses a FlashAttention version. The page shows its year, the GPU it targets, what changed, and how close it gets to the chip’s peak speed for the versions where that is published.',
    text: 'The tiling idea stayed. Each version changed how well it **uses the GPU**. **FA1** (2022) made attention IO-aware. **FA2** (2023) cut non-matmul work and spread tiles across the whole chip. **FA3** (2024) used Hopper’s asynchronous copies and warp specialization. **FA4** (2025) reworks the pipeline for Blackwell.',
    hint: 'Step through the four versions.',
    mission: 'Find the version that first used Hopper’s asynchronous hardware.',
    takeaway: 'An algorithm sets how many bytes move. A kernel sets how close to peak the chip runs. Each GPU generation needs a new kernel.',
    mount(c) {
      const V = {
        fa1: { y: '2022', g: 'A100', t: 'IO-aware tiling and recomputation', b: ['Never writes the N × N matrix to HBM', 'Exact attention, memory O(N)', '2 to 4 times faster than standard attention'], u: '25 to 40% of A100 peak' },
        fa2: { y: '2023', g: 'A100', t: 'Better work partitioning', b: ['Fewer non-matmul operations', 'Splits tiles across sequence blocks, so one long sequence fills the chip', 'About 2 times faster than FA1'], u: '50 to 73% of A100 peak' },
        fa3: { y: '2024', g: 'H100', t: 'Asynchronous Hopper features', b: ['Producer and consumer warps with async copies (TMA)', 'Softmax overlapped with matrix multiplies', 'FP8 support with block-wise scaling'], u: '75% of H100 peak in BF16, about 740 TFLOPS' },
        fa4: { y: '2025', g: 'B200', t: 'Reworked for Blackwell', b: ['Matrix units got faster than exponentials and data movement', 'The softmax side now sets the pace', 'The same tiling, a new pipeline'], u: 'see the paper for current numbers' }
      };
      const f = c.fig(420, 226, '<g id="g"></g>');
      const st = c.stats([{ k: 'y', label: 'Year and target GPU', value: '', cls: 'mem' }, { k: 'u', label: 'Utilization of peak speed', value: '', cls: 'data' }]);
      let key = 'fa1', seenH = false;
      function draw() {
        const v = V[key]; let g = `<text class="b md" x="16" y="30">${key.toUpperCase().replace('FA', 'FlashAttention-')}</text><text class="b sm" x="16" y="56">${v.t}</text>`;
        v.b.forEach((s, i) => { g += `<rect class="t-${['mem', 'data', 'cmp'][i]}" x="16" y="${72 + i * 44}" width="388" height="36" rx="8"/><text class="xs" x="30" y="${95 + i * 44}">${s}</text>`; });
        f.q('#g').innerHTML = g;
        st.set('y', v.y + ', ' + v.g, v.t); st.set('u', v.u.length > 22 ? v.u.split(' of ')[0] : v.u, v.u.length > 22 ? 'of ' + v.u.split(' of ')[1] : '');
        c.mission.set(key === 'fa3');
      }
      c.seg({ label: 'Version', options: [['fa1', 'FA1'], ['fa2', 'FA2'], ['fa3', 'FA3'], ['fa4', 'FA4']], value: 'fa1', onChange: v => { key = v; draw(); } });
      c.note('Speeds are from the papers: FA2 on A100, FA3 on H100. Check the FlashAttention-4 paper for Blackwell numbers.');
      draw();
      c.demo(1500, async () => { key = 'fa3'; draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'decode', tag: 'Kernels',
    title: 'Decoding one token leaves most SMs idle',
    alt: 'A grid of the 132 streaming multiprocessors of an H100. Cells are green when a thread block runs on them and gray when they are idle. Controls set the batch size and how many pieces the key-value cache is split into. Counters show the share of SMs busy and the relative time.',
    text: 'During decode, **one query token** attends to a long KV cache. The work is split by batch and head only: batch 1 with 32 heads is **32 thread blocks for 132 SMs**. [[flash-decoding|Flash-Decoding]] also **splits the KV cache along its length**, runs the pieces on different SMs, and merges the partial results with the same rescaling as online softmax.',
    hint: 'Raise the number of KV splits.',
    mission: 'Keep at least 90% of the SMs busy at batch 1.',
    takeaway: 'Parallelism has to come from somewhere. With one sequence, it comes from splitting the KV cache.',
    mount(c) {
      const f = c.fig(420, 190, '<g id="g"></g>');
      const st = c.stats([{ k: 'b', label: 'SMs busy', value: '', cls: 'data' }, { k: 't', label: 'Relative time', value: '', cls: 'cmp' }]);
      let batch = 1, sp = 1;
      function draw() {
        const heads = 32, blocks = batch * heads * sp, waves = Math.ceil(blocks / 132), busy = Math.min(blocks, 132) / 132, avgBusy = blocks / (waves * 132), rel = waves / sp, shown = Math.min(blocks, 132); let g = '';
        for (let k = 0; k < 132; k++) { const x = 16 + (k % 22) * 14, y = 34 + Math.floor(k / 22) * 18; g += `<rect x="${x}" y="${y}" width="12" height="14" rx="2.5" class="${k < shown ? 'f-data' : 'well'}"/>`; }
        f.q('#g').innerHTML = `<text class="b sm" x="16" y="22">The 132 SMs of an H100, first wave</text>` + g + `<text class="xs mute" x="16" y="152">${fmt.n(blocks)} thread blocks = ${batch} sequence${batch > 1 ? 's' : ''} × 32 heads × ${sp} KV splits.</text><text class="xs mute" x="16" y="170">${waves} wave${waves > 1 ? 's' : ''} of blocks. Each block reads 1 ÷ ${sp} of the cache.</text>`;
        st.set('b', Math.round(avgBusy * 100) + '%', waves > 1 ? 'averaged over ' + waves + ' waves' : shown + ' of 132 SMs'); st.set('t', rel.toFixed(2) + '×', 'against 1 split at batch ' + batch);
        c.mission.set(batch === 1 && avgBusy >= 0.9);
      }
      c.seg({ label: 'Sequences in the batch', options: [['1', '1'], ['4', '4'], ['16', '16']], value: '1', onChange: v => { batch = +v; draw(); } });
      c.slider({ label: 'KV splits per head', values: [1, 2, 4, 8, 16], value: 1, fmt: v => v, onInput: v => { sp = v; draw(); } });
      draw();
      c.demo(1500, async () => { sp = 4; draw(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'What does FlashAttention avoid writing to HBM?', o: ['The N × N score matrix', 'The output O', 'The queries', 'The weights'], a: 0, why: 'Scores and probabilities stay in shared memory, tile by tile. Only the output block is written, once.' },
      { q: 'In BF16, how much memory does the score matrix of one head take at 64K tokens?', o: ['About 2 GB', 'About 34 GB', 'About 8 GB', 'About 270 GB'], a: 2, why: '2 bytes × 65,536² is about 8.6 GB for one head. 32 heads would need 275 GB.' },
      { q: 'Why does online softmax multiply the old sum by e^(m_old − m_new)?', o: ['To speed up the exponential', 'To keep earlier terms consistent when the maximum grows', 'To normalize the values to 1', 'To skip masked tiles'], a: 1, why: 'Earlier terms were computed against the old maximum. Rescaling puts them on the same footing as the new ones.' },
      { q: 'With head dimension 128 and 128-row tiles, about how much does tiling cut HBM traffic?', o: ['64 times', '10 times', 'It adds traffic', 'About 2 times'], a: 3, why: 'The cut is about 2B ÷ d, which is 2 here. The larger win is memory use, which stays O(N).' },
      { q: 'Why can a causal kernel skip tiles?', o: ['Later tokens are less important', 'The GPU caches them', 'Tiles above the diagonal are fully masked', 'Softmax ignores small values'], a: 2, why: 'A token cannot attend to later tokens, so tile pairs entirely above the diagonal contribute nothing.' },
      { q: 'Why does fusing six elementwise kernels speed them up?', o: ['The math becomes simpler', 'The tensor is read and written once instead of six times', 'Tensor cores handle them', 'It uses less precision'], a: 1, why: 'Elementwise chains are memory-bound. Time follows bytes moved, which fusion cuts by the number of operations.' },
      { q: 'Why does Flash-Decoding split the KV cache for a single sequence?', o: ['To reduce the cache size', 'To save power', 'To avoid masking', 'To give all the SMs something to do'], a: 3, why: 'Batch 1 with 32 heads makes only 32 blocks for 132 SMs. Splitting along the sequence makes enough blocks to fill the chip.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(q => `<rect x="${86 + q * 28}" y="${24 + r * 24}" width="24" height="20" rx="3" style="fill:${q <= r ? 'var(--data)' : 'var(--well)'};opacity:${q <= r ? 0.9 : 0.6}"/>`).join('')).join('')
    + '</g><rect x="86" y="24" width="24" height="20" rx="3" style="fill:none;stroke:var(--cmp);stroke-width:2.5"/><text x="20" y="20" style="font:600 11px var(--font-mono);fill:var(--ink-3)">tiles stay on chip</text></svg>';

  window.LESSONS.push({
    id: 'kernels', n: 9, track: 'inference', order: 3,
    title: 'FlashAttention and Fused Kernels',
    tagline: 'Tiling, online softmax and fusion: how attention stops moving a huge matrix through memory.',
    preview,
    scenes: S
  });
})();
