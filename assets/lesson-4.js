/* Lesson 4: Why a token takes 30 ms */
(function () {
  'use strict';
  const { fmt } = window.LLMI;

  /* Vendor peak figures. bw in TB/s, tf in dense BF16 TFLOPS, mem in GB. */
  const CHIPS = {
    a100: { name: 'A100', bw: 2.039, tf: 312, mem: 80 },
    h100: { name: 'H100', bw: 3.35, tf: 989, mem: 80 },
    h200: { name: 'H200', bw: 4.8, tf: 989, mem: 141 },
    b200: { name: 'B200', bw: 8, tf: 2250, mem: 192 }
  };
  const CHIP_OPTS = [['a100', 'A100'], ['h100', 'H100'], ['h200', 'H200'], ['b200', 'B200']];
  const ridgeOf = k => CHIPS[k].tf / CHIPS[k].bw;

  /* One decode step of a dense model. P in billions of weights, bytes per weight, n chips, batch b, kv = extra bytes read per step. */
  function step(o) {
    const C = CHIPS[o.chip], n = o.n || 1, b = o.batch || 1;
    const W = o.P * 1e9 * o.bytes, bytes = W + (o.kv || 0);
    const tMem = bytes / (C.bw * 1e12 * n) * 1000;
    const tCmp = 2 * o.P * 1e9 * b / (C.tf * 1e12 * n) * 1000;
    const t = Math.max(tMem, tCmp);
    return { W, bytes, tMem, tCmp, t, perUser: 1000 / t, total: b * 1000 / t, bound: tMem >= tCmp ? 'memory' : 'compute', cap: C.mem * n, fits: W / 1e9 <= C.mem * n };
  }
  const pathOf = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');

  const S = [];

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'hook', tag: 'The puzzle',
    title: 'The math takes 0.1 ms. A token takes 30.',
    alt: 'A bar showing 30 milliseconds for one generated token, with a thin sliver for the 0.1 millisecond of arithmetic.',
    text: 'A large model streams one token about every **30 ms**. Each token needs roughly 100 billion operations, and one chip does about a quadrillion per second. That is **0.1 ms** of math. Where does the rest of the time go?',
    hint: 'Guess how much of the 30 ms is arithmetic, then press Reveal.',
    takeaway: 'Under 1% of a token’s time is arithmetic. The rest is the chip waiting for data.',
    mount(c) {
      const X0 = 20, WID = 380, Y0 = 74, BH = 56, TRUE = WID * 0.1 / 30;
      const f = c.fig(420, 190, `
        <text x="20" y="28" class="b md">Time to produce one token</text>
        <rect class="well" x="${X0}" y="${Y0}" width="${WID}" height="${BH}" rx="10"/>
        <rect id="mem" class="t-mem" x="${X0}" y="${Y0}" width="0" height="${BH}" rx="10"/>
        <rect id="math" class="t-cmp" x="${X0}" y="${Y0}" width="190" height="${BH}" rx="10"/>
        ${[0, 10, 20, 30].map(v => `<line class="axis" x1="${X0 + WID * v / 30}" x2="${X0 + WID * v / 30}" y1="${Y0 + BH}" y2="${Y0 + BH + 7}"/><text class="m xs mute" text-anchor="middle" x="${X0 + WID * v / 30}" y="${Y0 + BH + 21}">${v} ms</text>`).join('')}
        <text id="glbl" class="b sm" x="${X0}" y="${Y0 - 12}">Your guess: 50% of the time is math</text>
        <g id="callout" style="opacity:0">
          <path class="ln s-cmp s2" d="M${X0 + 1.5} ${Y0 - 2} V${Y0 - 26}"/>
          <circle class="f-cmp" cx="${X0 + 1.5}" cy="${Y0 - 28}" r="4.5"/>
          <text class="b sm" x="${X0 + 12}" y="${Y0 - 24}">Actual: 0.1 ms of math (0.3%)</text>
        </g>
        <text id="memLbl" class="b sm" text-anchor="middle" x="${X0 + WID / 2 + 6}" y="${Y0 + BH / 2 + 5}" style="opacity:0">29.9 ms waiting for weights to arrive</text>`);
      const mathEl = f.q('#math'), memEl = f.q('#mem'), glbl = f.q('#glbl');
      const st = c.stats([
        { k: 'math', label: 'Arithmetic per token', value: '?', cls: 'cmp' },
        { k: 'wait', label: 'Waiting on memory', value: '?', cls: 'mem' },
        { k: 'fit', label: 'Tokens of math that fit', value: '?' }
      ]);
      const g = c.slider({ label: 'Your guess: share of the 30 ms spent on arithmetic', min: 0, max: 100, value: 50, fmt: v => v + '%',
        onInput: v => { mathEl.setAttribute('width', Math.max(2, WID * v / 100)); glbl.textContent = 'Your guess: ' + v + '% of the time is math'; } });
      let revealed = false, settle;
      const settled = new Promise(r => { settle = r; });
      const btn = c.btn('Reveal', () => reveal(), { kind: 'pri' });
      async function reveal() {
        if (revealed) return; revealed = true; btn.disabled = true; g.input.disabled = true;
        const from = Math.max(2, WID * g.get() / 100);
        await Promise.all([
          c.fx(glbl, { o: 0 }, 300),
          c.tween(1300, p => mathEl.setAttribute('width', from + (TRUE - from) * p)),
          c.tween(1300, p => memEl.setAttribute('width', WID * p))
        ]);
        mathEl.setAttribute('class', 'f-cmp');
        await Promise.all([c.fx(f.q('#callout'), { o: 1 }, 400), c.fx(f.q('#memLbl'), { o: 1 }, 400)]);
        st.set('math', '0.1 ms'); st.set('wait', '29.9 ms');
        await c.count(st.el.querySelectorAll('b')[2], 0, 300, 900, v => '×' + Math.round(v));
        settle();
      }
      c.demo(3600, reveal);
      c.play(() => settled);
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'map', tag: 'The route',
    title: 'Where a request spends its time',
    alt: 'A vertical route of eight stations a request passes, from pressing Enter to tokens streaming back, with prefill and decode marked as this lesson.',
    text: 'A request crosses a router, a scheduler, a prefill cluster, a cache transfer and a decode cluster before tokens stream back. This lesson covers the two phases at the center: **prefill** and **decode**.',
    takeaway: 'Two phases do the heavy lifting: reading your prompt, then writing the answer.',
    mount(c) {
      const st = [
        ['You press Enter', 'The prompt leaves your device'],
        ['Router', 'Picks a machine for your request'],
        ['Scheduler', 'Batches you with thousands of other requests'],
        ['Prefill cluster', 'Reads your whole prompt in one parallel pass', 1],
        ['KV cache transfer', 'Ships the saved keys and values onward'],
        ['Decode cluster', 'Writes the answer one token at a time', 1],
        ['Multi-token decoding', 'Tries to emit more than one token per pass'],
        ['Your screen', 'Tokens stream back to you']
      ];
      const Y = i => 36 + i * 50;
      let inner = `<line class="ln thin" x1="44" x2="44" y1="${Y(0)}" y2="${Y(7)}"/>`;
      st.forEach((r, i) => {
        if (r[2]) inner += `<rect class="t-ctl" x="66" y="${Y(i) - 23}" width="342" height="46" rx="10"/><text class="xs m mute" x="400" y="${Y(i) - 9}" text-anchor="end">THIS LESSON</text>`;
        inner += `<circle id="n${i}" class="box" cx="44" cy="${Y(i)}" r="11"/><text class="b" x="80" y="${Y(i) - 2}">${r[0]}</text><text class="sm" x="80" y="${Y(i) + 15}">${r[1]}</text>`;
      });
      inner += `<circle id="tok" class="f-data" cx="44" cy="${Y(0)}" r="7" stroke="var(--stage)" stroke-width="2"/>`;
      const f = c.fig(420, Y(7) + 34, inner);
      const tok = f.q('#tok');
      c.play(async () => {
        f.q('#n0').setAttribute('class', 't-data');
        for (let i = 1; i < st.length; i++) {
          await c.fx(tok, { y: Y(i) - Y(0) }, 420, c.ease.io);
          f.q('#n' + i).setAttribute('class', st[i][2] ? 't-ctl' : 't-data');
          await c.fx(tok, { s: 1.5 }, 120); await c.fx(tok, { s: 1 }, 120);
        }
      });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'two-numbers', tag: 'The chip',
    title: 'Two numbers set the speed limit',
    alt: 'Memory feeds compute through a pipe. Two timers race: moving the weights takes 41.8 milliseconds, the arithmetic takes 0.14 milliseconds.',
    text: 'To make a token, the chip must **move** every weight from memory, then **multiply** it. Arithmetic speed is how fast it multiplies. [[bandwidth|Memory bandwidth]] is how fast it moves. A token is not done until both finish.',
    hint: 'Pick a chip and a model size. The slower timer always wins. Try a 70B model on an H200: about 29 ms, close to the 30 ms in scene 1.',
    takeaway: 'Token time is set by the slower of two jobs, and moving weights is far slower than multiplying them.',
    mount(c) {
      const state = { chip: 'h100', P: 70 };
      const LX = 20, LW = 380;
      const f = c.fig(420, 318, `
        <text x="20" y="26" class="b md">Making one token</text>
        <rect class="t-mem" x="14" y="44" width="118" height="132" rx="12"/>
        <text x="73" y="68" text-anchor="middle" class="b sm">Memory (HBM)</text>
        <text id="wTxt" x="73" y="100" text-anchor="middle" class="m b lg">140 GB</text>
        <text x="73" y="120" text-anchor="middle" class="sm">of weights</text>
        <rect class="t-cmp" x="288" y="44" width="118" height="132" rx="12"/>
        <text x="347" y="68" text-anchor="middle" class="b sm">Compute</text>
        <text id="cTxt" x="347" y="100" text-anchor="middle" class="m b lg">989</text>
        <text x="347" y="120" text-anchor="middle" class="sm">TFLOPS</text>
        <text id="busy" x="347" y="150" text-anchor="middle" class="xs mute m">busy 0.3%</text>
        <rect class="well" x="132" y="92" width="156" height="40" rx="8"/>
        <text x="210" y="82" text-anchor="middle" class="b sm">Bandwidth</text>
        <text id="bTxt" x="210" y="152" text-anchor="middle" class="m b sm">3.35 TB/s</text>
        <g id="parts">${Array.from({ length: 7 }, (_, i) => `<rect class="f-mem" x="${136 + i * 22}" y="108" width="10" height="10" rx="2"/>`).join('')}</g>
        <text class="b sm" x="${LX}" y="212">Math for one token</text>
        <text id="mT" class="m sm" x="${LX + LW}" y="212" text-anchor="end">0.14 ms</text>
        <rect class="well" x="${LX}" y="220" width="${LW}" height="18" rx="5"/>
        <rect id="mathBar" class="f-cmp" x="${LX}" y="220" width="0" height="18" rx="3"/>
        <text class="b sm" x="${LX}" y="266">Moving the weights</text>
        <text id="wT" class="m sm" x="${LX + LW}" y="266" text-anchor="end">41.8 ms</text>
        <rect class="well" x="${LX}" y="274" width="${LW}" height="18" rx="5"/>
        <rect id="memBar" class="f-mem" x="${LX}" y="274" width="0" height="18" rx="3"/>
        <text id="clk" class="m xs mute" x="${LX}" y="310">t = 0.0 ms</text>`);
      const st = c.stats([
        { k: 'mv', label: 'Move the weights', value: '', cls: 'mem' },
        { k: 'mt', label: 'Do the math', value: '', cls: 'cmp' },
        { k: 'tok', label: 'Token time', value: '' },
        { k: 'idle', label: 'Compute sits idle', value: '' }
      ]);
      const parts = f.qa('#parts rect');
      let off = 0;
      c.loop(dt => { off = (off + dt * 0.09) % 22; parts.forEach((r, i) => r.setAttribute('x', 136 + i * 22 + off)); });
      let run = 0;
      async function race() {
        const id = ++run, C = CHIPS[state.chip];
        const tMem = 2 * state.P / C.bw, tCmp = 2 * state.P / C.tf, idle = (1 - tCmp / tMem) * 100;
        f.q('#wTxt').textContent = fmt.n(state.P * 2) + ' GB'; f.q('#cTxt').textContent = fmt.n(C.tf); f.q('#bTxt').textContent = C.bw + ' TB/s';
        f.q('#mT').textContent = fmt.ms(tCmp, 2); f.q('#wT').textContent = fmt.ms(tMem);
        f.q('#busy').textContent = 'busy ' + (100 - idle).toFixed(1) + '%';
        st.set('mv', fmt.ms(tMem)); st.set('mt', fmt.ms(tCmp, 2)); st.set('tok', fmt.ms(tMem), '= the slower timer'); st.set('idle', idle.toFixed(1) + '%');
        const mathBar = f.q('#mathBar'), memBar = f.q('#memBar');
        await c.tween(2600, p => {
          if (id !== run) return;
          const t = p * tMem;
          memBar.setAttribute('width', LW * p);
          mathBar.setAttribute('width', LW * Math.min(t, tCmp) / tMem);
          f.q('#clk').textContent = 't = ' + fmt.ms(t);
        }, c.ease.lin);
      }
      c.seg({ label: 'Chip', options: CHIP_OPTS, value: 'h100', onChange: v => { state.chip = v; race(); } });
      c.slider({ label: 'Model size (billions of weights)', values: [7, 13, 34, 70, 180, 405], value: 70, fmt: v => v + 'B', onInput: v => { state.P = v; race(); } });
      c.note('Thought experiment: all weights on one chip, 16-bit. Real systems split big models over several chips and add their bandwidth.');
      c.play(race);
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'memory-wall', tag: 'The trend',
    title: 'Math grew 80×. Memory speed grew 17×.',
    alt: 'A log chart covering 2012 through 2022. GPU arithmetic throughput rises to 80 times its 2012 level, memory bandwidth to 17 times. The gap is 4.7 times.',
    text: 'Between 2012 and 2022, top server GPUs gained about **80×** in arithmetic throughput but only about **17×** in memory bandwidth. Wulf and McKee named this widening gap the **memory wall** in 1995, long before [[transformer|transformers]] existed.',
    hint: 'Drag the year to read both growth factors.',
    takeaway: 'Arithmetic is cheap and getting cheaper faster. Moving data is the expensive part.',
    mount(c) {
      const PX0 = 48, PX1 = 366, PY0 = 30, PY1 = 258;
      const xs = yr => PX0 + (yr - 2012) / 10 * (PX1 - PX0);
      const ys = v => PY1 - Math.log10(v) / 2 * (PY1 - PY0);
      const grow = (G, yr) => Math.pow(G, (yr - 2012) / 10);
      const pts = G => Array.from({ length: 41 }, (_, i) => { const yr = 2012 + i / 4; return [xs(yr), ys(grow(G, yr))]; });
      const yrs = [2012, 2014, 2016, 2018, 2020, 2022];
      const f = c.fig(420, 296, `
        ${[1, 10, 100].map(v => `<line class="grid" x1="${PX0}" x2="${PX1}" y1="${ys(v)}" y2="${ys(v)}"/><text class="m xs mute" x="${PX0 - 8}" y="${ys(v) + 4}" text-anchor="end">${v}×</text>`).join('')}
        ${yrs.map(y => `<text class="m xs mute" x="${xs(y)}" y="${PY1 + 20}" text-anchor="middle">${y}</text>`).join('')}
        <line class="axis" x1="${PX0}" x2="${PX1}" y1="${PY1}" y2="${PY1}"/>
        <text class="sm mute" x="${PX0}" y="18">Growth since 2012 (log scale)</text>
        <path id="lc" class="s-cmp s3" d="${pathOf(pts(80))}"/>
        <path id="lb" class="s-mem s3" d="${pathOf(pts(17))}"/>
        <g id="ends" style="opacity:0">
          <circle class="f-cmp" cx="${xs(2022)}" cy="${ys(80)}" r="5" stroke="var(--stage)" stroke-width="2"/>
          <circle class="f-mem" cx="${xs(2022)}" cy="${ys(17)}" r="5" stroke="var(--stage)" stroke-width="2"/>
          <text class="b sm" x="${xs(2022) - 4}" y="${ys(80) - 12}" text-anchor="end">80×</text>
          <text class="b sm" x="${xs(2022) - 4}" y="${ys(17) + 24}" text-anchor="end">17×</text>
          <path class="ln thin" d="M${xs(2022) + 14} ${ys(80)} V${ys(17)} M${xs(2022) + 10} ${ys(80)} H${xs(2022) + 18} M${xs(2022) + 10} ${ys(17)} H${xs(2022) + 18}"/>
          <text class="b sm" x="${xs(2022) + 22}" y="${(ys(80) + ys(17)) / 2 + 4}">4.7×</text>
        </g>
        <g id="cur" style="opacity:0">
          <line class="ln thin dash" x1="0" x2="0" y1="${PY0}" y2="${PY1}"/>
          <circle id="dc" class="f-cmp" r="5" cx="0" cy="0" stroke="var(--stage)" stroke-width="2"/>
          <circle id="db" class="f-mem" r="5" cx="0" cy="0" stroke="var(--stage)" stroke-width="2"/>
        </g>`);
      c.legend([['cmp', 'Arithmetic throughput (FLOPS)'], ['mem', 'Memory bandwidth']]);
      const st = c.stats([
        { k: 'c', label: 'Arithmetic', value: '', cls: 'cmp' },
        { k: 'b', label: 'Memory bandwidth', value: '', cls: 'mem' },
        { k: 'g', label: 'Gap', value: '' }
      ]);
      c.note('Smooth curves between the two measured endpoints (1× in 2012, 80× and 17× in 2022). Real chips grew in steps.');
      const cur = f.q('#cur');
      function at(yr) {
        const a = grow(80, yr), b = grow(17, yr);
        c.place(cur, { x: xs(yr) });
        f.q('#dc').setAttribute('cy', ys(a)); f.q('#db').setAttribute('cy', ys(b));
        st.set('c', '×' + a.toFixed(a < 10 ? 1 : 0), 'in ' + Math.round(yr)); st.set('b', '×' + b.toFixed(b < 10 ? 1 : 0), 'in ' + Math.round(yr)); st.set('g', (a / b).toFixed(1) + '×', 'arithmetic ÷ bandwidth');
      }
      const sl = c.slider({ label: 'Year', min: 2012, max: 2022, step: 0.25, value: 2022, fmt: v => Math.round(v), onInput: at });
      at(2022);
      c.play(async () => {
        await Promise.all([c.draw(f.q('#lc'), 1700, c.ease.io), c.draw(f.q('#lb'), 1700, c.ease.io)]);
        await Promise.all([c.fx(f.q('#ends'), { o: 1 }, 400), c.fx(cur, { o: 1 }, 400)]);
      });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'forward-pass', tag: 'The model',
    title: 'One token means one trip through every weight',
    alt: 'A token vector passes through a stack of layers. For each layer the weights stream in from high-bandwidth memory until all of them have been read.',
    text: 'Your tokens become vectors that pass through dozens of layers. Each layer has its own [[weights]], stored in [[hbm|HBM]]. To produce **one** token the chip reads **all** of them: 140 GB for a 70B model at 16 bits.',
    hint: 'Switch the model size and watch the bytes read per token.',
    takeaway: 'Every forward pass reads every weight. The weights never change, so this cost repeats for every token.',
    mount(c) {
      const st = { P: 70, run: 0 };
      const LAYERS = { 7: 32, 70: 80, 405: 126 };
      const LY = i => 330 - i * 46;
      let layers = '', links = '';
      for (let i = 0; i < 6; i++) {
        layers += `<g><rect id="Lr${i}" class="box" x="30" y="${LY(i)}" width="232" height="36" rx="9"/><rect class="well" x="36" y="${LY(i) + 5}" width="108" height="26" rx="6"/><rect class="well" x="150" y="${LY(i) + 5}" width="106" height="26" rx="6"/><text class="sm" x="90" y="${LY(i) + 22}" text-anchor="middle">Attention</text><text class="sm" x="203" y="${LY(i) + 22}" text-anchor="middle">Feed-forward</text></g>`;
        links += `<path class="ln thin" d="M300 ${LY(i) + 18} H262"/><rect id="pk${i}" class="f-mem" x="-5" y="-5" width="10" height="10" rx="2" transform="translate(300 ${LY(i) + 18})" style="opacity:0"/>`;
      }
      const f = c.fig(420, 450, `
        <text id="ttl" class="b sm" x="30" y="20">One forward pass (6 of 80 layers drawn)</text>
        <g id="out" style="opacity:0"><rect class="t-data" x="106" y="30" width="78" height="28" rx="8"/><text class="b sm" x="145" y="49" text-anchor="middle">“ blue”</text></g>
        <path class="ln thin" d="M145 ${LY(5) - 4} V62" marker-end="url(#ah-ink)"/>
        ${layers}${links}
        <rect class="t-mem" x="300" y="92" width="100" height="262" rx="12"/>
        <text class="b sm" x="350" y="118" text-anchor="middle">HBM</text>
        <text class="sm" x="350" y="136" text-anchor="middle">all the weights</text>
        <text class="xs mute" x="350" y="376" text-anchor="middle">read this pass</text>
        <text id="gb" class="m b lg" x="350" y="400" text-anchor="middle">0 GB</text>
        ${['Why', ' is', ' the', ' sky'].map((w, i) => `<rect class="box" x="${30 + i * 58}" y="396" width="52" height="24" rx="7"/><text class="sm" x="${56 + i * 58}" y="412" text-anchor="middle">${w.replace(' ', ' ')}</text>`).join('')}
        <text class="xs mute" x="30" y="440">your tokens, turned into vectors</text>
        <circle id="dot" class="f-data" cx="145" cy="388" r="8" stroke="var(--stage)" stroke-width="2"/>`);
      const gb = f.q('#gb'), dot = f.q('#dot'), out = f.q('#out');
      async function run() {
        const id = ++st.run, total = st.P * 2;
        f.q('#ttl').textContent = 'One forward pass (6 of ' + LAYERS[st.P] + ' layers drawn)';
        gb.textContent = '0 GB'; out.style.opacity = 0; c.place(dot, { y: 0, o: 1 });
        for (let i = 0; i < 6; i++) f.q('#Lr' + i).setAttribute('class', 'box');
        for (let i = 0; i < 6; i++) {
          if (id !== st.run) return;
          await c.fx(dot, { y: LY(i) + 18 - 388 }, 300);
          if (id !== st.run) return;
          const lr = f.q('#Lr' + i), pk = f.q('#pk' + i);
          lr.setAttribute('class', 't-cmp'); pk.style.opacity = 1; c.place(pk, { x: 0 });
          await Promise.all([c.fx(pk, { x: -36 }, 320, c.ease.lin), c.count(gb, total * i / 6, total * (i + 1) / 6, 320, v => fmt.n(Math.round(v)) + ' GB')]);
          pk.style.opacity = 0; lr.setAttribute('class', 't-ok');
        }
        if (id !== st.run) return;
        await c.fx(dot, { y: 72 - 388 }, 340);
        await Promise.all([c.fx(dot, { o: 0 }, 260), c.fx(out, { o: 1 }, 300)]);
      }
      c.seg({ label: 'Model size', options: [[7, '7B'], [70, '70B'], [405, '405B']], value: 70, onChange: v => { st.P = v; run(); } });
      c.note('Weights at 16 bits (2 bytes each): 7B reads 14 GB per token, 70B reads 140 GB, 405B reads 810 GB.');
      c.play(run);
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'prefill-decode', tag: 'Two phases',
    title: 'Same model, two very different jobs',
    alt: 'Prefill reads the weights once and serves the whole prompt. Decode reads all the weights again for every single output token.',
    text: '[[prefill|Prefill]] reads your whole prompt in **one** pass, so one read of the weights serves thousands of tokens. [[decode|Decode]] writes the answer one token at a time, and every token pays for its own full read.',
    takeaway: 'One weight read buys 2,000 tokens in prefill and exactly 1 token in decode.',
    mount(c) {
      const BAR = 56;
      const chips = i => `<rect class="box" x="${20 + i * 38}" y="104" width="32" height="22" rx="6" id="pc${i}"/>`;
      const words = ['The', 'sky', 'is', 'blue', 'because', 'light'];
      const f = c.fig(420, 372, `
        <text class="b" x="20" y="22">Prefill: read the whole prompt at once</text>
        <rect class="well" x="20" y="36" width="${BAR}" height="22" rx="5"/>
        <rect id="pbar" class="f-mem" x="20" y="36" width="0" height="22" rx="5"/>
        <text class="m xs mute" x="${20 + BAR + 8}" y="52">1 read of 140 GB</text>
        <g id="fan" style="opacity:0">${Array.from({ length: 10 }, (_, i) => `<path class="ln thin" d="M${20 + BAR / 2} 60 L${36 + i * 38} 102"/>`).join('')}</g>
        ${Array.from({ length: 10 }, (_, i) => chips(i)).join('')}
        <text class="sm" x="20" y="146">One read serves a 2,000-token prompt</text>
        <line class="grid" x1="20" x2="400" y1="168" y2="168"/>
        <text class="b" x="20" y="196">Decode: write one token per pass</text>
        ${words.map((w, i) => `<rect class="well" x="${20 + i * 64}" y="212" width="${BAR}" height="22" rx="5"/><rect id="db${i}" class="f-mem" x="${20 + i * 64}" y="212" width="0" height="22" rx="5"/><path id="dl${i}" class="ln thin" d="M${48 + i * 64} 236 V258" style="opacity:0"/><g id="dt${i}" style="opacity:0"><rect class="t-data" x="${20 + i * 64}" y="260" width="${BAR}" height="26" rx="7"/><text class="sm b" x="${48 + i * 64}" y="278" text-anchor="middle">${w}</text></g>`).join('')}
        <text class="m xs mute" x="20" y="306">each bar = 1 read of 140 GB</text>
        <text class="sm" x="20" y="330">Every token needs its own read</text>
        <text id="cnt" class="m b sm" x="400" y="330" text-anchor="end">reads: 0</text>`);
      const st = c.stats([
        { k: 'p', label: 'Prefill: bytes moved per token', value: '70 MB', cls: 'cmp', sub: '140 GB ÷ 2,000 tokens' },
        { k: 'd', label: 'Decode: bytes moved per token', value: '140 GB', cls: 'mem', sub: '140 GB ÷ 1 token' }
      ]);
      c.play(async () => {
        await c.tween(700, p => f.q('#pbar').setAttribute('width', BAR * p));
        await c.fx(f.q('#fan'), { o: 1 }, 350);
        for (let i = 0; i < 10; i++) f.q('#pc' + i).setAttribute('class', 't-data');
        await c.wait(500);
        for (let i = 0; i < words.length; i++) {
          await c.tween(380, p => f.q('#db' + i).setAttribute('width', BAR * p), c.ease.lin);
          f.q('#dl' + i).style.opacity = 1;
          await c.fx(f.q('#dt' + i), { o: 1 }, 220);
          f.q('#cnt').textContent = 'reads: ' + (i + 1);
        }
      });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'intensity', tag: 'Two phases',
    title: 'Operations per byte decides who waits',
    alt: 'One weight is loaded once and multiplied by every token in flight. With 1 token it does 1 operation per byte, with 2,048 tokens it does 2,048.',
    text: '[[arithmetic intensity|Arithmetic intensity]] is operations per byte moved. Load a weight once, then multiply it by every token in flight. With 16-bit weights, **intensity equals the number of tokens sharing that read**. Decode has 1. Prefill has thousands.',
    hint: 'Raise the number of tokens that share one weight read and watch the marker cross the H100 ridge at 295.',
    takeaway: 'More tokens per weight read means more work per byte. Decode has the fewest tokens, so it has the least work per byte.',
    mount(c) {
      const RIDGE = ridgeOf('h100'), AX0 = 30, AX1 = 390, AY = 330;
      const ax = v => AX0 + Math.log2(v) / 12 * (AX1 - AX0);
      const f = c.fig(420, 372, `
        <rect class="t-mem" x="30" y="118" width="48" height="48" rx="8"/>
        <text class="b sm" x="54" y="108" text-anchor="middle">One weight</text>
        <text class="xs mute" x="54" y="184" text-anchor="middle">2 bytes</text>
        <g id="rays"></g>
        <g id="toks"></g>
        <text id="more" class="xs mute" x="400" y="304" text-anchor="end"></text>
        <text id="big" class="m b xl" x="210" y="268" text-anchor="middle">1 op per byte</text>
        <rect class="t-mem" x="${AX0}" y="${AY - 10}" width="${ax(RIDGE) - AX0}" height="20" rx="4" style="opacity:.55"/>
        <rect class="t-cmp" x="${ax(RIDGE)}" y="${AY - 10}" width="${AX1 - ax(RIDGE)}" height="20" rx="4" style="opacity:.55"/>
        <text class="xs b" x="${(AX0 + ax(RIDGE)) / 2}" y="${AY + 4}" text-anchor="middle">memory-bound</text>
        <text class="xs b" x="${(ax(RIDGE) + AX1) / 2}" y="${AY + 4}" text-anchor="middle">compute-bound</text>
        <path class="ln thin" d="M${ax(RIDGE)} ${AY - 16} V${AY + 16}"/>
        <text class="xs m mute" x="${ax(RIDGE)}" y="${AY + 40}" text-anchor="middle">H100 ridge: 295</text>
        ${[1, 8, 64, 512, 4096].map(v => `<text class="xs m mute" x="${ax(v)}" y="${AY - 16}" text-anchor="middle">${v}</text>`).join('')}
        <path id="mk" d="M0 12 l7 10 h-14z" class="ink-f" transform="translate(${ax(1)} ${AY})"/>`);
      const rays = f.q('#rays'), toks = f.q('#toks'), mk = f.q('#mk');
      const st = c.stats([
        { k: 'i', label: 'Operations per byte', value: '1', cls: 'cmp' },
        { k: 'z', label: 'On an H100', value: '' }
      ]);
      let cur = 1;
      function draw(k, animate) {
        const n = Math.min(k, 12), top = 163 - n * 10;
        let r = '', t = '';
        for (let i = 0; i < n; i++) {
          const y = top + i * 20 + 3;
          r += `<path class="ln s-cmp thin" d="M78 142 L330 ${y + 7}"/>`;
          t += `<rect class="t-data" x="330" y="${y}" width="40" height="14" rx="4"/>`;
        }
        rays.innerHTML = r; toks.innerHTML = t;
        f.q('#more').textContent = k === 1 ? '1 token in flight' : k > 12 ? '12 of ' + fmt.n(k) + ' tokens drawn' : k + ' tokens in flight';
        f.q('#more').setAttribute('y', top + n * 20 + 14);
        f.q('#big').textContent = fmt.n(k) + (k === 1 ? ' op per byte' : ' ops per byte');
        st.set('i', fmt.n(k)); st.set('z', k < RIDGE ? 'Memory-bound' : 'Compute-bound', k < RIDGE ? 'the chip waits for bytes' : 'the chip is busy multiplying');
        st.cls('i', 'cmp'); c.place(mk, { x: ax(k) });
        cur = k;
      }
      draw(1);
      const sl = c.slider({ label: 'Tokens sharing one read of the weights', values: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096], value: 1, fmt: v => fmt.n(v), onInput: draw });
      const row = c.row();
      c.btn('Decode: 1 token', () => sl.set(1), { small: true, into: row });
      c.btn('Prefill: 2,048 tokens', () => sl.set(2048), { small: true, into: row });
      c.note('Intensity here counts 2 operations per weight per token against 2 bytes per weight, so it equals the token count.');
      c.play(async () => {
        for (const v of [2, 8, 32, 128, 512, 2048]) { sl.set(v, true); draw(v); await c.wait(520); }
        await c.wait(500); sl.set(1, true); draw(1);
      });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'roofline', tag: 'Two phases',
    title: 'The roofline: you can only reach the lower ceiling',
    alt: 'A log-log roofline chart. Performance rises with arithmetic intensity along the memory ceiling until the ridge, then flattens at the compute ceiling. Decode sits far left, prefill sits right of the ridge.',
    text: 'A chip has two ceilings, drawn together as the [[roofline]]. The sloped one is [[bandwidth|memory bandwidth]] times intensity. The flat one is peak [[flops|compute]]. They meet at the [[ridge]]. Decode sits far left on the slope. Prefill sits right of the ridge on the flat roof.',
    hint: 'Change the chip, then slide intensity across the ridge.',
    takeaway: 'At batch size 1, decode uses under 1% of the arithmetic units while the memory bus is full.',
    mount(c) {
      const PX0 = 54, PX1 = 396, PY0 = 30, PY1 = 262, YMAX = 5000;
      const xs = v => PX0 + Math.log10(v) / 4 * (PX1 - PX0);
      const ys = v => PY1 - Math.log10(v) / Math.log10(YMAX) * (PY1 - PY0);
      const stt = { chip: 'h100', I: 1 };
      const f = c.fig(420, 322, `
        <g id="zones"></g>
        ${[1, 10, 100, 1000].map(v => `<line class="grid" x1="${PX0}" x2="${PX1}" y1="${ys(v)}" y2="${ys(v)}"/><text class="m xs mute" x="${PX0 - 7}" y="${ys(v) + 4}" text-anchor="end">${fmt.n(v)}</text>`).join('')}
        ${[1, 10, 100, 1000, 10000].map(v => `<line class="grid" x1="${xs(v)}" x2="${xs(v)}" y1="${PY0}" y2="${PY1}"/><text class="m xs mute" x="${xs(v)}" y="${PY1 + 18}" text-anchor="middle">${v >= 1000 ? v / 1000 + 'K' : v}</text>`).join('')}
        <line class="axis" x1="${PX0}" x2="${PX1}" y1="${PY1}" y2="${PY1}"/>
        <text class="sm mute" x="${PX0}" y="18">Achievable TFLOPS</text>
        <text class="sm mute" x="${(PX0 + PX1) / 2}" y="${PY1 + 40}" text-anchor="middle">Arithmetic intensity (operations per byte)</text>
        <path id="slope" class="s-mem s3" d=""/>
        <path id="roof" class="s-cmp s3" d=""/>
        <circle id="ridgeDot" class="panel-f ink-s" r="5" stroke-width="2"/>
        <text id="ridgeTxt" class="m xs b" text-anchor="middle"></text>
        <g id="dec"><circle class="f-mem" r="6" stroke="var(--stage)" stroke-width="2"/><text class="b xs" x="10" y="-9">Decode</text></g>
        <g id="pre"><circle class="f-cmp" r="6" stroke="var(--stage)" stroke-width="2"/><text class="b xs" x="0" y="-12" text-anchor="middle">Prefill</text></g>
        <g id="me"><path class="ln thin dash" d="M0 0 V0" id="meLine"/><circle r="9" class="none-f ink-s" stroke-width="2.5"/></g>`);
      c.legend([['mem', 'Memory ceiling'], ['cmp', 'Compute ceiling']]);
      const st = c.stats([
        { k: 'a', label: 'Achieved', value: '', cls: 'cmp' },
        { k: 'c', label: 'Compute units busy', value: '', cls: 'cmp' },
        { k: 'm', label: 'Memory bus busy', value: '', cls: 'mem' }
      ]);
      function draw() {
        const C = CHIPS[stt.chip], R = ridgeOf(stt.chip);
        f.q('#slope').setAttribute('d', `M${xs(1)} ${ys(C.bw)} L${xs(R)} ${ys(C.tf)}`);
        f.q('#roof').setAttribute('d', `M${xs(R)} ${ys(C.tf)} L${xs(10000)} ${ys(C.tf)}`);
        const rd = f.q('#ridgeDot'); rd.setAttribute('cx', xs(R)); rd.setAttribute('cy', ys(C.tf));
        const rt = f.q('#ridgeTxt'); rt.setAttribute('x', xs(R)); rt.setAttribute('y', ys(C.tf) - 12); rt.textContent = 'ridge ' + Math.round(R);
        f.q('#zones').innerHTML = `<rect class="t-mem" x="${PX0}" y="${PY0}" width="${xs(R) - PX0}" height="${PY1 - PY0}" style="opacity:.22;stroke:none"/><rect class="t-cmp" x="${xs(R)}" y="${PY0}" width="${PX1 - xs(R)}" height="${PY1 - PY0}" style="opacity:.2;stroke:none"/><text class="xs b" x="${PX0 + 8}" y="${PY1 - 8}">waiting on memory</text><text class="xs b" x="${PX1 - 8}" y="${PY1 - 8}" text-anchor="end">waiting on arithmetic</text>`;
        c.place(f.q('#dec'), { x: xs(1), y: ys(C.bw) });
        c.place(f.q('#pre'), { x: xs(2048), y: ys(C.tf) });
        move(stt.I);
      }
      function move(I) {
        stt.I = I;
        const C = CHIPS[stt.chip], perf = Math.min(C.bw * I, C.tf), x = xs(I), y = ys(perf);
        c.place(f.q('#me'), { x, y });
        f.q('#meLine').setAttribute('d', `M0 8 V${PY1 - y}`);
        st.set('a', fmt.n(perf, perf < 10 ? 1 : 0) + ' TFLOPS', 'of ' + fmt.n(C.tf) + ' peak');
        st.set('c', (perf / C.tf * 100).toFixed(perf / C.tf < 0.1 ? 1 : 0) + '%');
        st.set('m', Math.min(100, perf / (C.bw * I) * 100).toFixed(0) + '%');
        st.cls('c', perf / C.tf > 0.9 ? 'ok' : 'cmp');
      }
      c.seg({ label: 'Chip', options: CHIP_OPTS, value: 'h100', onChange: v => { stt.chip = v; draw(); } });
      const sl = c.slider({ label: 'Tokens sharing one weight read', values: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192], value: 1, fmt: v => fmt.n(v), onInput: move });
      c.note('Vendor peak figures, dense 16-bit. Intensity equals tokens per read for 16-bit weights.');
      draw();
      c.play(async () => {
        for (const v of [4, 16, 64, 256, 1024, 4096]) { sl.set(v, true); move(v); await c.wait(560); }
        await c.wait(400); sl.set(1, true); move(1);
      });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'ceiling', tag: 'The ceiling',
    title: 'The ceiling is bandwidth divided by bytes',
    alt: 'Two lanes show the time to move the weights and the time to do the math in one decode step. Tokens per second equals one over the longer lane.',
    text: 'One decode step moves all the weights and does the math. The longer of the two sets the step time. On one H100, 140 GB at 3.35 TB/s is **41.8 ms**, a ceiling of about **24 tokens per second** for one user. Three levers raise it: faster memory, fewer bytes per weight ([[quantization]]), or more tokens per read ([[batching]]).',
    hint: 'Try each lever: faster memory, fewer bytes, or more tokens per read.',
    takeaway: 'Faster memory and fewer bytes speed up each user. Batching raises total output but not the speed any one user sees.',
    mount(c) {
      const stt = { chip: 'h100', n: 1, P: 70, bytes: 2, batch: 1 };
      const LW = 380;
      const f = c.fig(420, 210, `
        <text class="b md" x="20" y="24">One decode step</text>
        <text class="b sm" x="20" y="58">Memory: move the weights</text>
        <text id="tm" class="m sm" x="400" y="58" text-anchor="end"></text>
        <rect class="well" x="20" y="66" width="${LW}" height="22" rx="6"/>
        <rect id="bm" class="f-mem" x="20" y="66" width="0" height="22" rx="6"/>
        <text class="b sm" x="20" y="120">Compute: do the math</text>
        <text id="tc" class="m sm" x="400" y="120" text-anchor="end"></text>
        <rect class="well" x="20" y="128" width="${LW}" height="22" rx="6"/>
        <rect id="bc" class="f-cmp" x="20" y="128" width="0" height="22" rx="6"/>
        <text id="verdict" class="sm b" x="20" y="184"></text>`);
      const st = c.stats([
        { k: 'u', label: 'Per user', value: '', cls: 'mem' },
        { k: 'w', label: 'Whole chip (all users)', value: '', cls: 'data' },
        { k: 't', label: 'Step time', value: '' }
      ]);
      const warn = c.html('<p class="warnline" style="display:none"></p>').q('p');
      let run = 0;
      function update(animate) {
        const r = step({ P: stt.P, bytes: stt.bytes, chip: stt.chip, n: stt.n, batch: stt.batch });
        const wm = LW * r.tMem / r.t, wc = Math.max(2, LW * r.tCmp / r.t);
        const bm = f.q('#bm'), bc = f.q('#bc');
        f.q('#tm').textContent = fmt.ms(r.tMem); f.q('#tc').textContent = fmt.ms(r.tCmp, 2);
        f.q('#verdict').textContent = r.bound === 'memory' ? 'Step time = the memory lane. The chip waits for weights.' : 'Step time = the compute lane. The chip is busy multiplying.';
        if (animate) {
          const id = ++run, a = +bm.getAttribute('width'), b = +bc.getAttribute('width');
          c.tween(450, p => { if (id !== run) return; bm.setAttribute('width', a + (wm - a) * p); bc.setAttribute('width', b + (wc - b) * p); });
        } else { bm.setAttribute('width', wm); bc.setAttribute('width', wc); }
        st.set('u', fmt.n(r.perUser, r.perUser < 100 ? 1 : 0) + ' tok/s'); st.set('w', fmt.n(r.total, r.total < 100 ? 1 : 0) + ' tok/s'); st.set('t', fmt.ms(r.t), r.bound + '-bound');
        st.cls('t', r.bound === 'memory' ? 'mem' : 'cmp');
        warn.style.display = r.fits ? 'none' : 'flex';
        warn.textContent = r.fits ? '' : 'Thought experiment: ' + fmt.n(r.W / 1e9) + ' GB of weights do not fit in ' + r.cap + ' GB. Real setups add chips, which also adds bandwidth.';
      }
      c.ctrl.append(c.h('p', { class: 'kicker', text: 'Lever 1: faster memory' }));
      c.seg({ label: 'Chip', options: CHIP_OPTS, value: 'h100', onChange: v => { stt.chip = v; update(true); } });
      c.seg({ label: 'Chips sharing the model', options: [[1, '1'], [2, '2'], [4, '4'], [8, '8']], value: 1, onChange: v => { stt.n = +v; update(true); } });
      c.ctrl.append(c.h('p', { class: 'kicker', text: 'Lever 2: fewer bytes' }));
      c.seg({ label: 'Bits per weight', options: [[2, '16-bit'], [1, '8-bit'], [0.5, '4-bit']], value: 2, onChange: v => { stt.bytes = +v; update(true); } });
      c.slider({ label: 'Model size (billions of weights)', values: [7, 13, 34, 70, 180, 405], value: 70, fmt: v => v + 'B', onInput: v => { stt.P = v; update(true); } });
      c.ctrl.append(c.h('p', { class: 'kicker', text: 'Lever 3: more tokens per read' }));
      c.slider({ label: 'Requests batched together', values: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512], value: 1, fmt: v => fmt.n(v), onInput: v => { stt.batch = v; update(true); } });
      c.note('Weight-only quantization: bytes shrink, arithmetic stays 16-bit. This scene ignores the KV cache (next scenes).');
      update(false);
      c.play(async () => {
        const wm = +f.q('#bm').getAttribute('width'), wc = +f.q('#bc').getAttribute('width');
        f.q('#bm').setAttribute('width', 0); f.q('#bc').setAttribute('width', 0);
        await c.tween(1200, p => { f.q('#bm').setAttribute('width', wm * p); f.q('#bc').setAttribute('width', wc * p); });
      });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'kv-why', tag: 'The cache',
    title: 'Why the model saves its work',
    alt: 'Two grids. Without a cache each step recomputes keys and values for every earlier token, filling a triangle. With a cache each step computes one new entry and reuses the rest.',
    text: 'Attention needs the keys and values of every earlier token, and those never change once computed. So the model saves them in the [[kv cache|KV cache]]. Without it, each new token would redo all earlier work, and the total would grow with the **square** of the length.',
    hint: 'Change the answer length and compare the two counts.',
    takeaway: 'Saving keys and values turns quadratic work into linear work. The price is memory.',
    mount(c) {
      const GX = [30, 226], GY = 76, GS = 164;
      let N = 8, run = 0;
      const f = c.fig(420, 290, `
        <text class="b sm" x="${GX[0]}" y="22">No cache</text><text class="xs mute" x="${GX[0]}" y="40">redo every earlier token</text>
        <text class="b sm" x="${GX[1]}" y="22">With a cache</text><text class="xs mute" x="${GX[1]}" y="40">compute one, reuse the rest</text>
        <rect class="well" x="${GX[0]}" y="${GY}" width="${GS}" height="${GS}" rx="6"/>
        <rect class="well" x="${GX[1]}" y="${GY}" width="${GS}" height="${GS}" rx="6"/>
        <g id="gl"></g><g id="gr"></g>
        <text class="xs mute" x="${GX[0]}" y="${GY - 6}">each row = one step, each cell = one token’s keys and values</text>
        <text id="nl" class="m b md" x="${GX[0]}" y="${GY + GS + 28}">0</text>
        <text id="nr" class="m b md" x="${GX[1]}" y="${GY + GS + 28}">0</text>
        <text class="xs mute" x="${GX[0]}" y="${GY + GS + 44}">cells computed</text>
        <text class="xs mute" x="${GX[1]}" y="${GY + GS + 44}">cells computed</text>`);
      c.legend([['cmp', 'Computed this step'], ['mem', 'Read from the cache']]);
      c.stats([
        { k: 'a', label: 'At 1,000 tokens: no cache', value: '500,500', cls: 'cmp', sub: '1,000 × 1,001 ÷ 2' },
        { k: 'b', label: 'At 1,000 tokens: with cache', value: '1,000', cls: 'mem', sub: 'one per token' }
      ]);
      function build() {
        const cs = GS / N, ids = ['gl', 'gr'];
        let L = '', R = '';
        for (let t = 0; t < N; t++) {
          let l = '', r = '';
          for (let j = 0; j <= t; j++) {
            const x = GX[0] + j * cs, x2 = GX[1] + j * cs, y = GY + t * cs;
            l += `<rect class="f-cmp" x="${x + 0.5}" y="${y + 0.5}" width="${cs - 1}" height="${cs - 1}" rx="${Math.min(2, cs / 4)}"/>`;
            r += `<rect class="${j === t ? 'f-cmp' : 'f-mem'}" x="${x2 + 0.5}" y="${y + 0.5}" width="${cs - 1}" height="${cs - 1}" rx="${Math.min(2, cs / 4)}"/>`;
          }
          L += `<g id="rl${t}" style="opacity:0">${l}</g>`; R += `<g id="rr${t}" style="opacity:0">${r}</g>`;
        }
        f.q('#gl').innerHTML = L; f.q('#gr').innerHTML = R;
      }
      async function play() {
        const id = ++run; build();
        f.q('#nl').textContent = '0'; f.q('#nr').textContent = '0';
        for (let t = 0; t < N; t++) {
          if (id !== run) return;
          f.q('#rl' + t).style.opacity = 1; f.q('#rr' + t).style.opacity = 1;
          f.q('#nl').textContent = fmt.n((t + 1) * (t + 2) / 2); f.q('#nr').textContent = fmt.n(t + 1);
          await c.wait(Math.max(110, 2200 / N));
        }
      }
      c.slider({ label: 'Answer length (tokens)', values: [4, 8, 12, 16, 24], value: 8, fmt: v => v, onInput: v => { N = v; play(); } });
      c.play(play);
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'kv-cost', tag: 'The cache',
    title: 'The cache joins the weights on the memory bus',
    alt: 'A stacked bar of bytes read per token: 140 gigabytes of weights plus a KV cache that grows with conversation length. A second bar shows the token rate ceiling falling as the cache grows.',
    text: 'The cache sits in [[hbm|HBM]] next to the weights, and decode reads **both** for every token. A 70B model with [[gqa|grouped-query attention]] stores about **320 KB per token**. A longer conversation means more bytes per token and a lower ceiling.',
    hint: 'Lengthen the conversation, then switch to full multi-head attention to see why GQA exists.',
    takeaway: 'Long contexts slow every token, because the whole cache is read again next to the weights.',
    mount(c) {
      const BW = 3.35e12, W = 140e9, PER = { gqa: 327680, mha: 2621440 };
      const stt = { ctx: 10000, kind: 'gqa' };
      const X0 = 20, WID = 380, MAXB = 500e9;
      const f = c.fig(420, 250, `
        <text class="b sm" x="20" y="22">Bytes read for one token</text>
        <rect class="well" x="${X0}" y="32" width="${WID}" height="30" rx="7"/>
        <rect id="bw" class="f-mem" x="${X0}" y="32" width="${WID * W / MAXB}" height="30" rx="7"/>
        <rect id="bk" class="f-data" x="${X0 + WID * W / MAXB}" y="32" width="0" height="30" rx="4"/>
        ${[0, 100, 200, 300, 400, 500].map(v => `<text class="m xs mute" x="${X0 + WID * v / 500}" y="82" text-anchor="middle">${v}</text>`).join('')}
        <text class="xs mute" x="400" y="98" text-anchor="end">GB</text>
        <text class="m xs b" x="${X0 + 8}" y="52" style="fill:var(--on-mem)">weights 140 GB</text>
        <text class="b sm" x="20" y="136">Fastest possible token rate (3.35 TB/s)</text>
        <rect class="well" x="${X0}" y="146" width="${WID}" height="30" rx="7"/>
        <rect id="br" class="f-mem" x="${X0}" y="146" width="0" height="30" rx="7"/>
        <text id="rt" class="m b sm" x="${X0 + 10}" y="166" style="fill:var(--on-mem)"></text>
        ${[0, 5, 10, 15, 20, 25].map(v => `<text class="m xs mute" x="${X0 + WID * v / 25}" y="196" text-anchor="middle">${v}</text>`).join('')}
        <text class="xs mute" x="400" y="212" text-anchor="end">tokens per second</text>`);
      c.legend([['mem', 'Weights'], ['data', 'KV cache']]);
      const st = c.stats([
        { k: 'kv', label: 'KV cache size', value: '', cls: 'data' },
        { k: 'by', label: 'Bytes per token', value: '', cls: 'mem' },
        { k: 'tr', label: 'Ceiling vs empty context', value: '', cls: 'cmp' }
      ]);
      function update() {
        const kv = stt.ctx * PER[stt.kind], tot = W + kv, rate = BW / tot, base = BW / W;
        const kvw = WID * kv / MAXB;
        f.q('#bk').setAttribute('width', kvw); f.q('#br').setAttribute('width', WID * rate / 25);
        f.q('#rt').textContent = rate.toFixed(1) + ' tok/s';
        st.set('kv', fmt.bytes(kv, kv < 1e9 ? 0 : 1), fmt.n(PER[stt.kind] / 1024) + ' KB per token'); st.set('by', fmt.bytes(tot, 1)); st.set('tr', (rate / base * 100 - 100).toFixed(0) + '%', rate.toFixed(1) + ' vs ' + base.toFixed(1) + ' tok/s');
      }
      c.seg({ label: 'Attention type', options: [['gqa', 'GQA: 8 KV heads'], ['mha', 'Full: 64 KV heads']], value: 'gqa', onChange: v => { stt.kind = v; update(); } });
      c.slider({ label: 'Conversation length', values: [0, 1000, 4000, 10000, 32000, 100000, 128000], value: 10000, fmt: v => fmt.n(v) + ' tokens', onInput: v => { stt.ctx = v; update(); } });
      c.note('KV bytes per token = 2 × 80 layers × KV heads × 128 × 2 bytes. Llama 3 70B uses 8 KV heads. Single-chip thought experiment, as before.');
      update();
      c.play(async () => {
        const seq = [0, 4000, 32000, 128000, 10000];
        for (const v of seq) { stt.ctx = v; update(); await c.wait(650); }
      });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'user-latency', tag: 'What you feel',
    title: 'The wait, then the stream',
    alt: 'A request timeline. A pause while the prompt is read, then tokens arrive one every 30 milliseconds. The pause grows with prompt length. The gap between tokens does not.',
    text: 'You feel two numbers. [[ttft|Time to first token]] is the pause while prefill reads your prompt. [[tpot|Time per output token]] is the gap between streamed tokens while decode runs. Prefill sets the first. Decode sets the second.',
    hint: 'Send a short and a very long prompt. Only one of the two numbers moves.',
    takeaway: 'Long prompts lengthen the pause and leave the stream speed unchanged. Prefill is compute-bound, decode is bandwidth-bound.',
    mount(c) {
      const stt = { prompt: 1000, ans: 60, sending: false, run: 0 };
      const PREFILL = 8000, TPOT = 30;
      const f = c.fig(420, 300, `
        <text class="b sm" x="20" y="22">Your request</text>
        <text id="state" class="m xs mute" x="400" y="22" text-anchor="end">idle</text>
        <rect class="box" x="20" y="34" width="380" height="40" rx="10"/>
        <text id="ptxt" class="sm" x="34" y="59">Prompt: 1,000 tokens</text>
        <text class="b sm" x="20" y="102">Streaming answer</text>
        <g id="grid"></g>
        <text class="b sm" x="20" y="226">Timeline</text>
        <rect class="well" x="20" y="236" width="380" height="20" rx="6"/>
        <rect id="tf" class="f-cmp" x="20" y="236" width="0" height="20" rx="6"/>
        <rect id="td" class="f-mem" x="20" y="236" width="0" height="20" rx="0"/>
        <text id="tfl" class="m xs b" x="20" y="274">TTFT</text>
        <text id="tdl" class="m xs b" x="400" y="274" text-anchor="end">decode</text>
        <text id="clk" class="m b md" x="400" y="102" text-anchor="end">0.00 s</text>`);
      c.legend([['cmp', 'Prefill (TTFT)'], ['mem', 'Decode (TPOT each)'], ['data', 'One token']]);
      const st = c.stats([
        { k: 'tt', label: 'TTFT', value: '', cls: 'cmp' },
        { k: 'tp', label: 'TPOT', value: '30 ms', cls: 'mem', sub: 'about 33 tokens/s' },
        { k: 'to', label: 'Whole answer', value: '' }
      ]);
      function nums() {
        const ttft = 50 + stt.prompt / PREFILL * 1000, total = ttft + stt.ans * TPOT;
        st.set('tt', fmt.ms(ttft, 2)); st.set('to', fmt.ms(total, 1));
        f.q('#ptxt').textContent = 'Prompt: ' + fmt.n(stt.prompt) + ' tokens';
        return { ttft, total };
      }
      function layout() {
        const { ttft, total } = nums(), w1 = 380 * ttft / total;
        f.q('#tf').setAttribute('width', w1); f.q('#td').setAttribute('x', 20 + w1); f.q('#td').setAttribute('width', 380 - w1);
        f.q('#tfl').textContent = 'TTFT ' + fmt.ms(ttft, 2);
        f.q('#tdl').textContent = stt.ans + ' tokens × 30 ms';
        const cols = stt.ans <= 60 ? 15 : 25, cell = 380 / cols, rows = Math.ceil(stt.ans / cols), size = Math.min(cell - 3, 13);
        let g = '';
        for (let i = 0; i < stt.ans; i++) g += `<rect id="k${i}" class="t-data" x="${20 + (i % cols) * cell}" y="${112 + Math.floor(i / cols) * (size + 3)}" width="${size}" height="${size}" rx="3" style="opacity:.12"/>`;
        f.q('#grid').innerHTML = g;
        return { ttft, total };
      }
      async function send() {
        if (stt.sending) return; stt.sending = true; const id = ++stt.run;
        const { ttft, total } = layout();
        const scale = Math.min(1, 4800 / total), clk = f.q('#clk');
        f.q('#state').textContent = 'reading the prompt (prefill)';
        await c.tween(ttft * scale, p => { clk.textContent = (p * ttft / 1000).toFixed(2) + ' s'; }, c.ease.lin);
        if (id !== stt.run) return;
        f.q('#state').textContent = 'streaming (decode)';
        for (let i = 0; i < stt.ans; i++) {
          f.q('#k' + i).style.opacity = 1; f.q('#k' + i).setAttribute('class', 'f-data');
          clk.textContent = ((ttft + (i + 1) * TPOT) / 1000).toFixed(2) + ' s';
          await c.wait(TPOT * scale);
          if (id !== stt.run) return;
        }
        f.q('#state').textContent = 'done' + (scale < 1 ? ' (shown at ' + scale.toFixed(2) + '× speed)' : '');
        stt.sending = false;
      }
      c.slider({ label: 'Prompt length (tokens)', values: [200, 1000, 4000, 16000, 64000], value: 1000, fmt: v => fmt.n(v), onInput: v => { stt.run++; stt.sending = false; stt.prompt = v; layout(); f.q('#clk').textContent = '0.00 s'; f.q('#state').textContent = 'idle'; } });
      c.slider({ label: 'Answer length (tokens)', values: [20, 60, 120, 200], value: 60, fmt: v => v, onInput: v => { stt.run++; stt.sending = false; stt.ans = v; layout(); f.q('#clk').textContent = '0.00 s'; f.q('#state').textContent = 'idle'; } });
      c.btn('Send request', () => { stt.run++; stt.sending = false; send(); }, { kind: 'pri' });
      c.note('Toy numbers: prefill reads 8,000 prompt tokens per second, decode writes one token every 30 ms. Real values depend on the model and the chips.');
      layout();
      c.play(send);
    }
  });

  /* 13 --------------------------------------------------------------- */
  S.push({
    id: 'goodput', tag: 'What you feel',
    title: 'Throughput can rise while useful work falls',
    alt: 'A chart of requests per second against load. Throughput rises to the server capacity. Goodput, the share that met the latency target, peaks earlier and then collapses toward zero.',
    text: 'Operators sell tokens, so they track [[throughput]]. But a token that arrives after the user gave up is worth nothing. [[goodput]] counts only requests that met their latency target. Load a server past its capacity and throughput holds while goodput collapses.',
    hint: 'Raise the load past the peak. Then tighten the latency target.',
    takeaway: 'Run the server where goodput peaks, not where raw throughput peaks.',
    mount(c) {
      const MU = 10, PX0 = 46, PX1 = 396, PY0 = 28, PY1 = 252, XM = 12, YM = 12;
      const xs = v => PX0 + v / XM * (PX1 - PX0), ys = v => PY1 - v / YM * (PY1 - PY0);
      const stt = { lam: 6, T: 1 };
      const good = (l, T) => l >= MU ? 0 : l * (1 - Math.exp(-(MU - l) * T));
      const thr = l => Math.min(l, MU);
      const path = fn => { let d = ''; for (let l = 0; l <= XM + 1e-6; l += 0.1) d += (d ? 'L' : 'M') + xs(l).toFixed(1) + ' ' + ys(fn(l)).toFixed(1); return d; };
      const f = c.fig(420, 312, `
        ${[0, 4, 8, 12].map(v => `<line class="grid" x1="${PX0}" x2="${PX1}" y1="${ys(v)}" y2="${ys(v)}"/><text class="m xs mute" x="${PX0 - 7}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        ${[0, 2, 4, 6, 8, 10, 12].map(v => `<text class="m xs mute" x="${xs(v)}" y="${PY1 + 18}" text-anchor="middle">${v}</text>`).join('')}
        <line class="axis" x1="${PX0}" x2="${PX1}" y1="${PY1}" y2="${PY1}"/>
        <text class="sm mute" x="${PX0}" y="16">Requests per second served</text>
        <text class="sm mute" x="${(PX0 + PX1) / 2}" y="${PY1 + 42}" text-anchor="middle">Load: requests per second arriving</text>
        <path class="ln thin dash" d="M${xs(MU)} ${PY0} V${PY1}"/>
        <text class="xs b" x="${xs(MU) + 5}" y="${PY0 + 12}">capacity</text>
        <path id="thr" class="s-mem s3" d="${path(thr)}"/>
        <path id="gd" class="s-data s3" d=""/>
        <g id="pk"><circle class="none-f ink-s" r="6" stroke-width="2"/><text class="xs b" y="24" text-anchor="middle">best load</text></g>
        <g id="me"><path id="mel" class="ln thin dash" d=""/><circle id="m1" class="f-mem" r="5" stroke="var(--stage)" stroke-width="2"/><circle id="m2" class="f-data" r="5" stroke="var(--stage)" stroke-width="2"/></g>`);
      c.legend([['mem', 'Throughput (everything served)'], ['data', 'Goodput (served on time)']]);
      const st = c.stats([
        { k: 't', label: 'Throughput', value: '', cls: 'mem' },
        { k: 'g', label: 'Goodput', value: '', cls: 'data' },
        { k: 'p', label: 'Served on time', value: '' }
      ]);
      function best(T) { let bl = 0, bg = 0; for (let l = 0; l < MU; l += 0.05) { const g = good(l, T); if (g > bg) { bg = g; bl = l; } } return [bl, bg]; }
      function draw() {
        f.q('#gd').setAttribute('d', path(l => good(l, stt.T)));
        const [bl, bg] = best(stt.T); c.place(f.q('#pk'), { x: xs(bl), y: ys(bg) });
        mv(stt.lam);
      }
      function mv(l) {
        stt.lam = l; const t = thr(l), g = good(l, stt.T);
        f.q('#m1').setAttribute('cx', xs(l)); f.q('#m1').setAttribute('cy', ys(t)); f.q('#m2').setAttribute('cx', xs(l)); f.q('#m2').setAttribute('cy', ys(g));
        f.q('#mel').setAttribute('d', `M${xs(l)} ${ys(t)} V${PY1}`);
        st.set('t', t.toFixed(1) + ' req/s'); st.set('g', g.toFixed(1) + ' req/s'); st.set('p', t > 0 ? (g / t * 100).toFixed(0) + '%' : '0%', g / t < 0.5 ? 'most users gave up' : '');
        st.cls('p', g / t < 0.5 ? 'bad' : g / t < 0.9 ? '' : 'ok');
      }
      const lamS = c.slider({ label: 'Load (requests per second)', min: 0.5, max: 12, step: 0.1, value: 6, fmt: v => v.toFixed(1), onInput: mv });
      c.slider({ label: 'Time-to-first-token target', values: [0.5, 1, 2, 4], value: 1, fmt: v => v + ' s', onInput: v => { stt.T = v; draw(); } });
      c.note('Toy model: one server, random arrivals, waiting time only (an M/M/1 queue, 10 requests per second capacity). Real servers batch requests, but the shape holds.');
      draw();
      c.play(async () => {
        await c.draw(f.q('#thr'), 900); await c.draw(f.q('#gd'), 900);
        for (const v of [3, 8, 9.5, 6]) { lamS.set(v, true); mv(v); await c.wait(750); }
      });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'recap', tag: 'Recap',
    title: 'Where the 30 ms goes',
    alt: 'Five facts that explain token time, followed by the topics coming next in the series.',
    text: 'Token time is the time to move bytes, not the time to do math. Five facts carry the whole lesson.',
    takeaway: 'time per token ≈ bytes read ÷ memory bandwidth',
    mount(c) {
      const facts = [
        ['Arithmetic is cheap. Moving data is expensive.', 'Compute grew 80× in a decade, bandwidth 17×.'],
        ['Prefill is compute-bound. Decode is memory-bound.', 'On an H100, decode runs about 300× below the ridge.'],
        ['One token reads every weight.', '140 GB ÷ 3.35 TB/s ≈ 42 ms, or about 24 tokens per second.'],
        ['The KV cache adds bytes as the conversation grows.', '320 KB per token for a 70B model with GQA.'],
        ['Users feel TTFT and TPOT. Operators optimize goodput.', 'Tokens that miss the latency target count for nothing.']
      ];
      const h = c.html(`<ol class="recap">${facts.map((r, i) => `<li style="opacity:.18"><span class="n">${i + 1}</span><div><b>${r[0]}</b><small>${r[1]}</small></div></li>`).join('')}</ol>
        <p class="kicker" style="margin:14px 0 6px">Next in the series</p>
        <div class="nextchips">${['Accelerator hardware', 'The code that runs on it', 'Quantization', 'Splitting models across chips', 'Mixture of experts', 'Serving at scale', 'Speculative decoding', 'One request, end to end'].map(t => `<span class="chip">${t}</span>`).join('')}</div>`, 'recapwrap');
      c.play(async () => {
        for (const li of h.qa('li')) { await c.fx(li, { o: 1 }, 450); await c.wait(500); }
      });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Six questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'At batch size 1, what limits how fast a 70B model produces tokens?', o: ['The speed of arithmetic', 'Memory bandwidth: every weight must be read for each token', 'Network latency to the user', 'The size of the vocabulary'], a: 1, why: 'Decode does about 1 operation per byte moved, far below the roofline ridge, so the memory bus is the limit.' },
      { q: 'Which phase of a request is compute-bound?', o: ['Prefill', 'Decode', 'Both equally', 'Neither'], a: 0, why: 'Prefill processes the whole prompt in one pass, so each weight is reused thousands of times. That puts it right of the ridge.' },
      { q: 'A 140 GB model on a chip with 3.35 TB/s of bandwidth. About how many tokens per second can one user get at best?', o: ['About 3', 'About 24', 'About 240', 'About 2,400'], a: 1, why: '3.35 TB/s divided by 140 GB per token is about 24 tokens per second, a hard physical ceiling for one stream.' },
      { q: 'What happens to the KV cache as a conversation gets longer?', o: ['It stays the same size', 'It shrinks as old tokens are forgotten', 'It grows, and must be read on every token', 'It moves to the CPU automatically'], a: 2, why: 'The cache holds keys and values for every token so far. Decode reads all of it each step, next to the weights.' },
      { q: 'Which change raises total throughput without changing the chip?', o: ['Batching more requests per weight read', 'Using a longer prompt', 'Turning off the KV cache', 'Sending requests more slowly'], a: 0, why: 'More tokens per weight read means more work per byte. Per-user speed stays about the same, but the chip serves more users.' },
      { q: 'What does goodput count?', o: ['All tokens produced per second', 'Only requests that met their latency target', 'Only the tokens in the prompt', 'The peak value of throughput'], a: 1, why: 'A token that arrives after the user gave up is wasted. Goodput filters throughput by the latency promise.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><rect x="24" y="66" width="272" height="26" rx="8" style="fill:var(--mem-soft);stroke:var(--mem);stroke-width:1.5"/><rect x="24" y="66" width="3" height="26" rx="1.5" style="fill:var(--cmp)"/><g class="slide"><rect x="34" y="72" width="14" height="14" rx="3" style="fill:var(--mem)"/></g><text x="24" y="54" style="font:600 11px var(--font-mono);fill:var(--ink-3)">one token: 30 ms</text><text x="24" y="114" style="font:600 11px var(--font-mono);fill:var(--ink-3)">math: 0.1 ms</text></svg>';

  window.LESSONS.push({
    id: 'inference', n: 4,
    title: 'Why a Token Takes 30 ms',
    tagline: 'Compute, memory bandwidth, and the two phases behind every LLM request.',
    preview,
    scenes: S
  });
})();
