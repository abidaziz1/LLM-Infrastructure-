/* Lesson 14: Faster Decoding and Long Context. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const expTok = (a, g) => (1 - Math.pow(a, g + 1)) / (1 - a);

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'spec', tag: 'Speculative decoding',
    title: 'Guess several tokens, check them all at once',
    alt: 'Six rows, each one round of speculative decoding. A row shows drafted tokens as boxes that are green when the target model accepts them and red where one is rejected, then a blue box for the target model’s own token. Controls set the acceptance rate and the number of drafted tokens. Counters show the expected tokens per target pass and the share of drafts accepted.',
    text: '[[speculative decoding|Speculative decoding]] uses the fact that decoding is memory-bound: a pass that checks **several tokens** costs almost the same as a pass that makes one. A cheap draft proposes **γ tokens**. The target model scores all of them in one pass, keeps the longest prefix it agrees with, and adds **one token of its own**. With acceptance rate **α**, a pass yields **(1 − α^(γ+1)) ÷ (1 − α)** tokens on average. The output matches what the target alone would produce.',
    hint: 'Raise the acceptance rate, then the draft length.',
    mission: 'Reach 2.5 tokens per target pass with 4 or fewer drafted tokens.',
    takeaway: 'Each pass always yields at least one token. Good guesses turn that into three or four.',
    mount(c) {
      const ROUNDS = 6, r = kit.rng(12), U = Array.from({ length: ROUNDS }, () => Array.from({ length: 8 }, () => r()));
      const f = c.fig(420, 188, '<g id="g"></g>');
      c.legend([['ok', 'Draft token accepted'], ['bad', 'Draft token rejected'], ['mem', 'Target’s own token']]);
      const st = c.stats([{ k: 'e', label: 'Tokens per target pass', value: '', cls: 'ok' }, { k: 'a', label: 'Drafts accepted', value: '', cls: 'data' }, { k: 'o', label: 'Floor with no luck', value: '', cls: 'mem' }]);
      let a = 0.5, G = 2;
      function draw(shown) {
        let g = '<text class="b sm" x="16" y="16">Six rounds, drawn with fixed random numbers</text>';
        for (let i = 0; i < ROUNDS; i++) {
          const y = 28 + i * 25; let n = 0, stop = false, x = 16, row = '';
          for (let j = 0; j < G; j++) {
            const ok = !stop && U[i][j] < a;
            row += `<rect class="${stop ? 'well' : ok ? 'f-ok' : 'f-bad'}" x="${x}" y="${y}" width="26" height="19" rx="4"/>`;
            if (ok) n++; else stop = true; x += 30;
          }
          row += `<rect class="f-mem" x="${x}" y="${y}" width="26" height="19" rx="4"/><text class="xs b" x="${x + 13}" y="${y + 14}" text-anchor="middle" style="fill:var(--on-mem)">T</text><text class="xs m b" x="404" y="${y + 14}" text-anchor="end">${n + 1} token${n ? 's' : ''}</text>`;
          g += `<g style="opacity:${i < shown ? 1 : 0}">${row}</g>`;
        }
        f.q('#g').innerHTML = g;
        const e = expTok(a, G);
        st.set('e', e.toFixed(2), 'γ = ' + G + ', α = ' + a); st.set('a', pct(a), 'chance per drafted token'); st.set('o', '1 token', 'every pass yields one');
        c.mission.set(e >= 2.5 && G <= 4);
      }
      const sA = c.slider({ label: 'Acceptance rate α', values: [0.5, 0.6, 0.7, 0.8, 0.9], value: 0.5, fmt: v => v.toFixed(1), onInput: v => { a = v; draw(ROUNDS); } });
      const sG = c.slider({ label: 'Drafted tokens γ', values: [1, 2, 3, 4, 6, 8], value: 2, fmt: v => v, onInput: v => { G = v; draw(ROUNDS); } });
      c.note('A rejected draft token and every one after it are discarded. The target’s own token takes the rejected spot, or follows the last accepted token.');
      draw(ROUNDS);
      c.play(async () => { for (let i = 0; i <= ROUNDS; i++) { draw(i); await c.wait(260); } draw(ROUNDS); });
      c.demo(1500, async () => { a = 0.8; G = 3; sA.set(0.8, true); sG.set(3, true); draw(ROUNDS); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'speedup', tag: 'Speculative decoding',
    title: 'Longer drafts help until drafting costs more than it saves',
    alt: 'A line chart of speedup against the number of drafted tokens from 1 to 8. The curve rises, flattens and then falls. A marker shows the chosen draft length and a label shows the best one. Controls set the acceptance rate, the draft cost as a share of one target pass, and the draft length. Counters show the speedup, the tokens per pass and the best draft length.',
    text: 'Each drafted token costs **c**, a fraction of one target pass, so a round costs **1 + γc** passes and yields **(1 − α^(γ+1)) ÷ (1 − α)** tokens. The speedup is their ratio. Later draft tokens are less likely to survive, so each extra one adds less while its cost stays the same. DeepSeek-V3 drafts **one** extra token with **85 to 90%** acceptance and reports about **1.8 times** more tokens per second.',
    hint: 'Find the draft length where the curve peaks.',
    mission: 'Choose a draft length within 2% of the best speedup.',
    takeaway: 'Speedup peaks at a moderate draft length. A cheaper or better draft moves the peak right.',
    mount(c) {
      const ch = kit.chart({ x: 44, y: 26, w: 352, h: 112, xmin: 1, xmax: 8, ymin: 0, ymax: 4, xt: [1, 2, 3, 4, 5, 6, 7, 8], yt: [0, 1, 2, 3, 4], xlabel: 'Drafted tokens γ', ylabel: 'Speedup' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Speedup', value: '', cls: 'ok' }, { k: 't', label: 'Tokens per pass', value: '', cls: 'data' }, { k: 'b', label: 'Best draft length', value: '', cls: 'cmp' }]);
      let a = 0.8, cc = 0.1, G = 1;
      const sp = (g) => expTok(a, g) / (1 + g * cc);
      function draw() {
        const pts = [1, 2, 3, 4, 5, 6, 7, 8].map(g => [ch.X(g), ch.Y(sp(g))]);
        let best = 1; for (let g = 2; g <= 8; g++) if (sp(g) > sp(best)) best = g;
        f.q('#g').innerHTML = `<line class="ln dash" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(1).toFixed(1)}" y2="${ch.Y(1).toFixed(1)}"/><path class="s-ok s3" fill="none" d="${kit.path(pts)}"/>` + pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i + 1 === G ? 6 : 3}" class="${i + 1 === G ? 'f-cmp' : 'f-ok'}" style="stroke:var(--stage);stroke-width:1.5"/>`).join('') + `<text class="xs mute" x="${ch.x1}" y="${(ch.Y(1) - 4).toFixed(1)}" text-anchor="end">1 = no gain</text>`;
        st.set('s', sp(G).toFixed(2) + '×', 'γ = ' + G + ', c = ' + Math.round(cc * 100) + '%'); st.set('t', expTok(a, G).toFixed(2), '(1 − α^' + (G + 1) + ') ÷ (1 − α)'); st.set('b', 'γ = ' + best, sp(best).toFixed(2) + '× at best');
        c.mission.set(sp(G) >= 0.98 * sp(best));
      }
      c.slider({ label: 'Acceptance rate α', values: [0.5, 0.6, 0.7, 0.8, 0.9], value: 0.8, fmt: v => v.toFixed(1), onInput: v => { a = v; draw(); } });
      c.seg({ label: 'Draft cost, share of a target pass', options: [['0.02', '2%'], ['0.1', '10%'], ['0.3', '30%'], ['0.6', '60%']], value: '0.1', onChange: v => { cc = +v; draw(); } });
      const sG = c.slider({ label: 'Drafted tokens γ', values: [1, 2, 3, 4, 5, 6, 7, 8], value: 1, fmt: v => v, onInput: v => { G = v; draw(); } });
      c.note('Formula from the speculative decoding paper by Leviathan and colleagues. It treats the check of γ + 1 tokens as costing one target pass, which holds while decoding is memory-bound.');
      draw();
      c.demo(1500, async () => { G = 6; sG.set(6, true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'batchspec', tag: 'Speculative decoding',
    title: 'Speculation stops paying when the server is busy',
    alt: 'A chart of speedup against the number of concurrent requests on a log axis from 1 to 1,024. The curve is flat near 2.4 times at low load, then falls through 1, meaning no gain, around 200 requests and ends below 1. A marker shows the chosen load. Controls set the load, the acceptance rate and the draft length. Counters show the speedup, the tokens the target must check per pass and whether that pass is memory-bound or compute-bound.',
    text: 'Checking γ + 1 tokens per request is free only while the GPU has **spare compute**. With many requests in the batch, a plain decode step is already near compute-bound. Speculation then multiplies the tokens to check by **γ + 1**, and every rejected token is **wasted work**. Past a certain load the speedup drops below 1: speculation makes the server slower.',
    hint: 'Raise the load until the curve crosses 1.',
    mission: 'Find a load where speculation is slower than plain decoding.',
    takeaway: 'Speculation spends spare compute to save time. A busy server has none to spare.',
    mount(c) {
      const TM = 7, TT = 0.0177, CC = 0.1;
      const ch = kit.chart({ x: 44, y: 26, w: 340, h: 112, xmin: 1, xmax: 1024, ymin: 0, ymax: 3, xlog: true, xt: [1, 4, 16, 64, 256, 1024], yt: [0, 1, 2, 3], xlabel: 'Concurrent requests', ylabel: 'Speedup' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Speedup', value: '', cls: 'ok' }, { k: 't', label: 'Tokens checked per pass', value: '', cls: 'cmp' }, { k: 'b', label: 'The pass is', value: '', cls: 'ctl' }]);
      let B = 16, a = 0.8, G = 4;
      const sp = (b) => expTok(a, G) * Math.max(TM, b * TT) / (Math.max(TM, b * (G + 1) * TT) + G * CC * TM);
      function draw() {
        const pts = Array.from({ length: 61 }, (_, i) => { const b = Math.pow(1024, i / 60); return [ch.X(b), ch.Y(Math.min(3, sp(b)))]; }), x = ch.X(B), s = sp(B);
        f.q('#g').innerHTML = `<line class="ln dash" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(1).toFixed(1)}" y2="${ch.Y(1).toFixed(1)}"/><text class="xs mute" x="${ch.x1}" y="${(ch.Y(1) - 4).toFixed(1)}" text-anchor="end">1 = no gain</text><path class="s-ok s3" fill="none" d="${kit.path(pts)}"/><line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(Math.min(3, s)).toFixed(1)}" r="5" class="${s < 1 ? 'f-bad' : 'f-ok'}" style="stroke:var(--stage);stroke-width:2"/>`;
        const comp = B * (G + 1) * TT > TM;
        st.set('s', s.toFixed(2) + '×', s < 1 ? 'slower than plain decoding' : 'faster than plain decoding'); st.set('t', fmt.n(B * (G + 1), 0), B + ' requests × ' + (G + 1)); st.set('b', comp ? 'compute-bound' : 'memory-bound', comp ? 'extra tokens now cost time' : 'extra tokens are nearly free');
        c.mission.set(s < 1);
      }
      const sl = c.slider({ label: 'Concurrent requests', values: [1, 4, 16, 64, 128, 256, 512, 1024], value: 16, fmt: v => v, onInput: v => { B = v; draw(); } });
      c.seg({ label: 'Acceptance rate α', options: [['0.6', '0.6'], ['0.8', '0.8']], value: '0.8', onChange: v => { a = +v; draw(); } });
      c.seg({ label: 'Drafted tokens γ', options: [['2', '2'], ['4', '4'], ['8', '8']], value: '4', onChange: v => { G = +v; draw(); } });
      c.note('Toy: 70B in FP8 on 8 GPUs. A pass costs 7 ms until it checks about 400 tokens, then 17.7 µs per token. Drafting costs 10% of a pass per token.');
      draw();
      c.demo(1500, async () => { B = 512; sl.set(512, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'kvgrow', tag: 'Long context',
    title: 'How the KV cache grows with context, and what shrinks it',
    alt: 'Three horizontal bars on a log scale show the KV cache of one user at the chosen context length for the same 70B-class model built with multi-head attention, grouped-query attention or multi-head latent attention. A vertical line marks the free memory of an 8-GPU node. Controls set the attention design, the cache precision and the context length. Counters show the bytes per token, the size per user and how many users fit.',
    text: 'The KV cache grows **linearly with context**. For a 70B-class model it is **2.6 MB per token** with 64 KV heads (multi-head), **328 KB** with 8 ([[gqa|grouped-query]]) and **92 KB** with [[mla|multi-head latent attention]]. At **1M tokens** that is **2.7 TB**, **344 GB** and **97 GB** for one user in BF16. Storing the cache in FP8 or in 4 bits shrinks it again.',
    hint: 'Set 1M tokens, then combine a design with a smaller precision.',
    mission: 'Fit at least 4 users at 1M tokens on one 8-GPU node.',
    takeaway: 'Fewer KV heads, a latent cache and fewer bits multiply together. At 1M tokens each one matters.',
    mount(c) {
      const VAL = { mha: 2 * 80 * 64 * 128, gqa: 2 * 80 * 8 * 128, mla: (512 + 64) * 80 }, NAME = { mha: 'Multi-head, 64 KV heads', gqa: 'Grouped-query, 8 KV heads', mla: 'Latent attention (MLA)' }, POOL = 8 * 72e9 - 70e9;
      const f = c.fig(420, 176, '<g id="g"></g>');
      const st = c.stats([{ k: 't', label: 'KV per token', value: '', cls: 'mem' }, { k: 'u', label: 'KV per user', value: '', cls: 'data' }, { k: 'n', label: 'Users that fit', value: '', cls: 'ok' }]);
      let at = 'gqa', bytes = 2, ctx = 131072;
      const cl = v => v >= 1048576 ? '1M' : fmt.n(v / 1024, 0) + 'K';
      const fr = v => (Math.log10(Math.max(v, 1e9)) - 9) / (Math.log10(5e12) - 9);
      function draw() {
        let g = `<text class="b sm" x="16" y="16">KV cache of one user at ${cl(ctx)} tokens</text>`;
        ['mha', 'gqa', 'mla'].forEach((k, i) => { const v = VAL[k] * bytes * ctx; g += kit.bar(16, 48 + i * 36, 388, 14, fr(v), k === at ? 'f-cmp' : 'f-mem', NAME[k], fmt.bytes(v, v < 1e10 || v >= 1e12 ? 1 : 0)); });
        const x = 16 + 388 * fr(POOL);
        g += `<line class="ln" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="24" y2="150" style="stroke:var(--ok);stroke-width:2.2"/><text class="xs b" x="${(x - 5).toFixed(1)}" y="${166}" text-anchor="end" style="fill:var(--ok)">free on 8 GPUs: ${fmt.n(POOL / 1e9, 0)} GB</text>`;
        f.q('#g').innerHTML = g;
        const pt = VAL[at] * bytes, pu = pt * ctx, n = Math.floor(POOL / pu);
        st.set('t', fmt.bytes(pt, 0), NAME[at]); st.set('u', fmt.bytes(pu, pu < 1e10 || pu >= 1e12 ? 1 : 0), 'at ' + cl(ctx) + ' tokens'); st.set('n', String(n), 'in ' + fmt.n(POOL / 1e9, 0) + ' GB');
        c.mission.set(ctx === 1048576 && n >= 4);
      }
      const sA = c.seg({ label: 'Attention design', options: [['mha', 'Multi-head'], ['gqa', 'Grouped-query'], ['mla', 'Latent (MLA)']], value: 'gqa', onChange: v => { at = v; draw(); } });
      const sB = c.seg({ label: 'Cache precision', options: [['2', 'BF16'], ['1', 'FP8'], ['0.5625', '4-bit']], value: '2', onChange: v => { bytes = +v; draw(); } });
      const sC = c.slider({ label: 'Context per user', values: [8192, 32768, 131072, 524288, 1048576], value: 131072, fmt: v => v >= 1048576 ? '1M tokens' : fmt.n(v / 1024, 0) + 'K tokens', onInput: v => { ctx = v; draw(); } });
      c.note('Toy: the same 70B-class model with 80 layers and head size 128, built three ways. The free pool is 8 × 72 GB minus 70 GB of FP8 weights. MLA stores a 512-value latent plus a 64-value position key per layer.');
      draw();
      c.demo(1500, async () => { at = 'mla'; sA.set('mla'); ctx = 1048576; sC.set(1048576, true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'attncost', tag: 'Long context',
    title: 'Past 100K tokens, attention costs more than the weights',
    alt: 'A log-log chart of time to first token against prompt length from 1K to 1M tokens, for dense attention and for sparse top-k attention. The dense curve bends upward past about 100K tokens, while the sparse curve stays close to a straight line. A marker shows the chosen length on the active curve. A switch selects sparse attention. Counters show the time to first token, the share of work spent in attention and the weight FLOPs against the attention FLOPs.',
    text: 'Prefill spends **2 × parameters** FLOPs per token on the weights, which grows in a straight line. Dense attention spends **2 × L² × hidden × layers**, which grows with the **square** of the prompt length. For a 70B model the two are equal near **100K tokens**, and at 1M tokens attention is about 90% of the work. [[sparse attention|Sparse attention]], as in DeepSeek-V3.2, lets each token read only its **top 2,048** earlier tokens, so cost grows in a straight line again.',
    hint: 'Slide the length up, then switch sparse attention on.',
    mission: 'Prefill a 1M-token prompt in under 60 seconds.',
    takeaway: 'Quadratic attention takes over past about 100K tokens. Choosing which tokens to read puts the cost back on a line.',
    mount(c) {
      const P = 70e9, D = 8192, NL = 80, K = 2048, RATE = 8 * 1979e12 * 0.5;
      const lin = L => 2 * P * L, dense = L => 2 * L * L * D * NL, sparse = L => 4 * L * Math.min(K, L) * D * NL + 0.05 * dense(L);
      const ch = kit.chart({ x: 52, y: 26, w: 334, h: 112, xmin: 1024, xmax: 1048576, ymin: 0.01, ymax: 1000, xlog: true, ylog: true, xt: [1024, 8192, 65536, 524288], xf: v => fmt.n(v / 1024, 0) + 'K', yt: [0.01, 0.1, 1, 10, 100, 1000], yf: v => v < 1 ? v : fmt.n(v, 0), xlabel: 'Prompt length, tokens', ylabel: 'Seconds to first token' });
      const curve = fn => Array.from({ length: 61 }, (_, i) => { const L = 1024 * Math.pow(1024, i / 60); return [ch.X(L), ch.Y((lin(L) + fn(L)) / RATE)]; });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      c.legend([['bad', 'Dense attention'], ['ok', 'Sparse top-2,048']]);
      const st = c.stats([{ k: 't', label: 'Time to first token', value: '', cls: 'cmp' }, { k: 's', label: 'Share in attention', value: '', cls: 'bad' }, { k: 'f', label: 'Weights vs attention', value: '', cls: 'mem' }]);
      let L = 8192, sp = false;
      function draw() {
        const at = sp ? sparse(L) : dense(L), t = (lin(L) + at) / RATE, x = ch.X(L);
        f.q('#g').innerHTML = `<path class="s-bad s3" fill="none" d="${kit.path(curve(dense))}" style="opacity:${sp ? 0.35 : 1}"/><path class="s-ok s3" fill="none" d="${kit.path(curve(sparse))}" style="opacity:${sp ? 1 : 0.35}"/><line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(t).toFixed(1)}" r="5" class="${sp ? 'f-ok' : 'f-bad'}" style="stroke:var(--stage);stroke-width:2"/>`;
        st.set('t', t < 1 ? (t * 1e3).toFixed(0) + ' ms' : t < 120 ? t.toFixed(1) + ' s' : (t / 60).toFixed(1) + ' min', fmt.n(L, 0) + ' tokens, 8 GPUs'); st.set('s', pct(at / (lin(L) + at)), sp ? 'sparse, indexer included' : 'dense'); st.set('f', kit.sci(lin(L), 1) + ' vs ' + kit.sci(at, 1), 'FLOPs');
        c.mission.set(sp && L >= 1000000 && t <= 60);
      }
      const sl = c.slider({ label: 'Prompt length', min: 1024, max: 1048576, log: true, round: true, value: 8192, fmt: v => v >= 1000000 ? '1M tokens' : fmt.n(v, 0) + ' tokens', onInput: v => { L = v; draw(); } });
      const tg = c.toggle({ label: 'Sparse attention: top 2,048 tokens per query', value: false, onChange: v => { sp = v; draw(); } });
      c.note('Toy: 70B model, 80 layers, hidden size 8192, causal attention, 8 GPUs at half of FP8 peak. The sparse case adds an indexer charged at 5% of dense attention. That share is an assumption.');
      draw();
      c.demo(1500, async () => { L = 1048576; sl.set(1048576, true); sp = true; tg.set(true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'window', tag: 'Long context',
    title: 'Local layers keep a short window and a small cache',
    alt: 'Twelve horizontal bars, one per layer, drawn to the same scale. A global layer stores the whole context and its bar is long. A local layer stores only the last window of tokens and its bar is short. Controls set the mix of local and global layers, the window size and the context length. Counters show the KV cache as a share of an all-global model and how many times smaller that is.',
    text: 'A **global** layer attends to every earlier token, so its cache holds the whole context. A [[sliding window attention|local]] layer attends only to the last **W** tokens, so its cache stops growing at W. Gemma 3 uses **5 local layers for each global one** with a 1,024-token window. gpt-oss alternates full layers with 128-token banded ones. Distant facts still reach later tokens through the global layers, so models are trained with the pattern from the start.',
    hint: 'Mix local layers in, then shrink the window.',
    mission: 'At 128K tokens, get the KV cache under 20% of an all-global model.',
    takeaway: 'A few global layers carry long-range information. The rest can keep a short window.',
    mount(c) {
      const NLAY = 12;
      const f = c.fig(420, 230, '<g id="g"></g>');
      const st = c.stats([{ k: 'r', label: 'KV cache vs all-global', value: '', cls: 'mem' }, { k: 'x', label: 'Smaller by', value: '', cls: 'ok' }, { k: 'g', label: 'Global layers', value: '', cls: 'ctl' }]);
      let N = 1, W = 1024, ctx = 32768;
      function draw() {
        let G = 0, g = `<text class="b sm" x="16" y="16">Cache per layer, ${fmt.n(ctx / 1024, 0)}K tokens, drawn to scale</text>`, tot = 0;
        for (let i = 0; i < NLAY; i++) {
          const glob = N === 1 || (N === 2 ? i % 2 === 0 : i % 6 === 5), w = glob ? 388 : Math.max(3, 388 * Math.min(W, ctx) / ctx), y = 26 + i * 14;
          if (glob) G++; tot += glob ? ctx : Math.min(W, ctx);
          g += `<rect class="well" x="16" y="${y}" width="388" height="10" rx="3"/><rect class="${glob ? 'f-mem' : 'f-cmp'}" x="16" y="${y}" width="${w.toFixed(1)}" height="10" rx="3"/>`;
        }
        g += `<text class="xs mute" x="16" y="212">Blue: global layer, whole context. Orange: local layer, last ${fmt.n(W, 0)} tokens.</text>`;
        f.q('#g').innerHTML = g;
        const rel = tot / (NLAY * ctx);
        st.set('r', pct(rel), fmt.n(tot / ctx, 1) + ' of 12 layers at full size'); st.set('x', (1 / rel).toFixed(1) + '×', 'than all-global'); st.set('g', G + ' of ' + NLAY, N === 1 ? 'all global' : N === 2 ? '1 global : 1 local' : '1 global : 5 local');
        c.mission.set(ctx === 131072 && rel <= 0.2);
      }
      c.seg({ label: 'Layer mix', options: [['1', 'All global'], ['2', '1 global : 1 local'], ['6', '1 global : 5 local']], value: '1', onChange: v => { N = +v; draw(); } });
      const sW = c.seg({ label: 'Local window', options: [['128', '128'], ['1024', '1,024'], ['4096', '4,096']], value: '1024', onChange: v => { W = +v; draw(); } });
      const sC = c.slider({ label: 'Context', values: [8192, 32768, 131072], value: 32768, fmt: v => fmt.n(v / 1024, 0) + 'K tokens', onInput: v => { ctx = v; draw(); } });
      draw();
      c.demo(1500, async () => { N = 6; ctx = 131072; sC.set(131072, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'In speculative decoding, what does the target model do with the draft’s tokens?', o: ['It ignores them', 'It scores all of them in a single forward pass', 'It trains on them', 'It regenerates them one by one'], a: 1, why: 'Checking several tokens costs about one pass while decoding is memory-bound. The target keeps the longest prefix it agrees with.' },
      { q: 'With acceptance rate 0.8 and 4 drafted tokens, about how many tokens does one target pass yield?', o: ['About 0.8', 'About 1.4', 'About 5', 'About 3.4'], a: 3, why: '(1 − 0.8^5) ÷ (1 − 0.8) is about 3.36. The count includes the target’s own token.' },
      { q: 'Why can drafting more and more tokens make speculative decoding slower?', o: ['Each extra draft token costs time but is less likely to be accepted', 'The target forgets the context', 'The KV cache disappears', 'Tokens must be re-tokenized'], a: 0, why: 'Acceptance of later tokens falls off geometrically while their cost stays constant, so the speedup peaks and then declines.' },
      { q: 'When does speculative decoding stop paying off?', o: ['At batch size 1', 'When prompts are short', 'When the server is compute-bound, because rejected tokens waste compute', 'When the model is quantized'], a: 2, why: 'With spare compute the extra tokens are nearly free. Without it, each rejected token costs real time.' },
      { q: 'A 70B-class model with 64 KV heads instead of 8 stores a KV cache how many times larger?', o: ['2 times', '8 times', '4 times', '64 times'], a: 1, why: 'The cache scales with the number of KV heads: 64 ÷ 8 is 8.' },
      { q: 'For a 70B model with 80 layers and hidden size 8192, at about what prompt length does attention FLOPs match the weight FLOPs in prefill?', o: ['About 1K tokens', 'About 10K tokens', 'About 100K tokens', 'About 10M tokens'], a: 2, why: 'Weights cost 2 × P × L and causal attention 2 × L² × d × layers. Setting them equal gives L = P ÷ (d × layers), about 107K.' },
      { q: 'What does sparse top-k attention change?', o: ['Each token attends to a chosen subset of earlier tokens, so cost grows with length × k', 'It removes the KV cache', 'It shortens the vocabulary', 'It quantizes the weights'], a: 0, why: 'A small indexer picks the k most relevant earlier tokens for each query. Attention then costs about L × k instead of L².' },
      { q: 'What does a local-attention layer do?', o: ['It skips attention entirely', 'It uses a different tokenizer', 'It attends to a window of recent tokens only, so its cache stops growing', 'It runs on the CPU'], a: 2, why: 'A local layer keeps keys and values for the last W tokens. Global layers in the stack carry the long-range links.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [['ok', 'ok', 'ok'], ['ok', 'ok', 'bad'], ['ok', 'bad']].map((row, r) => row.map((k, i) => `<rect x="${40 + i * 30}" y="${34 + r * 28}" width="26" height="20" rx="4" style="fill:var(--${k})"/>`).join('') + `<rect x="${40 + row.length * 30}" y="${34 + r * 28}" width="26" height="20" rx="4" style="fill:var(--mem)"/>`).join('')
    + '</g><text x="40" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">guess, check, keep the prefix</text></svg>';

  window.LESSONS.push({
    id: 'longctx', n: 14, track: 'inference', order: 8,
    title: 'Faster Decoding and Long Context',
    tagline: 'Speculative decoding, and why a million-token prompt strains memory and compute.',
    preview,
    scenes: S
  });
})();
