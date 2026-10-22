/* Lesson 8: Inside the GPU. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const lg = (v, lo, hi) => kit.clamp((Math.log10(v) - lo) / (hi - lo), 0.01, 1);
  const tms = s => s >= 1 ? s.toFixed(2) + ' s' : s >= 1e-3 ? (s * 1e3).toFixed(s * 1e3 < 10 ? 2 : 1) + ' ms' : (s * 1e6).toFixed(s * 1e6 < 10 ? 1 : 0) + ' µs';

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'cpugpu', tag: 'The chip',
    title: 'A GPU wins only when there is a lot of parallel work',
    alt: 'Two bars on a log scale show the time for a CPU and a GPU to finish a chosen number of independent tasks, with the speedup shown beside them. For a few tasks the CPU wins because the GPU has a fixed launch delay. For many tasks the GPU wins by hundreds of times.',
    text: 'A CPU has a few dozen fast cores. An H100 has [[sm|132 streaming multiprocessors]] and about **17,000 FP32 lanes**. Each lane is slower than a CPU core, and a GPU job pays about **10 µs** to launch. So tiny jobs run faster on a CPU, and jobs with **many independent tasks** run hundreds of times faster on a GPU.',
    hint: 'Raise the number of independent tasks.',
    mission: 'Find a workload where the GPU is at least 100 times faster.',
    takeaway: 'GPUs trade fast single threads for huge parallelism. Feed them parallel work or they sit idle.',
    mount(c) {
      const f = c.fig(420, 150, '<g id="b"></g>');
      const st = c.stats([{ k: 'c', label: 'CPU time', value: '', cls: 'mem' }, { k: 'g', label: 'GPU time', value: '', cls: 'data' }, { k: 's', label: 'Speedup', value: '', cls: 'cmp' }]);
      let n = 100;
      function draw() {
        const cpu = n / 6.4e7, gpu = 1e-5 + n / 6.7e10, sp = cpu / gpu;
        f.q('#b').innerHTML = kit.bar(16, 34, 388, 16, lg(cpu, -9, 0), 'f-mem', 'CPU: 16 cores (log scale, 1 ns to 1 s)', tms(cpu)) + kit.bar(16, 90, 388, 16, lg(gpu, -9, 0), 'f-data', 'GPU: 17,000 lanes plus 10 µs launch', tms(gpu)) + `<text class="xs mute" x="16" y="136">Toy: each task is 1,000 operations. CPU 64 GFLOPS, GPU 67 TFLOPS.</text>`;
        st.set('c', tms(cpu), fmt.n(n) + ' tasks'); st.set('g', tms(gpu), 'includes the launch'); st.set('s', sp >= 1 ? sp.toFixed(sp < 10 ? 1 : 0) + '× faster' : (1 / sp).toFixed(1) + '× slower', sp >= 1 ? 'GPU wins' : 'CPU wins');
        c.mission.set(sp >= 100);
      }
      c.slider({ label: 'Independent tasks', values: [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7], value: 100, fmt: v => fmt.n(v), onInput: v => { n = v; draw(); } });
      draw();
      c.demo(1500, async () => { n = 1e6; draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'anatomy', tag: 'The chip',
    title: 'From the whole chip down to one warp',
    alt: 'A selector zooms through four levels: the whole GPU, one streaming multiprocessor, one partition of an SM, and one warp. Each level shows what it contains and how many there are.',
    text: 'An H100 has [[sm|132 streaming multiprocessors (SMs)]]. Each SM has **4 partitions** with 32 FP32 lanes and one tensor core each, a **256 KB register file**, and up to **228 KB of shared memory**. An SM keeps up to **64 warps** resident, and a [[warp]] is **32 threads** that run in lockstep. That is up to **270,336 resident threads** on the chip.',
    hint: 'Zoom through all four levels.',
    mission: 'Visit all four levels.',
    takeaway: 'Chip → SM → partition → warp. Almost every performance question is about keeping these levels busy.',
    mount(c) {
      const LV = {
        gpu: { t: 'The whole GPU (H100 SXM5)', rows: [['132', 'streaming multiprocessors, in 8 GPCs'], ['50 MB', 'L2 cache shared by all SMs'], ['80 GB', 'HBM3 at 3.35 TB/s'], ['989 TFLOPS', 'BF16 dense on tensor cores']] },
        sm: { t: 'One streaming multiprocessor', rows: [['4', 'partitions, each with its own scheduler'], ['128', 'FP32 lanes and 4 tensor cores'], ['256 KB', 'registers, split across threads'], ['228 KB', 'shared memory you manage by hand'], ['64', 'warps resident at most']] },
        part: { t: 'One SM partition', rows: [['1', 'warp scheduler: issues 1 instruction per clock'], ['32', 'FP32 lanes, 16 warps’ worth of state'], ['1', 'tensor core: a small matrix multiply per instruction'], ['16', 'resident warps to switch between']] },
        warp: { t: 'One warp', rows: [['32', 'threads, one per lane'], ['1', 'instruction stream shared by all 32'], ['0', 'cost to switch to another ready warp'], ['32 × 4 B', 'one coalesced load: 128 bytes']] }
      };
      const f = c.fig(420, 232, '<g id="g"></g>');
      const st = c.stats([{ k: 'n', label: 'Threads resident on the chip', value: '270,336', cls: 'mem', sub: '132 SMs × 64 warps × 32 threads' }, { k: 'v', label: 'Levels visited', value: '', cls: 'ok' }]);
      let lv = 'gpu'; const seen = new Set(['gpu']);
      function draw() {
        const L = LV[lv]; let g = `<text class="b sm" x="16" y="24">${L.t}</text>`;
        L.rows.forEach((r, i) => { const y = 40 + i * 36; g += `<rect class="t-${['mem', 'data', 'cmp', 'ctl', 'mem'][i]}" x="16" y="${y}" width="388" height="30" rx="8"/><text class="b md m" x="30" y="${y + 21}">${r[0]}</text><text class="xs" x="140" y="${y + 20}">${r[1]}</text>`; });
        f.q('#g').innerHTML = g;
        seen.add(lv); st.set('v', seen.size + ' of 4');
        c.mission.set(seen.size === 4);
      }
      c.seg({ label: 'Zoom level', options: [['gpu', 'GPU'], ['sm', 'SM'], ['part', 'Partition'], ['warp', 'Warp']], value: 'gpu', onChange: v => { lv = v; draw(); } });
      draw();
      c.demo(1500, async () => { for (const k of ['sm', 'part', 'warp']) { lv = k; draw(); await c.wait(700); } });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'warps', tag: 'The chip',
    title: 'Warps stall when lanes disagree',
    alt: 'Four warps of 32 lanes each. Every lane takes either the if branch or the else branch. A warp whose lanes disagree runs both branches one after the other. A switch sorts the data so lanes in a warp agree. Counters show how many warps diverged and how many passes the chip ran.',
    text: 'All 32 threads of a warp share one instruction stream. When an `if` sends some lanes one way and some the other, the warp runs **both paths in turn**, with the idle lanes switched off. That is [[warp divergence]]. If the data is **sorted** so whole warps agree, each warp runs only one path.',
    hint: 'Change the share of lanes taking the branch, then sort.',
    mission: 'Make none of the 4 warps diverge.',
    takeaway: 'Divergence doubles the work of a warp. Grouping similar items together removes it.',
    mount(c) {
      const NW = 4, X0 = 16, CS = 8, f = c.fig(420, 218, '<g id="g"></g>');
      const st = c.stats([{ k: 'd', label: 'Warps that diverge', value: '', cls: 'bad' }, { k: 'p', label: 'Passes the chip runs', value: '', cls: 'cmp' }, { k: 'e', label: 'Lane efficiency', value: '', cls: 'data' }]);
      const r = kit.rng(9), order = Array.from({ length: NW * 32 }, () => r());
      let p = 40, sorted = false;
      function draw() {
        const total = NW * 32, nA = Math.round(p / 100 * total), idx = order.map((v, i) => i).sort((a, b) => order[a] - order[b]), isA = new Array(total).fill(false); idx.slice(0, nA).forEach(i => isA[i] = true);
        const val = sorted ? Array.from({ length: total }, (_, i) => i < nA) : isA; let g = '', div = 0, passes = 0;
        for (let w = 0; w < NW; w++) {
          const lanes = val.slice(w * 32, w * 32 + 32), a = lanes.filter(Boolean).length, dv = a > 0 && a < 32; if (dv) div++; passes += dv ? 2 : 1;
          g += `<text class="xs m b" x="${X0}" y="${44 + w * 40}">warp ${w}</text>`;
          lanes.forEach((v, k) => { g += `<rect x="${X0 + 52 + k * (CS + 1)}" y="${30 + w * 40}" width="${CS}" height="22" rx="2" class="${v ? 'f-data' : 'f-mem'}"/>`; });
          g += `<text class="xs ${dv ? 'b' : 'mute'}" x="${X0 + 52 + 32 * (CS + 1) + 6}" y="${46 + w * 40}" style="${dv ? 'fill:var(--bad)' : ''}">${dv ? '2 passes' : '1 pass'}</text>`;
        }
        f.q('#g').innerHTML = `<text class="xs mute" x="${X0}" y="18">Green: if branch. Blue: else branch. One square per lane.</text>` + g + `<text class="xs mute" x="${X0}" y="${44 + NW * 40 + 8}">${sorted ? 'Sorted: whole warps agree where the split allows.' : 'Unsorted: each warp mixes both outcomes.'}</text>`;
        st.set('d', div + ' of ' + NW, div ? 'run both branches' : 'all uniform'); st.set('p', passes, 'ideal: ' + NW); st.set('e', Math.round(NW / passes * 100) + '%', 'useful lanes per pass');
        c.mission.set(div === 0);
      }
      c.seg({ label: 'Lanes taking the if branch', options: [['25', '25%'], ['40', '40%'], ['50', '50%'], ['75', '75%']], value: '40', onChange: v => { p = +v; draw(); } });
      c.toggle({ label: 'Sort the data by branch first', value: false, onChange: v => { sorted = v; draw(); } });
      draw();
      c.demo(1500, async () => { p = 50; sorted = true; draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'ladder', tag: 'Memory',
    title: 'The memory ladder: smaller is faster',
    alt: 'Four memory levels from fastest to slowest: registers, shared memory, L2 cache and HBM, with their sizes, bandwidths and latencies. A slider sets the size of the data a kernel works on, and the level that can hold it is marked.',
    text: 'A GPU has four places to keep data. **Registers** and [[shared memory]] are on each SM and are the fastest. **L2** is shared by the whole chip. **HBM** is the big off-chip memory. Each step down holds more, answers later and delivers less bandwidth. Kernels run fast when their **working set fits high on the ladder**.',
    hint: 'Move the working-set size and watch the level change.',
    mission: 'Find the largest listed working set that still fits in the 50 MB L2.',
    takeaway: 'Bandwidth falls about 10 times from shared memory to HBM. FlashAttention and fused kernels exist to stay high on this ladder.',
    mount(c) {
      const LV = [['Registers', 33e6, '256 KB per SM, 33 MB in total', '1 cycle', 'f-data'], ['Shared memory', 30e6, '228 KB per SM, 30 MB in total', '~30 cycles, ~30 TB/s', 'f-mem'], ['L2 cache', 50e6, '50 MB, one for all SMs', '~250 cycles, ~5.5 TB/s', 'f-cmp'], ['HBM3', 80e9, '80 GB off-chip', '~500 cycles, 3.35 TB/s', 'f-ctl']];
      const f = c.fig(420, 218, '<g id="g"></g>');
      const st = c.stats([{ k: 'l', label: 'Fits in', value: '', cls: 'mem' }, { k: 'b', label: 'Bandwidth at that level', value: '', cls: 'data' }]);
      let ws = 1e6;
      function draw() {
        let g = '';
        LV.forEach((l, i) => { const y = 14 + i * 50, on = (i <= 1 && ws <= 30e6) || (i === 2 && ws > 30e6 && ws <= 50e6) || (i === 3 && ws > 50e6); g += `<rect x="16" y="${y}" width="206" height="42" rx="8" class="${on ? 't-' + l[4].slice(2) : 'box'}" style="${on ? 'stroke-width:3' : ''}"/><text class="b sm" x="28" y="${y + 18}">${l[0]}</text><text class="xs mute" x="28" y="${y + 34}">${l[2]}</text><text class="xs m" x="234" y="${y + 18}">${l[3]}</text>`; if (on) g += `<text class="xs b" x="234" y="${y + 34}" style="fill:var(--ok)">your data fits here</text>`; });
        f.q('#g').innerHTML = g;
        const names = ['registers', 'shared memory', 'L2', 'HBM'], bws = ['> 30 TB/s', '~30 TB/s', '~5.5 TB/s', '3.35 TB/s'];
        st.set('l', ws > 50e6 ? 'HBM3' : ws > 30e6 ? 'L2 cache' : 'On-chip SRAM', fmt.bytes(ws, 0)); st.set('b', bws[ws > 50e6 ? 3 : ws > 30e6 ? 2 : 1], ws > 50e6 ? 'about 10× less than shared memory' : '');
        c.mission.set(ws === 48e6);
      }
      c.slider({ label: 'Working-set size', values: [1e3, 64e3, 1e6, 16e6, 48e6, 64e6, 1e9, 80e9], value: 1e6, fmt: v => fmt.bytes(v, 0), onInput: v => { ws = v; draw(); } });
      c.note('Latencies and the L2 and shared-memory bandwidths are approximate. They vary by clock and access pattern.');
      draw();
      c.demo(1500, async () => { ws = 48e6; draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'coalesce', tag: 'Memory',
    title: 'Neighboring lanes should read neighboring bytes',
    alt: 'A strip of memory split into 32-byte sectors. Thirty-two lanes each read four bytes. The sectors they touch are marked. When the lanes read consecutive addresses, four sectors serve them all. With a stride, many more sectors are fetched and most of the bytes are wasted.',
    text: 'The memory system moves data in **32-byte sectors**. If a warp’s 32 lanes read 4 bytes each from **consecutive addresses**, one 128-byte request, **4 sectors**, serves them all. If the lanes read with a **stride**, each lane may need its own sector and most of the fetched bytes are thrown away. Reading with stride 1 is called [[coalesced]] access.',
    hint: 'Change the stride between lanes.',
    mission: 'Make every fetched byte useful.',
    takeaway: 'Stride 1 uses 100% of the bandwidth. Stride 8 or more uses 12.5% of it.',
    mount(c) {
      const f = c.fig(420, 150, '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Sectors fetched', value: '', cls: 'cmp' }, { k: 'u', label: 'Bytes used of bytes fetched', value: '', cls: 'data' }, { k: 'b', label: 'Effective bandwidth', value: '', cls: 'mem' }]);
      let stride = 8;
      function draw() {
        const secs = new Set(); for (let k = 0; k < 32; k++) secs.add(Math.floor(k * stride * 4 / 32));
        const n = secs.size, used = 128 / (n * 32), NS = 128; let g = `<text class="b sm" x="16" y="22">Memory, in 32-byte sectors (first ${Math.min(NS, Math.max(...secs) + 1)} drawn)</text>`;
        const W = 388 / NS; for (let s = 0; s < NS; s++) g += `<rect x="${(16 + s * W).toFixed(1)}" y="34" width="${(W - 0.6).toFixed(2)}" height="26" class="${secs.has(s) ? 'f-cmp' : 'well'}"/>`;
        for (let k = 0; k < 32; k++) { const s = Math.floor(k * stride * 4 / 32); if (s < NS) g += `<circle cx="${(16 + s * W + W / 2).toFixed(1)}" cy="78" r="3" class="f-data"/>`; }
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="104">Green dots: where the 32 lanes read. Orange: sectors the chip fetches.</text><text class="xs mute" x="16" y="122">Stride ${stride}: lane k reads element ${stride} × k.</text>`;
        st.set('s', n, '1 sector = 32 bytes'); st.set('u', Math.round(used * 100) + '%', '128 useful bytes of ' + n * 32); st.set('b', Math.round(used * 3.35 * 1000) / 1000 + ' TB/s', 'of the H100’s 3.35 TB/s');
        c.mission.set(used >= 0.999);
      }
      c.seg({ label: 'Stride between lanes (elements)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['32', '32']], value: '8', onChange: v => { stride = +v; draw(); } });
      draw();
      c.demo(1500, async () => { stride = 1; draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'occupancy', tag: 'Memory',
    title: 'Hide the wait with more warps',
    alt: 'A timeline for several warps. Each warp computes for a short burst, then waits about 500 cycles for memory. The SM switches to another ready warp while one waits. Sliders set the number of resident warps and the compute between loads. A bar shows how busy the SM stays.',
    text: 'A load from HBM takes **about 500 cycles**. The SM does not wait. It **switches to another warp** that is ready, at no cost. With enough warps in flight the waits overlap and the SM stays busy. Utilization is about **min(1, warps × compute ÷ (compute + 500))**. More compute between loads needs fewer warps.',
    hint: 'Raise the warps or the compute between loads.',
    mission: 'Keep the SM at least 90% busy with at most 16 warps.',
    takeaway: 'Memory latency is hidden by parallelism, not removed. Registers and shared memory limit how many warps fit.',
    mount(c) {
      const f = c.fig(420, 198, '<g id="g"></g>');
      const st = c.stats([{ k: 'u', label: 'SM busy', value: '', cls: 'data' }, { k: 'n', label: 'Warps needed for 100%', value: '', cls: 'cmp' }]);
      let W = 4, cc = 20; const LAT = 500;
      function draw() {
        const util = Math.min(1, W * cc / (cc + LAT)), need = Math.ceil((cc + LAT) / cc), shown = Math.min(W, 6), TW = 1200, X0 = 56, SC = 350 / TW; let g = `<text class="b sm" x="16" y="20">One SM, ${TW} cycles</text>`;
        for (let w = 0; w < shown; w++) {
          const y = 32 + w * 17; g += `<text class="xs m mute" x="${X0 - 6}" y="${y + 11}" text-anchor="end">warp ${w + 1}</text><rect x="${X0}" y="${y}" width="350" height="13" rx="3" class="well"/>`;
          for (let t = w * cc; t < TW; t += cc + LAT) { g += `<rect x="${(X0 + t * SC).toFixed(1)}" y="${y}" width="${Math.max(1.5, cc * SC).toFixed(1)}" height="13" rx="2" class="f-data"/><rect x="${(X0 + (t + cc) * SC).toFixed(1)}" y="${y}" width="${Math.min(LAT, TW - t - cc) * SC > 0 ? (Math.min(LAT, TW - t - cc) * SC).toFixed(1) : 0}" height="13" rx="2" class="f-mem" style="opacity:.35"/>`; }
        }
        if (W > 6) g += `<text class="xs mute" x="${X0}" y="${32 + 6 * 17 + 8}">... and ${W - 6} more warps</text>`;
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="190">Green: compute (${cc} cycles). Blue: waiting for memory (${LAT} cycles).</text>`;
        st.set('u', Math.round(util * 100) + '%', W + ' warps × ' + cc + ' ÷ ' + (cc + LAT)); st.set('n', need, 'for ' + cc + ' cycles of compute per load');
        c.mission.set(util >= 0.9 && W <= 16);
      }
      c.slider({ label: 'Resident warps', values: [1, 2, 4, 8, 16, 32, 48, 64], value: 4, fmt: v => v, onInput: v => { W = v; draw(); } });
      c.slider({ label: 'Compute cycles between loads', values: [10, 20, 50, 100, 200], value: 20, fmt: v => v, onInput: v => { cc = v; draw(); } });
      draw();
      c.demo(1500, async () => { cc = 50; W = 16; draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'tensorcore', tag: 'Compute',
    title: 'Tensor cores multiply small matrices in one step',
    alt: 'A tiny matrix multiply drawn as three blocks: a 16 by 16 block times a 16 by 8 block gives a 16 by 8 block, done by one tensor-core instruction. Four bars compare the peak speed of FP32 on CUDA cores, TF32, BF16 and FP8 on tensor cores. Controls choose the format and the matrix size, and a counter shows the multiply time.',
    text: 'A CUDA core does one multiply-add per clock. A [[tensor core]] does a whole small matrix multiply per instruction: 16 × 8 outputs, 16 deep, which is **2,048 multiply-adds**. On an H100, that is **989 TFLOPS in BF16** against **67 TFLOPS in FP32** on CUDA cores. Lower precision is faster because the same silicon does more small multiplies.',
    hint: 'Pick a format and a matrix size.',
    mission: 'Multiply two 4096 × 4096 matrices in under 0.2 ms.',
    takeaway: 'Matrix multiplies run 15 to 30 times faster on tensor cores. That is why every format change is a speed change.',
    mount(c) {
      const FM = { fp32: ['FP32, CUDA cores', 67e12], tf32: ['TF32, tensor cores', 494.7e12], bf16: ['BF16, tensor cores', 989e12], fp8: ['FP8, tensor cores', 1979e12] };
      const f = c.fig(420, 238, '<g id="g"></g>');
      const st = c.stats([{ k: 'f', label: 'Work, 2 × n³', value: '', cls: 'mem' }, { k: 't', label: 'Time at peak speed', value: '', cls: 'data' }]);
      let key = 'fp32', n = 4096;
      function draw() {
        const peak = FM[key][1], work = 2 * Math.pow(n, 3), t = work / peak;
        let g = `<text class="b sm" x="16" y="20">One tensor-core instruction</text>`;
        g += `<rect x="16" y="32" width="52" height="48" rx="3" class="t-mem"/><text class="xs b" x="42" y="60" text-anchor="middle">16 × 16</text><text class="b md" x="80" y="62" text-anchor="middle">×</text><rect x="92" y="32" width="38" height="48" rx="3" class="t-data"/><text class="xs b" x="111" y="60" text-anchor="middle">16 × 8</text><text class="b md" x="144" y="62" text-anchor="middle">=</text><rect x="158" y="32" width="38" height="48" rx="3" class="t-cmp"/><text class="xs b" x="177" y="60" text-anchor="middle">16 × 8</text><text class="xs" x="212" y="52">2,048 multiply-adds</text><text class="xs mute" x="212" y="68">in one instruction</text>`;
        Object.keys(FM).forEach((k, i) => { const y = 112 + i * 28, on = k === key; g += kit.bar(16, y, 388, 12, lg(FM[k][1] / 1e12, 1, 3.5), on ? 'f-cmp' : 'f-mem', FM[k][0], +(FM[k][1] / 1e12).toPrecision(4) + ' TFLOPS').replace('opacity', 'opacity'); });
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="${112 + 4 * 28 + 4}">Peak dense speed of an H100 SXM5. Real kernels reach 60 to 80%.</text>`;
        st.set('f', kit.sci(work, 2) + ' ops', n + ' × ' + n + ' × ' + n); st.set('t', tms(t), FM[key][0]);
        c.mission.set(n === 4096 && t < 0.2e-3);
      }
      c.seg({ label: 'Format and unit', options: [['fp32', 'FP32'], ['tf32', 'TF32'], ['bf16', 'BF16'], ['fp8', 'FP8']], value: 'fp32', onChange: v => { key = v; draw(); } });
      c.seg({ label: 'Matrix size n', options: [['1024', '1024'], ['2048', '2048'], ['4096', '4096'], ['8192', '8192']], value: '4096', onChange: v => { n = +v; draw(); } });
      draw();
      c.demo(1500, async () => { key = 'bf16'; draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'hbm', tag: 'Compute',
    title: 'HBM is a very wide bus, not a fast one',
    alt: 'Two bars compare memory bandwidth. A slider sets the number of DDR5 channels, each worth 38.4 gigabytes per second. The second bar shows an H100’s HBM3 at about 3.35 terabytes per second. A marker shows a typical eight-channel server CPU.',
    text: 'HBM stacks DRAM chips on top of each other next to the GPU. Each stack has a **1,024-bit bus**, and an H100 uses 5 stacks, **5,120 wires** in total, at 5.2 Gb/s each: about **3.35 TB/s**. A DDR5 channel has a 64-bit bus and delivers **38.4 GB/s**. It would take **87 channels** to match one H100.',
    hint: 'Add DDR5 channels until you match the GPU.',
    mission: 'Reach 3 TB/s with DDR5 channels.',
    takeaway: 'Bandwidth is wires times speed. HBM wins by using 80 times more wires, placed millimeters from the chip.',
    mount(c) {
      const f = c.fig(420, 176, '<g id="g"></g>');
      const st = c.stats([{ k: 'd', label: 'DDR5 bandwidth', value: '', cls: 'mem' }, { k: 'h', label: 'HBM3, 5 stacks', value: '3.35 TB/s', cls: 'data', sub: '5 × 1,024 bits × 5.2 Gb/s ÷ 8' }, { k: 'n', label: 'Channels to match', value: '87', cls: 'cmp', sub: '3,350 ÷ 38.4' }]);
      let ch = 8;
      function draw() {
        const bw = ch * 38.4, x = 16 + 307 / 3600 * 388;
        f.q('#g').innerHTML = kit.bar(16, 34, 388, 16, bw / 3600, bw >= 3000 ? 'f-ok' : 'f-mem', ch + ' DDR5-4800 channels', bw >= 1000 ? (bw / 1000).toFixed(2) + ' TB/s' : Math.round(bw) + ' GB/s') + kit.bar(16, 90, 388, 16, 3350 / 3600, 'f-data', 'One H100: HBM3 (linear scale, 0 to 3.6 TB/s)', '3.35 TB/s') +
          `<line class="ln" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="52" y2="70" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${(x + 6).toFixed(1)}" y="66">8-channel server CPU: 307 GB/s</text><text class="xs mute" x="16" y="136">HBM: 5,120 data wires. DDR5: 64 wires per channel.</text><text class="xs mute" x="16" y="152">DDR5 needs board traces. HBM sits beside the die.</text>`;
        st.set('d', bw >= 1000 ? (bw / 1000).toFixed(2) + ' TB/s' : Math.round(bw) + ' GB/s', ch + ' × 64 bits × 4.8 GT/s ÷ 8');
        c.mission.set(bw >= 3000);
      }
      c.slider({ label: 'DDR5 channels', min: 1, max: 100, step: 1, value: 8, fmt: v => v, onInput: v => { ch = v; draw(); } });
      draw();
      c.demo(1500, async () => { ch = 87; draw(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'launch', tag: 'Compute',
    title: 'Small kernels are launched faster than they run',
    alt: 'Two timelines. The CPU row shows kernel launches, each taking several microseconds. The GPU row shows the kernels running. When kernels are short, the GPU waits for the next launch and sits idle. With CUDA graphs the whole sequence is launched at once and the GPU runs back to back. Counters show the step time and how busy the GPU is.',
    text: 'The CPU launches each [[kernel]], and a launch costs **about 8 µs**. A decode step runs **hundreds to thousands of small kernels**, many shorter than that. The GPU then **waits for the CPU**. A [[cuda graph|CUDA graph]] records the whole sequence once and replays it with one launch, so the GPU runs back to back.',
    hint: 'Turn CUDA graphs on, or make the kernels longer.',
    mission: 'Keep the GPU at least 90% busy.',
    takeaway: 'A GPU can be starved by its own launch queue. CUDA graphs remove the per-kernel CPU cost.',
    mount(c) {
      const f = c.fig(420, 168, '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Time per step', value: '', cls: 'mem' }, { k: 'b', label: 'GPU busy', value: '', cls: 'data' }]);
      let n = 1000, t = 5, graph = false;
      function draw() {
        const LAUNCH = 8, GAP = 0.5, step = graph ? n * (t + GAP) : n * Math.max(t, LAUNCH), busy = n * t / step, X0 = 56, WIN = 100, SC = 350 / WIN;
        let g = `<text class="b sm" x="16" y="20">The first ${WIN} µs of a step</text><text class="xs m mute" x="${X0 - 6}" y="53" text-anchor="end">CPU</text><text class="xs m mute" x="${X0 - 6}" y="93" text-anchor="end">GPU</text><rect x="${X0}" y="40" width="350" height="18" rx="3" class="well"/><rect x="${X0}" y="80" width="350" height="18" rx="3" class="well"/>`;
        if (graph) g += `<rect x="${X0}" y="40" width="${(10 * SC).toFixed(1)}" height="18" rx="3" class="f-cmp"/><text class="xs" x="${X0 + 10 * SC + 6}" y="53">one graph launch</text>`;
        for (let i = 0; i < 40; i++) {
          const ls = i * LAUNCH, gs = graph ? 10 + i * (t + GAP) : (i + 1) * LAUNCH <= Math.max(0, i * Math.max(t, LAUNCH)) + LAUNCH ? i * Math.max(t, LAUNCH) + LAUNCH : 0;
          if (!graph && ls < WIN) g += `<rect x="${(X0 + ls * SC).toFixed(1)}" y="40" width="${Math.max(1, LAUNCH * SC - 1).toFixed(1)}" height="18" class="f-cmp"/>`;
          if (gs < WIN) g += `<rect x="${(X0 + gs * SC).toFixed(1)}" y="80" width="${Math.max(1, Math.min(t, WIN - gs) * SC - 0.8).toFixed(1)}" height="18" class="f-data"/>`;
        }
        f.q('#g').innerHTML = g + `<text class="xs mute" x="16" y="128">Orange: CPU launch (8 µs each). Green: kernel running (${t} µs).</text><text class="xs mute" x="16" y="146">${graph ? 'Graph replay: 0.5 µs between kernels.' : t < LAUNCH ? 'Each kernel is shorter than its launch, so the GPU idles.' : 'Kernels are long enough to hide the launch.'}</text>`;
        st.set('s', tms(step * 1e-6), n + ' kernels'); st.set('b', Math.round(busy * 100) + '%', busy >= 0.9 ? 'well fed' : 'starved');
        c.mission.set(busy >= 0.9);
      }
      c.slider({ label: 'Kernels per step', values: [200, 500, 1000, 2000, 5000], value: 1000, fmt: v => fmt.n(v), onInput: v => { n = v; draw(); } });
      c.slider({ label: 'Average kernel time (µs)', values: [2, 5, 10, 20, 50], value: 5, fmt: v => v, onInput: v => { t = v; draw(); } });
      c.toggle({ label: 'Use CUDA graphs', value: false, onChange: v => { graph = v; draw(); } });
      draw();
      c.demo(1500, async () => { graph = true; draw(); });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'links', tag: 'Scale',
    title: 'Between GPUs, the link sets the price of every byte',
    alt: 'Four bars on a log scale show how long it takes to move a chosen amount of data over NVLink, PCIe, InfiniBand and Ethernet. A slider sets the amount. A marker shows 20 milliseconds.',
    text: 'Moving data between GPUs is far slower than reading local HBM. [[nvlink|NVLink]] inside a node carries **450 GB/s** each way on an H100. **PCIe 5.0 x16** carries 64 GB/s, one [[infiniband|InfiniBand]] link 50 GB/s, and 100 Gb Ethernet 12.5 GB/s. The same tensor can cost 2 ms or 80 ms depending on the path.',
    hint: 'Change the amount of data.',
    mission: 'Find the largest listed payload NVLink moves in under 20 ms.',
    takeaway: 'Keep chatty traffic inside the NVLink domain. Everything else is 7 to 36 times slower.',
    mount(c) {
      const LK = [['NVLink, H100', 450, 'f-data'], ['PCIe 5.0 x16', 64, 'f-mem'], ['InfiniBand NDR, one link', 50, 'f-cmp'], ['Ethernet, 100 Gb', 12.5, 'f-ctl']];
      const f = c.fig(420, 208, '<g id="g"></g>');
      const st = c.stats([{ k: 'a', label: 'NVLink', value: '', cls: 'data' }, { k: 'b', label: 'InfiniBand', value: '', cls: 'cmp' }]);
      let gb = 1;
      function draw() {
        const x20 = 16 + lg(0.02, -4, 1) * 388; let g = '';
        LK.forEach((l, i) => { const t = gb / l[1]; g += kit.bar(16, 34 + i * 38, 388, 14, lg(t, -4, 1), l[2], l[0] + ' (' + l[1] + ' GB/s)', tms(t)); });
        for (let i = 0; i < 4; i++) g += `<line class="ln" x1="${x20.toFixed(1)}" x2="${x20.toFixed(1)}" y1="${32 + i * 38}" y2="${52 + i * 38}" style="stroke:var(--ink);stroke-width:2"/>`;
        g += `<text class="xs b" x="${x20.toFixed(1)}" y="${34 + 4 * 38}" text-anchor="middle">20 ms</text><text class="xs mute" x="16" y="${34 + 4 * 38 + 18}">Time to move ${gb} GB. Log scale from 0.1 ms to 10 s.</text>`;
        f.q('#g').innerHTML = g;
        st.set('a', tms(gb / 450), gb + ' GB at 450 GB/s'); st.set('b', tms(gb / 50), gb + ' GB at 50 GB/s');
        c.mission.set(gb === 8);
      }
      c.slider({ label: 'Payload', values: [0.1, 1, 8, 40, 140], value: 1, fmt: v => v + ' GB', onInput: v => { gb = v; draw(); } });
      c.note('Examples: 8 GB is a long KV cache. 140 GB is a 70B model in BF16.');
      draw();
      c.demo(1500, async () => { gb = 8; draw(); });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'specs', tag: 'Scale',
    title: 'Read a spec sheet in tokens per second',
    alt: 'Three chips, three model sizes and three weight formats can be combined. Two bars show how much of the GPU’s memory the weights use and how many tokens per second a single user could get while decoding, with a marker at 100. Counters show the decode ceiling and the prefill ceiling.',
    text: 'Three numbers on the spec sheet predict inference speed. **Memory size** says whether the weights fit. **Memory bandwidth** divided by the weight bytes is the **decode ceiling**. **Peak FLOPS** divided by 2 × parameters is the **prefill ceiling**. A 70B model in FP8 is 70 GB: **48 tokens per second** on an H100, **114** on a B200.',
    hint: 'Try different chips, models and formats.',
    mission: 'Find a 70B setup that decodes at 100 tokens per second or more on one GPU.',
    takeaway: 'Decode speed follows bandwidth and bytes. Smaller formats and faster memory both raise it.',
    mount(c) {
      const CH = { h100: { n: 'H100', mem: 80, bw: 3.35, bf: 989, f8: 1979 }, h200: { n: 'H200', mem: 141, bw: 4.8, bf: 989, f8: 1979 }, b200: { n: 'B200', mem: 192, bw: 8, bf: 2250, f8: 4500 } };
      const f = c.fig(420, 164, '<g id="g"></g>');
      const st = c.stats([{ k: 'd', label: 'Decode ceiling, batch 1', value: '', cls: 'data' }, { k: 'p', label: 'Prefill ceiling', value: '', cls: 'mem' }, { k: 'w', label: 'Weights', value: '', cls: 'cmp' }]);
      let chip = 'h100', P = 70, prec = 'fp8';
      const BYTES = { bf16: 2, fp8: 1, int4: 0.5 };
      function draw() {
        const C = CH[chip], wGB = P * BYTES[prec], fits = wGB <= C.mem, dec = fits ? C.bw * 1000 / wGB : 0, peak = (prec === 'fp8' ? C.f8 : C.bf) * 1e12, pre = fits ? peak / (2 * P * 1e9) : 0, x100 = 16 + 100 / 300 * 388;
        f.q('#g').innerHTML = kit.bar(16, 34, 388, 16, wGB / C.mem > 1 ? 1 : wGB / C.mem, fits ? 'f-mem' : 'f-bad', 'Weights in ' + C.n + ' memory (' + C.mem + ' GB)', wGB + ' GB' + (fits ? '' : ' too big')) +
          kit.bar(16, 92, 388, 16, Math.min(1, dec / 300), dec >= 100 ? 'f-ok' : 'f-data', 'Decode tokens per second, one user (0 to 300)', fits ? Math.round(dec) : 'does not fit') + `<line class="ln" x1="${x100.toFixed(1)}" x2="${x100.toFixed(1)}" y1="92" y2="120" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${x100.toFixed(1)}" y="134" text-anchor="middle">100</text><text class="xs mute" x="16" y="154">${C.n}: ${C.bw} TB/s, ${prec === 'fp8' ? C.f8 : C.bf} TFLOPS ${prec === 'fp8' ? 'FP8' : 'BF16'} dense. INT4 is weight-only.</text>`;
        st.set('d', fits ? Math.round(dec) + ' tok/s' : 'no fit', 'bandwidth ÷ weight bytes'); st.set('p', fits ? fmt.n(Math.round(pre)) + ' tok/s' : 'no fit', 'peak ÷ (2 × parameters)'); st.set('w', wGB + ' GB', P + 'B × ' + BYTES[prec] + ' bytes');
        c.mission.set(P === 70 && fits && dec >= 100);
      }
      c.seg({ label: 'Chip', options: [['h100', 'H100'], ['h200', 'H200'], ['b200', 'B200']], value: 'h100', onChange: v => { chip = v; draw(); } });
      c.seg({ label: 'Model', options: [['8', '8B'], ['70', '70B'], ['405', '405B']], value: '70', onChange: v => { P = +v; draw(); } });
      c.seg({ label: 'Weight format', options: [['bf16', 'BF16'], ['fp8', 'FP8'], ['int4', 'INT4']], value: 'fp8', onChange: v => { prec = v; draw(); } });
      c.note('Spec figures: H100 SXM 80 GB, H200 141 GB, B200 192 GB. Ceilings ignore the KV cache and real efficiency.');
      draw();
      c.demo(1500, async () => { chip = 'b200'; draw(); });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'What is a warp?', o: ['A group of 32 threads that run the same instruction together', 'A cache line of 128 bytes', 'One streaming multiprocessor', 'A kernel launch'], a: 0, why: 'A warp is 32 threads in lockstep. It is the unit the scheduler issues instructions to.' },
      { q: 'Half the lanes in a warp take an if branch and half take the else. What happens?', o: ['Each half runs on a different SM', 'The warp runs both paths one after the other', 'The warp crashes', 'The branch is skipped'], a: 1, why: 'The warp runs the if path with the else lanes switched off, then the else path. That is divergence, and it doubles the time.' },
      { q: 'Why does an SM keep many warps resident?', o: ['To use more registers', 'To run more kernels', 'To switch to another warp while one waits on memory', 'To reduce power'], a: 2, why: 'A memory load takes hundreds of cycles. Switching to a ready warp costs nothing, so the waits overlap.' },
      { q: 'Each lane in a warp reads a float, with a stride of 8 floats between lanes. About how much of the fetched data is used?', o: ['100%', '50%', '25%', '12.5%'], a: 3, why: 'Each lane needs its own 32-byte sector but uses 4 bytes of it, so 4 ÷ 32 = 12.5%.' },
      { q: 'Why is a BF16 matrix multiply so much faster than FP32 on an H100?', o: ['Tensor cores deliver about 15 times the peak of the FP32 CUDA cores', 'BF16 uses less memory bandwidth', 'FP32 is not supported', 'BF16 skips the multiply'], a: 0, why: '989 TFLOPS on tensor cores against 67 TFLOPS in FP32 on CUDA cores. Small formats let the same hardware do more.' },
      { q: 'What do CUDA graphs fix in a decode step with thousands of tiny kernels?', o: ['Divergence inside warps', 'Poor memory coalescing', 'Too few warps per SM', 'The CPU cost of launching each kernel'], a: 3, why: 'A graph replays a recorded sequence with one launch, so the GPU is not left waiting for the CPU.' },
      { q: 'Which link should carry the per-layer all-reduces of tensor parallelism?', o: ['Ethernet', 'NVLink inside the node', 'PCIe to the host', 'InfiniBand between racks'], a: 1, why: 'Those all-reduces sit on the critical path. NVLink is 7 to 36 times faster than the alternatives.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [0, 1, 2, 3, 4, 5].map(i => [0, 1, 2].map(j => `<rect x="${44 + i * 40}" y="${34 + j * 30}" width="32" height="22" rx="4" style="fill:var(--${(i + j) % 3 === 0 ? 'mem' : (i + j) % 3 === 1 ? 'data' : 'cmp'}-soft);stroke:var(--${(i + j) % 3 === 0 ? 'mem' : (i + j) % 3 === 1 ? 'data' : 'cmp'});stroke-width:1.2"/>`).join('')).join('')
    + '</g><rect x="44" y="128" width="232" height="8" rx="4" style="fill:var(--ctl);opacity:.85"/><text x="44" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">132 SMs, 32-thread warps</text></svg>';

  window.LESSONS.push({
    id: 'gpu', n: 8, track: 'inference', order: 2,
    title: 'Inside the GPU',
    tagline: 'Streaming multiprocessors, warps, the memory ladder, tensor cores and the links between chips.',
    preview,
    scenes: S
  });
})();
