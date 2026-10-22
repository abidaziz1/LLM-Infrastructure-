/* Lesson 18: Loop transformers. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const clamp = kit.clamp;

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'reuse', tag: 'The idea',
    title: 'Same layers, more passes',
    alt: 'A row of blocks stands for the stored layers of a transformer. When the loop count is above one, an arrow runs from the last block back to the first. Two sliders set the number of stored layers and the number of loops. Counters show the weights stored, the layer passes per token and the depth compared with a standard 24-layer model. A button runs one token through every pass.',
    text: 'A standard [[transformer]] sends each token through **24 different layers**, one time each. A **loop transformer** stores fewer layers and **runs them again**, feeding every pass the output of the last. Stored layers set the **weights** you keep in memory. Layer passes set the **compute** and the depth of reasoning. Here one layer holds 200M parameters, as in an 8B-class model.',
    hint: 'Lower the stored layers, then raise the loops.',
    mission: 'Keep 24 layer passes while storing at most 6 layers.',
    takeaway: 'Looping buys depth with compute instead of parameters: the same passes from fewer weights.',
    mount(c) {
      const f = c.fig(420, 170, '<g id="g"></g>');
      c.legend([['mem', 'Stored layer'], ['cmp', 'Layer running now'], ['ctl', 'Loop back']]);
      const st = c.stats([{ k: 'w', label: 'Weights stored', value: '', cls: 'mem' }, { k: 'p', label: 'Layer passes per token', value: '', cls: 'cmp' }, { k: 'd', label: 'Depth vs 24 layers', value: '', cls: 'data' }]);
      let n = 24, L = 1, at = -1, run = 0;
      function draw() {
        const passes = n * L, two = n > 12, per = two ? 12 : n, gap = 4;
        const bw = two ? 28 : Math.min(48, Math.floor((388 - (per - 1) * gap) / per)), bh = two ? 28 : 44;
        const w = per * bw + (per - 1) * gap, x0 = (420 - w) / 2, y0 = 52;
        let g = '<text class="b sm" x="16" y="18">' + passes + ' layer pass' + (passes > 1 ? 'es' : '') + ' through ' + n + ' stored layer' + (n > 1 ? 's' : '') + '</text>';
        g += '<text class="xs mute" x="16" y="34">The token flows left to right, then down.</text>';
        if (at >= 0) g += '<text class="xs m b" x="404" y="18" text-anchor="end">pass ' + (at + 1) + ', loop ' + (Math.floor(at / n) + 1) + '</text>';
        for (let i = 0; i < n; i++) {
          const r = Math.floor(i / per), x = x0 + (i % per) * (bw + gap), y = y0 + r * (bh + gap), on = at >= 0 && at % n === i;
          g += '<rect class="' + (on ? 'f-cmp' : 't-mem') + '" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="6"/>';
          if (bw >= 20) g += '<text class="xs m b" x="' + (x + bw / 2) + '" y="' + (y + bh / 2 + 4) + '" text-anchor="middle"' + (on ? ' style="fill:var(--on-cmp)"' : '') + '>' + (i + 1) + '</text>';
        }
        const rows = two ? 2 : 1, yb = y0 + rows * bh + (rows - 1) * gap + 4, xr = x0 + w - bw / 2;
        if (L > 1) {
          if (two) {
            const ym = y0 + bh / 2;
            g += '<path class="ln s-ctl" style="stroke-width:2" fill="none" d="M' + xr + ' ' + yb + ' V' + (yb + 14) + ' H8 V' + ym + ' H' + (x0 - 4) + '"/><polygon class="f-ctl" points="' + (x0 - 10) + ',' + (ym - 4) + ' ' + (x0 - 10) + ',' + (ym + 4) + ' ' + (x0 - 2) + ',' + ym + '"/>';
          } else {
            const xl = x0 + bw / 2;
            g += '<path class="ln s-ctl" style="stroke-width:2" fill="none" d="M' + xr + ' ' + yb + ' V' + (yb + 16) + ' H' + xl + ' V' + (yb + 4) + '"/><polygon class="f-ctl" points="' + (xl - 4) + ',' + (yb + 10) + ' ' + (xl + 4) + ',' + (yb + 10) + ' ' + xl + ',' + (yb + 2) + '"/>';
          }
          g += '<text class="xs m" x="210" y="' + (yb + 34) + '" text-anchor="middle">run the same ' + n + ' layer' + (n > 1 ? 's' : '') + ' again, ' + L + ' loops in all</text>';
        } else g += '<text class="xs mute" x="210" y="' + (yb + 24) + '" text-anchor="middle">one loop: every layer runs once</text>';
        f.q('#g').innerHTML = g;
        st.set('w', fmt.n(n * 0.2, 1) + 'B', n + ' layers × 200M');
        st.set('p', String(passes), n + ' × ' + L);
        st.set('d', +(passes / 24).toFixed(passes / 24 < 10 ? 2 : 0) + '×', 'weights: ' + Math.round(n / 24 * 100) + '%');
        c.mission.set(passes >= 24 && n <= 6);
      }
      const go = async () => {
        const id = ++run, passes = n * L, ms = clamp(2400 / passes, 30, 180);
        for (let i = 0; i < passes; i++) { if (id !== run) return; at = i; draw(); await c.wait(ms); }
        if (id === run) { at = -1; draw(); }
      };
      const sN = c.slider({ label: 'Stored layers', values: [1, 2, 3, 4, 6, 8, 12, 24], value: 24, fmt: v => v, onInput: v => { run++; at = -1; n = v; draw(); } });
      const sL = c.slider({ label: 'Loops', values: [1, 2, 3, 4, 6, 8, 12, 24], value: 1, fmt: v => v, onInput: v => { run++; at = -1; L = v; draw(); } });
      c.btn('Run one token', go, { small: true });
      c.note('Toy: every layer has 200M parameters. Real loop models also keep an input embedding and an output head that run once.');
      draw();
      c.demo(1600, async () => { n = 6; L = 4; sN.set(6, true); sL.set(4, true); draw(); await go(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'huginn', tag: 'A real model',
    title: 'Huginn: 8 stored layers, 132 passes',
    alt: 'A diagram of Huginn. A two-layer prelude feeds a four-layer core block, and the core feeds a two-layer coda. An arrow runs from the end of the core back to its start, labeled with the number of loops. A second arrow carries the prelude output into the core on every loop. A slider sets the number of loops. Two bars compare the weights stored with the compute of a dense model that does the same work. A mark on the compute bar shows 50 billion parameters.',
    text: 'In 2025, Geiping and colleagues trained **Huginn-0125**, a loop transformer with **3.5B parameters**. A 2-layer **prelude** turns the prompt into a state **e**. A 4-layer **core block** runs **r** times and gets **e** again on every loop. A 2-layer **coda** turns the last state into next-token scores. Training drew r at random with a mean of 32, so you choose r when you run it.',
    hint: 'Raise r and watch the compute bar pass the stored weights.',
    mission: 'Loop enough to match the compute of a 50B-parameter dense model.',
    takeaway: 'The loop count is a setting you choose at run time. Eight stored layers can do the work of 132 layer passes.',
    mount(c) {
      const f = c.fig(420, 226, '<g id="g"></g>');
      const st = c.stats([{ k: 'p', label: 'Layer passes per token', value: '', cls: 'cmp' }, { k: 'w', label: 'Weights stored', value: '', cls: 'mem' }, { k: 'c', label: 'Same-compute dense model', value: '', cls: 'data' }]);
      let r = 4;
      const LAYER = 0.395, MAX = 110;
      function blocks(x, nb, cls, name) { let g = ''; for (let i = 0; i < nb; i++) g += '<rect class="' + cls + '" x="' + (x + i * 38) + '" y="46" width="34" height="38" rx="6"/>'; return g + '<text class="xs b" x="' + (x + (nb * 38 - 4) / 2) + '" y="100" text-anchor="middle">' + name + '</text>'; }
      function draw() {
        const passes = 4 + 4 * r, dense = passes * LAYER;
        let g = '<text class="b sm" x="16" y="16">Core block loops ' + r + ' time' + (r > 1 ? 's' : '') + '</text>';
        g += blocks(16, 2, 't-mem', 'Prelude');
        g += blocks(132, 4, 't-cmp', 'Core block');
        g += blocks(326, 2, 't-mem', 'Coda');
        g += '<line class="ln" x1="92" x2="128" y1="65" y2="65"/><polygon class="ink-f" points="128,61 128,69 133,65"/><line class="ln" x1="282" x2="322" y1="65" y2="65"/><polygon class="ink-f" points="322,61 322,69 327,65"/>';
        g += '<path class="ln s-ctl" style="stroke-width:2" fill="none" d="M267 44 V30 H149 V42"/><polygon class="f-ctl" points="145,40 153,40 149,46"/><text class="xs m b" x="208" y="25" text-anchor="middle">× ' + r + '</text>';
        g += '<path class="ln s-data" style="stroke-width:2" fill="none" d="M110 69 V116 H149 V92"/><polygon class="f-data" points="145,92 153,92 149,86"/><text class="xs m" x="160" y="121">e: prompt state, added on every loop</text>';
        g += '<text class="xs b" x="16" y="160">Weights stored</text><rect class="well" x="16" y="165" width="388" height="12" rx="6"/><rect class="f-mem" x="16" y="165" width="' + Math.max(3, 388 * 3.5 / MAX).toFixed(1) + '" height="12" rx="6"/><text class="xs m b" x="404" y="160" text-anchor="end">3.5B</text>';
        g += '<text class="xs b" x="16" y="196">Compute per token, as a dense model</text><rect class="well" x="16" y="201" width="388" height="12" rx="6"/><rect class="' + (dense >= 50 ? 'f-ok' : 'f-cmp') + '" x="16" y="201" width="' + (388 * clamp(dense / MAX, 0, 1)).toFixed(1) + '" height="12" rx="6"/><text class="xs m b" x="404" y="196" text-anchor="end">' + fmt.n(dense, dense < 10 ? 1 : 0) + 'B</text>';
        const mx = 16 + 388 * 50 / MAX;
        g += '<line class="ln dash" x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="196" y2="219"/><text class="xs mute" x="' + (mx + 4).toFixed(1) + '" y="222">50B</text>';
        f.q('#g').innerHTML = g;
        st.set('p', String(passes), '2 + 4 × ' + r + ' + 2');
        st.set('w', '3.5B', '8 stored layers');
        st.set('c', fmt.n(dense, dense < 10 ? 1 : 0) + 'B', passes + ' × 0.4B');
        c.mission.set(dense >= 50);
      }
      const sR = c.slider({ label: 'Loops of the core block, r', values: [1, 2, 4, 8, 16, 32, 64], value: 4, fmt: v => v, onInput: v => { r = v; draw(); } });
      c.note('Toy arithmetic from the released config: hidden size 5,280, about 0.4B parameters per layer. At r = 32 that is 132 passes and about 52B, close to the 50B the authors quote. Embeddings add 0.35B to the stored weights.');
      draw();
      c.demo(1500, async () => { r = 32; sR.set(32, true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'hops', tag: 'Why loops help',
    title: 'Long chains of steps need many passes',
    alt: 'A chain of circles from a start node to an answer node, one circle per hop in a question that follows arrows. Completed hops are orange. If the layer passes run out before the last hop the answer node is red and the chain stops early. Sliders set the number of hops, the stored layers and the loops. Counters show the hops, the layer passes and the weights stored. A button animates the passes one hop at a time.',
    text: 'Some questions need **many steps in a row**. Start at A, follow its arrow, follow the next arrow, and repeat 12 times. Each step needs the one before it, so the model needs that many **sequential layer passes**. A 3-layer model gets 3. Loop its three layers four times and it gets 12 **without storing more weights**.',
    hint: 'Set the loops so the passes reach the hops.',
    mission: 'Answer a 12-hop question while storing at most 3 layers.',
    takeaway: 'Sequential steps need sequential depth. Loops supply depth without new weights.',
    mount(c) {
      const f = c.fig(420, 198, '<g id="g"></g>');
      const st = c.stats([{ k: 'k', label: 'Hops in the question', value: '', cls: 'ctl' }, { k: 'p', label: 'Layer passes', value: '', cls: 'cmp' }, { k: 'w', label: 'Weights stored', value: '', cls: 'mem' }]);
      let k = 12, n = 3, L = 1, at = -1, run = 0;
      function draw() {
        const passes = n * L, pos = at >= 0 ? Math.min(at + 1, passes, k) : Math.min(passes, k), done = pos >= k;
        const per = k + 1 > 13 ? 13 : k + 1, sp = Math.min(44, 388 / Math.max(1, per - 1)), sx = (420 - sp * (per - 1)) / 2;
        const P = i => { const r = Math.floor(i / per), j = i % per; return [sx + (r % 2 ? per - 1 - j : j) * sp, 74 + r * 48]; };
        let g = '<text class="b sm" x="16" y="18">' + k + ' hop' + (k > 1 ? 's' : '') + ' to follow, ' + passes + ' pass' + (passes > 1 ? 'es' : '') + ' available</text>';
        for (let i = 0; i < k; i++) {
          const a = P(i), b = P(i + 1), hit = i < pos;
          g += '<line class="ln ' + (hit ? 's-cmp' : 'dash') + '" style="stroke-width:' + (hit ? 3 : 1.5) + '" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>';
        }
        for (let i = 0; i <= k; i++) {
          const p = P(i), cls = i === k ? (done ? 'f-ok' : 't-bad') : (i <= pos ? 'f-cmp' : 'well');
          g += '<circle class="' + cls + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (i === 0 || i === k ? 10 : 7) + '"/>';
        }
        const s0 = P(0), e0 = P(k), pm = P(pos);
        g += '<text class="xs b" x="' + s0[0].toFixed(1) + '" y="' + (s0[1] - 16).toFixed(1) + '" text-anchor="middle">A</text>';
        g += '<text class="xs b" x="' + e0[0].toFixed(1) + '" y="' + (e0[1] - 16).toFixed(1) + '" text-anchor="middle">?</text>';
        if (!done || at >= 0) g += '<circle cx="' + pm[0].toFixed(1) + '" cy="' + pm[1].toFixed(1) + '" r="11" fill="none" style="stroke:var(--ink);stroke-width:2"/>';
        const yv = k + 1 > 13 ? 176 : 138;
        g += done ? '<text class="sm b" x="210" y="' + yv + '" text-anchor="middle" style="fill:var(--ok)">Reached hop ' + k + ': the answer is found.</text>' : '<text class="sm b" x="210" y="' + yv + '" text-anchor="middle" style="fill:var(--bad)">Out of passes at hop ' + pos + ' of ' + k + ': wrong answer.</text>';
        if (!done) g += '<text class="xs mute" x="210" y="' + (yv + 18) + '" text-anchor="middle">Needs ' + (k - passes) + ' more pass' + (k - passes > 1 ? 'es' : '') + '.</text>';
        f.q('#g').innerHTML = g;
        st.set('k', String(k), 'one arrow each');
        st.set('p', String(passes), n + ' × ' + L);
        st.set('w', fmt.n(n * 0.2, 1) + 'B', n + ' stored layers');
        c.mission.set(k === 12 && n <= 3 && passes >= k);
      }
      const go = async () => {
        const id = ++run, passes = n * L, ms = clamp(2200 / Math.max(1, Math.min(passes, k)), 40, 220);
        for (let i = 0; i < Math.min(passes, k); i++) { if (id !== run) return; at = i; draw(); await c.wait(ms); }
        if (id === run) { at = -1; draw(); }
      };
      c.slider({ label: 'Hops in the question', values: [2, 4, 6, 8, 12, 16, 24], value: 12, fmt: v => v, onInput: v => { run++; at = -1; k = v; draw(); } });
      c.slider({ label: 'Stored layers', values: [1, 2, 3, 4, 6, 12], value: 3, fmt: v => v, onInput: v => { run++; at = -1; n = v; draw(); } });
      const sL = c.slider({ label: 'Loops', values: [1, 2, 3, 4, 6, 8, 12, 24], value: 1, fmt: v => v, onInput: v => { run++; at = -1; L = v; draw(); } });
      c.btn('Follow the arrows', go, { small: true });
      c.note('Toy rule: one layer pass follows one arrow. Real models can combine some hops per pass. Saunshi and colleagues (2025) found that a k-layer model looped L times came close to a kL-layer model on addition and multi-hop lookups.');
      draw();
      c.demo(1500, async () => { L = 4; sL.set(4, true); draw(); await go(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'latent', tag: 'Thinking in vectors',
    title: 'Pass a word or pass the whole belief',
    alt: 'A grid with one row for each of eight answers, A to H, and one column for each reasoning step. A brighter cell means a stronger belief in that answer. The row of the correct answer is outlined. Under the grid, one setting shows the single word written between steps and the other shows that the whole belief is carried. A final chip shows the answer. Counters give how often each setting ends on the correct answer over 2,000 simulated runs, and the gap in points.',
    text: 'A chain of thought passes progress from step to step as **tokens**. One token carries at most **16 bits** with Huginn’s 65,536-word vocabulary, so each step squeezes its conclusion into one word. A loop passes the whole [[hidden state|hidden state]], **5,280 numbers** in Huginn. It can keep several answers alive until the evidence settles. You pay with readability: nobody can read a hidden state as text.',
    hint: 'Weaken the clues, then add steps.',
    mission: 'Find settings where passing the full belief wins by 15 points or more.',
    takeaway: 'A one-word channel drops the runner-up answers. A vector keeps them, but nobody can read it.',
    mount(c) {
      const K = 8, ABC = 'ABCDEFGH', N = 2000, PRIOR = 2;
      const f = c.fig(420, 218, '<g id="g"></g>');
      c.legend([['data', 'Belief in an answer'], ['ok', 'Right answer'], ['bad', 'Wrong word']]);
      const st = c.stats([{ k: 'w', label: 'Word carrier right', value: '', cls: 'cmp' }, { k: 'v', label: 'Vector carrier right', value: '', cls: 'data' }, { k: 'g', label: 'Vector minus word', value: '', cls: 'ctl' }]);
      let carrier = 'word', s = 2, steps = 4, ex = 4;
      const argmax = a => a.indexOf(Math.max.apply(null, a));
      function trial(r, s, steps) {
        const truth = Math.floor(r() * K), clues = [], zv = new Array(K).fill(0), cols = { vec: [], word: [] };
        for (let i = 0; i < steps; i++) { const l = []; for (let j = 0; j < K; j++) l.push((j === truth ? s : 0) + kit.gauss(r)); clues.push(l); }
        let w = -1;
        for (let i = 0; i < steps; i++) {
          for (let j = 0; j < K; j++) zv[j] += clues[i][j];
          cols.vec.push(zv.slice());
          const zw = clues[i].slice(); if (w >= 0) zw[w] += PRIOR;
          cols.word.push(zw); w = argmax(zw);
        }
        return { truth, cols, vec: argmax(zv), word: w };
      }
      const cache = {};
      function acc(s, steps) {
        const key = s + '|' + steps; if (cache[key]) return cache[key];
        const r = kit.rng(11); let a = 0, b = 0;
        for (let i = 0; i < N; i++) { const t = trial(r, s, steps); if (t.vec === t.truth) a++; if (t.word === t.truth) b++; }
        return (cache[key] = { vec: a / N, word: b / N });
      }
      function draw() {
        const t = trial(kit.rng(100 + ex), s, steps), zs = t.cols[carrier], cw = Math.min(90, Math.floor(372 / steps)), gx = 36, gy = 36, rh = 14, W = cw * steps;
        let g = '<text class="b sm" x="16" y="14">One example: ' + K + ' possible answers, ' + steps + ' clue' + (steps > 1 ? 's' : '') + '</text>';
        for (let j = 0; j < K; j++) g += '<text class="xs m ' + (j === t.truth ? 'b' : 'mute') + '" x="' + (gx - 8) + '" y="' + (gy + j * rh + 11) + '" text-anchor="end">' + ABC[j] + '</text>';
        for (let i = 0; i < steps; i++) {
          const z = zs[i], mx = Math.max.apply(null, z), e = z.map(v => Math.exp(v - mx)), tot = e.reduce((a, b) => a + b, 0), x = gx + i * cw;
          g += '<text class="xs mute" x="' + (x + cw / 2 - 1) + '" y="' + (gy - 5) + '" text-anchor="middle">' + (i + 1) + '</text>';
          for (let j = 0; j < K; j++) {
            const y = gy + j * rh;
            g += '<rect class="well" x="' + x + '" y="' + y + '" width="' + (cw - 2) + '" height="' + (rh - 2) + '" rx="2"/><rect class="f-data" style="opacity:' + (0.08 + 0.92 * e[j] / tot).toFixed(2) + '" x="' + x + '" y="' + y + '" width="' + (cw - 2) + '" height="' + (rh - 2) + '" rx="2"/>';
          }
        }
        g += '<rect class="s-ok" fill="none" style="stroke-width:2" x="' + (gx - 2) + '" y="' + (gy + t.truth * rh - 1) + '" width="' + (W + 2) + '" height="' + rh + '" rx="3"/>';
        const cy = gy + K * rh + 8, fin = t.cols[carrier].length - 1;
        for (let i = 0; i < steps; i++) {
          const x = gx + i * cw + (cw - 2) / 2, w = argmax(zs[i]), last = i === steps - 1;
          if (carrier === 'word' || last) g += '<rect class="' + (w === t.truth ? 't-ok' : 't-bad') + '" x="' + (x - 11) + '" y="' + cy + '" width="22" height="16" rx="5"/><text class="xs m b" x="' + x + '" y="' + (cy + 12) + '" text-anchor="middle">' + ABC[w] + '</text>';
          else g += '<rect class="t-data" x="' + (x - Math.min(cw - 8, 40) / 2) + '" y="' + cy + '" width="' + Math.min(cw - 8, 40) + '" height="16" rx="5"/><text class="xs m" x="' + x + '" y="' + (cy + 12) + '" text-anchor="middle">all ' + K + '</text>';
        }
        const fa = argmax(zs[fin]);
        g += '<text class="xs mute" x="16" y="' + (cy + 36) + '">' + (carrier === 'word' ? 'Between steps only the written word survives.' : 'Between steps the whole belief survives. Only the last chip is a word.') + '</text>';
        g += '<text class="xs m b" x="16" y="' + (cy + 52) + '" style="fill:var(--' + (fa === t.truth ? 'ok' : 'bad') + ')">Final answer ' + ABC[fa] + ': ' + (fa === t.truth ? 'right' : 'wrong') + '</text>';
        f.q('#g').innerHTML = g;
        const a = acc(s, steps), gap = Math.round((a.vec - a.word) * 100);
        st.set('w', Math.round(a.word * 100) + '%', 'writes one word per step');
        st.set('v', Math.round(a.vec * 100) + '%', 'carries the full belief');
        st.set('g', (gap >= 0 ? '+' : '−') + Math.abs(gap) + ' points', 'over ' + N.toLocaleString('en-US') + ' runs');
        c.mission.set(gap >= 15);
      }
      const sg = c.seg({ label: 'What passes between steps', options: [['word', 'One written word'], ['vec', 'The whole belief']], value: 'word', onChange: v => { carrier = v; draw(); } });
      const sS = c.slider({ label: 'Clue strength', values: [0.5, 0.75, 1, 1.5, 2, 3], value: 2, fmt: v => String(v), onInput: v => { s = v; draw(); } });
      const sT = c.slider({ label: 'Reasoning steps', values: [1, 2, 3, 4, 6, 8], value: 4, fmt: v => v, onInput: v => { steps = v; draw(); } });
      c.btn('New example', () => { ex++; draw(); }, { small: true });
      c.note('Toy: eight answers, one noisy clue per step, 2,000 simulated runs. A real chain of thought can also write "C or E" or reread earlier text, so the real gap is smaller. Latent states are not human-readable.');
      draw();
      c.demo(1500, async () => { s = 1; steps = 6; carrier = 'vec'; sS.set(1, true); sT.set(6, true); sg.set('vec'); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'exit', tag: 'Adaptive depth',
    title: 'Spend loops where tokens are hard',
    alt: 'Sixteen tokens drawn as columns of loop cells, in two groups of eight. Cells fill upward to the loop where each token exits. A tick mark shows how many loops that token needed. Green columns exit at or after the tick and red columns exit too early. Dashed grey cells show idle waiting inside a fixed batch. A slider sets the confidence needed to exit and a switch chooses fixed batches of eight or refilling every loop. Counters show tokens right, average loops used and loops paid per token.',
    text: 'The token "the" may need one loop. A hard number may need seven. An **early exit** gate checks after each loop whether the token is ready and stops once its confidence passes a threshold. That saves compute only if the server can **reuse the freed slot**. A fixed batch waits for its slowest token. Refilling the batch **every loop** keeps the saving. Mixture-of-Recursions (2025) learns this per token, and a 2026 paper builds the batching for looped models.',
    hint: 'Lower the threshold until tokens go wrong, then change the batching.',
    mission: 'Pay 4 loops or fewer per token and get at least 15 of 16 tokens right.',
    takeaway: 'Adaptive depth saves loops only when the batch refills as tokens exit.',
    mount(c) {
      const TOK = [['the', 1], ['17', 2], ['of', 1], ['×', 1], ['408', 6], ['is', 1], ['and', 1], ['=', 2], ['24', 2], ['to', 1], ['a', 1], ['391', 7], ['in', 1], ['x²', 5], ['it', 1], ['3.7', 4]];
      const NOISE = [-1.36, -0.52, -0.98, 0.04, 1.08, 1.03, 0.2, 1.84, 0.72, 1.97, -1.02, 0.11, -2.43, -1.43, -1.5, 1.31];
      const MAXL = 8, SH = 0.9, need = TOK.map(t => t[1]), est = need.map((n, i) => n + NOISE[i]);
      const exits = tau => est.map(x => { for (let t = 1; t <= MAXL; t++) if (1 / (1 + Math.exp(-(t - x + 0.5) / SH)) >= tau) return t; return MAXL; });
      const f = c.fig(420, 208, '<g id="g"></g>');
      c.legend([['ok', 'Exits in time'], ['bad', 'Exits too early'], ['mute', 'Idle, waiting']]);
      const st = c.stats([{ k: 'r', label: 'Tokens right', value: '', cls: 'ok' }, { k: 'a', label: 'Loops used on average', value: '', cls: 'cmp' }, { k: 'p', label: 'Loops paid per token', value: '', cls: 'ctl' }]);
      let tau = 0.9, mode = 'static';
      function draw() {
        const ex = exits(tau), right = ex.filter((e, i) => e >= need[i]).length, avg = ex.reduce((a, b) => a + b, 0) / 16;
        const mx = [Math.max.apply(null, ex.slice(0, 8)), Math.max.apply(null, ex.slice(8))], paid = mode === 'static' ? (mx[0] * 8 + mx[1] * 8) / 16 : avg, yb = 166;
        let g = '<text class="b sm" x="16" y="16">Loops each token runs before it exits</text>';
        for (let i = 0; i < 16; i++) {
          const x = 14 + i * 25, e = ex[i], good = e >= need[i], top = j => yb - j * 13, wait = mode === 'static' ? mx[i < 8 ? 0 : 1] : e;
          for (let j = 1; j <= e; j++) g += '<rect class="' + (good ? 'f-ok' : 'f-bad') + '" x="' + x + '" y="' + top(j) + '" width="20" height="11" rx="2"/>';
          for (let j = e + 1; j <= wait; j++) g += '<rect class="well" style="stroke-dasharray:2 2" x="' + x + '" y="' + top(j) + '" width="20" height="11" rx="2"/>';
          g += '<line class="ink-s" style="stroke-width:2.5" x1="' + (x - 1.5) + '" x2="' + (x + 21.5) + '" y1="' + (top(need[i]) - 1.5) + '" y2="' + (top(need[i]) - 1.5) + '"/>';
          g += '<text class="xs m" x="' + (x + 10) + '" y="' + (yb + 15) + '" text-anchor="middle">' + TOK[i][0] + '</text>';
        }
        if (mode === 'static') g += '<line class="ln dash" x1="211.5" x2="211.5" y1="38" y2="198"/><text class="xs mute" x="16" y="200">batch 1</text><text class="xs mute" x="222" y="200">batch 2</text>';
        else g += '<text class="xs mute" x="16" y="200">A freed slot takes a new token on the next loop, so nothing waits.</text>';
        f.q('#g').innerHTML = g;
        st.set('r', right + ' of 16', 'tick mark = loops needed');
        st.set('a', avg.toFixed(1), 'of ' + MAXL + ' allowed');
        st.set('p', paid.toFixed(1), mode === 'static' ? 'idle slots included' : 'no idle slots');
        c.mission.set(paid <= 4 && right >= 15);
      }
      const sT = c.slider({ label: 'Exit when confidence reaches', values: [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99], value: 0.9, fmt: v => Math.round(v * 100) + '%', onInput: v => { tau = v; draw(); } });
      const sM = c.seg({ label: 'Batching', options: [['static', 'Fixed batches of 8'], ['refill', 'Refill every loop']], value: 'static', onChange: v => { mode = v; draw(); } });
      c.note('Toy: 16 tokens from different requests, two batches of 8, at most 8 loops. The gate’s confidence is a noisy guess of how many loops a token needs. Ouro’s default setting runs every loop, and vLLM ignores early exit for it.');
      draw();
      c.demo(1500, async () => { tau = 0.8; mode = 'refill'; sT.set(0.8); sM.set('refill'); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'stable', tag: 'Training',
    title: 'Loops can settle, keep moving or blow up',
    alt: 'Two panels. The left panel plots a two-number state after each loop as a path of dots in a plane, starting from a hollow ring, with a cross marking where it settles when it settles. The right panel plots, on a log scale, how far the state moves on each loop. Sliders set the gain of the loop and the number of loops shown, and a switch rescales the state every loop. Counters show the state size, the last change and the long-run behavior.',
    text: 'A loop applies one function again and again, so its state follows a **path**. If each pass shrinks differences (a **gain** below 1), the state settles on a [[fixed point]] and extra loops change nothing. With a gain above 1 the state grows on every pass. In training that appears as **loss spikes**. Normalizing the state keeps its size bounded, but a high gain can still leave it moving.',
    hint: 'Try a gain below 1, or switch normalization on.',
    mission: 'Settle within 5% of the final state in 12 loops or fewer.',
    takeaway: 'A gain below 1 settles, so extra loops are safe. A gain above 1 makes extra loops harmful.',
    mount(c) {
      const TH = 0.6, E = [1, 0], S0 = [-1.2, 1.4], RAD = 1.5, CT = Math.cos(TH), SN = Math.sin(TH);
      const sup10 = v => '10' + kit.sup(Math.round(Math.log10(v)));
      const ch = kit.chart({ x: 250, y: 30, w: 154, h: 140, xmin: 0, xmax: 40, ymin: 1e-3, ymax: 1e3, ylog: true, xt: [0, 20, 40], yt: [1e-3, 1e-1, 10, 1e3], yf: sup10, xlabel: 'Loop', ylabel: 'Change per loop' });
      const f = c.fig(420, 214, '<defs><clipPath id="stabClip"><rect x="14" y="30" width="172" height="140"/></clipPath></defs><rect class="well" x="14" y="30" width="172" height="140" rx="6"/><line class="grid" x1="14" x2="186" y1="100" y2="100"/><line class="grid" x1="100" x2="100" y1="30" y2="170"/><text class="xs mute" x="14" y="22">State after each loop</text>' + ch.svg + '<g id="g"></g>');
      c.legend([['cmp', 'State'], ['ok', 'Where it settles']]);
      const st = c.stats([{ k: 'z', label: 'State size at this loop', value: '', cls: 'cmp' }, { k: 'm', label: 'Change in the last loop', value: '', cls: 'ctl' }, { k: 'v', label: 'Long run, 60 loops', value: '', cls: 'ok' }]);
      let a = 1.15, norm = false, T = 12;
      const orbits = {};
      function orb(a, norm) {
        const key = a + '|' + norm; if (orbits[key]) return orbits[key];
        let s = S0.slice(); const p = [s];
        for (let t = 0; t < 400; t++) {
          let u0 = a * (CT * s[0] - SN * s[1]) + E[0], u1 = a * (SN * s[0] + CT * s[1]) + E[1];
          if (norm) { const m = Math.hypot(u0, u1) || 1; u0 = RAD * u0 / m; u1 = RAD * u1 / m; }
          s = [u0, u1]; p.push(s);
        }
        return (orbits[key] = p);
      }
      const len = v => Math.hypot(v[0], v[1]), step = (o, t) => Math.hypot(o[t][0] - o[t - 1][0], o[t][1] - o[t - 1][1]);
      const num = v => v >= 1e5 ? '10' + kit.sup(Math.round(Math.log10(v))) : v >= 100 ? String(Math.round(v)) : v >= 0.01 ? v.toFixed(2) : '<0.01';
      const px = p => [100 + 26 * p[0], 100 - 26 * p[1]];
      function draw() {
        const o = orb(a, norm), fin = o[400], conv = (norm || a < 1) && step(o, 400) < 1e-4, err = conv ? Math.hypot(o[T][0] - fin[0], o[T][1] - fin[1]) / len(fin) : Infinity;
        const pts = o.slice(0, T + 1).map(px), cur = pts[T], s0 = pts[0];
        let g = '<polyline class="ln s-cmp" style="stroke-width:1.5" clip-path="url(#stabClip)" fill="none" points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
        g += '<g clip-path="url(#stabClip)">' + pts.map(p => '<circle class="f-cmp" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4"/>').join('') + '</g>';
        if (conv) { const m = px(fin); g += '<path class="ln s-ok" style="stroke-width:2.4" d="M' + (m[0] - 6) + ' ' + m[1].toFixed(1) + ' h12 M' + m[0].toFixed(1) + ' ' + (m[1] - 6).toFixed(1) + ' v12"/>'; }
        g += '<circle cx="' + s0[0].toFixed(1) + '" cy="' + s0[1].toFixed(1) + '" r="5" fill="none" style="stroke:var(--ink);stroke-width:1.6"/><text class="xs mute" x="' + (s0[0] + 8).toFixed(1) + '" y="' + (s0[1] + 3).toFixed(1) + '">start</text>';
        if (cur[0] > 14 && cur[0] < 186 && cur[1] > 30 && cur[1] < 170) g += '<circle class="f-cmp" cx="' + cur[0].toFixed(1) + '" cy="' + cur[1].toFixed(1) + '" r="5" style="stroke:var(--ink);stroke-width:2"/>';
        else g += '<text class="xs b" x="100" y="164" text-anchor="middle" style="fill:var(--bad)">state left the chart</text>';
        const dl = []; for (let t = 1; t <= 40; t++) dl.push([ch.X(t), ch.Y(clamp(step(o, t), 1e-3, 1e3))]);
        g += '<path class="ln s-cmp" style="stroke-width:2" d="' + kit.path(dl) + '"/><line class="ln dash" x1="' + ch.X(T).toFixed(1) + '" x2="' + ch.X(T).toFixed(1) + '" y1="' + ch.y0 + '" y2="' + ch.y1 + '"/><circle class="f-cmp" cx="' + ch.X(T).toFixed(1) + '" cy="' + ch.Y(clamp(step(o, T), 1e-3, 1e3)).toFixed(1) + '" r="4.5" style="stroke:var(--ink);stroke-width:1.6"/>';
        f.q('#g').innerHTML = g;
        const verdict = len(o[60]) > 20 ? 'Blows up' : step(o, 60) / Math.max(1, len(o[60])) > 0.03 ? 'Keeps moving' : 'Settles';
        st.set('z', num(len(o[T])), 'after ' + T + ' loop' + (T > 1 ? 's' : ''));
        st.set('m', num(step(o, T)), 'distance moved');
        st.set('v', verdict, norm ? 'state rescaled each loop' : 'gain ' + a.toFixed(2));
        c.mission.set(T <= 12 && err < 0.05);
      }
      const sA = c.slider({ label: 'Gain of the loop', values: [0.5, 0.7, 0.85, 0.95, 1, 1.05, 1.15, 1.3], value: 1.15, fmt: v => v.toFixed(2), onInput: v => { a = v; draw(); } });
      const sN = c.toggle({ label: 'Rescale the state every loop (normalization)', value: false, onChange: v => { norm = v; draw(); } });
      const sL = c.slider({ label: 'Loops shown', values: [1, 2, 4, 8, 12, 16, 24, 40], value: 12, fmt: v => v, onInput: v => { T = v; draw(); } });
      c.note('Toy: a state of 2 numbers, updated as gain × rotation + prompt. Real states have thousands of numbers. Parcae (2026) caps the spectral norm of its injection weights and STARS (2026) penalizes the loop’s [[spectral radius]], so extra loops keep helping.');
      draw();
      c.demo(1500, async () => { a = 0.7; sA.set(0.7, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'cost', tag: 'The bill',
    title: 'Looping saves storage, not decode time',
    alt: 'Two pairs of bars compare the time one decode step takes. The top pair is a standard 24-layer model and the bottom pair is the chosen looped layout. In each pair one bar is the time to read the weights from memory and the other is the time to do the arithmetic, and the longer bar sets the step time. Controls choose the layout, the size of fast on-chip memory and the batch size. Counters show the weights stored, the time per step and the speed compared with the 24-layer model.',
    text: 'Looping shrinks what you **store**, not what you **run**. A decode step reads the loop’s weights from [[hbm|HBM]] on every pass, so 24 passes move the same bytes as a 24-layer model and take the same time. The exception is a block small enough to stay in fast on-chip memory. An H100 has 50 MB of L2 cache, far less than a useful block. Each loop also writes its own [[kv cache|KV cache]] entries, unless a design shares them.',
    hint: 'Pick a looped layout, then grow the fast memory.',
    mission: 'Make a looped layout decode at least 3 times faster than the 24-layer model.',
    takeaway: 'Looping shrinks the weights, not the work. Decode speeds up only when the loop’s weights stay in fast memory.',
    mount(c) {
      const BW = 3.35e12, PEAK = 1.979e15, PL = 200e6, SC = 270 / 6;
      const f = c.fig(420, 208, '<g id="g"></g>');
      c.legend([['mem', 'Time to read the weights'], ['cmp', 'Time to do the math']]);
      const st = c.stats([{ k: 'w', label: 'Weights stored', value: '', cls: 'mem' }, { k: 't', label: 'Time per decode step', value: '', cls: 'cmp' }, { k: 'x', label: 'Speed vs 24 layers', value: '', cls: 'ok' }]);
      let lay = '24x1', cache = 50, B = 1;
      const LAY = { '24x1': [24, 1], '6x4': [6, 4], '3x8': [3, 8], '1x24': [1, 24] };
      function model(n, L) {
        const block = n * PL, fits = L > 1 && block <= cache * 1e6, bytes = fits ? block : block * L;
        const mem = bytes / BW, cmp = 2 * PL * n * L * B / PEAK;
        return { block, fits, bytes, mem, cmp, time: Math.max(mem, cmp) };
      }
      const ms = v => (v * 1e3).toFixed(v * 1e3 < 0.1 ? 3 : 2);
      function pair(y, name, m) {
        const wm = Math.max(2, m.mem * 1e3 * SC), wc = Math.max(2, m.cmp * 1e3 * SC), memWins = m.mem >= m.cmp;
        return '<text class="xs b" x="16" y="' + y + '">' + name + '</text>'
          + '<text class="xs m ' + (memWins ? 'b' : 'mute') + '" x="16" y="' + (y + 22) + '">memory</text><rect class="well" x="72" y="' + (y + 12) + '" width="270" height="12" rx="6"/><rect class="f-mem" x="72" y="' + (y + 12) + '" width="' + Math.min(270, wm).toFixed(1) + '" height="12" rx="6"/><text class="xs m ' + (memWins ? 'b' : 'mute') + '" x="348" y="' + (y + 22) + '">' + ms(m.mem) + ' ms</text>'
          + '<text class="xs m ' + (memWins ? 'mute' : 'b') + '" x="16" y="' + (y + 40) + '">math</text><rect class="well" x="72" y="' + (y + 30) + '" width="270" height="12" rx="6"/><rect class="f-cmp" x="72" y="' + (y + 30) + '" width="' + Math.min(270, wc).toFixed(1) + '" height="12" rx="6"/><text class="xs m ' + (memWins ? 'mute' : 'b') + '" x="348" y="' + (y + 40) + '">' + ms(m.cmp) + ' ms</text>';
      }
      function draw() {
        const [n, L] = LAY[lay], ref = model(24, 1), m = model(n, L), speed = ref.time / m.time;
        let g = pair(14, '24 layers × 1, the reference', ref) + pair(92, n + ' layer' + (n > 1 ? 's' : '') + ' × ' + L + (L > 1 ? ', fast memory ' + cache + ' MB' : ''), m);
        const mb = x => x >= 1e9 ? (x / 1e9).toFixed(1) + ' GB' : Math.round(x / 1e6) + ' MB';
        g += '<text class="xs m" x="16" y="172">' + (L > 1 ? 'Loop block ' + mb(m.block) + (m.fits ? ' fits in ' + cache + ' MB: read once.' : ', fast memory ' + cache + ' MB: read ' + L + ' times.') : 'No loops: every weight is read once.') + '</text>';
        g += '<text class="xs m" x="16" y="190">HBM read per step: ' + mb(m.bytes) + ' (reference ' + mb(ref.bytes) + ').</text>';
        f.q('#g').innerHTML = g;
        st.set('w', fmt.n(n * 0.2, 1) + ' GB', 'vs 4.8 GB at 24 layers');
        st.set('t', ms(m.time) + ' ms', m.mem >= m.cmp ? 'limited by memory' : 'limited by math');
        st.set('x', +speed.toFixed(speed < 10 ? 1 : 0) + '×', 'same 24 layer passes');
        c.mission.set(L > 1 && speed >= 3);
      }
      const sg = c.seg({ label: 'Stored layers × loops', options: [['24x1', '24 × 1'], ['6x4', '6 × 4'], ['3x8', '3 × 8'], ['1x24', '1 × 24']], value: '24x1', onChange: v => { lay = v; draw(); } });
      const sC = c.slider({ label: 'Fast on-chip memory for weights', values: [0, 50, 200, 600, 1200, 2400], value: 50, fmt: v => v + ' MB', onInput: v => { cache = v; draw(); } });
      const sB = c.slider({ label: 'Batch size', values: [1, 8, 64, 256, 1024], value: 1, fmt: v => v, onInput: v => { B = v; draw(); } });
      c.note('Toy: FP8 weights, 200M parameters per layer, 3.35 TB/s HBM, 1,979 TFLOPS peak. A block that fits in fast memory is read once per step and one that does not is read on every loop. Real kernels overlap and cache partly. The Ouro authors attribute their gains to using stored knowledge better, not to storing more.');
      draw();
      c.demo(1600, async () => { lay = '3x8'; cache = 1200; sg.set('3x8'); sC.set(1200, true); draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'A loop transformer stores 6 layers and runs them 4 times. How many layer passes does each token get?', o: ['6', '10', '24', '4'], a: 2, why: '6 stored layers × 4 loops = 24 layer passes: the depth of a 24-layer model from a quarter of the weights.' },
      { q: 'Compared with a 24-layer model of the same depth, what does looping save?', o: ['Decode time on a GPU', 'Stored weights, so memory capacity', 'KV cache entries', 'Compute per token'], a: 1, why: 'Only the stored weights shrink. Compute is the same 24 passes, and each pass still reads the weights and writes its own KV entries. Saunshi et al. also found that looped models lag on memorization-style metrics while matching deeper models on reasoning.' },
      { q: 'Huginn has a 2-layer prelude, a 4-layer core and a 2-layer coda. With 32 loops of the core, how many layer passes does a token get?', o: ['36', '264', '8', '132'], a: 3, why: '2 + 4 × 32 + 2 = 132 layer passes from 8 stored layers, about the compute of a 50B-parameter dense model.' },
      { q: 'A chain of thought passes one token between steps. With a 65,536-word vocabulary, how many bits can that token carry at most?', o: ['16 bits', '65,536 bits', '5,280 bits', '1 bit'], a: 0, why: 'log2(65,536) = 16. A hidden state holds thousands of numbers, which is why a loop can keep several answers alive.' },
      { q: 'Why does per-token early exit save little in a fixed batch of 8 tokens?', o: ['Early exit makes tokens less accurate', 'Fixed batches cannot run loops', 'The batch waits for its slowest token, so finished slots sit idle', 'Exit gates need more memory than the loop'], a: 2, why: 'Compute is saved only when a freed slot takes new work. Continuous depth batching rebuilds the batch between loops to do that.' },
      { q: 'In the stability toy, what happens to the state when the gain is above 1 and nothing rescales it?', o: ['It settles faster', 'It grows on every pass and can blow up', 'It resets to the start', 'It stops moving'], a: 1, why: 'Each pass multiplies differences by the gain, so they grow. Parcae and STARS keep the loop’s gain under control so extra loops stay safe.' },
      { q: 'On an H100, why does looping a 6-layer block 4 times not make decoding faster than a 24-layer model?', o: ['Loops cannot run on GPUs', 'GPUs have too few cores', 'Loops double the KV cache', 'The block is read from HBM on every loop, so the bytes moved match the 24-layer model'], a: 3, why: 'A 1.2 GB block does not fit in a 50 MB cache, so every loop re-reads it. Decode stays limited by memory bandwidth.' },
      { q: 'What is a main drawback of latent loops compared with a written chain of thought?', o: ['The intermediate reasoning is not readable text', 'They need more training data than any dense model', 'They cannot use attention', 'They only work on math'], a: 0, why: 'A hidden state is a vector of numbers. You cannot read it or check it the way you can read written steps.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [0, 1, 2].map(i => `<rect x="${86 + i * 52}" y="38" width="44" height="44" rx="8" style="fill:var(--mem);opacity:.9"/>`).join('')
    + '<path d="M230 86 V114 H108 V92" fill="none" style="stroke:var(--ctl);stroke-width:3;stroke-linecap:round;stroke-linejoin:round"/><polygon points="102,94 114,94 108,86" style="fill:var(--ctl)"/>'
    + '<text x="169" y="134" text-anchor="middle" style="font:700 12px var(--font-mono);fill:var(--ink-2)">× 8 loops</text>'
    + '</g><text x="160" y="20" text-anchor="middle" style="font:600 11px var(--font-mono);fill:var(--ink-3)">same layers, run again</text></svg>';

  window.LESSONS.push({
    id: 'loops', n: 18, track: 'frontier', order: 1,
    title: 'Loop Transformers',
    tagline: 'Reuse the same layers many times to think longer without adding parameters.',
    preview,
    scenes: S
  });
})();
