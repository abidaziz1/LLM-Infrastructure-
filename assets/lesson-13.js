/* Lesson 13: Serving. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const cls3 = ['f-data', 'f-mem', 'f-cmp'], on3 = ['--on-data', '--on-mem', '--on-cmp'];

  /* 1 ---------------------------------------------------------------- */
  const LEN = { same: Array(20).fill(6), mixed: [7, 9, 3, 5, 4, 9, 6, 9, 4, 5, 10, 5, 3, 4, 3, 7, 10, 6, 4, 4], wide: [2, 2, 6, 3, 5, 15, 7, 6, 10, 7, 7, 5, 4, 13, 3, 4, 2, 3, 2, 3] };
  function schedule(len, cont) {
    const SL = 4, blocks = [];
    if (!cont) { let t = 0; for (let g = 0; g < len.length; g += SL) { const grp = len.slice(g, g + SL), mx = Math.max(...grp); grp.forEach((l, i) => blocks.push({ s: i, t0: t, l, id: g + i })); t += mx; } return { blocks, T: t }; }
    const free = new Array(SL).fill(0);
    len.forEach((l, id) => { const s = free.indexOf(Math.min(...free)); blocks.push({ s, t0: free[s], l, id }); free[s] += l; });
    return { blocks, T: Math.max(...free) };
  }
  S.push({
    id: 'batching', tag: 'Scheduling',
    title: 'Continuous batching fills every slot, every step',
    alt: 'A schedule with four rows, one per batch slot, and time running left to right. Numbered colored blocks are requests, and red areas are idle slot time. With static batching each group of four waits for its longest request, so short requests leave red gaps. With continuous batching a finished request frees its slot for a waiting one, so the red gaps nearly vanish. Controls set the policy and how much output lengths vary. Counters show utilization, finish time and throughput.',
    text: 'A static batch waits for its **longest** request, so the slots of short requests sit idle. [[continuous batching|Continuous batching]] decides at every decode step: when a request finishes, a waiting one takes its slot at the next step. The Orca paper called this iteration-level scheduling, and vLLM and similar servers use it. The gain grows as output lengths spread out.',
    hint: 'Switch the policy, then widen the lengths.',
    mission: 'Reach at least 90% slot utilization with mixed lengths.',
    takeaway: 'Idle slots are wasted GPU time. Scheduling every step instead of every batch removes most of it.',
    mount(c) {
      const f = c.fig(420, 196, '<g id="g"></g>');
      const st = c.stats([{ k: 'u', label: 'Slot utilization', value: '', cls: 'data' }, { k: 't', label: 'Time to finish all 20', value: '', cls: 'cmp' }, { k: 'p', label: 'Work per block', value: '', cls: 'ok' }]);
      let pol = 'static', spread = 'same';
      function draw() {
        const len = LEN[spread], a = schedule(len, pol === 'cont'), mx = Math.max(schedule(len, false).T, schedule(len, true).T), u = 352 / mx, X0 = 56, rh = 26, gap = 6, work = len.reduce((p, q) => p + q, 0);
        let g = '';
        for (let s = 0; s < 4; s++) {
          const y = 14 + s * (rh + gap), row = a.blocks.filter(b => b.s === s).sort((p, q) => p.t0 - q.t0);
          g += `<rect class="well" x="${X0}" y="${y}" width="${(mx * u).toFixed(1)}" height="${rh}" rx="4"/><text class="xs m mute" x="${X0 - 6}" y="${y + 17}" text-anchor="end">slot ${s + 1}</text>`;
          let cur = 0; row.forEach(b => { if (b.t0 > cur) g += `<rect class="f-bad" x="${(X0 + cur * u).toFixed(1)}" y="${y}" width="${((b.t0 - cur) * u).toFixed(1)}" height="${rh}" style="opacity:.3"/>`; cur = b.t0 + b.l; });
          if (cur < a.T) g += `<rect class="f-bad" x="${(X0 + cur * u).toFixed(1)}" y="${y}" width="${((a.T - cur) * u).toFixed(1)}" height="${rh}" style="opacity:.3"/>`;
          row.forEach(b => { g += `<rect class="${cls3[b.id % 3]}" x="${(X0 + b.t0 * u + 0.5).toFixed(1)}" y="${y}" width="${(b.l * u - 1).toFixed(1)}" height="${rh}" rx="3"/>`; if (b.l * u >= 13) g += `<text class="xs b" x="${(X0 + (b.t0 + b.l / 2) * u).toFixed(1)}" y="${y + 17}" text-anchor="middle" style="fill:var(${on3[b.id % 3]})">${b.id + 1}</text>`; });
        }
        g += `<text class="xs mute" x="${X0}" y="${14 + 4 * (rh + gap) + 14}">time, one block = 5 decode steps. Red: slot idle.</text><text class="xs mute" x="${X0}" y="${14 + 4 * (rh + gap) + 32}">20 requests, ${pol === 'cont' ? 'a new one starts when a slot frees.' : 'groups of 4 start together.'}</text>`;
        f.q('#g').innerHTML = g;
        const util = work / (4 * a.T);
        st.set('u', pct(util), work + ' of ' + 4 * a.T + ' slot-blocks busy'); st.set('t', a.T + ' blocks', pol === 'cont' ? 'continuous' : 'static'); st.set('p', (work / a.T).toFixed(1), 'blocks of work per block, 4 at best');
        c.mission.set(spread === 'mixed' && util >= 0.9);
      }
      const sP = c.seg({ label: 'Batching', options: [['static', 'Static'], ['cont', 'Continuous']], value: 'static', onChange: v => { pol = v; draw(); } });
      const sS = c.seg({ label: 'Output lengths', options: [['same', 'All the same'], ['mixed', 'Mixed'], ['wide', 'Very different']], value: 'same', onChange: v => { spread = v; draw(); } });
      draw();
      c.demo(1500, async () => { spread = 'mixed'; sS.set('mixed'); pol = 'cont'; sP.set('cont'); draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'chunk', tag: 'Scheduling',
    title: 'A long prompt can freeze everyone else',
    alt: 'Two rows on a shared time axis. The top row shows GPU iterations: blue for decode work and orange for prefill work. The bottom row shows the moments a chatting user receives a token. Without chunking, one long prefill creates a long gap with no tokens. With smaller chunks the gap shrinks, but the long prompt finishes later. A slider sets the chunk size. Counters show the longest pause, the time to first token of the long prompt and the number of iterations.',
    text: '[[prefill|Prefill]] is compute-heavy and a 32K-token prompt can occupy the GPU for **over half a second**. Every user who is decoding waits. [[chunked prefill|Chunked prefill]] cuts the prompt into pieces and runs one piece with each decode step, so the pause equals one iteration. Smaller chunks shorten the pause but make the long prompt wait for **more iterations**. The pick is a trade-off.',
    hint: 'Try each chunk size and watch the gap.',
    mission: 'Keep the pause under 50 ms and the long prompt’s first token under 0.75 s.',
    takeaway: 'Chunk size trades decode smoothness against the long prompt’s own wait. There is a middle that meets both.',
    mount(c) {
      const TD = 7, PT = 0.0177, PROMPT = 32768, MAXT = 128 * (TD + 256 * PT) + 6 * TD, X0 = 16, W = 388;
      const f = c.fig(420, 156, '<g id="g"></g>');
      c.legend([['mem', 'Decode work'], ['cmp', 'Prefill work']]);
      const st = c.stats([{ k: 'p', label: 'Longest pause for decoders', value: '', cls: 'bad' }, { k: 't', label: 'First token, long prompt', value: '', cls: 'cmp' }, { k: 'n', label: 'Iterations for the prompt', value: '', cls: 'ctl' }]);
      let C = 32768;
      function draw() {
        const n = Math.ceil(PROMPT / C), ti = TD + C * PT, u = W / MAXT; let t = 0, g = '<text class="b sm" x="16" y="16">GPU iterations, 70B in FP8 on 8 GPUs</text>', ticks = '', gaps = '', iter = [];
        for (let i = 0; i < 3; i++) iter.push([TD, 0]); for (let i = 0; i < n; i++) iter.push([TD, C * PT]); for (let i = 0; i < 3; i++) iter.push([TD, 0]);
        let last = 0, worst = 0, ws = 0;
        iter.forEach(([d, p]) => {
          const x = X0 + t * u; g += `<rect class="f-mem" x="${x.toFixed(2)}" y="26" width="${Math.max(0.8, d * u).toFixed(2)}" height="26"/>` + (p ? `<rect class="f-cmp" x="${(x + d * u).toFixed(2)}" y="26" width="${Math.max(0.8, p * u).toFixed(2)}" height="26"/>` : '');
          t += d + p; ticks += `<line class="ln" x1="${(X0 + t * u).toFixed(2)}" x2="${(X0 + t * u).toFixed(2)}" y1="86" y2="106" style="stroke:var(--ink);stroke-width:1.4"/>`;
          if (t - last > worst) { worst = t - last; ws = last; } last = t;
        });
        gaps = `<rect class="f-bad" x="${(X0 + ws * u).toFixed(1)}" y="86" width="${(worst * u).toFixed(1)}" height="20" style="opacity:.3"/>`;
        g += '<text class="b sm" x="16" y="76">Tokens a chatting user receives</text>' + gaps + ticks + `<line class="axis" x1="${X0}" x2="${X0 + W}" y1="106" y2="106"/><text class="xs" x="16" y="128">${n === 1 ? 'The whole prompt runs in one iteration.' : 'The prompt runs as ' + n + ' chunks of ' + C + ' tokens.'} Longest gap: ${worst.toFixed(0)} ms.</text><text class="xs mute" x="16" y="146">Toy: decode step 7 ms, prefill 17.7 µs per token. Attention cost is ignored.</text>`;
        f.q('#g').innerHTML = g;
        st.set('p', worst.toFixed(0) + ' ms', n === 1 ? 'one big iteration' : 'one iteration'); st.set('t', (n * ti / 1e3).toFixed(2) + ' s', n + ' × ' + ti.toFixed(0) + ' ms'); st.set('n', String(n), PROMPT / 1024 + 'K tokens ÷ ' + (C >= PROMPT ? 'all' : C));
        c.mission.set(worst <= 50 && n * ti <= 750);
      }
      const sl = c.slider({ label: 'Prefill chunk per iteration', values: [256, 512, 1024, 2048, 4096, 32768], value: 32768, fmt: v => v === 32768 ? 'no chunking' : fmt.n(v, 0) + ' tokens', onInput: v => { C = v; draw(); } });
      draw();
      c.play(async () => { for (const v of [4096, 2048, 1024, 512]) { C = v; sl.set(v, true); draw(); await c.wait(450); } await c.wait(300); C = 32768; sl.set(32768, true); draw(); });
      c.demo(1500, async () => { C = 2048; sl.set(2048, true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'disagg', tag: 'Architecture',
    title: 'Give prefill and decode their own GPUs',
    alt: 'A row of 16 GPU squares split into prefill GPUs in orange and decode GPUs in blue. Below, two bars show the capacity of each pool in requests per second, and a line states how long the KV cache takes to cross the link. Controls set how many GPUs are in the prefill pool and the link speed in gigabits per second. Counters show the capacity of the system, the transfer time and the time to first token.',
    text: '[[prefill|Prefill]] is **compute-bound** and [[decode]] is **memory-bound**, so on one GPU each slows the other. [[disaggregation|Disaggregation]] gives each its own pool: prefill GPUs build the KV cache and send it to decode GPUs. DistServe and Splitwise proposed this split. The cost is moving the cache: **537 MB** per 4K-token request for an 8B model. Mind the units: a **400 Gbps** link moves **50 GB/s**.',
    hint: 'Balance the two pools, then raise the link speed.',
    mission: 'Reach 125 requests per second with the first token in under 110 ms.',
    takeaway: 'Pool sizes must match the work, and the link must carry the cache quickly. Gbps counts bits, GB/s counts bytes: divide by 8.',
    mount(c) {
      const GPUS = 16, PROMPT = 4096, OUT = 256, KVTOK = 131072, W8 = 8e9, FP = 1979e12 * 0.5, BWG = 3.35e12;
      const tPre = 2 * W8 * PROMPT / FP, tStep = (W8 + 64 * (PROMPT + OUT) * KVTOK) / BWG, decRate = 64 / tStep / OUT, kvBytes = PROMPT * KVTOK;
      const f = c.fig(420, 176, '<g id="g"></g>');
      const st = c.stats([{ k: 'c', label: 'System capacity', value: '', cls: 'ok' }, { k: 'x', label: 'KV transfer', value: '', cls: 'mem' }, { k: 't', label: 'Time to first token', value: '', cls: 'cmp' }]);
      let P = 8, gbps = 100;
      function draw() {
        const D = GPUS - P, capP = P / tPre, capD = D * decRate, cap = Math.min(capP, capD), xfer = kvBytes * 8 / (gbps * 1e9), ttft = tPre + xfer + tStep, mx = 200;
        let g = '<text class="b sm" x="16" y="16">16 GPUs: orange for prefill, blue for decode</text>';
        for (let k = 0; k < GPUS; k++) g += `<rect class="${k < P ? 'f-cmp' : 'f-mem'}" x="${16 + k * 24.4}" y="26" width="20" height="22" rx="4"/>`;
        g += `<text class="xs" x="16" y="68">KV cache: ${(kvBytes / 1e6).toFixed(0)} MB per request. ${gbps >= 1000 ? 'NVLink' : gbps + ' Gbps'} is ${fmt.n(gbps / 8, 0)} GB/s, so ${xfer * 1e3 < 10 ? (xfer * 1e3).toFixed(1) : (xfer * 1e3).toFixed(0)} ms.</text>`;
        g += kit.bar(16, 98, 388, 14, capP / mx, 'f-cmp', 'Prefill pool' + (capP <= capD ? ', the limit' : ''), fmt.n(capP, 0) + ' req/s') + kit.bar(16, 140, 388, 14, capD / mx, 'f-mem', 'Decode pool' + (capD < capP ? ', the limit' : ''), fmt.n(capD, 0) + ' req/s');
        f.q('#g').innerHTML = g;
        st.set('c', fmt.n(cap, 0) + ' req/s', capP <= capD ? 'prefill-bound' : 'decode-bound'); st.set('x', xfer * 1e3 < 10 ? (xfer * 1e3).toFixed(1) + ' ms' : (xfer * 1e3).toFixed(0) + ' ms', gbps >= 1000 ? '3,600 Gbps NVLink' : gbps + ' Gbps ÷ 8 = ' + fmt.n(gbps / 8, 1) + ' GB/s'); st.set('t', (ttft * 1e3).toFixed(0) + ' ms', 'prefill ' + (tPre * 1e3).toFixed(0) + ' + transfer + 1 step');
        c.mission.set(cap >= 125 && ttft <= 0.11);
      }
      const sP = c.slider({ label: 'GPUs in the prefill pool', values: [4, 5, 6, 7, 8, 9, 10, 11, 12], value: 8, fmt: v => v + ' of 16', onInput: v => { P = v; draw(); } });
      const sL = c.seg({ label: 'Link between the pools', options: [['25', '25 Gbps'], ['100', '100 Gbps'], ['400', '400 Gbps'], ['3600', 'NVLink']], value: '100', onChange: v => { gbps = +v; draw(); } });
      c.note('Toy: 8B model in FP8 on single GPUs, 4,096-token prompts, 256 output tokens, decode batches of 64, prefill at half of peak. Queueing is ignored.');
      draw();
      c.demo(1500, async () => { P = 9; sP.set(9, true); gbps = 400; sL.set('400'); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'queue', tag: 'Load',
    title: 'Run hot and the slowest requests wait forever',
    alt: 'A chart of the 99th-percentile latency, in multiples of the service time, against utilization from 0 to 100 percent. The curve is flat at low utilization and climbs steeply above 80 percent. A dashed horizontal line marks the latency target and a dashed vertical line marks the cost limit. A marker shows the chosen utilization. Counters show the 99th-percentile latency, the average latency and the cost per request.',
    text: 'Requests arrive at random, so some find the server busy and **wait**. In the simplest queue, response time grows as **1 ÷ (1 − utilization)**: double the service time at 50% busy, ten times at 90%. The slowest 1% take about **4.6 times the average**. Running cold wastes money, because cost per request is **1 ÷ utilization**. Capacity planning is choosing the point between.',
    hint: 'Slide utilization and watch where both limits hold.',
    mission: 'Keep the 99th percentile under 30 service times at no more than 1.3 times the minimum cost.',
    takeaway: 'Above about 80% busy, each extra point of utilization costs a lot of tail latency. Keep headroom.',
    mount(c) {
      const ch = kit.chart({ x: 52, y: 26, w: 340, h: 112, xmin: 0, xmax: 1, ymin: 0, ymax: 50, xt: [0, 0.25, 0.5, 0.75, 1], xf: v => Math.round(v * 100) + '%', yt: [0, 10, 20, 30, 40, 50], xlabel: 'Utilization', ylabel: '99th percentile, in service times' });
      const pts = Array.from({ length: 98 }, (_, i) => { const r = 0.01 + i * 0.0099; return [ch.X(r), ch.Y(Math.min(50, 4.6 / (1 - r)))]; });
      const f = c.fig(420, 188, ch.svg + `<line class="ln dash" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(30).toFixed(1)}" y2="${ch.Y(30).toFixed(1)}" style="stroke:var(--ok)"/><text class="xs" x="${ch.x0 + 6}" y="${(ch.Y(30) - 4).toFixed(1)}" style="fill:var(--ok)">target: 30</text><line class="ln dash" x1="${ch.X(0.77).toFixed(1)}" x2="${ch.X(0.77).toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}" style="stroke:var(--warn)"/><text class="xs" x="${(ch.X(0.77) - 4).toFixed(1)}" y="${ch.y1 - 6}" text-anchor="end" style="fill:var(--warn)">cost limit: 77%</text><path class="s-cmp s3" fill="none" d="${kit.path(pts)}"/><g id="m"></g>`);
      const st = c.stats([{ k: 'p', label: '99th percentile', value: '', cls: 'bad' }, { k: 'a', label: 'Average', value: '', cls: 'cmp' }, { k: 'c', label: 'Cost per request', value: '', cls: 'mem' }]);
      let rho = 0.3;
      function draw() {
        const p99 = 4.6 / (1 - rho), avg = 1 / (1 - rho), cost = 1 / rho, x = ch.X(rho);
        f.q('#m').innerHTML = `<line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(Math.min(50, p99)).toFixed(1)}" r="5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/>`;
        st.set('p', p99.toFixed(1) + '×', 'service times'); st.set('a', avg.toFixed(1) + '×', 'service times'); st.set('c', cost.toFixed(2) + '×', 'vs 100% utilization');
        c.mission.set(p99 <= 30 && cost <= 1.3);
      }
      const sl = c.slider({ label: 'Utilization', min: 5, max: 98, step: 1, value: 30, fmt: v => v + '%', onInput: v => { rho = v / 100; draw(); } });
      c.note('Toy: random arrivals, one server, exponential service times. A batching server has many slots, which softens the curve but keeps its shape.');
      draw();
      c.demo(1500, async () => { rho = 0.8; sl.set(80, true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'router', tag: 'Routing',
    title: 'Send a conversation back to the replica that remembers it',
    alt: 'Four stacked bars, one per replica, show how many of 2,000 requests each handled, split into cache hits in green and misses in orange, with a dashed line at the average load. Controls pick the routing policy and how uneven conversation popularity is. Counters show the cache hit rate, the busiest replica compared with the average, and the number of misses.',
    text: 'Follow-up messages repeat a long prefix. A replica that already holds it can **skip the prefill**. **Round-robin** and **least-loaded** spread each conversation over every replica, so caches rarely help. **Hashing** by conversation keeps caches warm but overloads the replica with a busy conversation. [[cache-aware routing|Cache-aware]] routing goes where the prefix lives unless that replica is more than 30% over its share.',
    hint: 'Try each policy, then make popularity more uneven.',
    mission: 'Get at least 90% cache hits with the busiest replica within 1.25 times the average.',
    takeaway: 'Locality and balance pull in opposite directions. A router that watches both gets most of each.',
    mount(c) {
      const R = 4, C = 64, CAP = 16, N = 2000, memo = {};
      function sim(policy, zs) {
        const key = policy + zs; if (memo[key]) return memo[key];
        const r = kit.rng(4), w = Array.from({ length: C }, (_, i) => Math.pow(i + 1, -zs)), sw = w.reduce((a, b) => a + b, 0), cum = []; let acc = 0; w.forEach(v => { acc += v / sw; cum.push(acc); });
        const draw = () => { const u = r(); let lo = 0, hi = C - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] >= u) hi = m; else lo = m + 1; } return lo; };
        const caches = Array.from({ length: R }, () => []), load = new Array(R).fill(0), hit = new Array(R).fill(0); let rr = 0;
        const owner = cv => ((cv * 2654435761) >>> 0) % R;
        for (let i = 0; i < N; i++) {
          const cv = draw(), mean = (i + 1) / R; let rep;
          if (policy === 'rr') rep = rr++ % R;
          else if (policy === 'least') rep = load.indexOf(Math.min(...load));
          else if (policy === 'hash') rep = owner(cv);
          else { const have = []; for (let k = 0; k < R; k++) if (caches[k].includes(cv)) have.push(k); let pick = -1; if (have.length) { pick = have.reduce((x, y) => load[y] < load[x] ? y : x); if (load[pick] + 1 > 1.3 * mean + 1) pick = -1; } rep = pick >= 0 ? pick : load.indexOf(Math.min(...load)); }
          load[rep]++; const cc = caches[rep], j = cc.indexOf(cv); if (j >= 0) { hit[rep]++; cc.splice(j, 1); cc.push(cv); } else { cc.push(cv); if (cc.length > CAP) cc.shift(); }
        }
        return (memo[key] = { load, hit, rate: hit.reduce((a, b) => a + b, 0) / N, imb: Math.max(...load) / (N / R) });
      }
      const DESC = { rr: 'Round-robin: every 4th request goes to the same replica. Balanced, but each conversation lands on all four.', least: 'Least loaded: the idlest replica takes the request. Balanced, with the same scattered caches.', hash: 'Hash by conversation: a conversation always lands on one replica. Warm caches, uneven load.', aware: 'Cache-aware: prefer a replica that holds the prefix, unless it is over 130% of its share.' };
      const f = c.fig(420, 196, '<g id="g"></g>');
      c.legend([['ok', 'Cache hit'], ['cmp', 'Miss: prefix recomputed']]);
      const st = c.stats([{ k: 'h', label: 'Cache hit rate', value: '', cls: 'ok' }, { k: 'i', label: 'Busiest ÷ average', value: '', cls: 'bad' }, { k: 'm', label: 'Misses', value: '', cls: 'cmp' }]);
      const nt = c.note('');
      let pol = 'rr', zs = 1;
      function draw() {
        const o = sim(pol, zs), mx = 900, base = 150, H = 110; let g = '<text class="b sm" x="16" y="16">Requests handled by each of 4 replicas</text>';
        o.load.forEach((v, i) => { const x = 40 + i * 92, h1 = o.hit[i] / mx * H, h2 = (v - o.hit[i]) / mx * H; g += `<rect class="f-ok" x="${x}" y="${(base - h1).toFixed(1)}" width="60" height="${Math.max(1, h1).toFixed(1)}" rx="3"/><rect class="f-cmp" x="${x}" y="${(base - h1 - h2).toFixed(1)}" width="60" height="${Math.max(1, h2).toFixed(1)}" rx="3"/><text class="xs m b" x="${x + 30}" y="${(base - h1 - h2 - 5).toFixed(1)}" text-anchor="middle">${v}</text><text class="xs m mute" x="${x + 30}" y="168" text-anchor="middle">Replica ${i + 1}</text>`; });
        const ym = base - (N / R) / mx * H;
        g += `<line class="axis" x1="32" x2="404" y1="${base}" y2="${base}"/><line class="ln dash" x1="32" x2="404" y1="${ym.toFixed(1)}" y2="${ym.toFixed(1)}"/><text class="xs mute" x="16" y="188">Dashed line: the average, 500 requests per replica.</text>`;
        f.q('#g').innerHTML = g; nt.textContent = DESC[pol];
        st.set('h', pct(o.rate), 'of 2,000 requests'); st.set('i', o.imb.toFixed(2) + '×', o.imb <= 1.25 ? 'balanced' : 'uneven'); st.set('m', fmt.n(Math.round(N * (1 - o.rate)), 0), 'prefix recomputed');
        c.mission.set(o.rate >= 0.9 && o.imb <= 1.25);
      }
      const sP = c.seg({ label: 'Routing policy', options: [['rr', 'Round-robin'], ['least', 'Least loaded'], ['hash', 'Hash by conversation'], ['aware', 'Cache-aware']], value: 'rr', onChange: v => { pol = v; draw(); } });
      c.seg({ label: 'Conversation popularity', options: [['0.8', 'Mild skew'], ['1', 'Typical'], ['1.2', 'Strong skew']], value: '1', onChange: v => { zs = +v; draw(); } });
      c.note('Toy: 64 conversations with Zipf popularity, 16 kept in each replica’s cache, least recently used leaves first. Real routers track cached prefixes in a radix tree.');
      draw();
      c.demo(1500, async () => { pol = 'aware'; sP.set('aware'); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'cost', tag: 'Money',
    title: 'The same GPUs can cost 45 times more per token',
    alt: 'Five horizontal bars on a log scale show the cost per million output tokens at batch sizes from 1 to 128 users per replica, for the chosen GPU price and utilization. The bar for the chosen batch is orange. Controls set the GPU price per hour, the users per replica and the utilization. Counters show tokens per second, the replica cost per hour and the cost per million output tokens.',
    text: 'Cost per million tokens is **GPU dollars per hour ÷ tokens per hour**. Tokens per hour depend on how many users share each decode step and how often the GPUs are actually busy. One 8-GPU replica at **$2.50 per GPU-hour** costs $20 an hour. With **1 user** it makes about 150 tokens a second. With **64 users** it makes about 6,600. Idle time multiplies the cost again.',
    hint: 'Raise the batch, then the utilization.',
    mission: 'At $2.50 per GPU-hour, get under $1.50 per million output tokens.',
    takeaway: 'Price per token is mostly a batching and utilization story. The GPU price is the smaller lever.',
    mount(c) {
      const M = { P: 70e9, layers: 80, hid: 8192, kv: 2 * 80 * 8 * 128 * 2 }, BS = [1, 4, 16, 64, 128];
      const arT = (m, hop) => 5e-6 + 2 * 7 * hop + 2 * 7 / 8 * m / 450e9;
      const tput = B => { const mem = (M.P / 8 + B * M.kv * 4096 / 8) / 3.35e12, comp = 2 * M.P * B / (8 * 1979e12 * 0.6), comm = M.layers * 2 * arT(B * M.hid * 2, 1.5e-6); return B / (Math.max(mem, comp) + comm); };
      const TP = {}; BS.forEach(b => { TP[b] = tput(b); });
      const f = c.fig(420, 196, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'Output tokens per second', value: '', cls: 'data' }, { k: 'h', label: 'Replica cost per hour', value: '', cls: 'mem' }, { k: 'c', label: 'Per million output tokens', value: '', cls: 'ok' }]);
      let price = 2.5, B = 4, util = 0.25;
      const cost = (b, hr) => hr / (TP[b] * 3600 * util) * 1e6;
      function draw() {
        const hr = 8 * price, lo = Math.log10(0.3), hi = Math.log10(150); let g = '<text class="b sm" x="16" y="16">Dollars per million output tokens, by users per replica</text>';
        BS.forEach((b, i) => { const v = cost(b, hr), fr = (Math.log10(v) - lo) / (hi - lo); g += kit.bar(16, 38 + i * 30, 388, 12, fr, b === B ? 'f-cmp' : 'f-mem', b + (b === 1 ? ' user' : ' users'), '$' + (v < 10 ? v.toFixed(2) : v.toFixed(0))); });
        g += '<text class="xs mute" x="16" y="190">Log scale. Same GPUs, same model, same utilization in every bar.</text>';
        f.q('#g').innerHTML = g;
        const v = cost(B, hr);
        st.set('t', fmt.n(TP[B] * util, 0), fmt.n(TP[B], 0) + ' at 100% busy × ' + Math.round(util * 100) + '%'); st.set('h', '$' + hr.toFixed(0), '8 GPUs × $' + price.toFixed(2)); st.set('c', '$' + (v < 10 ? v.toFixed(2) : v.toFixed(1)), 'at ' + B + (B === 1 ? ' user' : ' users') + ', ' + Math.round(util * 100) + '% busy');
        c.mission.set(price === 2.5 && v <= 1.5);
      }
      c.slider({ label: 'Price per GPU-hour', values: [1.5, 2, 2.5, 3, 4, 6], value: 2.5, fmt: v => '$' + v.toFixed(2), onInput: v => { price = v; draw(); } });
      const sB = c.slider({ label: 'Users per replica', values: BS, value: 4, fmt: v => v, onInput: v => { B = v; draw(); } });
      const sU = c.slider({ label: 'Share of time the GPUs are busy', values: [10, 25, 50, 75, 90], value: 25, fmt: v => v + '%', onInput: v => { util = v / 100; draw(); } });
      c.note('Toy: one 8-GPU replica of a 70B model in FP8, 4,096 tokens of context per user, output tokens only. Prices are assumptions, not quotes. Input tokens cost less because prefill is batched well.');
      draw();
      c.demo(1500, async () => { B = 64; sB.set(64, true); util = 0.75; sU.set(75, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'Why does continuous batching beat static batching when output lengths vary?', o: ['A finished request frees its slot for a waiting one at the next step', 'It uses a bigger batch', 'It skips the KV cache', 'It runs prefill on different GPUs'], a: 0, why: 'A static batch waits for its longest request. Continuous batching refills a slot as soon as it frees, so fewer slots sit idle.' },
      { q: 'A 32K-token prompt arrives while others are decoding. What does chunked prefill do?', o: ['It compresses the prompt', 'It runs the prompt in pieces alongside decode steps, so decoders pause less', 'It drops the middle of the prompt', 'It moves decoding to another model'], a: 1, why: 'Each iteration carries one piece of the prompt plus the decode work, so the longest pause is one iteration.' },
      { q: 'What do you give up with a smaller prefill chunk?', o: ['Accuracy', 'KV cache space', 'Decode speed for everyone', 'The long prompt needs more iterations, so its first token comes later'], a: 3, why: 'Shorter pauses for the decoders mean more iterations for the long prompt, which delays its own first token.' },
      { q: 'Why split prefill and decode onto separate GPU pools?', o: ['Decode does not need a GPU', 'Prefill needs less memory', 'Prefill is compute-bound and decode is memory-bound, so mixing them makes each slow the other', 'It removes the KV cache'], a: 2, why: 'Separate pools can be sized and batched for their own bottleneck. The price is moving the KV cache between them.' },
      { q: 'A 4K-token request on an 8B model has a 537 MB KV cache. How long does it take over a 100 Gbps link?', o: ['About 43 ms', 'About 4 ms', 'About 430 ms', 'About 4 s'], a: 0, why: '100 Gbps is 12.5 GB/s. 537 MB ÷ 12.5 GB/s is about 43 ms.' },
      { q: 'In the simple queue, what happens to the 99th-percentile latency as utilization approaches 100%?', o: ['It falls', 'It grows without bound', 'It stays flat', 'It doubles once'], a: 1, why: 'Response time follows 1 ÷ (1 − utilization). Near full load, every small burst creates a long queue.' },
      { q: 'Why does cache-aware routing beat round-robin for chat traffic?', o: ['It sends fewer requests', 'It uses a bigger model', 'It sends follow-ups to a replica that already holds the conversation’s KV cache', 'It skips tokenization'], a: 2, why: 'A hit skips the prefill for the repeated prefix. Round-robin scatters each conversation across every replica, so most requests miss.' },
      { q: 'One 8-GPU replica can cost under $1 or about $38 per million output tokens. What is the main cause?', o: ['The GPUs change speed', 'Network fees', 'The model changes', 'Batch size and utilization change how many tokens each GPU-hour produces'], a: 3, why: 'Cost is dollars per hour ÷ tokens per hour. Going from 1 user to 64 users multiplies tokens per hour by about 45.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [[[0, 4, 0], [4, 6, 1], [10, 3, 2]], [[0, 7, 1], [7, 3, 2], [10, 5, 0]], [[0, 3, 2], [3, 5, 0], [8, 6, 1]], [[0, 5, 0], [5, 4, 1], [9, 5, 2]]].map((row, s) => row.map(([t0, l, k]) => `<rect x="${30 + t0 * 17}" y="${30 + s * 25}" width="${l * 17 - 3}" height="20" rx="4" style="fill:var(${['--data', '--mem', '--cmp'][k]});opacity:.9"/>`).join('')).join('')
    + '</g><text x="30" y="20" style="font:600 11px var(--font-mono);fill:var(--ink-3)">every slot busy, every step</text></svg>';

  window.LESSONS.push({
    id: 'serving', n: 13, track: 'inference', order: 7,
    title: 'Serving at Scale',
    tagline: 'Batching, chunked prefill, split pools, queues, routing and the real cost per million tokens.',
    preview,
    scenes: S
  });
})();
