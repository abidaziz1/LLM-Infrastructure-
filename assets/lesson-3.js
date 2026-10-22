/* Lesson 3: Prompt caching */
(function () {
  'use strict';
  const { fmt } = window.LLMI;
  const CHK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const REDO = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/></svg>';
  const LABEL = { hit: 'cached', miss: 'recompute', fix: 'reused, small repair' };
  /* Prompt segments as rows. s.t = tokens. Rows from index `miss` onward are recomputed unless s.state forces a state. */
  function rows(segs, miss) {
    const max = Math.max.apply(null, segs.map(s => s.t));
    return '<div class="stackrows">' + segs.map((s, i) => {
      const st = s.state || (i < miss ? 'hit' : 'miss');
      return `<div class="prow ${st}${s.off ? ' off' : ''}"><span class="bar" style="width:${Math.max(6, s.t / max * 100)}%"></span><span class="ic">${st === 'miss' ? REDO : CHK}</span><span><b>${s.n}</b><small>${fmt.n(s.t)} tokens</small></span><span class="st">${LABEL[st]}</span></div>`;
    }).join('') + '</div>';
  }
  const hitTokens = (segs, miss) => segs.reduce((a, s, i) => a + ((s.state === 'hit' || s.state === 'fix' || (!s.state && i < miss)) && !s.off ? s.t : 0), 0);

  const S = [];

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'tax', tag: 'The bill',
    title: 'You pay for the same prompt every turn',
    alt: 'Two cumulative cost lines over 50 turns. Without caching the cost grows by 2.4 cents a turn to $1.20. With caching it grows by 0.24 cents a turn after one write, ending near 15 cents.',
    text: 'A coding agent resends an **8,000-token** system prompt on every turn. At $3 per million input tokens that costs **2.4 cents** each time, so 50 turns cost **$1.20** before any new work. [[prompt caching|Caching]] makes the repeat a one-time payment.',
    hint: 'Drag the turn count and compare the two lines.',
    takeaway: 'Most of your input bill is the same prompt processed again. Caching pays for it once.',
    mount(c) {
      const PX0 = 50, PX1 = 392, PY0 = 28, PY1 = 236, YM = 1.3;
      const unit = 8000 * 3 / 1e6;
      const none = n => n * unit, cached = n => n < 1 ? 0 : unit * 1.25 + (n - 1) * unit * 0.1;
      const xs = n => PX0 + n / 50 * (PX1 - PX0), ys = v => PY1 - v / YM * (PY1 - PY0);
      const path = fn => { let d = ''; for (let n = 0; n <= 50; n++) d += (d ? 'L' : 'M') + xs(n).toFixed(1) + ' ' + ys(fn(n)).toFixed(1); return d; };
      const f = c.fig(420, 280, `
        ${[0, 0.4, 0.8, 1.2].map(v => `<line class="grid" x1="${PX0}" x2="${PX1}" y1="${ys(v)}" y2="${ys(v)}"/><text class="m xs mute" x="${PX0 - 7}" y="${ys(v) + 4}" text-anchor="end">$${v.toFixed(2)}</text>`).join('')}
        ${[0, 10, 20, 30, 40, 50].map(n => `<text class="m xs mute" x="${xs(n)}" y="${PY1 + 18}" text-anchor="middle">${n}</text>`).join('')}
        <line class="axis" x1="${PX0}" x2="${PX1}" y1="${PY1}" y2="${PY1}"/>
        <text class="sm mute" x="${PX0}" y="16">Total input cost so far</text>
        <text class="sm mute" x="${(PX0 + PX1) / 2}" y="${PY1 + 40}" text-anchor="middle">Turns in the session</text>
        <path id="ln" class="s-cmp s3" d="${path(none)}"/>
        <path id="lc" class="s-data s3" d="${path(cached)}"/>
        <g id="cur" style="opacity:0"><path id="cl" class="ln thin dash" d=""/><circle id="d1" class="f-cmp" r="5" stroke="var(--stage)" stroke-width="2"/><circle id="d2" class="f-data" r="5" stroke="var(--stage)" stroke-width="2"/></g>`);
      c.legend([['cmp', 'No caching'], ['data', 'With caching']]);
      const st = c.stats([
        { k: 'a', label: 'Without caching', value: '', cls: 'cmp' },
        { k: 'b', label: 'With caching', value: '', cls: 'data', sub: '25% extra on the first write' },
        { k: 'c', label: 'Saved', value: '' }
      ]);
      function at(n) {
        const a = none(n), b = cached(n);
        f.q('#d1').setAttribute('cx', xs(n)); f.q('#d1').setAttribute('cy', ys(a)); f.q('#d2').setAttribute('cx', xs(n)); f.q('#d2').setAttribute('cy', ys(b));
        f.q('#cl').setAttribute('d', `M${xs(n)} ${ys(a)} V${PY1}`);
        st.set('a', fmt.usd(a)); st.set('b', fmt.usd(b)); st.set('c', Math.round((1 - b / a) * 100) + '%', 'after ' + n + (n === 1 ? ' turn' : ' turns'));
      }
      const sl = c.slider({ label: 'Turns so far', min: 1, max: 50, step: 1, value: 50, fmt: v => v, onInput: at });
      at(50);
      c.play(async () => {
        await Promise.all([c.draw(f.q('#ln'), 1100), c.draw(f.q('#lc'), 1100)]);
        f.q('#cur').style.opacity = 1;
        await c.tween(1800, p => { const n = Math.max(1, Math.round(p * 50)); sl.set(n, true); at(n); }, c.ease.io);
      });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'phases', tag: 'Two phases',
    title: 'A request has two phases with opposite limits',
    alt: 'Prefill keeps the arithmetic units busy while the memory bus is mostly idle. Decode keeps the memory bus busy while the arithmetic units are almost idle.',
    text: '[[prefill|Prefill]] reads the whole prompt at once. Every token looks at every earlier token, so arithmetic is the limit and [[attention]] work grows with the **square** of the prompt length. [[decode|Decode]] writes one token at a time and re-reads the weights each step, so memory is the limit.',
    takeaway: 'Prefill sets time to first token. Caching skips prefill work for the part of the prompt it has already seen.',
    mount(c) {
      const cols = [{ x: 20, t: 'Prefill', s: 'all tokens at once', cmp: 100, mem: 15, note: 'Sets time to first token' }, { x: 218, t: 'Decode', s: 'one token per step', cmp: 0.3, mem: 100, note: 'Sets time per output token' }];
      let inner = '';
      cols.forEach((k, j) => {
        inner += `<text class="b md" x="${k.x}" y="22">${k.t}</text><text class="xs mute" x="${k.x}" y="40">${k.s}</text>`;
        for (let i = 0; i < 8; i++) inner += `<rect id="t${j}_${i}" class="box" x="${k.x + i * 22}" y="50" width="18" height="16" rx="4"/>`;
        [['Compute', 0, 'cmp'], ['Memory bus', 1, 'mem']].forEach(([lab, m, role]) => {
          const mx = k.x + 14 + m * 88;
          inner += `<rect class="well" x="${mx}" y="88" width="62" height="124" rx="8"/><rect id="m${j}_${m}" class="f-${role}" x="${mx}" y="212" width="62" height="0" rx="8"/><text class="xs b" x="${mx + 31}" y="232" text-anchor="middle">${lab}</text><text id="v${j}_${m}" class="m sm" x="${mx + 31}" y="250" text-anchor="middle">0%</text>`;
        });
        inner += `<text class="b sm" x="${k.x}" y="284">${k.note}</text>`;
      });
      const f = c.fig(420, 296, inner);
      c.legend([['cmp', 'Arithmetic units busy'], ['mem', 'Memory bus busy']]);
      const set = (j, m, pct, p) => { const h = Math.max(pct > 0 ? 2 : 0, 124 * pct / 100 * p); f.q(`#m${j}_${m}`).setAttribute('height', h); f.q(`#m${j}_${m}`).setAttribute('y', 212 - h); f.q(`#v${j}_${m}`).textContent = (pct * p < 1 ? (pct * p).toFixed(1) : Math.round(pct * p)) + '%'; };
      c.play(async () => {
        for (let i = 0; i < 8; i++) f.q('#t0_' + i).setAttribute('class', 't-data');
        await Promise.all([c.tween(1100, p => set(0, 0, 100, p)), c.tween(1100, p => set(0, 1, 15, p))]);
        await c.wait(500);
        for (let i = 0; i < 8; i++) { f.q('#t1_' + i).setAttribute('class', 't-data'); await c.wait(150); }
        await Promise.all([c.tween(900, p => set(1, 0, 0.3, p)), c.tween(900, p => set(1, 1, 100, p))]);
      });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'anatomy', tag: 'The repeat',
    title: 'Each request repeats the last one almost word for word',
    alt: 'Two stacked bars of prompt segments. The second request is the first plus a small new piece. Everything else is identical.',
    text: 'A production prompt carries a long system prompt, tool definitions and the whole conversation so far. The next request adds one small piece at the end. By turn 50, more than **98%** of the tokens are byte-for-byte the same as the request before.',
    hint: 'Increase the number of earlier turns and watch the identical share grow.',
    takeaway: 'The part that repeats grows every turn. The part that is new stays small.',
    mount(c) {
      const SYS = 6000, TOOLS = 4000, TURN = 1500, X0 = 20, W = 380;
      const f = c.fig(420, 232, `
        <text class="b sm" id="t1" x="20" y="22">Request 10</text>
        <g id="top"></g>
        <text class="b sm" id="t2" x="20" y="112">Request 11</text>
        <g id="bot"></g>
        <text id="newl" class="xs b" x="400" y="190" text-anchor="end"></text>`);
      c.legend([['ok', 'Identical to the request before'], ['cmp', 'New']]);
      const st = c.stats([{ k: 'p', label: 'Identical to the last request', value: '', cls: 'ok' }, { k: 't', label: 'Tokens in this request', value: '' }, { k: 'n', label: 'New tokens', value: fmt.n(TURN), cls: 'cmp' }]);
      function draw(k) {
        const hist = k * TURN, total = SYS + TOOLS + hist + TURN, sc = W / total;
        const seg = (x, w, y, cls, label) => `<rect class="${cls}" x="${x}" y="${y}" width="${Math.max(1.5, w)}" height="44" rx="5"/>${w > 52 ? `<text class="xs b" x="${x + w / 2}" y="${y + 27}" text-anchor="middle">${label}</text>` : ''}`;
        let t = '', b = '', x = X0;
        const topParts = [[SYS, 'System'], [TOOLS, 'Tools'], [(k - 1) * TURN, 'History'], [TURN, 'New']];
        topParts.forEach(([n, l], i) => { t += seg(x, n * sc, 34, i === 3 ? 't-cmp' : 'box', l); x += n * sc; });
        f.q('#top').innerHTML = t;
        x = X0;
        const botParts = [[SYS, 'System'], [TOOLS, 'Tools'], [hist, 'History'], [TURN, 'New']];
        botParts.forEach(([n, l], i) => { b += seg(x, n * sc, 124, i === 3 ? 't-cmp' : 't-ok', l); x += n * sc; });
        f.q('#bot').innerHTML = b;
        f.q('#t1').textContent = 'Request ' + k; f.q('#t2').textContent = 'Request ' + (k + 1) + ' (identical part in green)';
        const nx = X0 + (total - TURN) * sc;
        f.q('#newl').textContent = 'new: ' + fmt.n(TURN) + ' tokens'; f.q('#newl').setAttribute('y', 184);
        const pct = (total - TURN) / total * 100;
        st.set('p', pct.toFixed(pct > 98 ? 1 : 0) + '%'); st.set('t', fmt.n(total));
      }
      const sl = c.slider({ label: 'Earlier turns in the conversation', values: [1, 2, 5, 10, 25, 50, 100], value: 10, fmt: v => v, onInput: draw });
      draw(10);
      c.play(async () => {
        for (const v of [1, 5, 25, 100, 10]) { sl.set(v, true); draw(v); await c.wait(700); }
      });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'prefix-match', tag: 'Why it works',
    title: 'Change one token and everything after it changes',
    alt: 'Two rows of eight tokens. Editing one token in the new request marks that token and every later token for recomputation, while earlier tokens stay reused.',
    text: 'For each token the model stores a key and a value. Both depend on that token **and every token before it**, never on tokens after it. So the stored work stays valid for any prompt with the same [[prefix]], and breaks at the first difference.',
    hint: 'Click any token in the new request to change it.',
    takeaway: 'A cache hit needs an identical prefix. The first different token ends the reuse.',
    mount(c) {
      const W = ['You', 'are', 'a', 'coding', 'agent', '.', 'Be', 'brief'], ALT = ['We', 'were', 'an', 'test', 'bot', '!', 'Stay', 'long'];
      const ed = W.map(() => false), CW = 44, GAP = 4, X0 = 20;
      let inner = `<text class="b sm" x="20" y="22">Cached request</text><text class="b sm halo" x="20" y="106">New request: click a token to change it</text><text class="xs mute" x="20" y="200">stored keys and values for the new request</text>`;
      let lines = '';
      W.forEach((w, i) => {
        const x = X0 + i * (CW + GAP);
        inner += `<g><rect class="t-data" x="${x}" y="32" width="${CW}" height="30" rx="7"/><text class="xs b" x="${x + CW / 2}" y="51" text-anchor="middle">${w}</text></g>`;
        inner += `<g class="clk" id="c${i}" data-i="${i}" role="button" tabindex="0" aria-label="Change token ${i + 1}"><rect id="cr${i}" class="t-ok" x="${x}" y="116" width="${CW}" height="30" rx="7"/><text id="ct${i}" class="xs b" x="${x + CW / 2}" y="135" text-anchor="middle">${w}</text></g>`;
        inner += `<rect id="kv${i}" class="f-ok" x="${x}" y="208" width="${CW}" height="16" rx="4"/><text id="kt${i}" class="xs m" x="${x + CW / 2}" y="238" text-anchor="middle">reused</text>`;
        lines += `<path class="ln thin" d="M${x + CW / 2} 62 V 114" style="opacity:.4"/>`;
      });
      inner = lines + inner;
      inner += `<path id="dep" class="ln s-cmp s2" d="" marker-end="url(#ah-cmp)" style="opacity:0"/><text id="depT" class="xs b" x="20" y="176" style="opacity:0">everything after depends on the changed token</text>`;
      const f = c.fig(420, 252, inner);
      c.legend([['ok', 'Reused from the cache'], ['cmp', 'Recomputed']]);
      const st = c.stats([{ k: 'r', label: 'Tokens reused', value: '', cls: 'ok' }, { k: 'x', label: 'Tokens recomputed', value: '', cls: 'cmp' }]);
      function render() {
        const first = ed.indexOf(true), n = W.length, hit = first < 0 ? n : first;
        W.forEach((w, i) => {
          const isEd = ed[i], miss = first >= 0 && i >= first;
          f.q('#ct' + i).textContent = isEd ? ALT[i] : w;
          f.q('#cr' + i).setAttribute('class', isEd ? 't-cmp' : miss ? 't-cmp' : 't-ok');
          f.q('#kv' + i).setAttribute('class', miss ? 'f-cmp' : 'f-ok'); f.q('#kt' + i).textContent = miss ? 'redo' : 'reused';
        });
        const dep = f.q('#dep'), dt = f.q('#depT');
        if (first >= 0 && first < n - 1) {
          const x1 = X0 + first * (CW + GAP) + CW / 2, x2 = X0 + (n - 1) * (CW + GAP) + CW / 2;
          dep.setAttribute('d', `M${x1} 160 H${x2}`); dep.style.opacity = 1; dt.style.opacity = 1; dt.setAttribute('x', x1);
        } else { dep.style.opacity = 0; dt.style.opacity = 0; }
        st.set('r', hit + ' of ' + n, Math.round(hit / n * 100) + '% of the prompt'); st.set('x', (n - hit) + ' of ' + n);
        c.say(first < 0 ? 'The new prompt matches the cached one. All eight tokens are reused.' : `Token ${first + 1} changed. Tokens 1 to ${first} ${first ? 'are reused' : 'are none'}. Tokens ${first + 1} to ${n} must be recomputed.`);
      }
      const toggle = i => { ed[i] = !ed[i]; render(); };
      f.qa('.clk').forEach(g => { c.on(g, 'click', () => toggle(+g.dataset.i)); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(+g.dataset.i); } }); });
      c.btn('Reset', () => { ed.fill(false); render(); }, { small: true });
      render();
      c.demo(2200, async () => { toggle(4); await c.wait(1800); toggle(4); toggle(1); await c.wait(1800); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'cache-size', tag: 'The cache',
    title: 'The cache can outgrow the GPU',
    alt: 'Bars for GPU memory, model weights and the KV cache on one scale in gigabytes. The cache bar grows with sequence length and can exceed both the GPU and the weights.',
    text: 'The [[kv cache|KV cache]] stores two vectors per token in every layer. Size = 2 × layers × KV heads × head size × tokens × bytes. For a 70B model with 64 KV heads at 16 bits that is about **2.6 MB per token**. At 32,000 tokens the cache is bigger than a whole 80 GB H100.',
    hint: 'Lengthen the sequence. Then try 8 KV heads and 8-bit values to see how designers shrink the cache.',
    takeaway: 'The cache can rival the model itself, so serving systems treat every byte of it as scarce.',
    mount(c) {
      const stt = { heads: 64, bytes: 2, len: 4000 }, X0 = 20, WID = 380, MAX = 400;
      const gx = g => WID * g / MAX;
      const f = c.fig(420, 218, `
        ${[0, 100, 200, 300, 400].map(v => `<line class="grid" x1="${X0 + gx(v)}" x2="${X0 + gx(v)}" y1="30" y2="172"/><text class="m xs mute" x="${X0 + gx(v)}" y="190" text-anchor="middle">${v}</text>`).join('')}
        <text class="xs mute" x="400" y="208" text-anchor="end">gigabytes</text>
        <text class="b sm" x="20" y="22">One H100 holds</text>
        <rect class="box" x="${X0}" y="30" width="${gx(80)}" height="26" rx="6"/><text class="m xs b" x="${X0 + gx(80) + 8}" y="48">80 GB</text>
        <text class="b sm" x="20" y="80">70B weights, 16-bit</text>
        <rect class="t-mem" x="${X0}" y="88" width="${gx(140)}" height="26" rx="6"/><text class="m xs b" x="${X0 + gx(140) + 8}" y="106">140 GB</text>
        <text class="b sm" x="20" y="138">KV cache for this setting</text>
        <rect id="kv" class="f-data" x="${X0}" y="146" width="0" height="26" rx="6"/><text id="kvt" class="m xs b" x="0" y="164"></text>`);
      const st = c.stats([
        { k: 'p', label: 'Per token', value: '', cls: 'data' },
        { k: 't', label: 'Whole cache', value: '', cls: 'data' },
        { k: 'h', label: 'Compared with one H100', value: '' }
      ]);
      function update() {
        const per = 2 * 80 * stt.heads * 128 * stt.bytes, tot = per * stt.len, gb = tot / 1e9;
        const w = Math.min(WID, gx(gb)); f.q('#kv').setAttribute('width', Math.max(2, w));
        const t = f.q('#kvt'); t.textContent = fmt.n(gb, gb < 10 ? 1 : 0) + ' GB';
        const tx = X0 + w + 8; if (tx > 330) { t.setAttribute('x', X0 + w - 8); t.setAttribute('text-anchor', 'end'); t.style.fill = 'var(--on-data)'; } else { t.setAttribute('x', tx); t.setAttribute('text-anchor', 'start'); t.style.fill = ''; }
        st.set('p', per >= 1e6 ? fmt.n(per / 1e6, 1) + ' MB' : fmt.n(per / 1e3) + ' KB'); st.set('t', fmt.n(gb, gb < 10 ? 1 : 0) + ' GB'); st.set('h', (gb / 80).toFixed(gb / 80 < 1 ? 2 : 1) + '×', gb > 80 ? 'does not fit' : 'fits');
        st.cls('h', gb > 80 ? 'bad' : 'ok');
      }
      c.seg({ label: 'Keys and values per layer', options: [[64, '64 KV heads'], [8, '8 KV heads (GQA)']], value: 64, onChange: v => { stt.heads = +v; update(); } });
      c.seg({ label: 'Precision', options: [[2, '16-bit'], [1, '8-bit']], value: 2, onChange: v => { stt.bytes = +v; update(); } });
      const sl = c.slider({ label: 'Sequence length', values: [1000, 4000, 10000, 32000, 128000], value: 4000, fmt: v => fmt.n(v) + ' tokens', onInput: v => { stt.len = v; update(); } });
      c.note('80 layers and head size 128, as in a 70B model. Grouped-query attention (GQA) shares each key and value across several query heads.');
      update();
      c.play(async () => { for (const v of [32000, 128000, 4000]) { sl.set(v, true); stt.len = v; update(); await c.wait(800); } });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'prefix-win', tag: 'The payoff',
    title: 'A repeated prompt skips most of the wait',
    alt: 'A 10,000 token prompt as a bar split into reused and recomputed parts, and two time-to-first-token bars. A cold request takes 4.3 seconds, a fully cached repeat 0.6 seconds.',
    text: 'When a new request starts with tokens the system has already processed, it reuses their stored keys and values and runs prefill only on the rest. On a 10,000-token prompt, time to first token fell from **4.3 s** to **0.6 s** on a repeat.',
    hint: 'Drag how much of the prompt matches an earlier request.',
    takeaway: 'You skip prefill work for every matching token at the start of the prompt.',
    mount(c) {
      const X0 = 20, W = 380, MAXT = 4.5;
      const f = c.fig(420, 226, `
        <text class="b sm" x="20" y="22">A 10,000-token prompt</text>
        <rect class="well" x="${X0}" y="32" width="${W}" height="30" rx="7"/>
        <rect id="hit" class="t-ok" x="${X0}" y="32" width="0" height="30" rx="7"/>
        <rect id="miss" class="t-cmp" x="${X0}" y="32" width="0" height="30" rx="7"/>
        <text id="hl" class="xs b" x="${X0 + 8}" y="52"></text><text id="ml" class="xs b" x="392" y="52" text-anchor="end"></text>
        <text class="b sm" x="20" y="98">Time to first token</text>
        <text class="m xs mute" x="400" y="124" text-anchor="end">cold start</text>
        <rect class="well" x="${X0}" y="130" width="${W}" height="22" rx="6"/><rect class="f-cmp" x="${X0}" y="130" width="${W * 4.3 / MAXT}" height="22" rx="6"/><text class="m xs b" x="${X0 + W * 4.3 / MAXT - 8}" y="146" text-anchor="end" style="fill:var(--on-cmp)">4.3 s</text>
        <text class="m xs mute" x="400" y="176" text-anchor="end">this request</text>
        <rect class="well" x="${X0}" y="182" width="${W}" height="22" rx="6"/><rect id="tb" class="f-data" x="${X0}" y="182" width="0" height="22" rx="6"/><text id="tt" class="m xs b" x="0" y="198"></text>
        <path class="ln thin dash" d="M${X0 + W * 0.6 / MAXT} 124 V212"/><text class="xs mute" x="${X0 + W * 0.6 / MAXT + 5}" y="218">fully cached: 0.6 s</text>`);
      const st = c.stats([{ k: 't', label: 'Time to first token', value: '', cls: 'data' }, { k: 's', label: 'Prefill work skipped', value: '', cls: 'ok' }, { k: 'f', label: 'Faster than cold', value: '' }]);
      function at(shared) {
        const frac = shared / 10000, ttft = 0.6 + 3.7 * (1 - frac);
        f.q('#hit').setAttribute('width', Math.max(0, W * frac)); f.q('#miss').setAttribute('x', X0 + W * frac); f.q('#miss').setAttribute('width', Math.max(0, W * (1 - frac)));
        f.q('#hl').textContent = shared > 1500 ? 'reused ' + fmt.n(shared) : ''; f.q('#ml').textContent = shared < 8500 ? 'recomputed ' + fmt.n(10000 - shared) : '';
        const tb = f.q('#tb'), w = W * ttft / MAXT; tb.setAttribute('width', w);
        const tt = f.q('#tt'); tt.textContent = ttft.toFixed(1) + ' s'; if (w > 60) { tt.setAttribute('x', X0 + w - 8); tt.setAttribute('text-anchor', 'end'); tt.style.fill = 'var(--on-cmp)'; } else { tt.setAttribute('x', X0 + w + 8); tt.setAttribute('text-anchor', 'start'); tt.style.fill = ''; }
        st.set('t', ttft.toFixed(1) + ' s'); st.set('s', Math.round(frac * 100) + '%'); st.set('f', (4.3 / ttft).toFixed(1) + '×');
      }
      const sl = c.slider({ label: 'Tokens that match an earlier request', min: 0, max: 10000, step: 500, value: 10000, fmt: v => fmt.n(v), onInput: at });
      c.note('Measured example from this lesson: 4.3 s cold, 0.6 s for an identical repeat. Values in between are interpolated.');
      at(0);
      c.play(async () => {
        await c.wait(500);
        await c.tween(2000, p => { const v = Math.round(p * 20) * 500; sl.set(v, true); at(v); }, c.ease.io);
      });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'paged', tag: 'How it is stored',
    title: 'Memory in blocks, matched by a hash chain',
    alt: 'Two requests as rows of tokens grouped into blocks. Each block has a hash that includes its parent. Blocks before the first changed token match and share physical memory. Later blocks do not.',
    text: '[[paged attention|Paged attention]] splits the cache into fixed-size blocks, like pages of memory. Each block gets a hash of **its parent’s hash plus its own tokens**. Identical prefixes give identical hash chains, so two requests point at the same physical blocks.',
    hint: 'Move the first changed token, then change the block size. Only whole blocks are reused.',
    takeaway: 'Reuse stops at the first block whose hash differs. The partial block at the end is never cached.',
    mount(c) {
      const N = 22, ST = 17, X0 = 20, stt = { B: 8, e: 12 };
      const A = Array.from({ length: N }, (_, i) => (i * 37 + 11) % 97);
      const h4 = (prev, arr) => { let h = (2166136261 ^ prev) >>> 0; for (const v of arr) { h = Math.imul(h ^ v, 16777619) >>> 0; } return h >>> 0; };
      const hex = h => (h >>> 16).toString(16).padStart(4, '0');
      const f = c.fig(420, 322, `
        <text class="b sm" x="20" y="22">Request A (cached)</text><g id="ra"></g>
        <text class="b sm" x="20" y="132">Request B (new)</text><g id="rb"></g>
        <text class="b sm" x="20" y="246">Physical memory (blocks)</text><g id="mem"></g>`);
      c.legend([['ok', 'Shared block (hit)'], ['cmp', 'New block (miss)']]);
      const st = c.stats([{ k: 'r', label: 'Tokens reused', value: '', cls: 'ok' }, { k: 'x', label: 'Tokens recomputed', value: '', cls: 'cmp' }]);
      function render() {
        const B = stt.B, e = stt.e - 1, nf = Math.floor(N / B), Bt = A.map((v, i) => i === e ? (v + 50) % 97 : v);
        const chain = arr => { const hs = []; let p = 0; for (let j = 0; j < nf; j++) { p = h4(p, arr.slice(j * B, (j + 1) * B)); hs.push(p); } return hs; };
        const hA = chain(A), hB = chain(Bt), hit = hA.map((h, j) => h === hB[j]);
        let nHit = 0; while (nHit < nf && hit[nHit]) nHit++;
        const row = (y, hs, status, isB) => {
          let s = '';
          for (let i = 0; i < N; i++) {
            const j = Math.floor(i / B), full = j < nf, ok = full && (!isB || j < nHit);
            const cls = !isB ? 't-data' : (i === e ? 'f-cmp' : ok ? 't-ok' : 't-cmp');
            s += `<rect class="${cls}" x="${X0 + i * ST}" y="${y}" width="14" height="14" rx="3"${isB && i === e ? ' stroke="var(--ink)" stroke-width="2"' : ''}/>`;
          }
          for (let j = 0; j < nf; j++) {
            const cls = !isB ? 'box' : (j < nHit ? 't-ok' : 't-cmp');
            s += `<rect class="${cls}" x="${X0 + j * B * ST}" y="${y + 20}" width="${B * ST - 3}" height="20" rx="5"/><text class="m xs b" x="${X0 + j * B * ST + (B * ST - 3) / 2}" y="${y + 34}" text-anchor="middle">${hex(hs[j])}</text>`;
          }
          if (N % B) s += `<rect class="box" x="${X0 + nf * B * ST}" y="${y + 20}" width="${(N - nf * B) * ST - 3}" height="20" rx="5" style="stroke-dasharray:3 3"/><text class="xs mute" x="${X0 + nf * B * ST + ((N - nf * B) * ST - 3) / 2}" y="${y + 34}" text-anchor="middle">${(N - nf * B) * ST > 48 ? 'tail' : ''}</text>`;
          return s;
        };
        f.q('#ra').innerHTML = row(36, hA, null, false);
        f.q('#rb').innerHTML = row(146, hB, null, true);
        const tail = N % B ? 1 : 0;
        let slots = '';
        const SS = 31, slotX = i => X0 + i * SS;
        const total = Math.min(12, nf + tail + (nf - nHit) + tail);
        for (let i = 0; i < 12; i++) {
          let cls = 'well', lab = '';
          if (i < nf) { cls = i < nHit ? 't-ok' : 't-mem'; lab = i < nHit ? '×2' : 'A'; }
          else if (i === nf && tail) { cls = 'box'; lab = 'A'; }
          else if (i < nf + tail + (nf - nHit)) { cls = 't-cmp'; lab = 'B'; }
          else if (tail && i === nf + tail + (nf - nHit)) { cls = 'box'; lab = 'B'; }
          slots += `<rect class="${cls}" x="${slotX(i)}" y="256" width="27" height="28" rx="6"${cls === 'box' ? ' style="stroke-dasharray:3 3"' : ''}/><text class="m xs b" x="${slotX(i) + 13.5}" y="274" text-anchor="middle">${lab}</text>`;
        }
        f.q('#mem').innerHTML = slots + `<text class="xs mute" x="20" y="300">×2 = block shared by both requests</text><text class="xs mute" x="20" y="314">dashed = partial block, never shared</text>`;
        const reused = nHit * B;
        st.set('r', reused + ' of ' + N, nHit + (nHit === 1 ? ' block' : ' blocks') + ' of ' + B + ' tokens'); st.set('x', (N - reused) + ' of ' + N, N % B ? 'includes ' + (N % B) + ' tail tokens' : '');
        c.say('');
      }
      c.seg({ label: 'Block size (tokens)', options: [[4, '4'], [8, '8'], [16, '16']], value: 8, onChange: v => { stt.B = +v; render(); } });
      const sl = c.slider({ label: 'First token that differs in request B', min: 1, max: N, step: 1, value: 12, fmt: v => 'token ' + v, onInput: v => { stt.e = v; render(); } });
      c.note('Smaller blocks leave a shorter uncached tail, so short prompts hit more often. Larger blocks make each attention step wider and more efficient on the GPU.');
      render();
      c.play(async () => { for (const v of [20, 6, 12]) { await c.wait(750); sl.set(v, true); stt.e = v; render(); } });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'radix', tag: 'How it is stored',
    title: 'A tree finds the longest shared prefix in one walk',
    alt: 'A radix tree of prompts. Edges hold runs of words. Requests that share a start share a path, and an edge splits where two prompts diverge.',
    text: 'The [[radix tree|radix tree]] used by SGLang stores cached state as a tree. Each edge holds a run of tokens. Requests with a shared start share a path, and an edge **splits** where two prompts diverge. Finding the longest cached prefix is one walk from the root.',
    hint: 'Step through four requests. The last one is a lookup.',
    takeaway: 'Shared prefixes are stored once. Branching requests, such as parallel tool calls, hang off a shared trunk.',
    mount(c) {
      const PR = ['You are a bot . Hi there', 'You are a bot . Hi again', 'You are a coder . Fix it', 'You are a bot . Hi there friend'].map(s => s.split(' '));
      let nid = 0, root, step = 0, green = new Set(), orange = new Set();
      const mkn = label => ({ label, kids: [], id: ++nid });
      function insert(words) {
        let node = root, i = 0; const fresh = new Set();
        while (i < words.length) {
          const kid = node.kids.find(k => k.label[0] === words[i]);
          if (!kid) { const nn = mkn(words.slice(i)); node.kids.push(nn); fresh.add(nn.id); return fresh; }
          let j = 0; while (j < kid.label.length && i + j < words.length && kid.label[j] === words[i + j]) j++;
          if (j < kid.label.length) { const rest = { label: kid.label.slice(j), kids: kid.kids, id: ++nid }; kid.label = kid.label.slice(0, j); kid.kids = [rest]; }
          i += j; node = kid;
        }
        return fresh;
      }
      function lookup(words) {
        let node = root, i = 0; const ids = new Set();
        while (i < words.length) {
          const kid = node.kids.find(k => k.label[0] === words[i]); if (!kid) break;
          let j = 0; while (j < kid.label.length && i + j < words.length && kid.label[j] === words[i + j]) j++;
          ids.add(kid.id); i += j; if (j < kid.label.length) break; node = kid;
        }
        return { n: i, ids };
      }
      const f = c.fig(420, 336, `<g id="tree"></g>`);
      const log = c.html('<ol class="reqlist"></ol>', 'reqs');
      const st = c.stats([{ k: 'a', label: 'Cached prefix found', value: '', cls: 'ok' }, { k: 'b', label: 'Nodes in the tree', value: '' }]);
      function render() {
        let leaves = 0, maxd = 0;
        (function walk(n, d) { n.d = d; maxd = Math.max(maxd, d); if (!n.kids.length) n.x = leaves++; else { n.kids.forEach(k => walk(k, d + 1)); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } })(root, 0);
        const px = n => leaves <= 1 ? 210 : 44 + n.x / (leaves - 1) * 332, py = n => 34 + n.d * 70;
        let edges = '', nodes = '', count = 0;
        (function draw(n, p) {
          count++;
          const cls = green.has(n.id) ? 's-ok' : orange.has(n.id) ? 's-cmp' : '';
          if (p) {
            const x1 = px(p), y1 = py(p), x2 = px(n), y2 = py(n);
            edges += `<path class="ln ${cls} ${green.has(n.id) || orange.has(n.id) ? 's3' : ''}" d="M${x1} ${y1} L${x2} ${y2}"/>`;
            let lab = n.label.join(' '); if (lab.length > 17) lab = lab.slice(0, 16) + '…';
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, w = lab.length * 6.3 + 12;
            edges += `<rect class="panel-f ${cls}" x="${mx - w / 2}" y="${my - 10}" width="${w}" height="20" rx="6" style="stroke:var(--line);stroke-width:1"/><text class="xs b" x="${mx}" y="${my + 4}" text-anchor="middle">${lab}</text>`;
          }
          nodes += `<circle class="${green.has(n.id) ? 't-ok' : orange.has(n.id) ? 't-cmp' : 'box'}" cx="${px(n)}" cy="${py(n)}" r="7"/>`;
          n.kids.forEach(k => draw(k, n));
        })(root, null);
        f.q('#tree').innerHTML = edges + nodes + `<text class="xs mute" x="${px(root) + 12}" y="${py(root) + 4}">start</text>`;
        st.set('b', count - 1);
      }
      function list() {
        log.q('ol').innerHTML = PR.map((w, i) => `<li class="${i < step ? 'done' : i === step ? 'next' : ''}"><span class="n">${i + 1}</span><span>${i === 3 ? '<b>Lookup:</b> ' : ''}${w.join(' ')}</span></li>`).join('');
      }
      function reset() { nid = 0; root = { label: [], kids: [], id: 0 }; step = 0; green = new Set(); orange = new Set(); st.set('a', '–', ''); render(); list(); btn.textContent = 'Insert request 1'; }
      async function advance() {
        if (step >= 4) { reset(); return; }
        const w = PR[step];
        if (step < 3) { orange = insert(w); green = new Set(); step++; render(); list(); st.set('a', '–', ''); btn.textContent = step < 3 ? 'Insert request ' + (step + 1) : 'Look up request 4'; await c.wait(900); orange = new Set(); render(); }
        else {
          const r = lookup(w); green = r.ids; orange = new Set(); render(); st.set('a', r.n + ' of ' + w.length + ' tokens', 'one walk from the root');
          step++; list(); btn.textContent = 'Start over'; await c.wait(1300);
          orange = insert(w); render();
        }
      }
      const btn = c.btn('Insert request 1', () => advance(), { kind: 'pri' });
      c.note('Green = cached path reused. Orange = new or split nodes. Words stand in for tokens.');
      reset();
      c.play(async () => { for (let i = 0; i < 4; i++) { await c.wait(900); await advance(); } });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'hierarchy', tag: 'Using it well',
    title: 'Order matters: tools, then system, then messages',
    alt: 'A request as rows: tool definitions, system prompt, three messages and a new message. Everything above the first changed row stays cached. That row and everything below it is recomputed.',
    text: 'Inside one request the cache follows a fixed order: tool definitions, then the system prompt, then the messages. A change **invalidates its own layer and everything after it**. Edit a tool and the system and message caches go too. Add a new message and nothing earlier is touched.',
    hint: 'Pick what changed since the last request and watch the cached share.',
    takeaway: 'Put what never changes at the top. Put what changes often at the end.',
    mount(c) {
      const segs = [{ n: 'Tool definitions', t: 3000 }, { n: 'System prompt', t: 5000 }, { n: 'Message 1', t: 1200 }, { n: 'Message 2', t: 1800 }, { n: 'Message 3', t: 1500 }, { n: 'New message', t: 400 }];
      const first = { none: 5, m2: 3, sys: 1, tools: 0 };
      const box = c.html('<div id="rows"></div><div class="hitmeter"><span>Cached share</span><span class="meter"><i></i></span><span class="v">0%</span></div>');
      const st = c.stats([{ k: 'h', label: 'Reused tokens', value: '', cls: 'ok' }, { k: 'r', label: 'Recomputed tokens', value: '', cls: 'cmp' }]);
      const total = segs.reduce((a, s) => a + s.t, 0);
      function show(key) {
        const miss = first[key], hit = hitTokens(segs, miss);
        box.q('#rows').innerHTML = rows(segs, miss);
        box.q('.meter i').style.width = (hit / total * 100) + '%'; box.q('.v').textContent = Math.round(hit / total * 100) + '%';
        st.set('h', fmt.n(hit), 'of ' + fmt.n(total)); st.set('r', fmt.n(total - hit));
      }
      const sg = c.seg({ label: 'What changed since the last request?', options: [['none', 'Only the new message'], ['m2', 'Edited message 2'], ['sys', 'Edited the system prompt'], ['tools', 'Edited a tool']], value: 'none', onChange: show });
      show('none');
      c.play(async () => { for (const k of ['m2', 'sys', 'tools', 'none']) { await c.wait(1100); sg.set(k); show(k); } });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'killers', tag: 'Using it well',
    title: 'Three small habits that silently break the cache',
    alt: 'A prompt as rows. Switching on a timestamp in the system prompt, random key order in tool definitions, or a memory blob before the history moves the first difference up and turns later rows into recomputation.',
    text: 'The costliest misses make no noise. A **timestamp** in the system prompt changes every request. Tool schemas written with **random key order** look the same but hash differently. A **memory blob** placed before the history changes everything after it.',
    hint: 'Switch the habits on one at a time and read the fix.',
    takeaway: 'Treat the prefix as immutable. Put every source of variation in a small tail at the very end.',
    mount(c) {
      const on = { ts: false, keys: false, mem: false };
      const FIX = { keys: ['Tool JSON with random key order', 'Serialize with sorted keys so the bytes never change.'], ts: ['Timestamp in the system prompt', 'Put the time in the last user message instead.'], mem: ['Memory blob before the history', 'Append it after the history, or keep it fixed for the session.'] };
      const box = c.html('<div id="rows"></div><div class="hitmeter"><span>Cached share</span><span class="meter"><i></i></span><span class="v">0%</span></div><div id="fix" class="fixes"></div>');
      const st = c.stats([{ k: 'h', label: 'Cached share', value: '', cls: 'ok' }, { k: 'x', label: 'Input cost vs a clean prompt', value: '', cls: 'cmp' }]);
      function show() {
        const segs = [{ n: 'Tool definitions', t: 3000 }, { n: 'System prompt', t: 5000 }];
        if (on.mem) segs.push({ n: 'Memory blob', t: 800 });
        segs.push({ n: 'Conversation history', t: 12000 }, { n: 'New message', t: 500 });
        let miss = segs.length - 1;
        if (on.keys) miss = Math.min(miss, 0);
        if (on.ts) miss = Math.min(miss, 1);
        if (on.mem) miss = Math.min(miss, 2);
        const total = segs.reduce((a, s) => a + s.t, 0), hit = hitTokens(segs, miss);
        const clean = 3000 + 5000 + 12000, cleanTotal = clean + 500, cost = hit * 0.1 + (total - hit), ideal = clean * 0.1 + 500 + (on.mem ? 800 : 0);
        box.q('#rows').innerHTML = rows(segs, miss);
        box.q('.meter i').style.width = (hit / total * 100) + '%'; box.q('.v').textContent = Math.round(hit / total * 100) + '%';
        st.set('h', Math.round(hit / total * 100) + '%', fmt.n(hit) + ' of ' + fmt.n(total) + ' tokens'); st.set('x', (cost / (clean * 0.1 + 500)).toFixed(1) + '×', 'hits billed at 10%, misses at 100%');
        st.cls('x', cost / (clean * 0.1 + 500) > 2 ? 'bad' : 'ok');
        box.q('#fix').innerHTML = Object.keys(on).filter(k => on[k]).map(k => `<div class="fixline"><b>${FIX[k][0]}</b><span>Fix: ${FIX[k][1]}</span></div>`).join('') || '<div class="fixline"><b>A clean prompt</b><span>Everything stable sits above the new message.</span></div>';
      }
      const tg = {};
      [['ts', 'Timestamp in the system prompt'], ['keys', 'Tool JSON with random key order'], ['mem', 'Memory blob before the history']].forEach(([k, lab]) => { tg[k] = c.toggle({ label: lab, value: false, onChange: v => { on[k] = v; show(); } }); });
      c.note('Cost counts cache hits at 10% of the base price and misses at 100%. It ignores the one-time write premium.');
      show();
      c.play(async () => { for (const k of ['keys', 'ts', 'mem']) { await c.wait(1100); on[k] = true; tg[k].set(true); show(); await c.wait(900); on[k] = false; tg[k].set(false); show(); } });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'rag', tag: 'Limits',
    title: 'Retrieved documents break exact-prefix matching',
    alt: 'Request A and request B as rows of system prompt, three retrieved documents and a question. Reordering or replacing an early document leaves almost nothing reusable. A research idea reuses documents at any position.',
    text: 'A retrieval system picks different documents for each question and places them mid-prompt. Attention depends on position, so the same document at a new position has different keys and values. Standard caching matches only an exact prefix, so one early change wastes the rest.',
    hint: 'Change what request B retrieves. Then switch on the research idea.',
    takeaway: 'Design for exact prefixes today. Reusing documents at any position is still research.',
    mount(c) {
      const A = ['Doc 12', 'Doc 7', 'Doc 31'];
      const CASES = { same: [['Doc 12', 'Doc 7', 'Doc 31'], 'Same documents, same order, new question'], swap: [['Doc 7', 'Doc 12', 'Doc 31'], 'Same documents, different order'], first: [['Doc 5', 'Doc 12', 'Doc 7'], 'A new document comes first'], last: [['Doc 12', 'Doc 7', 'Doc 8'], 'Only the last document changes'] };
      const stt = { k: 'same', blend: false };
      const box = c.html(`<p class="kicker" style="margin:0 0 6px">Request A (cached): System, ${A.join(', ')}, Question</p><div id="rows"></div><div class="hitmeter"><span>Reused share</span><span class="meter"><i></i></span><span class="v">0%</span></div>`);
      const st = c.stats([{ k: 'h', label: 'Reused tokens', value: '', cls: 'ok' }, { k: 'x', label: 'Recomputed tokens', value: '', cls: 'cmp' }]);
      function show() {
        const docs = CASES[stt.k][0];
        const segs = [{ n: 'System prompt', t: 2000 }].concat(docs.map(d => ({ n: d, t: 3000 }))).concat([{ n: 'Question', t: 200 }]);
        let miss = segs.length - 1;
        for (let i = 1; i <= 3; i++) if (docs[i - 1] !== A[i - 1]) { miss = i; break; }
        if (stt.blend) segs.forEach((s, i) => { if (i >= 1 && i <= 3 && i >= miss && A.indexOf(s.n) >= 0) s.state = 'fix'; });
        const total = segs.reduce((a, s) => a + s.t, 0), hit = hitTokens(segs, miss);
        box.q('#rows').innerHTML = rows(segs, miss);
        box.q('.meter i').style.width = (hit / total * 100) + '%'; box.q('.v').textContent = Math.round(hit / total * 100) + '%';
        st.set('h', fmt.n(hit), 'of ' + fmt.n(total)); st.set('x', fmt.n(total - hit));
      }
      const sg = c.seg({ label: 'What request B retrieves', options: Object.keys(CASES).map(k => [k, CASES[k][1]]), value: 'same', onChange: v => { stt.k = v; show(); } });
      c.toggle({ label: 'Research idea: reuse documents at any position', value: false, onChange: v => { stt.blend = v; show(); } });
      c.note('Research systems such as CacheBlend recompute a small fraction of tokens to repair reused documents. No major API ships this today.');
      show();
      c.play(async () => { for (const k of ['swap', 'first', 'last', 'same']) { await c.wait(1100); stt.k = k; sg.set(k); show(); } });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'providers', tag: 'Using it well',
    title: 'Four providers, four ways to cache',
    alt: 'Four cards showing how each provider exposes caching and what a cache hit costs compared with normal input tokens.',
    text: 'Providers expose caching differently and charge differently for a [[cache hit|hit]]. Anthropic lets you mark where to cache. OpenAI does it automatically. Gemini offers both. DeepSeek caches to **disk**, which makes hits very cheap.',
    takeaway: 'A hit costs between 10% and 50% of a normal input token, and on DeepSeek far less.',
    mount(c) {
      const cards = [
        ['Anthropic', 'You choose', 'Mark up to 4 breakpoints. A write costs 25% extra on a 5-minute timer, 100% extra on 1 hour.', [['Hit price', 10]]],
        ['OpenAI', 'Automatic', 'No setup. A prompt_cache_key routes related requests to the same cache.', [['Hit price', 50]]],
        ['Gemini', 'Both', 'Implicit caching is free. Explicit caching goes further but bills storage per token-hour.', [['Implicit hit', 25], ['Explicit hit', 10]]],
        ['DeepSeek', 'On disk', 'Hits cost about 1.4 cents per million tokens, an order of magnitude below the rest.', [['Hit price', 1.4]]]
      ];
      const h = c.html('<div class="pcards">' + cards.map(k => `<div class="pcard" style="opacity:.2"><span class="k">${k[0]}</span><span class="big">${k[1]}</span><p>${k[2]}</p>${k[3].map(b => `<div class="pbar"><span>${b[0]}</span><div class="meter"><i style="width:0" data-w="${b[1]}"></i></div><span class="pv">${k[0] === 'DeepSeek' ? '1.4¢ per M' : b[1] + '%'}</span></div>`).join('')}</div>`).join('') + '</div><p class="legend" style="margin-top:0">Bars show a hit as a share of the normal input price. DeepSeek is shown as an absolute price.</p>');
      const lis = h.qa('.pcard');
      c.note('Discounts and prices change. Check each provider’s current pricing page before you plan around a number.');
      c.play(async () => {
        for (const card of lis) {
          await c.fx(card, { o: 1 }, 350);
          const bars = Array.from(card.querySelectorAll('.meter i'));
          await Promise.all(bars.map(b => c.tween(600, p => { b.style.width = (+b.dataset.w * p) + '%'; })));
        }
      });
    }
  });

  /* 13 --------------------------------------------------------------- */
  S.push({
    id: 'breakeven', tag: 'Using it well',
    title: 'When does caching pay back?',
    alt: 'A chart of cost against the number of requests sharing a prefix. Caching with a 5-minute timer is cheaper from the second request, with a 1-hour timer from the third.',
    text: 'On Anthropic a write costs extra, so a cache only wins once the prefix is **reused**. The chart counts cost in units of one uncached pass over the prefix. A 5-minute cache pays back on the **second** request. A 1-hour cache pays back on the **third**.',
    hint: 'Slide the number of requests that share the prefix and find where each line crosses the orange one.',
    takeaway: 'After the break-even point, every extra hit saves about 90% of the prefix cost.',
    mount(c) {
      const PX0 = 40, PX1 = 396, PY0 = 22, PY1 = 214, NM = 20, YM = 20;
      const xs = n => PX0 + (n - 1) / (NM - 1) * (PX1 - PX0), ys = v => PY1 - v / YM * (PY1 - PY0);
      const L = { none: n => n, five: n => 1.25 + 0.1 * (n - 1), hour: n => 2 + 0.1 * (n - 1) };
      const path = fn => { let d = ''; for (let n = 1; n <= NM; n++) d += (d ? 'L' : 'M') + xs(n).toFixed(1) + ' ' + ys(fn(n)).toFixed(1); return d; };
      const f = c.fig(420, 270, `
        ${[0, 5, 10, 15, 20].map(v => `<line class="grid" x1="${PX0}" x2="${PX1}" y1="${ys(v)}" y2="${ys(v)}"/><text class="m xs mute" x="${PX0 - 7}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        ${[1, 5, 10, 15, 20].map(n => `<text class="m xs mute" x="${xs(n)}" y="${PY1 + 17}" text-anchor="middle">${n}</text>`).join('')}
        <line class="axis" x1="${PX0}" x2="${PX1}" y1="${PY1}" y2="${PY1}"/>
        <text class="xs mute" x="${PX0}" y="12">Cost in units of one uncached pass over the prefix</text>
        <text class="xs mute" x="${(PX0 + PX1) / 2}" y="${PY1 + 38}" text-anchor="middle">Requests that share the prefix</text>
        <path id="p0" class="s-cmp s3" d="${path(L.none)}"/><path id="p1" class="s-data s3" d="${path(L.five)}"/><path id="p2" class="s-mem s3" d="${path(L.hour)}"/>
        <g id="be"><circle class="none-f ink-s" cx="${xs(2)}" cy="${ys(L.five(2))}" r="8" stroke-width="2"/><circle class="none-f ink-s" cx="${xs(3)}" cy="${ys(L.hour(3))}" r="8" stroke-width="2"/></g>
        <g id="cur"><path id="cl" class="ln thin dash" d=""/><circle id="d0" class="f-cmp" r="5" stroke="var(--stage)" stroke-width="2"/><circle id="d1" class="f-data" r="5" stroke="var(--stage)" stroke-width="2"/><circle id="d2" class="f-mem" r="5" stroke="var(--stage)" stroke-width="2"/></g>`);
      c.legend([['cmp', 'No caching'], ['data', '5-minute cache'], ['mem', '1-hour cache']]);
      const st = c.stats([{ k: 'a', label: 'No caching', value: '', cls: 'cmp' }, { k: 'b', label: '5-minute cache', value: '', cls: 'data' }, { k: 'c', label: '1-hour cache', value: '', cls: 'mem' }]);
      function at(n) {
        ['none', 'five', 'hour'].forEach((k, i) => { const d = f.q('#d' + i); d.setAttribute('cx', xs(n)); d.setAttribute('cy', ys(L[k](n))); });
        f.q('#cl').setAttribute('d', `M${xs(n)} ${ys(L.none(n))} V${PY1}`);
        const a = L.none(n), b = L.five(n), h = L.hour(n);
        st.set('a', a.toFixed(1)); st.set('b', b.toFixed(2), b < a ? 'cheaper than no cache' : 'costs more'); st.set('c', h.toFixed(2), h < a ? 'cheaper than no cache' : 'costs more');
        st.cls('b', b < a ? 'ok' : 'bad'); st.cls('c', h < a ? 'ok' : 'bad');
      }
      const sl = c.slider({ label: 'Requests that share the prefix', min: 1, max: NM, step: 1, value: 10, fmt: v => v, onInput: at });
      c.note('Anthropic: hit = 0.1×, write = 1.25× (5 min) or 2× (1 hour). Circles mark the first request where each cache wins.');
      at(1);
      c.play(async () => { await c.tween(2200, p => { const n = Math.max(1, Math.round(1 + p * 19)); sl.set(n, true); at(n); }, c.ease.io); await c.wait(300); sl.set(10, true); at(10); });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'mla', tag: 'Where it lives',
    title: 'A smaller cache can live on disk',
    alt: 'Standard attention stores a key and a value for each token. Latent attention stores one small latent vector instead, about 60 times smaller, so the cache fits on cheap disk.',
    text: 'Standard attention stores a **key and a value** for every token in every layer. Both come from the same hidden state. [[mla|Multi-head latent attention]] stores one small **latent** vector instead and folds the projection into the query, so keys and values are never rebuilt. The cache shrinks roughly **60×**.',
    takeaway: 'Shrink the cache enough and storage gets cheap enough to keep it on disk. Reading it back beats recomputing.',
    mount(c) {
      const W = 380, X = 20;
      const f = c.fig(420, 318, `
        <text class="b sm" x="20" y="22">Stored per token, per layer</text>
        <text class="xs mute" x="20" y="46">Standard attention</text>
        <rect id="kb" class="t-mem" x="${X}" y="54" width="0" height="28" rx="6"/><rect id="vb" class="t-mem" x="${X + W / 2}" y="54" width="0" height="28" rx="6"/>
        <text id="kl" class="b sm" x="${X + W / 4}" y="73" text-anchor="middle" style="opacity:0">K</text><text id="vl" class="b sm" x="${X + W * 3 / 4}" y="73" text-anchor="middle" style="opacity:0">V</text>
        <text class="xs mute" x="20" y="108">Latent attention (MLA)</text>
        <rect id="lb" class="f-ctl" x="${X}" y="116" width="0" height="28" rx="3"/>
        <text id="ll" class="b sm" x="${X + W / 60 + 10}" y="135" style="opacity:0">one latent: about 60× smaller</text>
        <line class="grid" x1="20" x2="400" y1="166" y2="166"/>
        <text class="b sm" x="20" y="190">Why K and V can be merged</text>
        <rect class="box" x="20" y="206" width="84" height="34" rx="8"/><text class="xs b" x="62" y="227" text-anchor="middle">hidden state</text>
        <path class="ln" d="M104 215 H146 L172 207" marker-end="url(#ah-ink)"/><path class="ln" d="M104 231 H146 L172 239" marker-end="url(#ah-ink)"/>
        <rect class="t-mem" x="176" y="194" width="60" height="26" rx="7"/><text class="xs b" x="206" y="211" text-anchor="middle">K</text>
        <rect class="t-mem" x="176" y="228" width="60" height="26" rx="7"/><text class="xs b" x="206" y="245" text-anchor="middle">V</text>
        <text class="xs mute" x="246" y="228">two big vectors stored</text>
        <rect class="box" x="20" y="268" width="84" height="34" rx="8"/><text class="xs b" x="62" y="289" text-anchor="middle">hidden state</text>
        <path class="ln" d="M104 285 H172" marker-end="url(#ah-ctl)"/>
        <rect class="t-ctl" x="176" y="272" width="26" height="26" rx="7"/><text class="xs b" x="189" y="289" text-anchor="middle">c</text>
        <text class="xs mute" x="214" y="282">one small latent stored</text><text class="xs mute" x="214" y="296">folded into Q at attention time</text>`);
      const st = c.stats([{ k: 'a', label: 'Cache at 128K tokens, standard', value: '320 GB', cls: 'mem' }, { k: 'b', label: 'With latent attention', value: 'about 5 GB', cls: 'data' }]);
      c.note('The 320 GB figure is the 64-head example from the cache-size scene. The 60× factor is the one reported for DeepSeek’s design and depends on the model.');
      c.play(async () => {
        await Promise.all([c.tween(900, p => f.q('#kb').setAttribute('width', W / 2 * p)), c.tween(900, p => f.q('#vb').setAttribute('width', W / 2 * p))]);
        await Promise.all([c.fx(f.q('#kl'), { o: 1 }, 250), c.fx(f.q('#vl'), { o: 1 }, 250)]);
        await c.wait(500);
        await c.tween(700, p => f.q('#lb').setAttribute('width', Math.max(2, W / 60 * p)));
        await c.fx(f.q('#ll'), { o: 1 }, 400);
      });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'tiers', tag: 'Where it lives',
    title: 'Cached state moves between memory tiers',
    alt: 'Four tiers of storage: GPU memory, CPU RAM, local SSD and network storage. New conversations enter GPU memory and move older ones down. Revisiting an old conversation moves its blocks back up.',
    text: 'Every byte of [[hbm|HBM]] holding cache is a byte a live request cannot use. So serving systems keep cache in tiers: GPU memory, CPU RAM, local SSD, network storage. Each tier is bigger and slower. Cold blocks move down. Hot blocks move back up.',
    hint: 'Start new conversations and revisit old ones. Watch their blocks change tier.',
    takeaway: 'A lower tier is slower than GPU memory but still beats recomputing the whole prefill.',
    mount(c) {
      const TIERS = [{ n: 'GPU memory (HBM)', cap: 6, y: 40, note: 'fastest, smallest' }, { n: 'CPU RAM', cap: 6, y: 104, note: '' }, { n: 'Local SSD', cap: 9, y: 168, note: '' }, { n: 'Network storage', cap: 12, y: 232, note: 'biggest, slowest' }];
      const COL = ['var(--mem)', 'var(--cmp)', 'var(--data)', 'var(--ctl)', 'var(--m5)', 'var(--y4)', 'var(--mem)', 'var(--cmp)', 'var(--data)', 'var(--ctl)', 'var(--m5)', 'var(--y4)'];
      const ONC = ['var(--on-mem)', 'var(--on-cmp)', 'var(--on-data)', 'var(--on-accent)', '#0b1220', '#0b1220', 'var(--on-mem)', 'var(--on-cmp)', 'var(--on-data)', 'var(--on-accent)', '#0b1220', '#0b1220'];
      const SS = 22;
      let bands = '';
      TIERS.forEach(t => { bands += `<text class="b sm" x="20" y="${t.y - 8}">${t.n}</text><text class="xs mute" x="400" y="${t.y - 8}" text-anchor="end">${t.note}</text><rect class="well" x="20" y="${t.y}" width="${t.cap * SS + 8}" height="30" rx="8"/>`; });
      const f = c.fig(420, 290, bands + '<g id="blocks"></g>');
      const st = c.stats([{ k: 'w', label: 'Last revisited prefix was in', value: '–' }, { k: 'n', label: 'Conversations cached', value: '' }]);
      let convs = [], nextId = 0, tick = 0;
      const mkConv = () => { const id = nextId++; return { id, letter: 'ABCDEFGHIJKL'[id % 12], last: tick++, els: [] }; };
      const where = new Map();
      function plan() {
        const order = convs.slice().sort((a, b) => b.last - a.last);
        const slots = []; TIERS.forEach((t, ti) => { for (let i = 0; i < t.cap; i++) slots.push([ti, i]); });
        let k = 0; where.clear();
        order.forEach(cv => { for (let b = 0; b < 3; b++) { where.set(cv.id + ':' + b, k < slots.length ? slots[k] : null); k++; } });
        return order;
      }
      function tierOf(cv) { const w = where.get(cv.id + ':0'); return w ? w[0] : -1; }
      const g = f.q('#blocks'), els = new Map();
      function ensure(cv) {
        for (let b = 0; b < 3; b++) {
          const key = cv.id + ':' + b; if (els.has(key)) continue;
          const el = s2(key, cv); els.set(key, el);
        }
      }
      function s2(key, cv) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        el.innerHTML = `<rect x="0" y="0" width="18" height="18" rx="4" style="fill:${COL[cv.id % 12]}" stroke="var(--stage)" stroke-width="1.5"/><text x="9" y="13" text-anchor="middle" class="xs b" style="fill:${ONC[cv.id % 12]};font-size:10.5px">${cv.letter}</text>`;
        el.setAttribute('transform', 'translate(420 0)'); el.style.opacity = 0; g.append(el); return el;
      }
      async function relayout(animate) {
        const order = plan(), jobs = [];
        els.forEach((el, key) => { if (!where.get(key)) { jobs.push(animate ? c.fx(el, { x: 440, o: 0 }, 400) : Promise.resolve(c.place(el, { x: 440, o: 0 }))); } });
        order.forEach(cv => { ensure(cv); for (let b = 0; b < 3; b++) { const key = cv.id + ':' + b, w = where.get(key), el = els.get(key); if (!w) continue; const tx = 24 + w[1] * SS, ty = TIERS[w[0]].y + 6; jobs.push(animate ? c.fx(el, { x: tx, y: ty, o: 1 }, 520) : Promise.resolve(c.place(el, { x: tx, y: ty, o: 1 }))); } });
        st.set('n', order.filter(cv => tierOf(cv) >= 0).length, 'each has 3 blocks');
        await Promise.all(jobs);
      }
      async function newConv() { const cv = mkConv(); convs.push(cv); c.say('**New conversation ' + cv.letter + '** enters GPU memory and pushes older blocks down.'); await relayout(true); }
      async function revisit(which) {
        const live = convs.filter(cv => tierOf(cv) >= 0).sort((a, b) => a.last - b.last);
        if (!live.length) return;
        const cv = which === 'oldest' ? live[0] : live[Math.floor(Math.random() * live.length)];
        const ti = tierOf(cv);
        st.set('w', TIERS[ti].n.replace(' (HBM)', ''), ti === 0 ? 'instant hit' : ti === 3 ? 'slow, still beats recompute' : 'slower, beats recompute');
        c.say('**Conversation ' + cv.letter + '** was in ' + TIERS[ti].n + '. Reloading it beats recomputing the prefill.');
        cv.last = tick++; await relayout(true);
      }
      c.btn('New conversation', () => newConv(), { kind: 'pri', small: true });
      c.btn('Revisit the oldest', () => revisit('oldest'), { small: true });
      c.btn('Revisit a random one', () => revisit('random'), { small: true });
      c.note('Blocks stand for 3 chunks of one conversation’s cache. Capacities are tiny here so the movement is easy to see.');
      for (let i = 0; i < 5; i++) convs.push(mkConv());
      relayout(false);
      c.play(async () => { await c.wait(500); await newConv(); await c.wait(700); await newConv(); await c.wait(700); await revisit('oldest'); });
    }
  });

  /* 16 --------------------------------------------------------------- */
  S.push({
    id: 'side-channel', tag: 'Security',
    title: 'A cache hit leaks through timing',
    alt: 'An attacker probes four candidate words for the next position of a hidden prompt. The candidate that returns fast was already cached by someone else. With per-organization isolation every probe is slow.',
    text: 'A hit returns its first token faster than a miss. If users share a cache, an attacker can send a guess and time the reply: **fast** means someone already sent that prefix. Repeating this word by word, researchers rebuilt other users’ prompts. This leak is a [[side channel]]. The defense is one cache per organization.',
    hint: 'Play the attacker. Probe the four guesses, click the fast one, repeat. Then switch isolation on.',
    takeaway: 'Any cache shared across customers leaks timing. Per-organization isolation removes the cross-customer hits.',
    mount(c) {
      const HID = ['my', 'blood', 'test', 'shows', 'high', 'cholesterol'];
      const OPT = [['what', 'my', 'the', 'a'], ['sugar', 'pressure', 'blood', 'weight'], ['work', 'sample', 'test', 'pressure'], ['says', 'shows', 'is', 'has'], ['low', 'normal', 'high', 'stable'], ['glucose', 'iron', 'sodium', 'cholesterol']];
      const stt = { i: 0, iso: false, probed: false, busy: false, times: [] };
      const h = c.html(`<div class="sidech">
        <p class="kicker">Another customer’s prompt (hidden from you)</p><div class="chips" id="hid"></div>
        <p class="kicker">What you have recovered</p><div class="chips" id="got"></div>
        <p class="kicker">Time to first token for each guess</p><div id="probes" class="probes"></div></div>`);
      const st = c.stats([{ k: 'p', label: 'Hit (cached)', value: '0.6 s', cls: 'ok' }, { k: 'm', label: 'Miss (not cached)', value: '4.3 s', cls: 'cmp' }]);
      function chips() {
        h.q('#hid').innerHTML = HID.map((w, i) => `<span class="chip" style="${i < stt.i ? '' : 'opacity:.6'}">${i < stt.i ? w : '••••'}</span>`).join('');
        h.q('#got').innerHTML = stt.i ? HID.slice(0, stt.i).map(w => `<span class="chip"><i style="background:var(--ok)"></i>${w}</span>`).join('') + (stt.i === HID.length ? ' <b style="font-size:14px">Recovered.</b>' : '') : '<span class="note" style="margin:0">nothing yet</span>';
      }
      function probes() {
        const done = stt.i >= HID.length;
        h.q('#probes').innerHTML = done ? '<p class="note" style="margin:0">All six words recovered from timing alone. In published work this reached 87% accuracy on a medical question bot.</p>' : OPT[stt.i].map((w, k) => `<button type="button" class="probe" data-k="${k}" ${stt.probed ? '' : 'disabled'}><span class="w">${w}</span><span class="meter"><i style="width:0"></i></span><span class="t">${stt.probed ? '' : 'not probed'}</span></button>`).join('');
        h.qa('.probe').forEach(b => c.on(b, 'click', () => pick(+b.dataset.k)));
      }
      async function probe() {
        if (stt.busy || stt.i >= HID.length) return; stt.busy = true; stt.probed = false; probes();
        const correct = HID[stt.i], btns = h.qa('.probe');
        stt.times = OPT[stt.i].map(w => (w === correct && !stt.iso) ? 0.6 + Math.random() * 0.15 : 4.3 + Math.random() * 0.4);
        await Promise.all(btns.map((b, k) => c.tween(900, p => { b.querySelector('.meter i').style.width = (stt.times[k] / 4.8 * 100 * p) + '%'; b.querySelector('.t').textContent = (stt.times[k] * p).toFixed(1) + ' s'; }, c.ease.out)));
        btns.forEach((b, k) => { const fast = stt.times[k] < 2; b.classList.add(fast ? 'fast' : 'slow'); b.querySelector('.t').textContent = stt.times[k].toFixed(1) + ' s ' + (fast ? 'fast' : 'slow'); b.disabled = false; });
        stt.probed = true; stt.busy = false;
        const anyFast = stt.times.some(t => t < 2);
        c.say(anyFast ? 'One guess came back fast. That prefix was already cached by someone else. Click it.' : 'Every guess is slow. Nothing in this cache belongs to you, so nothing leaks.');
      }
      function pick(k) {
        if (!stt.probed) return;
        if (stt.times[k] < 2) { stt.i++; stt.probed = false; chips(); probes(); c.say(stt.i >= HID.length ? 'Done. The hidden prompt is fully recovered.' : 'Right. Probe the next word.'); }
        else c.say('That guess was slow, so it was not cached. Try the fast one.');
      }
      c.btn('Probe the four guesses', () => probe(), { kind: 'pri', small: true });
      c.toggle({ label: 'Per-organization cache isolation', value: false, onChange: v => { stt.iso = v; stt.i = 0; stt.probed = false; chips(); probes(); c.say(v ? 'Isolation on. Your probes can only hit your own cache.' : 'Isolation off. One shared cache for everyone.'); } });
      c.btn('Start over', () => { stt.i = 0; stt.probed = false; chips(); probes(); c.say(''); }, { small: true });
      c.note('A conceptual model of published research on prompt-cache timing attacks. Providers now isolate caches per organization.');
      chips(); probes();
      c.demo(2200, async () => { for (let n = 0; n < HID.length; n++) { await probe(); await c.wait(700); const k = stt.times.findIndex(t => t < 2); if (k >= 0) pick(k); await c.wait(400); } });
    }
  });

  /* 17 --------------------------------------------------------------- */
  S.push({
    id: 'recap', tag: 'Recap',
    title: 'Five rules for a cache that works',
    alt: 'Five design rules for prompt caching, and where to go next.',
    text: 'Caching changed the cost of long prompts. The stable part is processed once and reused at about a tenth of the price. Five habits keep that saving intact.',
    takeaway: 'Treat the prefix as immutable and isolate every source of variation at the very end.',
    mount(c) {
      const facts = [
        ['Keep the prefix identical.', 'Variation belongs in a small tail at the end of the request.'],
        ['Order layers: tools, system, messages.', 'A change invalidates its own layer and everything after it.'],
        ['Hunt the silent killers.', 'Timestamps, unstable JSON key order and mid-prefix blobs.'],
        ['Count the reuses.', 'A cache pays back after one reuse (5 minutes) or two (1 hour).'],
        ['Shared caches leak timing.', 'Isolate per organization, and expect hits only within your own traffic.']
      ];
      const h = c.html(`<ol class="recap">${facts.map((r, i) => `<li style="opacity:.18"><span class="n">${i + 1}</span><div><b>${r[0]}</b><small>${r[1]}</small></div></li>`).join('')}</ol>
        <p class="kicker" style="margin:14px 0 6px">Related lessons</p>
        <div class="nextchips"><a class="chip" href="#lesson-4">Lesson 4: why a token takes 30 ms</a><a class="chip" href="#lesson-2">Lesson 2: how an AI agent works</a></div>`, 'recapwrap');
      c.play(async () => { for (const li of h.qa('li')) { await c.fx(li, { o: 1 }, 450); await c.wait(450); } });
    }
  });

  /* 18 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Six questions. Each has a short explanation, right or wrong.',
    quiz: [
      { q: 'What must be true for a prompt cache hit?', o: ['The request has the same length as a cached one', 'The request starts with exactly the same tokens as a cached one', 'The request uses the same user account name', 'The request arrives within one second'], a: 1, why: 'Keys and values depend on every token before them, so reuse works only for an identical prefix.' },
      { q: 'Which edit throws away the most cached work?', o: ['Adding a new message at the end', 'Editing the last message', 'Editing the system prompt', 'Editing a tool definition'], a: 3, why: 'Tools come first, so changing one invalidates the tools, the system prompt and all messages after it.' },
      { q: 'Why does a timestamp at the top of the system prompt hurt caching?', o: ['It adds many tokens', 'It changes every request, so the first difference sits near the top', 'It is not allowed by providers', 'It slows decoding'], a: 1, why: 'Everything after the first changed token is recomputed. A change near the top leaves almost nothing to reuse.' },
      { q: 'With a 5-minute Anthropic cache (write 1.25×, hit 0.1×), when does caching first beat no caching?', o: ['On the first request', 'On the second request', 'After ten requests', 'Never'], a: 1, why: 'Two requests cost 1.25 + 0.1 = 1.35 units with caching against 2 without.' },
      { q: 'Why can a design like MLA keep its cache on disk?', o: ['Disks are as fast as GPU memory', 'The cache is about 60× smaller, so it is cheap to store and reload', 'The cache is encrypted', 'The model skips prefill entirely'], a: 1, why: 'A small latent vector replaces the key and value, so reading it back costs less than recomputing.' },
      { q: 'What does the timing side channel reveal?', o: ['The model weights', 'Whether someone else already sent a given prefix', 'The price of a request', 'The GPU temperature'], a: 1, why: 'A fast first token means a cache hit, which means another request already carried that prefix.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice">' +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect class="${i < 6 ? 'a' : 'c'}" x="${24 + i * 35}" y="38" width="30" height="22" rx="6" style="fill:${i < 6 ? 'var(--ok-soft)' : 'var(--cmp-soft)'};stroke:${i < 6 ? 'var(--ok)' : 'var(--cmp)'};stroke-width:1.5"/>`).join('') +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect class="${i < 7 ? 'b' : 'c'}" x="${24 + i * 35}" y="86" width="30" height="22" rx="6" style="fill:${i < 7 ? 'var(--ok-soft)' : 'var(--cmp-soft)'};stroke:${i < 7 ? 'var(--ok)' : 'var(--cmp)'};stroke-width:1.5"/>`).join('') +
    '<text x="24" y="28" style="font:600 11px var(--font-mono);fill:var(--ink-3)">request 1</text><text x="24" y="126" style="font:600 11px var(--font-mono);fill:var(--ink-3)">request 2: same start, reused</text></svg>';

  window.LESSONS.push({
    id: 'caching', n: 3,
    title: 'Prompt Caching',
    tagline: 'Why the same prompt should be paid for once, and what quietly breaks the saving.',
    preview,
    scenes: S
  });
})();
