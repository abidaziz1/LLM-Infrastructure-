/* Lesson 15: One request through a 72-GPU rack. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'rack', tag: 'The hardware',
    title: 'One rack, 72 GPUs, one NVLink domain',
    alt: 'A drawing of a rack with nine compute trays, then nine NVLink switch trays, then nine more compute trays. Four cards on the right give the rack’s main numbers: 72 GPUs and 36 CPUs, 130 terabytes per second of NVLink, 13.4 terabytes of HBM and about 120 kilowatts. Clicking a card outlines the matching part of the rack and shows an explanation.',
    text: 'A rack such as **GB200 NVL72** holds **72 GPUs and 36 Grace CPUs** in 18 compute trays. Nine [[nvlink|NVLink]] switch trays connect every GPU to every other GPU at full speed, so all 72 form one [[scale-up domain]]. Before you follow a request through it, look at what is inside.',
    hint: 'Click each card to inspect that part.',
    mission: 'Inspect all four parts of the rack.',
    takeaway: 'The rack is built so that any GPU reaches any other at full NVLink speed. That is what MoE decoding needs.',
    mount(c) {
      const CARDS = [
        { k: 'gpu', big: '72 GPUs', sub: 'and 36 Grace CPUs', cls: 'mem', note: '18 compute trays hold 4 GPUs and 2 Grace CPUs each: 72 GPUs and 36 CPUs in one rack. Each tray is a separate computer, and the NVLink switches join them.' },
        { k: 'nvl', big: '130 TB/s', sub: 'NVLink, 1.8 TB/s per GPU', cls: 'ctl', note: '9 NVLink switch trays join every GPU to every other. Each GPU gets 1.8 TB/s, which is 900 GB/s in each direction, and the rack adds up to about 130 TB/s. An 8-GPU node has only 8 GPUs on that fabric.' },
        { k: 'hbm', big: '13.4 TB', sub: 'HBM3e, 576 TB/s in all', cls: 'data', note: 'Each GPU has about 186 to 192 GB of HBM3e at about 8 TB/s. Across 72 GPUs that is about 13.4 TB and 576 TB/s. A 671B-parameter model in FP8 takes 671 GB, so it fits with room for a large KV cache.' },
        { k: 'pwr', big: 'About 120 kW', sub: 'liquid cooled', cls: 'warn', note: 'The rack draws about 120 kW. Coolant runs through plates on the GPUs and switches, so the data center needs liquid loops as well as air handling.' }
      ];
      const band = (y, kind) => Array.from({ length: 9 }, (_, i) => `<rect class="${kind === 'sw' ? 't-ctl' : 't-mem'}" x="16" y="${(y + i * 5.8).toFixed(1)}" width="168" height="4.6" rx="1.5" style="stroke-width:1"/>` + (kind === 'sw' ? '' : [0, 1, 2, 3].map(j => `<rect class="f-mem" x="${28 + j * 38}" y="${(y + i * 5.8 + 0.8).toFixed(1)}" width="22" height="3" rx="1"/>`).join(''))).join('');
      const f = c.fig(420, 254, '<g id="r"></g><g id="o"></g><g id="cards"></g>');
      const visited = new Set(), nt = c.note('Click a card on the right to inspect that part of the rack.');
      let sel = null;
      const OUT = { gpu: [[16, 40, 168, 52], [16, 184, 168, 52]], nvl: [[16, 112, 168, 52]], hbm: [[16, 40, 168, 52], [16, 184, 168, 52]], pwr: [[10, 30, 180, 214]] };
      const OC = { gpu: 's-mem', nvl: 's-ctl', hbm: 's-data', pwr: 's-warn' };
      function draw() {
        f.q('#r').innerHTML = '<text class="xs mute" x="16" y="34">9 compute trays</text>' + band(40, 'c') + '<text class="xs mute" x="16" y="106">9 NVLink switch trays</text>' + band(112, 'sw') + '<text class="xs mute" x="16" y="178">9 compute trays</text>' + band(184, 'c');
        f.q('#o').innerHTML = sel ? OUT[sel].map(r => `<rect class="${OC[sel]}" fill="none" x="${r[0] - 3}" y="${r[1] - 3}" width="${r[2] + 6}" height="${r[3] + 6}" rx="6" style="stroke-width:3"/>`).join('') : '';
        f.q('#cards').innerHTML = CARDS.map((cd, i) => { const y = 24 + i * 54, on = visited.has(cd.k); return `<g class="clk" data-k="${cd.k}" role="button" tabindex="0" aria-label="${cd.big}, ${cd.sub}"><rect class="${on ? 't-' + cd.cls : 'box'}" x="204" y="${y}" width="200" height="46" rx="8" style="${sel === cd.k ? 'stroke-width:3' : ''}"/><text class="md b" x="216" y="${y + 21}">${cd.big}</text><text class="xs mute" x="216" y="${y + 37}">${cd.sub}</text>${on ? `<path d="M382 ${y + 12} l4 4.4 l8-9" fill="none" class="ink-s" style="stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"/>` : ''}</g>`; }).join('');
        f.qa('#cards .clk').forEach(g => { const act = () => { sel = g.dataset.k; visited.add(sel); nt.textContent = CARDS.find(q => q.k === sel).note; draw(); }; c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
        c.mission.set(visited.size === CARDS.length);
      }
      draw();
      c.demo(1800, async () => { for (const cd of CARDS) { sel = cd.k; visited.add(cd.k); nt.textContent = cd.note; draw(); await c.wait(1300); } });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'waterfall', tag: 'The request',
    title: 'Where the first second goes',
    alt: 'A waterfall chart with eight rows, one per stage of a request from the client to the first token: connection setup, travel to the data center, gateway, tokenizing, router and queue, prefill, KV cache transfer, and the first decode step with the trip back. Each bar starts when the previous one ends, and the longest is outlined. Controls set the prompt length, the load on the system, the distance to the client and whether the connection is new. Counters show the time to first token, the largest stage and the time for a 300-token answer.',
    text: 'A request is more than a model call. It sets up a connection, crosses the network, passes the [[api gateway|gateway]], gets **tokenized**, waits in a **queue**, runs [[prefill]], moves its KV cache to decode GPUs, and streams the first token back. For short prompts the network and the queue dominate. For long prompts **prefill** takes over.',
    hint: 'Lengthen the prompt and watch the bars.',
    mission: 'Make prefill the longest stage.',
    takeaway: 'Short requests wait on the network and the queue. Long prompts wait on prefill. Know which one you have.',
    mount(c) {
      const NAMES = ['Open the connection', 'Request travels in', 'Gateway', 'Tokenize', 'Router and queue', 'Prefill', 'Move the KV cache', 'First token back'], COL = ['f-data', 'f-data', 'f-ctl', 'f-ctl', 'f-warn', 'f-cmp', 'f-mem', 'f-cmp'];
      const f = c.fig(420, 236, '<g id="g"></g>');
      c.legend([['data', 'Network'], ['ctl', 'Gateway'], ['warn', 'Queue'], ['cmp', 'GPU work'], ['mem', 'KV move']]);
      const st = c.stats([{ k: 't', label: 'Time to first token', value: '', cls: 'cmp' }, { k: 'l', label: 'Largest stage', value: '', cls: 'bad' }, { k: 'a', label: 'Whole 300-token answer', value: '', cls: 'ok' }]);
      let P = 200, load = 0.8, rtt = 80, fresh = true;
      const fm = ms => ms < 1 ? ms.toFixed(1) + ' ms' : ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(2) + ' s';
      function times() {
        const prefill = P / 100000 * 1000 + Math.pow(P / 131072, 2) * 400;
        return [fresh ? 2 * rtt : 0, rtt / 2, 5, P * 0.001, 1 + load / (1 - load) * 50, prefill, P * 70272 / 900e9 * 1000, 12 + rtt / 2];
      }
      function draw() {
        const T = times(), total = T.reduce((a, b) => a + b, 0), big = T.indexOf(Math.max(...T)), X0 = 138, W = 218; let acc = 0, g = '';
        T.forEach((d, i) => {
          const y = 12 + i * 21, x = X0 + acc / total * W, w = Math.max(2, d / total * W);
          g += `<text class="xs ${i === big ? 'b' : ''}" x="16" y="${y + 13}">${NAMES[i]}</text><rect class="well" x="${X0}" y="${y}" width="${W}" height="16" rx="4"/><rect class="${COL[i]}" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="16" rx="3"/>${i === big ? `<rect class="ink-s" fill="none" x="${(x - 1).toFixed(1)}" y="${y - 1}" width="${(w + 2).toFixed(1)}" height="18" rx="4" style="stroke-width:2"/>` : ''}<text class="xs m b" x="404" y="${y + 13}" text-anchor="end">${fm(d)}</text>`;
          acc += d;
        });
        g += `<text class="xs mute" x="16" y="${12 + 8 * 21 + 14}">Bars share one time axis. Toy numbers for a 671B MoE in one rack.</text>`;
        f.q('#g').innerHTML = g;
        st.set('t', fm(total), 'sum of the eight stages'); st.set('l', NAMES[big], pct(T[big] / total) + ' of the wait'); st.set('a', ((total + 299 * 12) / 1000).toFixed(1) + ' s', '12 ms per later token');
        c.mission.set(big === 5);
      }
      const sP = c.slider({ label: 'Prompt length', values: [200, 2000, 8000, 32000, 128000], value: 200, fmt: v => fmt.n(v, 0) + ' tokens', onInput: v => { P = v; draw(); } });
      c.seg({ label: 'Load on the system', options: [['0.5', 'Light'], ['0.8', 'Busy'], ['0.95', 'Nearly full']], value: '0.8', onChange: v => { load = +v; draw(); } });
      c.seg({ label: 'Client distance, round trip', options: [['20', '20 ms'], ['80', '80 ms'], ['200', '200 ms']], value: '80', onChange: v => { rtt = +v; draw(); } });
      c.toggle({ label: 'New connection: TCP and TLS first', value: true, onChange: v => { fresh = v; draw(); } });
      c.note('Toy: gateway 5 ms, tokenizing 1 µs per token, queue wait grows as load ÷ (1 − load), prefill 100K tokens per second plus an attention term, 71 KB of KV per token over 900 GB/s NVLink, first decode step 12 ms.');
      draw();
      c.demo(1500, async () => { P = 32000; sP.set(32000, true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'token', tag: 'The request',
    title: 'One token, 61 layers, 116 trips across the rack',
    alt: 'A grid of 72 GPUs. One GPU is violet: it holds this user’s KV cache and runs attention. In each mixture-of-experts layer, lines run from it to the 8 orange GPUs that hold the chosen experts. A slider moves through the 61 layers. The first three layers are dense and need no trip. Counters show the all-to-all exchanges so far, the data sent and the elapsed time.',
    text: 'In a DeepSeek-V3-style model, a decode step passes one token through **61 layers**. Attention runs on the GPU that holds the user’s KV cache. In **58 of the layers** the router then sends the token to **8 expert GPUs** and gathers the results: two [[all-to-all]] exchanges per layer. That is **116 exchanges** for one token, and every one must finish before the next layer can start.',
    hint: 'Slide through the layers.',
    mission: 'Find the first layer where the token leaves its GPU.',
    takeaway: 'Each token makes 116 trips across the rack. That is why the interconnect sets the speed.',
    mount(c) {
      const HOME = 23, X0 = 26, Y0 = 46, PITCH = 20;
      const f = c.fig(420, 214, '<g id="g"></g>');
      const st = c.stats([{ k: 'a', label: 'Exchanges so far', value: '', cls: 'cmp' }, { k: 'd', label: 'Data sent so far', value: '', cls: 'mem' }, { k: 't', label: 'Time so far', value: '', cls: 'ctl' }]);
      let layer = 1;
      const pick = l => { const r = kit.rng(100 + l), s = new Set(); while (s.size < 8) s.add(Math.floor(r() * 72)); return [...s]; };
      const xy = k => [X0 + (k % 9) * PITCH, Y0 + Math.floor(k / 9) * PITCH];
      function draw() {
        const moe = layer >= 4, ex = moe ? pick(layer) : [];
        let g = `<text class="b sm" x="16" y="18">72 GPUs, layer ${layer} of 61</text>`;
        ex.forEach(k => { const a = xy(HOME), b = xy(k); g += `<line class="ln" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" style="stroke:var(--cmp);stroke-width:1.4;opacity:.7"/>`; });
        for (let k = 0; k < 72; k++) { const p = xy(k), hot = k === HOME || ex.includes(k); g += `<circle class="${k === HOME ? 'f-ctl' : ex.includes(k) ? 'f-cmp' : 'well'}" cx="${p[0]}" cy="${p[1]}" r="${hot ? 7 : 6}"/>`; }
        const steps = moe ? ['1  Attention on the violet GPU', '2  Router picks 8 experts', '3  Dispatch to those 8 GPUs', '4  Experts compute', '5  Combine back'] : ['1  Attention on the violet GPU', '2  Dense feed-forward, same GPU', '    No trip across the rack'];
        g += steps.map((s, i) => `<text class="xs" x="212" y="${60 + i * 20}">${s}</text>`).join('') + '<text class="xs mute" x="212" y="176">Violet: attention.</text><text class="xs mute" x="212" y="192">Orange: the 8 experts.</text>';
        g += `<text class="xs mute" x="16" y="${Y0 + 7 * PITCH + 20}">Layers 1 to 3 are dense. Layers 4 to 61 are MoE.</text>`;
        f.q('#g').innerHTML = g;
        const nm = Math.max(0, layer - 3);
        st.set('a', String(2 * nm), nm + ' MoE layers × 2'); st.set('d', fmt.bytes(nm * 172032, 1), '172 KB per MoE layer'); st.set('t', (layer * 0.12).toFixed(2) + ' ms', '120 µs per layer');
        c.mission.set(layer === 4);
      }
      const sl = c.slider({ label: 'Layer', min: 1, max: 61, step: 1, value: 1, fmt: v => v, onInput: v => { layer = v; draw(); } });
      c.note('Toy: 120 µs per layer, from the next scene’s model at 64 users per GPU. Dispatch sends 7168 values in FP8 and combine returns them in BF16, about 172 KB per token per MoE layer.');
      draw();
      c.play(async () => { await c.wait(300); await c.tween(3800, p => { layer = 1 + Math.round(p * 60); sl.set(layer, true); draw(); }, c.ease.io); await c.wait(400); layer = 1; sl.set(1, true); draw(); });
      c.demo(5500, async () => { layer = 4; sl.set(4, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'frontier', tag: 'Speed and throughput',
    title: 'The interconnect moves the whole trade-off curve',
    alt: 'A chart with tokens per second for each user on the horizontal axis and tokens per second for each GPU on the vertical axis. Two curves show the same MoE model on 8-GPU H100 nodes and on a 72-GPU NVLink rack. Larger batches move along a curve toward more throughput and slower users. The rack curve lies far above and to the right of the node curve. A green zone marks the goal. A marker shows the chosen batch. Counters show per-user speed, per-GPU throughput and step time.',
    text: 'A bigger batch per GPU makes each **user slower** and each **GPU more productive**. Every system traces a curve between those two. A DeepSeek-V3-style model on **8-GPU nodes** with 50 GB/s links between them sits low on the chart. On a **72-GPU NVLink rack** the same model gets faster all-to-all exchanges and more memory bandwidth, so the whole curve moves up and to the right.',
    hint: 'Slide the batch on each system.',
    mission: 'Serve each user at 60 tokens per second or more with at least 3,000 tokens per second per GPU.',
    takeaway: 'Raising throughput costs speed per user. A better interconnect lets you have more of both.',
    mount(c) {
      const SYS = { h100: { N: 32, bw: 3.35e12, fp8: 1979e12, mem: 72e9, intra: 450e9, inter: 50e9, lat: 25e-6, ib: true }, nvl72: { N: 72, bw: 8e12, fp8: 4500e12, mem: 170e9, intra: 900e9, inter: 900e9, lat: 10e-6, ib: false } };
      const NL = 61, ATTW = 14.5e9 / 61, EXP = 3 * 7168 * 2048, KVL = 70272 / 61, CTX = 4096, H = 7168, K = 8, BS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
      function step(s, B) {
        const S2 = SYS[s], tA = (ATTW + B * CTX * KVL) / S2.bw, tE = Math.max((256 / S2.N) * EXP / S2.bw, B * K * 2 * 3 * H * 2048 / (0.5 * S2.fp8)), per = B * K * H * 3;
        const bi = S2.ib ? per * 7 / S2.N : per * (S2.N - 1) / S2.N, bx = S2.ib ? per * (S2.N - 8) / S2.N : 0, tC = Math.max(bi / S2.intra, bx / S2.inter) + 2 * S2.lat;
        const t = NL * (tA + tE + tC) + 1e-3, need = 14.5e9 + (256 / S2.N) * EXP * 58 + B * CTX * 70272;
        return { t, user: 1 / t, gpu: B / t, fits: need <= S2.mem, need };
      }
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 0, xmax: 200, ymin: 0, ymax: 14000, xt: [0, 50, 100, 150, 200], yt: [0, 4000, 8000, 12000], yf: v => v ? fmt.n(v / 1000, 0) + 'k' : 0, xlabel: 'Tokens per second, each user', ylabel: 'Tokens per second, each GPU' });
      const pts = s => BS.map(B => [B, step(s, B)]).filter(o => o[1].fits).map(o => [ch.X(o[1].user), ch.Y(o[1].gpu)]);
      const f = c.fig(420, 188, `<rect class="f-ok" x="${ch.X(60).toFixed(1)}" y="${ch.y0}" width="${(ch.x1 - ch.X(60)).toFixed(1)}" height="${(ch.Y(3000) - ch.y0).toFixed(1)}" style="opacity:.13"/><text class="xs b" x="${ch.x1 - 6}" y="${ch.y0 + 14}" text-anchor="end" style="fill:var(--ok)">goal</text>` + ch.svg + '<g id="g"></g>');
      c.legend([['mem', '8-GPU H100 nodes, EP32'], ['cmp', '72-GPU NVLink rack, EP72']]);
      const st = c.stats([{ k: 'u', label: 'Per user', value: '', cls: 'ok' }, { k: 'g', label: 'Per GPU', value: '', cls: 'cmp' }, { k: 't', label: 'Step time', value: '', cls: 'ctl' }]);
      let sys = 'h100', B = 16;
      function draw() {
        const o = step(sys, B), act = pts(sys), oth = pts(sys === 'h100' ? 'nvl72' : 'h100');
        const line = (p, cls, op) => `<path class="${cls} s2" fill="none" d="${kit.path(p)}" style="opacity:${op}"/>` + p.map(q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.6" class="${cls.replace('s-', 'f-')}" style="opacity:${op}"/>`).join('');
        const sc = s => s === 'h100' ? 's-mem' : 's-cmp';
        let g = line(oth, sc(sys === 'h100' ? 'nvl72' : 'h100'), 0.35) + line(act, sc(sys), 1);
        if (o.fits) g += `<circle cx="${ch.X(o.user).toFixed(1)}" cy="${ch.Y(o.gpu).toFixed(1)}" r="6" class="${sys === 'h100' ? 'f-mem' : 'f-cmp'}" style="stroke:var(--ink);stroke-width:2"/>`;
        f.q('#g').innerHTML = g;
        st.set('u', o.fits ? o.user.toFixed(0) + ' tok/s' : 'does not fit', o.fits ? 'one user, at batch ' + B : fmt.n(o.need / 1e9, 0) + ' GB needed per GPU'); st.set('g', o.fits ? fmt.n(o.gpu, 0) + ' tok/s' : '-', o.fits ? 'whole GPU' : ''); st.set('t', o.fits ? (o.t * 1e3).toFixed(1) + ' ms' : '-', o.fits ? '61 layers + 1 ms' : '');
        c.mission.set(o.fits && o.user >= 60 && o.gpu >= 3000);
      }
      const sS = c.seg({ label: 'System', options: [['h100', '8-GPU H100 nodes'], ['nvl72', '72-GPU NVLink rack']], value: 'h100', onChange: v => { sys = v; draw(); } });
      const sB = c.slider({ label: 'Users per GPU', values: BS, value: 16, fmt: v => v, onInput: v => { B = v; draw(); } });
      c.note('Toy: DeepSeek-V3-like model in FP8, 4,096 tokens of context per user, attention replicated on every GPU, experts spread evenly and all touched, no overlap of communication and compute. Nodes: 3.35 TB/s, 1,979 TFLOPS, 50 GB/s between nodes. Rack: 8 TB/s, 4,500 TFLOPS, 900 GB/s NVLink. Real systems tune and overlap more.');
      draw();
      c.demo(1500, async () => { sys = 'nvl72'; sS.set('nvl72'); B = 64; sB.set(64, true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'blast', tag: 'When something breaks',
    title: 'A bigger domain means a bigger blast radius',
    alt: 'Three bars on a log scale show the share of time a model-serving domain of 8, 32 or 72 GPUs is down, given the failure rate per GPU, the repair time and the number of spare GPUs. The bar for the chosen domain size is orange. Controls set the domain size, the failure rate, the repair time and the spares. Counters show downtime per year, failures per month and GPU-hours idled by one failure.',
    text: 'Expert parallelism needs **every GPU in the domain** to answer. One failed GPU stops the whole group until it is fixed or replaced, so a 72-GPU domain idles **9 times more capacity per failure** than an 8-GPU node. If failures arrive at random with an average of **λ** GPUs down at any time, the domain is down when more than its **spares** have failed: the Poisson tail. One [[hot spare]] cuts the downtime by a large factor.',
    hint: 'Pick 72 GPUs, then add a spare.',
    mission: 'Keep a 72-GPU domain down less than 0.5% of the time.',
    takeaway: 'Scale-up domains tie more GPUs to each failure. Fast repair and spare GPUs pay for the extra size.',
    mount(c) {
      const NS = [8, 32, 72], pois = (lam, s) => { let sum = 0, term = Math.exp(-lam); for (let k = 0; k <= s; k++) { sum += term; term *= lam / (k + 1); } return Math.max(0, 1 - sum); };
      const f = c.fig(420, 156, '<g id="g"></g>');
      const st = c.stats([{ k: 'd', label: 'Downtime per year', value: '', cls: 'bad' }, { k: 'f', label: 'Failures per month', value: '', cls: 'cmp' }, { k: 'i', label: 'Idled by one failure', value: '', cls: 'mem' }]);
      let n = 72, p = 0.001, D = 24, sp = 0;
      const un = N => pois(N * p * D / 24, sp), fr = u => kit.clamp((Math.log10(Math.max(u * 100, 1e-4)) + 4) / 6, 0, 1), lab = u => { const v = u * 100; return v < 0.001 ? '<0.001%' : (v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(1)) + '%'; };
      function draw() {
        let g = '<text class="b sm" x="16" y="16">Share of time the domain is down (log scale)</text>';
        NS.forEach((N, i) => { const u = un(N); g += kit.bar(16, 44 + i * 36, 388, 14, fr(u), N === n ? 'f-cmp' : 'f-mem', N + ' GPUs, one domain', lab(u)); });
        g += '<text class="xs mute" x="16" y="152">Scale: 0.0001% at the left edge, 100% at the right.</text>';
        f.q('#g').innerHTML = g;
        const u = un(n);
        st.set('d', u * 8760 < 1 ? (u * 8760 * 60).toFixed(0) + ' min' : (u * 8760).toFixed(u * 8760 < 10 ? 1 : 0) + ' h', lab(u) + ' of the year'); st.set('f', (n * p * 30).toFixed(2), n + ' GPUs × ' + (p * 100).toFixed(2) + '% a day'); st.set('i', fmt.n(n * D, 0) + ' GPU-hours', n + ' GPUs × ' + D + ' h');
        c.mission.set(n === 72 && u < 0.005);
      }
      const sN = c.seg({ label: 'Domain size', options: [['8', '8 GPUs'], ['32', '32 GPUs'], ['72', '72 GPUs']], value: '72', onChange: v => { n = +v; draw(); } });
      c.seg({ label: 'Failure rate per GPU', options: [['0.0003', '0.03% a day'], ['0.001', '0.1% a day'], ['0.003', '0.3% a day']], value: '0.001', onChange: v => { p = +v; draw(); } });
      c.seg({ label: 'Time to repair', options: [['1', '1 hour'], ['4', '4 hours'], ['24', '24 hours']], value: '24', onChange: v => { D = +v; draw(); } });
      const sS = c.seg({ label: 'Spare GPUs in the domain', options: [['0', 'None'], ['1', 'One'], ['2', 'Two']], value: '0', onChange: v => { sp = +v; draw(); } });
      c.note('Toy: failures at random, each repaired in the stated time, the domain needs all but its spares. Meta reported 419 unexpected interruptions in 54 days on 16,384 GPUs during Llama 3 training, about 0.05% per GPU per day from every cause. Rates in your fleet will differ.');
      draw();
      c.demo(1500, async () => { sp = 1; sS.set('1'); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'How many GPUs share one NVLink domain in a GB200 NVL72 rack?', o: ['8', '36', '72', '144'], a: 2, why: '72 Blackwell GPUs, joined by 9 NVLink switch trays, so any GPU reaches any other at full speed.' },
      { q: 'About how much NVLink bandwidth does each GPU in the rack have?', o: ['50 GB/s', '1.8 TB/s', '450 GB/s', '130 TB/s'], a: 1, why: '1.8 TB/s per GPU, 900 GB/s each way. The 130 TB/s figure is the whole rack added together.' },
      { q: 'Which part of the time to first token grows fastest with prompt length?', o: ['The network round trip', 'The gateway', 'The router', 'Prefill'], a: 3, why: 'Prefill work grows with the number of prompt tokens, and attention adds a term that grows with its square. The others barely change.' },
      { q: 'Why is moving the KV cache from prefill to decode cheap inside the rack?', o: ['The cache is compressed to nothing', 'At 900 GB/s, a cache of a few hundred megabytes moves in about a millisecond', 'It is never moved', 'It moves after decoding'], a: 1, why: 'A 8K-token prompt has about 576 MB of cache in a model like DeepSeek-V3. Over NVLink that is under a millisecond.' },
      { q: 'A DeepSeek-V3-style model has 61 layers, the first 3 dense. How many all-to-all exchanges does one decode step trigger?', o: ['116', '61', '58', '8'], a: 0, why: '58 MoE layers each need a dispatch and a combine, so 116 exchanges.' },
      { q: 'What does a larger batch per GPU do?', o: ['It speeds up every user', 'It slows every user and lowers throughput', 'It slows each user and raises tokens per second per GPU', 'It changes nothing'], a: 2, why: 'Each step takes longer, so each user gets tokens more slowly. The GPU spreads its fixed costs over more users and produces more tokens in total.' },
      { q: 'Why does a larger NVLink domain raise the blast radius of one GPU failure?', o: ['More GPUs depend on each other, so a failure idles more capacity', 'NVLink fails more often than other links', 'Failures spread over the network', 'Spare GPUs cannot be used'], a: 0, why: 'Expert parallelism needs every GPU in the domain. One failure stops 72 GPUs instead of 8, until repair or replacement.' },
      { q: 'In the toy model, what lowers the downtime of a 72-GPU domain most cheaply?', o: ['More tokens per GPU', 'A faster link', 'Longer prompts', 'A hot spare GPU in the domain'], a: 3, why: 'With one spare, a single failure no longer stops the domain. It is down only when two GPUs are broken at once.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + Array.from({ length: 72 }, (_, k) => { const hot = [3, 11, 20, 28, 37, 49, 58, 66].includes(k), home = k === 23; return `<circle cx="${52 + (k % 12) * 19}" cy="${44 + Math.floor(k / 12) * 19}" r="6.5" style="fill:${home ? 'var(--ctl)' : hot ? 'var(--cmp)' : 'var(--well)'}"/>`; }).join('')
    + '</g><text x="40" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">72 GPUs, one NVLink domain</text></svg>';

  window.LESSONS.push({
    id: 'rackrun', n: 15, track: 'inference', order: 9,
    title: 'One Request Through a 72-GPU Rack',
    tagline: 'From the gateway to the first token: where the time goes, and why the rack’s interconnect matters.',
    preview,
    scenes: S
  });
})();
