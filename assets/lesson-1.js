/* Lesson 1: One question, 18 layers */
(function () {
  'use strict';
  const { fmt, esc } = window.LLMI;
  const LAYERS = ['Key matrix', 'Debounce', 'USB report', 'Browser', 'TLS', 'Packets', 'BGP routing', 'Fiber optics', 'Data center', 'GPU', 'Transformer', 'Software stack', 'OS and driver', 'Warps', 'Logic gates', 'Chip fabrication', 'Transistors', 'Electrons'];
  const S = [];

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'intro', tag: 'The question',
    title: 'A quarter second. Eighteen layers.',
    alt: 'A question is typed and an answer appears in a quarter of a second. Below it, a map of the eighteen layers this lesson descends through, starting with the keyboard and ending with electrons.',
    text: 'You type a question. About a quarter second later, an answer appears. This lesson follows that quarter second down through **18 layers**, starting at your fingertip and ending at single electrons. Each layer solves one problem so the layer above does not have to.',
    takeaway: 'Nothing here is mysterious. Each layer is a plain machine built on the one below it.',
    mount(c) {
      const h = c.html(`<div class="chatmock"><div><span class="cm-l">You</span><span><span id="q"></span><i class="caret"></i></span></div><div class="cm-a" style="opacity:.25"><span class="cm-l">Answer</span><span>Sunlight scatters off air molecules. Blue light scatters most, so the sky looks blue.</span></div><div class="cm-t"><span class="m" id="t">0.00 s</span><span class="meter"><i style="width:0"></i></span></div></div><ol class="map18">${LAYERS.map((l, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${l}</li>`).join('')}</ol>`);
      c.play(async () => {
        await c.type(h.q('#q'), 'Why is the sky blue?', 22);
        await c.wait(250);
        const bar = h.q('.cm-t .meter i');
        await c.tween(1000, p => { h.q('#t').textContent = (p * 0.25).toFixed(2) + ' s'; bar.style.width = (p * 100) + '%'; }, c.ease.lin);
        h.q('.cm-a').style.opacity = 1;
        await c.wait(350);
        for (const li of h.qa('.map18 li')) { li.classList.add('on'); await c.wait(130); }
      });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'matrix', layer: 1, tag: 'Your fingertip',
    title: 'A keyboard scans a grid',
    alt: 'A grid of sixteen keys with row and column wires. The controller powers one row at a time and listens on the columns. A pressed key connects its row to its column. Direct wiring would need one wire per key.',
    text: 'A full keyboard does not run 104 wires to the controller. Keys sit on a **grid**: 6 rows and 18 columns make 24 wires. The controller powers one row at a time and listens on the columns. A pressed key connects its row to its column, so the controller knows exactly which one it was.',
    hint: 'Click keys to press them, then compare matrix wiring with one wire per key.',
    takeaway: 'Scanning a grid trades a little time for a lot fewer wires. A real controller scans thousands of times a second.',
    mount(c) {
      const K = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V', '1', '2', '3', '4'];
      const cx = j => 118 + j * 66, ry = i => 118 + i * 52;
      let wm = '', wd = '', keys = '';
      wm += `<rect class="t-ctl" x="12" y="${ry(0) - 22}" width="48" height="${ry(3) - ry(0) + 44}" rx="10"/><text class="b xs" x="36" y="${(ry(0) + ry(3)) / 2}" text-anchor="middle" transform="rotate(-90 36 ${(ry(0) + ry(3)) / 2})">powers one row</text>`;
      wm += `<rect class="t-ctl" x="${cx(0) - 40}" y="16" width="${cx(3) - cx(0) + 80}" height="34" rx="9"/><text class="b xs" x="${(cx(0) + cx(3)) / 2}" y="38" text-anchor="middle">reads the columns</text>`;
      for (let i = 0; i < 4; i++) wm += `<path id="rw${i}" class="ln" d="M60 ${ry(i)} H${cx(3) + 32}"/><text class="m xs mute" x="${cx(3) + 40}" y="${ry(i) + 4}">R${i}</text>`;
      for (let j = 0; j < 4; j++) wm += `<path id="cw${j}" class="ln" d="M${cx(j)} 50 V${ry(3) + 30}"/><text class="m xs mute" x="${cx(j)}" y="${ry(3) + 46}" text-anchor="middle">C${j}</text>`;
      wd += `<rect class="t-ctl" x="12" y="16" width="100" height="36" rx="9"/><text class="b xs" x="62" y="39" text-anchor="middle">controller</text>`;
      K.forEach((k, n) => { const i = Math.floor(n / 4), j = n % 4; wd += `<path id="dw${n}" class="ln thin" d="M62 52 L${cx(j) - 22} ${ry(i)}"/>`; keys += `<g class="clk" id="k${n}" data-n="${n}" role="button" tabindex="0" aria-label="Key ${k}"><rect id="kr${n}" class="box" x="${cx(j) - 22}" y="${ry(i) - 17}" width="44" height="34" rx="8"/><text class="b" x="${cx(j)}" y="${ry(i) + 5}" text-anchor="middle">${k}</text></g>`; });
      const f = c.fig(420, 352, `<g id="gm">${wm}</g><g id="gd" style="opacity:0">${wd}</g>${keys}`);
      const pressed = new Set(); let mode = 'matrix';
      const st = c.stats([{ k: 'w', label: 'Wires for these 16 keys', value: '8', cls: 'ok', sub: '4 rows + 4 columns' }, { k: 'f', label: 'Wires for 104 keys', value: '24', sub: 'matrix, versus 104 direct' }, { k: 'd', label: 'Keys detected', value: 'none' }]);
      function paint() {
        K.forEach((k, n) => { const on = pressed.has(n); f.q('#kr' + n).setAttribute('class', on ? 't-ctl' : 'box'); f.q('#dw' + n).setAttribute('class', 'ln thin' + (mode === 'direct' && on ? ' s-data s3' : '')); });
        st.set('d', pressed.size ? Array.from(pressed).sort((a, b) => a - b).map(n => K[n]).join(' ') : 'none');
        f.q('#gm').style.opacity = mode === 'matrix' ? 1 : 0; f.q('#gd').style.opacity = mode === 'direct' ? 1 : 0;
        st.set('w', mode === 'matrix' ? '8' : '16', mode === 'matrix' ? '4 rows + 4 columns' : 'one per key'); st.set('f', mode === 'matrix' ? '24' : '104', mode === 'matrix' ? 'matrix, versus 104 direct' : 'one wire per key');
        st.cls('w', mode === 'matrix' ? 'ok' : 'bad');
      }
      const toggle = n => { pressed.has(n) ? pressed.delete(n) : pressed.add(n); paint(); };
      f.qa('.clk').forEach(g => { c.on(g, 'click', () => toggle(+g.dataset.n)); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(+g.dataset.n); } }); });
      c.seg({ label: 'Wiring', options: [['matrix', 'Matrix (rows and columns)'], ['direct', 'One wire per key']], value: 'matrix', onChange: v => { mode = v; paint(); if (v === 'direct') c.say('Direct wiring: every key needs its own wire back to the controller.'); } });
      c.forever(async () => {
        if (mode !== 'matrix') { await c.wait(250); return; }
        for (let r = 0; r < 4 && mode === 'matrix'; r++) {
          f.q('#rw' + r).setAttribute('class', 'ln s-cmp s3');
          const hits = [];
          for (let j = 0; j < 4; j++) if (pressed.has(r * 4 + j)) { f.q('#cw' + j).setAttribute('class', 'ln s-data s3'); hits.push(K[r * 4 + j]); }
          c.say(hits.length ? `Row ${r} is powered. Column ${hits.length > 1 ? 's' : ''} light up, so **${hits.join(' and ')}** ${hits.length > 1 ? 'are' : 'is'} down.` : `Row ${r} is powered. No column answers.`);
          await c.wait(340);
          f.q('#rw' + r).setAttribute('class', 'ln'); for (let j = 0; j < 4; j++) f.q('#cw' + j).setAttribute('class', 'ln');
        }
      });
      paint();
      c.demo(1800, async () => { toggle(5); await c.wait(1500); toggle(6); await c.wait(1500); toggle(5); toggle(6); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'debounce', layer: 2, tag: 'Your fingertip',
    title: 'One press, dozens of edges',
    alt: 'An oscilloscope trace of a key press. The voltage chatters for up to 5 milliseconds before settling. Without debouncing every rising edge counts as a press. With debouncing firmware waits for a stable signal and registers one press.',
    text: 'Mechanical contacts do not close cleanly. They **bounce**, and the signal chatters for up to 5 ms. Without a fix, one press registers as many. The firmware **debounces**: it waits until the signal has been steady for 5 ms, then reports a single press.',
    hint: 'Press the key again, then switch the debounce filter on and off.',
    takeaway: 'Your finger sends one press. The metal sends a burst of edges. Firmware filters the burst.',
    mount(c) {
      const X0 = 40, XW = 360, TMAX = 14, tx = t => X0 + t / TMAX * XW;
      const f = c.fig(420, 262, `
        <defs><clipPath id="clipS"><rect id="clipR" x="0" y="0" width="0" height="262"/></clipPath></defs>
        <text class="b sm" x="20" y="22">Voltage at the switch</text>
        <text class="m xs mute" x="${X0 - 6}" y="52" text-anchor="end">1</text><text class="m xs mute" x="${X0 - 6}" y="100" text-anchor="end">0</text>
        <line class="grid" x1="${X0}" x2="${X0 + XW}" y1="48" y2="48"/><line class="grid" x1="${X0}" x2="${X0 + XW}" y1="96" y2="96"/>
        <g clip-path="url(#clipS)"><path id="raw" class="s-data s2" d=""/></g>
        <text class="b sm" x="20" y="146">What the firmware reports</text>
        <line class="axis" x1="${X0}" x2="${X0 + XW}" y1="206" y2="206"/>
        <g clip-path="url(#clipS)"><g id="ticks"></g></g>
        ${[0, 2, 4, 6, 8, 10, 12, 14].map(t => `<text class="m xs mute" x="${tx(t)}" y="226" text-anchor="middle">${t}</text>`).join('')}
        <text class="xs mute" x="${X0 + XW}" y="246" text-anchor="end">milliseconds</text>
        <path id="sweep" class="ln thin" d="M${X0} 36 V210" style="opacity:.5"/>`);
      const st = c.stats([{ k: 'e', label: 'Edges on the wire', value: '0', cls: 'data' }, { k: 'p', label: 'Presses reported', value: '0', cls: 'cmp', sub: 'you pressed once' }]);
      let on = true, edges = [], run = 0;
      function gen() {
        const out = [], t0 = 1.0, dur = c.rnd(3.4, 5.0); let t = t0, v = 1;
        out.push({ t, v });
        while (t < t0 + dur) { t += c.rnd(0.07, 0.4); v = 1 - v; out.push({ t, v }); }
        if (v === 0) { t += c.rnd(0.07, 0.3); out.push({ t, v: 1 }); }
        return out;
      }
      function build() {
        let d = `M${tx(0)} 96`, prev = 0;
        edges.forEach(e => { d += ` H${tx(e.t)} V${e.v ? 48 : 96}`; prev = e.v; });
        d += ` H${tx(TMAX)}`;
        f.q('#raw').setAttribute('d', d);
        const rising = edges.filter(e => e.v === 1).map(e => e.t), last = edges[edges.length - 1].t;
        const marks = on ? [last + 5] : rising;
        f.q('#ticks').innerHTML = marks.map(t => `<path class="s-cmp s3" d="M${tx(t)} 206 V164" style="stroke:var(--cmp)"/><circle class="f-cmp" cx="${tx(t)}" cy="160" r="4"/>`).join('');
        return { marks, rising, last };
      }
      async function press() {
        const id = ++run; edges = gen(); const info = build();
        st.set('e', '0'); st.set('p', '0');
        await c.tween(2600, p => {
          if (id !== run) return;
          const t = p * TMAX; f.q('#clipR').setAttribute('width', tx(0) + p * (tx(TMAX) - tx(0)) + 4); c.place(f.q('#sweep'), { x: p * XW });
          st.set('e', edges.filter(e => e.t <= t).length); st.set('p', info.marks.filter(m => m <= t).length);
        }, c.ease.lin);
      }
      const tg = c.toggle({ label: 'Debounce filter (wait 5 ms for a steady signal)', value: true, onChange: v => { on = v; press(); } });
      c.btn('Press the key again', () => press(), { kind: 'pri', small: true });
      c.note('Each bounce is a rapid on and off as the metal contacts settle. Real firmware samples the pin every millisecond or faster.');
      c.play(async () => { on = false; tg.set(false); await press(); await c.wait(900); on = true; tg.set(true); await press(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'usb', layer: 3, tag: 'Your fingertip',
    title: 'Your key press becomes eight bytes',
    alt: 'A USB keyboard report: one byte of modifier bits, one reserved byte, and up to six key codes. Pressing keys on the keyboard changes the bytes.',
    text: 'The controller sends the key state to the computer as a **USB packet of eight bytes**: one byte of modifier bits (Ctrl, Shift, Alt), one reserved byte, and up to **six** key codes at once. Your motion is now data.',
    hint: 'Press keys on the mini keyboard. Try Shift with a letter, then press seven letters.',
    takeaway: 'Everything you do on a keyboard fits in eight bytes: modifiers, a spare byte and six slots.',
    mount(c) {
      const MODS = [['Ctrl', 0x01], ['Shift', 0x02], ['Alt', 0x04]];
      const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
      const code = ch => ch === 'Enter' ? 0x28 : ch === 'Space' ? 0x2C : 0x04 + ch.charCodeAt(0) - 65;
      const BITS = ['RGui', 'RAlt', 'RShift', 'RCtrl', 'LGui', 'LAlt', 'LShift', 'LCtrl'];
      const h = c.html(`<div class="kbd">${MODS.map(m => `<button type="button" class="mod" data-m="${m[1]}">${m[0]}</button>`).join('')}<span class="sp"></span>${ROWS.map(r => r.split('').map(ch => `<button type="button" data-k="${ch}">${ch}</button>`).join('') + '<span class="sp"></span>').join('')}<button type="button" data-k="Enter">Enter</button><button type="button" data-k="Space">Space</button></div>
        <div class="bytes" id="by"></div><div class="bits" id="bi"></div><p class="kicker" style="margin:6px 0 0">Byte 0 holds the modifier bits: a 1 means that key is down</p>`);
      let mods = 0, keys = [];
      function render() {
        const b = [mods, 0].concat(Array.from({ length: 6 }, (_, i) => keys[i] || 0)), L = ['Modifiers', 'Reserved', 'Key 1', 'Key 2', 'Key 3', 'Key 4', 'Key 5', 'Key 6'];
        h.q('#by').innerHTML = b.map((v, i) => `<div class="${v ? 'on' : ''}"><b>${v.toString(16).toUpperCase().padStart(2, '0')}</b><small>${L[i]}</small></div>`).join('');
        h.q('#bi').innerHTML = BITS.map((n, i) => `<span class="${mods & (1 << (7 - i)) ? 'on' : ''}">${n}</span>`).join('');
        h.qa('.kbd .mod').forEach(bn => bn.classList.toggle('dn', !!(mods & +bn.dataset.m)));
        h.qa('.kbd [data-k]').forEach(bn => bn.classList.toggle('dn', keys.indexOf(code(bn.dataset.k)) >= 0));
      }
      h.qa('.kbd .mod').forEach(bn => c.on(bn, 'click', () => { mods ^= +bn.dataset.m; render(); }));
      h.qa('.kbd [data-k]').forEach(bn => c.on(bn, 'click', () => {
        const k = code(bn.dataset.k), i = keys.indexOf(k);
        if (i >= 0) keys.splice(i, 1); else if (keys.length < 6) keys.push(k); else c.say('**Only six key slots.** The seventh key is ignored in this report format.');
        render();
      }));
      c.btn('Release all keys', () => { mods = 0; keys = []; render(); c.say(''); }, { small: true });
      c.note('Key codes follow the USB HID table: A is 04, B is 05, and so on up to Z at 1D. Left Shift is bit 1 of the modifier byte.');
      render();
      c.demo(1800, async () => { mods = 2; render(); await c.wait(900); keys = [code('H')]; render(); await c.wait(1100); keys.push(code('E')); render(); await c.wait(1100); mods = 0; keys = []; render(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'dom-events', layer: 4, tag: 'Your browser',
    title: 'A keystroke is an event that travels a tree',
    alt: 'A tree of page elements. A key event travels down the tree to the input, then back up. Listeners on the way run in order on the way up.',
    text: 'The USB packet reaches your browser, and JavaScript springs to life. The key press becomes an **event** that travels through the [[dom|DOM]], the tree of page elements. It goes **down** to the input (capture), then **back up** (bubble). Any listener on the way can react.',
    hint: 'Click an element to add or remove a listener, then press a key.',
    takeaway: 'One keystroke can trigger code on every element between the top of the page and the input.',
    mount(c) {
      const N = [['html', 210, 30, null], ['head', 96, 96, 0, 1], ['body', 250, 96, 0], ['header', 168, 162, 2, 1], ['div#app', 306, 162, 2], ['form', 306, 228, 4], ['input', 246, 294, 5], ['button', 366, 294, 5, 1]];
      const canL = [0, 2, 5, 6], on = new Set([2, 6]);
      let edges = '', nodes = '';
      N.forEach((n, i) => { if (n[3] != null) edges += `<path class="ln" d="M${N[n[3]][1]} ${N[n[3]][2] + 14} L${n[1]} ${n[2] - 14}" ${n[4] ? 'style="opacity:.35"' : ''}/>`; });
      N.forEach((n, i) => { nodes += `<g class="${canL.indexOf(i) >= 0 ? 'clk' : ''}" id="n${i}" data-i="${i}" ${canL.indexOf(i) >= 0 ? 'role="button" tabindex="0" aria-label="Toggle listener on ' + n[0] + '"' : ''} ${n[4] ? 'style="opacity:.45"' : ''}><rect id="nr${i}" class="box" x="${n[1] - 38}" y="${n[2] - 14}" width="76" height="28" rx="7"/><text class="m xs b" x="${n[1]}" y="${n[2] + 4}" text-anchor="middle">${n[0]}</text><g id="lb${i}" style="opacity:0"><circle class="f-ctl" cx="${n[1] + 38}" cy="${n[2] - 14}" r="8"/><text class="xs b" x="${n[1] + 38}" y="${n[2] - 10}" text-anchor="middle" style="fill:var(--on-accent)">L</text></g></g>`; });
      const f = c.fig(420, 340, `<text class="b sm" x="20" y="22">Page elements</text>${edges}${nodes}<g id="ev" transform="translate(210 8)"><circle class="f-data" r="8" stroke="var(--stage)" stroke-width="2"/></g><text id="ph" class="b sm" x="20" y="326"></text>`);
      c.legend([['cmp', 'Capture: down'], ['data', 'Bubble: up'], ['ctl', 'Listener (L)']]);
      const log = c.html('<ol class="reqlist" id="lg"></ol>', 'reqs');
      const ev = f.q('#ev'), ph = f.q('#ph');
      function marks() { N.forEach((n, i) => { f.q('#lb' + i).style.opacity = on.has(i) ? 1 : 0; }); }
      let busy = false;
      async function press() {
        if (busy) return; busy = true; log.q('#lg').innerHTML = ''; const order = [0, 2, 4, 5, 6];
        const at = i => c.fx(ev, { x: N[i][1], y: N[i][2] - 24 }, 380, c.ease.io);
        c.place(ev, { x: 210, y: 8, o: 1 }); ev.firstElementChild.setAttribute('class', 'f-cmp');
        ph.textContent = 'Capture phase: the event travels down';
        for (const i of order) await at(i);
        ev.firstElementChild.setAttribute('class', 'f-data'); ph.textContent = 'Bubble phase: the event travels back up';
        let k = 0;
        for (const i of order.slice().reverse()) {
          await at(i);
          if (on.has(i)) { k++; f.q('#nr' + i).setAttribute('class', 't-ctl'); log.q('#lg').insertAdjacentHTML('beforeend', `<li class="done"><span class="n">${k}</span><span><b>${N[i][0]}</b> listener ran</span></li>`); await c.wait(260); f.q('#nr' + i).setAttribute('class', 'box'); }
        }
        await c.fx(ev, { y: 8, o: 0 }, 300); ph.textContent = k ? k + ' listener' + (k > 1 ? 's' : '') + ' ran, input first.' : 'No listeners attached. Nothing reacted.';
        busy = false;
      }
      f.qa('.clk').forEach(g => { const i = +g.dataset.i, t = () => { on.has(i) ? on.delete(i) : on.add(i); marks(); }; c.on(g, 'click', t); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); });
      c.btn('Press a key', () => press(), { kind: 'pri', small: true });
      marks();
      c.play(async () => { await c.wait(400); await press(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'frame', layer: 4, tag: 'Your browser',
    title: 'A frame has 16.7 ms',
    alt: 'A timeline of frames. Style, layout, paint and composite take about 13 ms. A screen refreshes every 16.7 milliseconds. Extra JavaScript that pushes the work past that misses a refresh and halves the frame rate.',
    text: 'The page must recalculate styles, compute layout, paint pixels and composite layers **60 times a second**. That leaves **16.7 ms** per frame. The browser needs about 13 ms of it. If your code adds enough work to miss the next screen refresh, the frame is dropped and the page stutters.',
    hint: 'Add JavaScript work per frame and watch the frame rate fall in steps.',
    takeaway: 'A frame that misses a refresh waits for the next one, so 17 ms of work is fine and 18 ms halves your frame rate.',
    mount(c) {
      const V = 1000 / 60, X0 = 20, XW = 380, TM = 200, tx = t => X0 + t / TM * XW;
      const SEG = [['Style', 3, 'ctl'], ['Layout', 4, 'mem'], ['Paint', 4, 'data'], ['Composite', 2, 'ok']];
      const f = c.fig(420, 252, `<text class="b sm" x="20" y="22">Frames over 200 ms</text><g id="ticks"></g><g id="frames"></g><path id="ph" class="ln" d="M20 40 V176" style="stroke:var(--ink);opacity:.6"/>${[0, 50, 100, 150, 200].map(t => `<text class="m xs mute" x="${tx(t)}" y="208" text-anchor="middle">${t}</text>`).join('')}<text class="xs mute" x="400" y="228" text-anchor="end">milliseconds</text>`);
      c.legend([['cmp', 'Your JavaScript'], ['ctl', 'Style'], ['mem', 'Layout'], ['data', 'Paint'], ['ok', 'Composite']]);
      const st = c.stats([{ k: 'w', label: 'Work per frame', value: '', cls: 'cmp' }, { k: 'f', label: 'Frames per second', value: '', cls: 'ok' }, { k: 'd', label: 'Missed refreshes', value: '' }]);
      let extra = 0;
      function draw() {
        const W = 13 + extra, period = Math.ceil((W - 1e-6) / V) * V;
        let tk = '', fr = '', t = 0, n = 0;
        for (let v = 0; v * V <= TM; v++) tk += `<path class="grid" d="M${tx(v * V)} 36 V180"/>`;
        while (t < TM && n < 14) {
          let x = t; const parts = (extra ? [['JS', extra, 'cmp']] : []).concat(SEG);
          parts.forEach(([nm, w, role]) => { fr += `<rect class="f-${role}" x="${tx(x)}" y="70" width="${Math.max(0.8, w / TM * XW - 0.8)}" height="54" rx="2"/>`; x += w; });
          fr += `<text class="m xs mute" x="${tx(t)}" y="62">${n + 1}</text>`;
          if (period > V + 0.1) for (let k = 1; k < Math.round(period / V); k++) fr += `<path class="s-bad s2" d="M${tx(t + k * V)} 134 V176" style="stroke:var(--bad)"/><text class="xs b" x="${tx(t + k * V) + 3}" y="150">missed</text>`;
          t += period; n++;
        }
        f.q('#ticks').innerHTML = tk; f.q('#frames').innerHTML = fr;
        st.set('w', W.toFixed(0) + ' ms', 'budget 16.7 ms'); st.set('f', (1000 / period).toFixed(0), period > V + 0.1 ? 'below 60' : 'full speed'); st.set('d', period > V + 0.1 ? Math.round(period / V) - 1 + ' per frame' : 'none');
        st.cls('f', period > V + 0.1 ? 'bad' : 'ok');
      }
      const sl = c.slider({ label: 'Extra JavaScript per frame (ms)', min: 0, max: 40, step: 1, value: 0, fmt: v => v + ' ms', onInput: v => { extra = v; draw(); } });
      draw();
      let ph = 0; c.loop(dt => { ph = (ph + dt / 3200) % 1; f.q('#ph').setAttribute('d', `M${X0 + ph * XW} 40 V176`); });
      c.play(async () => { for (const v of [0, 4, 10, 25, 0]) { await c.wait(1100); extra = v; sl.set(v, true); draw(); } });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'request', layer: 4, tag: 'Your browser',
    title: 'Enter builds an HTTP request',
    alt: 'An HTTP request shown as text: a method and path, headers, and a JSON body containing your question. The question can be edited and the body length updates.',
    text: 'When you press Enter, the fetch API builds an **HTTP request**: a method and path, headers, and your question as the payload. Then it hands the request to the network stack. Your intention is now text that a server can parse.',
    hint: 'Type your own question and watch the request change.',
    takeaway: 'The whole conversation with a server is plain structured text until the next layer scrambles it.',
    mount(c) {
      const h = c.html('<pre class="codeblk" id="rq"></pre><p class="note" id="nt" style="margin:8px 0 0"></p>');
      let q = 'Why is the sky blue?', shown = 99;
      const lines = () => {
        const body = JSON.stringify({ messages: [{ role: 'user', content: q }] }), len = new TextEncoder().encode(body).length;
        return [`<span class="k">POST</span> /v1/chat HTTP/1.1`, `Host: api.example.com`, `Content-Type: application/json`, `Content-Length: ${len}`, `Authorization: Bearer sk-...`, ``, `<span class="s">${esc(body)}</span>`];
      };
      function render() { const L = lines(); h.q('#rq').innerHTML = L.slice(0, shown).join('\n'); h.q('#nt').innerHTML = '<b>Method and path</b> say what to do. <b>Headers</b> describe the message. The <b>body</b> carries your question.'; }
      const tx = c.text({ label: 'Your question', value: q, max: 60, onInput: v => { q = v || ' '; render(); } });
      render();
      c.play(async () => { for (shown = 1; shown <= 7; shown++) { render(); await c.wait(380); } shown = 99; render(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'tls', layer: 5, tag: 'On the wire',
    title: 'Two strangers agree on a secret in public',
    alt: 'A browser and a server each pick a private number, exchange public values, and both compute the same shared secret. Anyone watching sees only the public values. A brute force demonstration shows why large numbers make guessing hopeless.',
    text: 'Anyone can listen to your request on the network. In 1976 Diffie and Hellman showed how two sides can agree on a secret **in public**. Each sends a value built from a private number. Both compute the **same** secret, and it never crosses the wire. [[tls|TLS]] uses elliptic curves, then encrypts with [[aes|AES]]. This demo uses small numbers you can check by hand.',
    hint: 'Pick the private numbers, run the exchange, then try the eavesdropper.',
    takeaway: 'The secret never crosses the wire. With real 256-bit numbers, guessing it is out of reach.',
    mount(c) {
      const P = 23, G = 5, mp = (b, e, m) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
      let a = 6, b = 15, run = 0;
      const h = c.html(`<div class="dh">
        <div class="dhc"><b>Browser</b><div class="r" data-r="1"><span>private a</span><code id="va">6</code></div><div class="r" data-r="2"><span>public A = g<sup>a</sup> mod p</span><code id="vA"></code></div></div>
        <div class="dhc"><b>Server</b><div class="r" data-r="1"><span>private b</span><code id="vb">15</code></div><div class="r" data-r="2"><span>public B = g<sup>b</sup> mod p</span><code id="vB"></code></div></div>
        <div class="dhw" data-r="3"><span>On the wire, readable by anyone:</span><code id="wire"></code></div>
        <div class="dhc" data-r="4"><div class="r"><span>secret = B<sup>a</sup> mod p</span><code id="s1"></code></div></div>
        <div class="dhc" data-r="4"><div class="r"><span>secret = A<sup>b</sup> mod p</span><code id="s2"></code></div></div>
        <div class="dhw eve" id="eve"><span><b>Eavesdropper.</b> She knows p, g, A and B. To get the secret she needs a or b. She tries every value:</span><code id="guess">press the button to start</code></div></div>
        <div class="dhw enc" id="enc" style="opacity:.25"><span>Both sides now encrypt with AES-256 using a key derived from the secret</span><code id="ct">Why is the sky blue?</code></div>`);
      const st = c.stats([{ k: 'g', label: 'Toy numbers: guesses needed', value: '–', cls: 'cmp' }, { k: 'r', label: '256-bit curve: best known attack', value: '≈ 2¹²⁸ steps', sub: 'about 3 × 10³⁸' }, { k: 'y', label: 'At 10¹⁸ guesses per second', value: '≈ 10 trillion years' }]);
      const SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
      const sup = n => String(n).replace(/[0-9]/g, d => SUPD[d]);
      const hex = (seed, n) => { let s = seed >>> 0, o = ''; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; o += (s >>> 24).toString(16).padStart(2, '0') + (i % 2 ? ' ' : ''); } return o.trim(); };
      function show() { const A = mp(G, a, P), B = mp(G, b, P), s1 = mp(B, a, P), s2 = mp(A, b, P); h.q('#va').textContent = a; h.q('#vb').textContent = b; h.q('#vA').textContent = `${G}${sup(a)} mod ${P} = ${A}`; h.q('#vB').textContent = `${G}${sup(b)} mod ${P} = ${B}`; h.q('#wire').textContent = `p = ${P}, g = ${G}, A = ${A}, B = ${B}`; h.q('#s1').textContent = `${B}${sup(a)} mod ${P} = ${s1}`; h.q('#s2').textContent = `${A}${sup(b)} mod ${P} = ${s2}`; h.q('#ct').textContent = hex(s1 * 7919 + 13, 10); return { A, B, s: s1 }; }
      async function exchange() {
        const id = ++run; const rows = h.qa('[data-r]'); rows.forEach(r => r.style.opacity = r.dataset.r === '1' ? 1 : 0.15); h.q('#enc').style.opacity = 0.25; show();
        for (const k of ['2', '3', '4']) { await c.wait(700); if (id !== run) return; rows.filter(r => r.dataset.r === k).forEach(r => r.style.opacity = 1); }
        await c.wait(600); h.q('#enc').style.opacity = 1; h.q('#ct').textContent = 'Why is the sky blue?'; await c.wait(700); show();
      }
      async function brute() {
        const { A } = show(); const id = ++run, out = h.q('#guess'); out.textContent = '';
        for (let k = 1; k <= P - 1; k++) {
          const v = mp(G, k, P); out.textContent = `a = ${k}: ${G}${sup(k)} mod ${P} = ${v}` + (v === A ? '   match. She found a.' : '');
          await c.wait(170); if (id !== run) return;
          if (v === A) { st.set('g', k + ' of ' + (P - 1), 'trivial with small numbers'); return; }
        }
      }
      c.slider({ label: 'Browser private number a', min: 1, max: 22, step: 1, value: 6, fmt: v => v, onInput: v => { a = v; exchange(); } });
      c.slider({ label: 'Server private number b', min: 1, max: 22, step: 1, value: 15, fmt: v => v, onInput: v => { b = v; exchange(); } });
      c.btn('Run the exchange', () => exchange(), { kind: 'pri', small: true });
      c.btn('Eavesdropper tries every value', () => brute(), { small: true });
      c.note('The ciphertext is illustrative: real AES-256 output looks like random bytes. Elliptic-curve TLS uses a different formula but the same idea.');
      show();
      c.play(async () => { await exchange(); await c.wait(700); await brute(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'packets', layer: 6, tag: 'On the wire',
    title: 'Your message gets wrapped in layers of headers',
    alt: 'Nested boxes. The encrypted request is wrapped by a TCP header, then an IP header, then an Ethernet header and checksum. Each layer handles one concern.',
    text: 'The network cannot send a request as one piece. Each layer wraps your data in its own header, one concern per layer. **TCP** adds 20 bytes: sequence numbers so packets arrive in order. **IP** adds 20 to 40 bytes: where it came from and where it goes, plus a [[ttl|time-to-live]] counter. **Ethernet** adds its own header and a checksum.',
    hint: 'Click a layer to see the fields it adds.',
    takeaway: 'Five layers, each handling one concern, around the same bytes you started with.',
    mount(c) {
      const B = [
        ['pe', 'Ethernet frame: +14 B header, +4 B checksum', '', 392, 250, 'cmp', 'Ethernet adds the destination and source hardware (MAC) addresses and a type. A 4 byte checksum at the end lets the receiver detect corruption.'],
        ['pi', 'IP packet: +20 B (IPv4) or 40 B (IPv6)', '', 332, 180, 'ctl', 'IP adds the source and destination addresses, the protocol, and a time-to-live (TTL) counter that drops by one at every router so lost packets cannot wander forever.'],
        ['pt', 'TCP segment: +20 B', '', 272, 112, 'mem', 'TCP adds source and destination ports, a sequence number so data arrives in order, an acknowledgment number so lost data is noticed, flags and a window size.'],
        ['pd', 'Your encrypted request', 'about 300 B of ciphertext', 212, 54, 'data', 'The payload is the HTTP request from the last layers, already scrambled by TLS. The layers around it never read it.']
      ];
      const cy = 138;
      const f = c.fig(420, 276, B.map(b => `<g id="${b[0]}" class="clk" role="button" tabindex="0" aria-label="${b[1]}" transform="translate(210 ${cy})" style="opacity:0"><rect class="t-${b[5]}" x="${-b[3] / 2}" y="${-b[4] / 2}" width="${b[3]}" height="${b[4]}" rx="14"/><text class="b sm" x="${-b[3] / 2 + 14}" y="${-b[4] / 2 + 21}">${b[1]}</text>${b[2] ? `<text class="xs" x="${-b[3] / 2 + 14}" y="${-b[4] / 2 + 38}">${b[2]}</text>` : ''}</g>`).reverse().join(''));
      const st = c.stats([{ k: 'a', label: 'Payload', value: '300 B', cls: 'data' }, { k: 'b', label: 'Headers and checksum', value: '+58 B', sub: '20 + 20 + 14 + 4' }, { k: 'c', label: 'On the wire', value: '358 B' }]);
      const show = i => { B.forEach((b, k) => f.q('#' + b[0]).querySelector('rect').style.strokeWidth = k === i ? 3.5 : ''); c.say('**' + B[i][1].split(':')[0] + '.** ' + B[i][6]); };
      B.forEach((b, i) => { const g = f.q('#' + b[0]); c.on(g, 'click', () => show(i)); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } }); });
      c.play(async () => {
        for (let i = B.length - 1; i >= 0; i--) { const g = f.q('#' + B[i][0]); c.place(g, { s: 0.88, o: 0 }); await c.fx(g, { s: 1, o: 1 }, 520, c.ease.out); await c.wait(380); }
        show(2);
      });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'tcp-loss', layer: 6, tag: 'On the wire',
    title: 'TCP notices a missing packet and sends it again',
    alt: 'A sender transmits six numbered packets to a receiver. One is lost on the way. The receiver keeps asking for the missing number, the sender times out and resends it, and all six arrive in order.',
    text: 'The internet drops packets. **TCP** numbers every packet and the receiver acknowledges the next number it expects. When one goes missing the receiver keeps asking for it. After a timeout the sender **sends it again**, and your data arrives complete and in order.',
    hint: 'Send six packets on a perfect network, then on one that loses a packet.',
    takeaway: 'Numbering plus acknowledgments turns an unreliable network into a reliable stream.',
    mount(c) {
      const X1 = 104, X2 = 316, SLOT = i => 62 + i * 50;
      let slots = '';
      for (let i = 0; i < 6; i++) slots += `<rect id="sl${i}" class="well" x="${SLOT(i)}" y="228" width="42" height="32" rx="7"/><text class="m xs mute" x="${SLOT(i) + 21}" y="249" text-anchor="middle">${i + 1}</text>`;
      let pk = '';
      for (let i = 0; i < 6; i++) pk += `<g id="pk${i}" transform="translate(${X1} 134)" style="opacity:0"><rect class="t-data" x="-14" y="-14" width="28" height="28" rx="7"/><text class="b sm" x="0" y="5" text-anchor="middle">${i + 1}</text></g>`;
      const f = c.fig(420, 322, `
        <rect class="t-ctl" x="14" y="108" width="76" height="52" rx="10"/><text class="b sm" x="52" y="139" text-anchor="middle">Sender</text>
        <rect class="t-cmp" x="330" y="108" width="76" height="52" rx="10"/><text class="b sm" x="368" y="139" text-anchor="middle">Receiver</text>
        <line class="ln thin dash" x1="${X1}" x2="${X2}" y1="134" y2="134"/>${pk}
        <text class="b sm" x="20" y="212">Receiver’s buffer</text>${slots}
        <text id="ack" class="m b sm" x="368" y="186" text-anchor="middle">ack 1</text>
        <rect class="well" x="20" y="284" width="380" height="14" rx="5"/><rect id="to" class="f-warn" x="20" y="284" width="0" height="14" rx="5"/><text class="xs mute" x="20" y="316">sender’s timeout timer</text>
        <text id="x" class="b" x="${(X1 + X2) / 2}" y="130" text-anchor="middle" style="fill:var(--bad);opacity:0;font-size:26px">×</text>`);
      const st = c.stats([{ k: 'o', label: 'Arrived in order', value: '–', cls: 'ok' }, { k: 'r', label: 'Resends', value: '0', cls: 'cmp' }]);
      let lossy = false, run = 0;
      async function send() {
        const id = ++run, lost = lossy ? c.rint(1, 4) : -1, got = new Set(), q = i => f.q('#pk' + i);
        for (let i = 0; i < 6; i++) { f.q('#sl' + i).setAttribute('class', 'well'); c.place(q(i), { x: X1, y: 134, o: 0 }); }
        f.q('#ack').textContent = 'ack 1'; f.q('#to').setAttribute('width', 0); st.set('o', '–'); st.set('r', '0'); c.say(lossy ? '' : 'A perfect network: every packet arrives.');
        const ackFor = () => { let n = 0; while (got.has(n)) n++; return n + 1; };
        const flight = async (i, drop) => {
          c.place(q(i), { x: X1, y: 134, o: 1 });
          if (drop) { await c.fx(q(i), { x: 210 }, 460, c.ease.lin); f.q('#x').style.opacity = 1; await c.fx(q(i), { o: 0 }, 300); await c.wait(250); f.q('#x').style.opacity = 0; return; }
          await c.fx(q(i), { x: X2 }, 900, c.ease.lin); if (id !== run) return; c.place(q(i), { o: 0 });
          got.add(i); f.q('#sl' + i).setAttribute('class', 't-data'); const a = ackFor(); f.q('#ack').textContent = 'ack ' + a + (a <= i ? ' (again)' : '');
        };
        const jobs = [];
        for (let i = 0; i < 6; i++) { jobs.push(flight(i, i === lost)); await c.wait(300); if (id !== run) return; }
        await Promise.all(jobs); if (id !== run) return;
        if (lost >= 0) {
          c.say('**Packet ' + (lost + 1) + ' never arrived.** The receiver keeps asking for ' + (lost + 1) + '.');
          await c.tween(900, p => f.q('#to').setAttribute('width', 380 * p), c.ease.lin); if (id !== run) return;
          c.say('**Timeout.** The sender resends packet ' + (lost + 1) + '.'); st.set('r', '1');
          await flight(lost, false); if (id !== run) return;
          f.q('#to').setAttribute('width', 0); c.say('**Packet ' + (lost + 1) + ' arrived.** The receiver acknowledges 7: everything is here, in order.');
        }
        st.set('o', '6 of 6');
      }
      const sg = c.seg({ label: 'Network', options: [[0, 'Perfect'], [1, 'Loses one packet']], value: 0, onChange: v => { lossy = !!+v; } });
      c.btn('Send 6 packets', () => send(), { kind: 'pri', small: true });
      c.play(async () => { lossy = true; sg.set(1); await send(); });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'bgp', layer: 7, tag: 'The internet',
    title: 'Routes follow agreements, not the shortest path',
    alt: 'A map of networks. The shortest path from you to the AI cloud passes through a rival network that has no agreement with yours, so it is refused. The packet takes a longer path through networks that do have agreements.',
    text: 'The internet is over **70,000 independent networks** that agree to pass each other’s traffic. [[bgp|BGP]] does not find the shortest path. It follows politics, economics and business agreements. A router checks a table of **1,000,000+ routes** in microseconds, and a packet may take 10 to 20 hops when two would be shorter.',
    hint: 'Switch between the fewest hops and the path the agreements allow.',
    takeaway: 'A route exists only where two networks agreed to carry traffic for each other.',
    mount(c) {
      const N = { you: ['You', 44, 178], isp: ['Your ISP', 124, 96], t1a: ['Tier-1 A', 226, 54], t1b: ['Tier-1 B', 318, 118], ai: ['AI cloud', 366, 242], rv: ['Rival ISP', 160, 270] };
      const E = [['you', 'isp', 1], ['isp', 't1a', 1], ['t1a', 't1b', 1], ['t1b', 'ai', 1], ['you', 'rv', 0], ['rv', 'ai', 1]];
      const pos = k => ({ x: N[k][1], y: N[k][2] });
      let inner = E.map(([a, b, ok]) => `<path class="ln ${ok ? '' : 'dash'}" d="M${N[a][1]} ${N[a][2]} L${N[b][1]} ${N[b][2]}" style="${ok ? '' : 'stroke:var(--bad);stroke-width:2'}"/>`).join('');
      inner += `<text class="xs b" x="20" y="238" style="fill:var(--bad)">no agreement</text>`;
      Object.keys(N).forEach(k => { inner += `<g transform="translate(${N[k][1]} ${N[k][2]})"><rect x="-38" y="-16" width="76" height="32" rx="9" style="fill:var(--stage)"/><rect class="${k === 'you' ? 't-data' : k === 'ai' ? 't-ctl' : 'box'}" x="-38" y="-16" width="76" height="32" rx="9"/><text class="xs b" y="4" text-anchor="middle">${N[k][0]}</text></g>`; });
      inner += `<g id="pk" transform="translate(44 178)"><circle class="f-data" r="8" stroke="var(--stage)" stroke-width="2"/></g><text id="ttl" class="m b sm" x="20" y="22">TTL 64</text><text id="res" class="b sm" x="20" y="316" style="opacity:0"></text>`;
      const f = c.fig(420, 328, inner);
      c.html('<div class="stats"><div class="stat"><span>Independent networks</span><b>70,000+</b></div><div class="stat"><span>Routes a router holds</span><b>1,000,000+</b></div><div class="stat"><span>Typical path</span><b>10 to 20 hops</b></div></div>');
      let mode = 'bgp', run = 0;
      async function go() {
        const id = ++run, pk = f.q('#pk'); c.place(pk, { x: 44, y: 178, o: 1 }); f.q('#ttl').textContent = 'TTL 64'; f.q('#res').style.opacity = 0;
        const path = mode === 'short' ? ['you', 'rv'] : ['you', 'isp', 't1a', 't1b', 'ai']; let ttl = 64;
        for (let i = 1; i < path.length; i++) {
          if (mode === 'short' && i === 1) { await c.fx(pk, { x: 44 + (N.rv[1] - 44) * 0.42, y: 178 + (N.rv[2] - 178) * 0.42 }, 600, c.ease.io); if (id !== run) return; f.q('#res').textContent = 'Refused: the rival network has no agreement to carry this traffic.'; f.q('#res').style.opacity = 1; await c.fx(pk, { x: 44, y: 178, o: 0 }, 500); return; }
          await c.fx(pk, { x: N[path[i]][1], y: N[path[i]][2] }, 620, c.ease.io); if (id !== run) return;
          if (i < path.length - 1) { ttl--; f.q('#ttl').textContent = 'TTL ' + ttl; }
          await c.wait(160);
        }
        f.q('#res').textContent = 'Delivered over 4 links. Each router lowered the TTL by one.'; f.q('#res').style.opacity = 1; await c.fx(pk, { o: 0 }, 400);
      }
      c.seg({ label: 'Routing rule', options: [['short', 'Fewest hops'], ['bgp', 'What agreements allow']], value: 'bgp', onChange: v => { mode = v; go(); } });
      c.play(async () => { mode = 'short'; await go(); await c.wait(900); mode = 'bgp'; await go(); });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'fiber', layer: 8, tag: 'The internet',
    title: 'For most of the trip, your message is light',
    alt: 'Light bounces along the core of a glass fiber by total internal reflection. A race from New York to London compares light in a vacuum, light in fiber and real cables.',
    text: 'On long hauls your message becomes **light**: photons racing through glass fibers thinner than a hair. Total internal reflection keeps them inside the core. In fiber, light moves at about **two thirds** of its speed in a vacuum, a limit no engineering removes. New York to London is 5,600 km.',
    hint: 'Run the race and compare the finish times.',
    takeaway: 'Distance alone costs about 28 ms across the Atlantic. Cables you can buy get within a couple of milliseconds of that.',
    mount(c) {
      const PX0 = 150, PX1 = 330, runners = [['Light in a vacuum', 18.7, 'data'], ['Light in fiber, ideal', 28.0, 'mem'], ['Best modern cable', 30, 'ctl'], ['Older cables', 40, 'cmp']];
      let zig = 'M24 66'; for (let i = 1; i <= 17; i++) zig += ` L${24 + i * 22} ${i % 2 ? 76 : 56}`;
      const lanes = runners.map((r, i) => `<text class="xs b" x="20" y="${200 + i * 36}">${r[0]}</text><line class="grid" x1="${PX0}" x2="${PX1}" y1="${196 + i * 36}" y2="${196 + i * 36}"/><circle id="r${i}" class="f-${r[2]}" cx="${PX0}" cy="${196 + i * 36}" r="7" stroke="var(--stage)" stroke-width="2"/><text id="rt${i}" class="m xs b" x="${PX1 + 14}" y="${200 + i * 36}" style="opacity:0">${r[1]} ms</text>`).join('');
      const f = c.fig(420, 356, `
        <text class="b sm" x="20" y="20">Inside a fiber</text>
        <rect class="well" x="20" y="34" width="380" height="64" rx="8"/><rect class="t-data" x="20" y="56" width="380" height="20" rx="3"/>
        <text class="xs mute" x="26" y="48">cladding</text><text class="xs mute" x="26" y="92">cladding</text><text class="xs b" x="394" y="50" text-anchor="end">core</text>
        <path class="s-data s2" d="${zig}" style="stroke:var(--ink)"/><circle id="ray" class="f-data" cx="24" cy="66" r="6" stroke="var(--stage)" stroke-width="2"/>
        <text class="xs mute" x="20" y="116">The ray reflects at the core boundary and never leaves.</text>
        <text class="b sm" x="20" y="148">New York to London, 5,600 km</text><text id="clk" class="m b sm" x="400" y="148" text-anchor="end">t = 0.0 ms</text>
        <text class="xs mute" x="${PX0}" y="176">New York</text><text class="xs mute" x="${PX1}" y="176" text-anchor="end">London</text>${lanes}`);
      c.html('<div class="stats"><div class="stat"><span>Speed in fiber</span><b>about 2/3 c</b></div><div class="stat"><span>Submarine cables</span><b>500+</b><small>about 99% of intercontinental traffic</small></div></div>');
      const ray = f.q('#ray'), zp = f.q('path.s2');
      c.loop(dt => { /* ray moves along the zigzag */ ray.__p = ((ray.__p || 0) + dt / 2600) % 1; const L = zp.getTotalLength(), pt = zp.getPointAtLength(L * ray.__p); ray.setAttribute('cx', pt.x); ray.setAttribute('cy', pt.y); });
      let run = 0;
      async function race() {
        const id = ++run; runners.forEach((r, i) => { f.q('#r' + i).setAttribute('cx', PX0); f.q('#rt' + i).style.opacity = 0; }); const tot = 40;
        await c.tween(3600, p => { if (id !== run) return; const t = p * tot; f.q('#clk').textContent = 't = ' + t.toFixed(1) + ' ms'; runners.forEach((r, i) => { f.q('#r' + i).setAttribute('cx', PX0 + (PX1 - PX0) * Math.min(1, t / r[1])); if (t >= r[1]) f.q('#rt' + i).style.opacity = 1; }); }, c.ease.lin);
      }
      c.btn('Run the race (slowed 90 times)', () => race(), { kind: 'pri', small: true });
      c.play(race);
    }
  });

  /* 13 --------------------------------------------------------------- */
  S.push({
    id: 'load-balancer', layer: 9, tag: 'The data center',
    title: 'A load balancer hides failing machines',
    alt: 'Requests arrive at a load balancer that ends the encrypted connection and sends each request to a healthy server. Every few seconds it checks the servers and removes any that fail from rotation.',
    text: 'Your message arrives at a data center that can draw 100 megawatts or more. First, **load balancers** at the edge end your TLS connection, decrypt the message and route it to a healthy server. They check every backend every few seconds and drop failures from rotation. That is why AI services stay up while hardware fails constantly.',
    hint: 'Click a server to fail it. Requests sent before the next health check are lost.',
    takeaway: 'Failures are routine. The balancer notices within seconds and stops sending traffic there.',
    mount(c) {
      const SY = [50, 124, 198, 272], alive = [true, true, true, true], known = [true, true, true, true];
      let sv = '';
      SY.forEach((y, i) => { sv += `<g class="clk" id="s${i}" data-i="${i}" role="button" tabindex="0" aria-label="Server ${i + 1}: click to fail or restore"><rect id="sr${i}" class="t-cmp" x="296" y="${y - 24}" width="104" height="48" rx="10"/><text class="b sm" x="316" y="${y + 5}">Server ${i + 1}</text><circle id="sd${i}" class="f-ok" cx="382" cy="${y}" r="6"/></g><path class="ln thin" d="M212 166 L296 ${y}"/>`; });
      const f = c.fig(420, 338, `<rect class="t-data" x="14" y="144" width="62" height="44" rx="10"/><text class="xs b" x="45" y="171" text-anchor="middle">Requests</text><path class="ln" d="M76 166 H118" marker-end="url(#ah-ink)"/>
        <rect id="lbr" class="t-ctl" x="120" y="118" width="92" height="96" rx="12"/><text class="b sm" x="166" y="150" text-anchor="middle">Load</text><text class="b sm" x="166" y="168" text-anchor="middle">balancer</text><text class="xs" x="166" y="196" text-anchor="middle">TLS ends here</text>${sv}
        <rect class="well" x="20" y="316" width="380" height="8" rx="4"/><rect id="hc" class="f-ctl" x="20" y="316" width="0" height="8" rx="4"/><text class="xs mute" x="20" y="308">next health check</text><g id="dots"></g>`);
      const st = c.stats([{ k: 's', label: 'Served', value: '0', cls: 'ok' }, { k: 'f', label: 'Lost before the check', value: '0', cls: 'bad' }]);
      let served = 0, failed = 0, rr = 0, clock = 0, HC = 2400;
      const paint = () => SY.forEach((y, i) => { f.q('#sr' + i).setAttribute('class', alive[i] ? (known[i] ? 't-cmp' : 't-cmp') : 't-bad'); f.q('#sd' + i).setAttribute('class', alive[i] ? 'f-ok' : 'f-bad'); f.q('#s' + i).style.opacity = known[i] || alive[i] ? 1 : 0.5; });
      async function req() {
        const live = known.map((k, i) => k ? i : -1).filter(i => i >= 0); if (!live.length) return;
        const i = live[rr++ % live.length], d = c.html('', '', f.q('#dots')); void d;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('transform', 'translate(76 166)'); g.innerHTML = '<circle class="f-data" r="6" stroke="var(--stage)" stroke-width="2"/>'; f.q('#dots').append(g);
        await c.fx(g, { x: 120 }, 260, c.ease.lin); await c.fx(g, { x: 296, y: SY[i] }, 420, c.ease.lin);
        if (alive[i]) { served++; st.set('s', served); g.firstElementChild.setAttribute('class', 'f-ok'); } else { failed++; st.set('f', failed); g.firstElementChild.setAttribute('class', 'f-bad'); }
        await c.fx(g, { o: 0 }, 260); g.remove();
      }
      c.forever(async () => { c.spawn(req); await c.wait(520); });
      c.loop(dt => { clock += dt; if (clock >= HC) { clock = 0; for (let i = 0; i < 4; i++) known[i] = alive[i]; paint(); } f.q('#hc').setAttribute('width', 380 * clock / HC); });
      f.qa('.clk').forEach(g => { const t = () => { const i = +g.dataset.i; alive[i] = !alive[i]; paint(); c.say(alive[i] ? '**Server ' + (i + 1) + ' restored.** It rejoins at the next health check.' : '**Server ' + (i + 1) + ' failed.** Requests still go there until the next check.'); }; c.on(g, 'click', t); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); });
      c.btn('Restore all servers', () => { alive.fill(true); paint(); }, { small: true });
      paint();
      c.demo(2200, async () => { alive[1] = false; paint(); c.say('**Server 2 failed.** Requests still go there until the next check.'); await c.wait(4500); alive[1] = true; paint(); });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'gpu', layer: 10, tag: 'The GPU',
    title: 'One GPU draws 700 watts',
    alt: 'A schematic of an H100 GPU die with 132 streaming multiprocessor tiles, memory stacks on both sides, and a cooling selector.',
    text: 'Your request lands on a [[gpu|GPU]] such as an Nvidia H100. It has **16,896 cores** in 132 [[sm|streaming multiprocessors]] and 80 GB of memory that feeds them at **3.35 TB/s**, about 50 times faster than a PC’s RAM. One H100 draws **700 W**. Eight in a server draw 5.6 kW for the GPUs alone. Fill a rack with them and air cooling reaches its limit.',
    hint: 'Click a tile to inspect one SM. Switch the cooling method and add GPUs.',
    takeaway: 'Power and heat limit how many GPUs fit in one rack.',
    mount(c) {
      const GX = 112, GY = 82, S = 18;
      let tiles = '';
      for (let r = 0; r < 11; r++) for (let q = 0; q < 12; q++) tiles += `<rect class="clk t-cmp sm" data-n="${r * 12 + q + 1}" x="${GX + q * S}" y="${GY + r * S}" width="15" height="15" rx="3" style="opacity:0"/>`;
      const hbm = [[52, 96], [52, 190], [334, 96], [334, 190]].map(([x, y]) => `<rect class="t-mem" x="${x}" y="${y}" width="34" height="80" rx="6"/><text class="xs b" x="${x + 17}" y="${y + 44}" text-anchor="middle" transform="rotate(-90 ${x + 17} ${y + 40})">HBM3</text>`).join('');
      const f = c.fig(420, 340, `
        <text class="b md" x="20" y="24">NVIDIA H100</text><text class="xs mute" x="20" y="42">132 SMs · 80 GB memory · 3.35 TB/s</text>
        <rect id="die" class="box" x="104" y="74" width="224" height="208" rx="10"/>${hbm}${tiles}
        <text id="heat" class="b sm" x="210" y="308" text-anchor="middle"></text>`);
      const st = c.stats([{ k: 'n', label: 'GPUs in the rack', value: '', cls: 'cmp' }, { k: 'w', label: 'Heat from the GPUs alone', value: '', cls: 'cmp' }, { k: 'l', label: 'This cooling handles about', value: '' }]);
      const LIM = { air: 30, liquid: 120, imm: 120 }, NAME = { air: 'Air', liquid: 'Liquid cold plates', imm: 'Immersion' };
      let n = 32, mode = 'air';
      const update = () => {
        const kw = n * 0.7, lim = LIM[mode], ok = kw <= lim;
        f.q('#die').setAttribute('class', ok ? 't-ok' : 't-bad');
        f.q('#heat').textContent = ok ? NAME[mode] + ' can remove ' + fmt.n(kw, 1) + ' kW.' : NAME[mode] + ' cannot remove ' + fmt.n(kw, 1) + ' kW. Its limit is near ' + lim + ' kW.';
        st.set('n', n, n / 8 + ' servers of 8'); st.set('w', fmt.n(kw, 1) + ' kW', n + ' × 700 W'); st.set('l', lim + ' kW', 'per rack, rough figure'); st.cls('w', ok ? 'ok' : 'bad');
      };
      f.qa('.sm').forEach(t => c.on(t, 'click', () => c.say('**SM ' + t.dataset.n + ' of 132.** About 128 CUDA cores, tensor cores for matrix math, shared memory and warp schedulers.')));
      const sg = c.seg({ label: 'Cooling', options: [['air', 'Air'], ['liquid', 'Liquid cold plates'], ['imm', 'Immersion']], value: 'air', onChange: v => { mode = v; update(); } });
      const sl = c.slider({ label: 'GPUs in the rack', min: 8, max: 72, step: 8, value: 32, fmt: v => v, onInput: v => { n = v; update(); } });
      c.note('Memory bandwidth is 3.35 TB/s, versus roughly 70 GB/s for desktop RAM. Cooling limits are rough industry figures that vary by design. Specifications are published vendor figures.');
      update();
      c.play(async () => {
        const ts = f.qa('.sm');
        await c.tween(1600, p => { ts.forEach((t, i) => { t.style.opacity = Math.min(1, Math.max(0, p * 2.2 - i / ts.length)); }); }, c.ease.lin);
        ts.forEach(t => t.style.opacity = 1); await c.wait(700);
        n = 72; sl.set(72, true); update(); await c.wait(1200);
        mode = 'liquid'; sg.set('liquid'); update(); await c.wait(1000);
        mode = 'air'; n = 32; sg.set('air'); sl.set(32, true); update();
      });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'tokens', layer: 11, tag: 'The model',
    title: 'Text becomes tokens, tokens become vectors',
    alt: 'A sentence split into token chips. Selecting a token shows its vector as a strip of colored cells, a list of thousands of numbers.',
    text: 'Your message becomes mathematics. Tokenization cuts the text into [[token|tokens]]: pieces of words that a tokenizer learned from huge amounts of text. They are **sub-word units**, not whole words. A 500-word prompt becomes about 650 to 800 tokens. Each token maps to a **vector**, a list of thousands of numbers.',
    hint: 'Pick a phrase, then click a token to see its vector.',
    takeaway: 'The model never sees letters. It sees token IDs, then vectors, then arithmetic.',
    mount(c) {
      const PH = { sky: ['Why is the sky blue?', ['Why', ' is', ' the', ' sky', ' blue', '?'], [5195, 318, 262, 6766, 4171, 30]], rare: ['Unbelievably quick answers', ['Un', 'believ', 'ably', ' quick', ' answers'], [3118, 21196, 1346, 2068, 7429]], tok: ['Tokenization splits unusual words', ['Token', 'ization', ' splits', ' unusual', ' words'], [22906, 2065, 41399, 19232, 3951]] };
      const h = c.html('<div class="chain" id="tk" style="gap:6px"></div><p class="kicker" id="vl" style="margin:14px 0 6px"></p><div class="vec" id="vc"></div><p class="note" style="margin:8px 0 0">Illustrative splits and IDs. Real tokenizers differ by model. Real vectors have thousands of numbers, for example 4,096.</p>');
      let key = 'sky', sel = 3;
      const rng = s => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      function vec() {
        const [, tk, ids] = PH[key], r = rng(ids[sel] * 7 + 1);
        h.q('#vl').textContent = 'Vector for “' + tk[sel].trim() + '” (token ' + fmt.n(ids[sel]) + '): 64 of about 4,096 numbers';
        h.q('#vc').innerHTML = Array.from({ length: 64 }, () => { const v = r() * 2 - 1; return `<i style="background:${v > 0 ? 'var(--cmp)' : 'var(--mem)'};opacity:${(0.12 + Math.abs(v) * 0.88).toFixed(2)}"></i>`; }).join('');
      }
      function chips() {
        const [, tk, ids] = PH[key];
        h.q('#tk').innerHTML = tk.map((t, i) => `<button type="button" class="tokchip${i === sel ? ' sel' : ''}" data-i="${i}"><b>${esc(t).replace(/ /g, '·')}</b><small>${ids[i]}</small></button>`).join('');
        h.qa('.tokchip').forEach(b => c.on(b, 'click', () => { sel = +b.dataset.i; chips(); vec(); }));
        vec();
      }
      c.seg({ label: 'Phrase', options: Object.keys(PH).map(k => [k, PH[k][0]]), value: 'sky', onChange: v => { key = v; sel = Math.min(sel, PH[v][1].length - 1); chips(); } });
      chips();
      c.play(async () => { const bs = h.qa('.tokchip'); bs.forEach(b => b.style.opacity = 0.15); for (const b of bs) { await c.fx(b, { o: 1 }, 220); await c.wait(160); } });
    }
  });

  /* 16 --------------------------------------------------------------- */
  S.push({
    id: 'attention', layer: 11, tag: 'The model',
    title: 'Attention lets every token look back',
    alt: 'A sentence of seven tokens. Selecting a token draws arcs to the earlier tokens it attends to, with thicker arcs for larger weights, and shows the weights as bars that sum to 100%.',
    text: '[[attention|Attention]] is the core step of a [[transformer]]. Every token asks **what matters here?** It sends a **query**. Every earlier token offers a **key**. Where query and key match, that token’s **value** flows through. A softmax turns the scores into shares that add up to 100%. The word “it” ends up looking mostly at “cat”.',
    hint: 'Click any word to see which earlier words it looks at.',
    takeaway: 'Meaning comes from how much each token borrows from the ones before it.',
    mount(c) {
      const T = ['The', 'cat', 'sat', 'because', 'it', 'was', 'tired'];
      const W = [[1], [0.35, 0.65], [0.10, 0.55, 0.35], [0.05, 0.25, 0.45, 0.25], [0.04, 0.62, 0.10, 0.10, 0.14], [0.03, 0.20, 0.07, 0.10, 0.40, 0.20], [0.02, 0.38, 0.05, 0.08, 0.27, 0.10, 0.10]];
      const CW = 52, ST = 58, X0 = 14, cx = i => X0 + i * ST + CW / 2;
      let chips = '';
      T.forEach((t, i) => { chips += `<g class="clk" id="tk${i}" data-i="${i}" role="button" tabindex="0" aria-label="${t}"><rect id="tr${i}" class="box" x="${X0 + i * ST}" y="176" width="${CW}" height="28" rx="8"/><text class="xs b" x="${cx(i)}" y="195" text-anchor="middle">${t}</text></g>`; });
      const f = c.fig(420, 312, `<g id="arcs"></g>${chips}<g id="bars"></g>`);
      const st = c.stats([{ k: 'a', label: 'Looks most at', value: '', cls: 'data' }, { k: 's', label: 'Weights add up to', value: '100%' }]);
      let sel = 4, mode = 'soft';
      const score = w => Math.log(w) + 3;
      function draw() {
        const w = W[sel]; let arcs = '', bars = '';
        T.forEach((t, i) => { f.q('#tr' + i).setAttribute('class', i === sel ? 't-ctl' : i < sel ? 't-data' : 'box'); f.q('#tk' + i).style.opacity = i > sel ? 0.4 : 1; });
        w.forEach((v, j) => { if (j === sel) return; const x1 = cx(sel), x2 = cx(j), top = 168, peak = 168 - 34 - Math.abs(x1 - x2) * 0.42; arcs += `<path class="s-data" d="M${x1} ${top} Q${(x1 + x2) / 2} ${peak} ${x2} ${top}" style="fill:none;stroke-width:${(1 + v * 12).toFixed(1)};opacity:${(0.25 + v * 0.75).toFixed(2)};stroke-linecap:round"/>`; });
        const max = mode === 'soft' ? 1 : 3.2;
        w.forEach((v, j) => { const val = mode === 'soft' ? v : Math.max(0, score(v)), hh = Math.max(2, val / max * 70); bars += `<rect class="f-${mode === 'soft' ? 'data' : 'mem'}" x="${X0 + j * ST + 8}" y="${288 - hh}" width="${CW - 16}" height="${hh}" rx="4"/><text class="m xs b" x="${cx(j)}" y="${282 - hh}" text-anchor="middle">${mode === 'soft' ? Math.round(v * 100) + '%' : score(v).toFixed(1)}</text>`; });
        bars += `<text class="xs mute" x="20" y="306">${mode === 'soft' ? 'attention weights after softmax' : 'raw scores before softmax (query · key)'}</text>`;
        f.q('#arcs').innerHTML = arcs; f.q('#bars').innerHTML = bars;
        const mx = w.indexOf(Math.max.apply(null, w)); st.set('a', T[mx], Math.round(w[mx] * 100) + '% of the attention');
        c.say('**“' + T[sel] + '”** asks what matters, so it attends to ' + (sel === 0 ? 'itself only.' : 'the words before it, mostly “' + T[mx] + '”.'));
      }
      f.qa('.clk').forEach(g => { const t = () => { sel = +g.dataset.i; draw(); }; c.on(g, 'click', t); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); });
      c.seg({ label: 'Show', options: [['soft', 'Weights after softmax'], ['raw', 'Raw scores']], value: 'soft', onChange: v => { mode = v; draw(); } });
      c.note('Illustrative weights, hand-set for this sentence. Real models compute them from learned queries and keys in every layer.');
      draw();
      c.play(async () => { for (const i of [1, 2, 3, 4]) { await c.wait(750); sel = i; draw(); } });
    }
  });

  /* 17 --------------------------------------------------------------- */
  S.push({
    id: 'software', layer: 12, tag: 'The machine',
    title: 'One line of Python goes through five translations',
    alt: 'One matrix operation passes through five forms: a Python call, a C++ operator, a CUDA kernel launch, portable PTX instructions and finally machine code for the exact chip.',
    text: 'Python is slow, so `model(x)` only **describes** the work. PyTorch’s C++ core receives the call and dispatches it by device and data type to a CUDA kernel. The compiler turns that into portable **PTX**, and the driver turns PTX into **SASS**, the machine instructions of this exact GPU. Five translations, decades of engineering.',
    takeaway: 'You write one line. Five layers of software turn it into instructions a chip can execute.',
    mount(c) {
      const R = [['Python', 'y = model(x)', 'Readable and slow. It only describes the work.'], ['PyTorch C++ (ATen)', 'at::matmul(x, W)', 'Dispatches by device and data type.'], ['CUDA', 'gemm<<<grid, block>>>(x, W, y);', 'Launches thousands of threads on the GPU.'], ['PTX', 'fma.rn.f32 %f3, %f1, %f2, %f0;', 'Portable instructions: a fused multiply-add.'], ['SASS', 'FFMA R0, R2, R3, R0;', 'Machine code for this exact chip.']];
      const h = c.html(`<div class="stps">${R.map((r, i) => `<div class="stp model"><span class="n">${i + 1}</span><span><b>${r[0]}</b><code style="display:block;margin:3px 0;font-size:13px;overflow-wrap:anywhere">${esc(r[1])}</code><small>${r[2]}</small></span><span class="g">${i === 0 ? 'you write' : i === 4 ? 'chip runs' : 'translates'}</span></div>`).join('')}</div>`);
      const rows = h.qa('.stp');
      c.play(async () => { for (let i = 0; i < rows.length; i++) { rows.forEach(r => r.classList.remove('now')); rows[i].classList.add('now', 'seen'); await c.wait(900); } });
    }
  });

  /* 18 --------------------------------------------------------------- */
  S.push({
    id: 'os-driver', layer: 13, tag: 'The machine',
    title: 'Your code must ask the kernel for permission',
    alt: 'Three bands: user space, kernel and hardware. A CUDA launch crosses the privilege boundary through a system call into the GPU driver, which queues commands for the GPU. Data then moves by DMA over PCIe while the CPU stays free.',
    text: 'Between your application and the hardware sits the operating system. To reach the GPU, code must cross a **privilege boundary** between user mode (ring 3) and kernel mode (ring 0). The NVIDIA driver queues the commands. Bulk data moves by [[dma|DMA]]: the GPU reads memory over PCIe 5.0 at about 64 GB/s while the CPU does other work.',
    hint: 'Switch between CPU copying and DMA.',
    takeaway: 'The kernel guards the hardware. DMA keeps the CPU free while the GPU pulls data directly.',
    mount(c) {
      const f = c.fig(420, 372, `
        <rect class="well" x="12" y="10" width="396" height="108" rx="12"/><text class="xs b" x="24" y="30">User space (ring 3)</text>
        <rect class="t-data" x="24" y="46" width="150" height="50" rx="9"/><text class="xs b" x="99" y="66" text-anchor="middle">Your Python process</text><text class="xs" x="99" y="82" text-anchor="middle">cudaLaunch(...)</text>
        <rect class="box" x="196" y="46" width="100" height="50" rx="9"/><text class="xs mute" x="246" y="76" text-anchor="middle">other processes</text>
        <rect class="box" x="308" y="46" width="88" height="50" rx="9"/><text class="xs mute" x="352" y="76" text-anchor="middle">scheduler</text>
        <path class="s-bad s2" d="M12 130 H408" style="stroke-dasharray:6 5;stroke:var(--bad)"/><text class="xs b" x="210" y="124" text-anchor="middle" style="fill:var(--ink)">privilege boundary: a system call crosses it</text>
        <rect class="well" x="12" y="140" width="396" height="86" rx="12"/><text class="xs b" x="24" y="160">Kernel (ring 0)</text>
        <rect class="t-ctl" x="24" y="172" width="170" height="44" rx="9"/><text class="xs b" x="109" y="190" text-anchor="middle">NVIDIA driver</text><text class="xs" x="109" y="206" text-anchor="middle">queues commands</text>
        <rect id="cpu" class="box" x="236" y="172" width="150" height="44" rx="9"/><text id="cpul" class="xs b" x="311" y="198" text-anchor="middle">CPU: free</text>
        <rect class="well" x="12" y="240" width="396" height="118" rx="12"/><text class="xs b" x="24" y="260">Hardware</text>
        <rect class="t-mem" x="24" y="276" width="110" height="64" rx="9"/><text class="xs b" x="79" y="312" text-anchor="middle">System RAM</text>
        <rect class="t-cmp" x="286" y="276" width="110" height="64" rx="9"/><text class="xs b" x="341" y="304" text-anchor="middle">GPU</text><text class="xs" x="341" y="320" text-anchor="middle">command queue</text>
        <path class="ln s3" d="M134 308 H286" style="stroke-width:6;opacity:.35"/><text class="xs b" x="210" y="298" text-anchor="middle">PCIe 5.0: 64 GB/s</text>
        <g id="cmd" transform="translate(99 71)"><circle class="f-data" r="7" stroke="var(--stage)" stroke-width="2"/></g><g id="dm"></g>`);
      c.html('<div class="stats"><div class="stat"><span>Address lookup, TLB hit</span><b>1 cycle</b></div><div class="stat"><span>Address lookup, TLB miss</span><b>hundreds of cycles</b></div></div>');
      let mode = 'dma', run = 0;
      const paint = () => { f.q('#cpu').setAttribute('class', mode === 'cpu' ? 't-cmp' : 'box'); f.q('#cpul').textContent = mode === 'cpu' ? 'CPU: copying every byte' : 'CPU: free'; };
      async function launch() {
        const id = ++run, d = f.q('#cmd'); c.place(d, { x: 99, y: 71, o: 1 });
        await c.fx(d, { x: 109, y: 194 }, 700, c.ease.io); if (id !== run) return;
        await c.fx(d, { x: 341, y: 312 }, 800, c.ease.io); if (id !== run) return; await c.fx(d, { o: 0 }, 250);
        paint(); const g = f.q('#dm'); g.innerHTML = '';
        for (let k = 0; k < 6; k++) { const q = document.createElementNS('http://www.w3.org/2000/svg', 'g'); q.setAttribute('transform', 'translate(140 316)'); q.innerHTML = '<rect class="f-mem" x="-5" y="-5" width="10" height="10" rx="2"/>'; g.append(q); c.spawn(async () => { await c.wait(k * (mode === 'dma' ? 140 : 420)); await c.fx(q, { x: 280 }, mode === 'dma' ? 520 : 1300, c.ease.lin); await c.fx(q, { o: 0 }, 150); }); }
      }
      c.seg({ label: 'How bulk data moves', options: [['cpu', 'CPU copies each byte'], ['dma', 'DMA']], value: 'dma', onChange: v => { mode = v; launch(); } });
      paint();
      c.play(async () => { await launch(); await c.wait(1800); mode = 'cpu'; await launch(); await c.wait(2400); mode = 'dma'; paint(); });
    }
  });

  /* 19 --------------------------------------------------------------- */
  S.push({
    id: 'warps', layer: 14, tag: 'The silicon',
    title: 'Thirty-two threads, one instruction',
    alt: 'A warp of 32 threads in a grid. When all threads take the same path one pass is enough. When they split, both paths run one after the other and half the threads sit idle each time.',
    text: 'An SM runs threads in groups of 32 called [[warp|warps]]. Every thread in a warp executes the **same instruction at the same time**. If the threads split at an if-else, both paths run one after the other and each pass **masks out** the others. Divergence costs speed, so GPU programs avoid it where they can.',
    hint: 'Slide how many threads take the if branch. Anything other than all or none costs a second pass.',
    takeaway: 'Same instruction, many data. A warp is fast only while its threads agree.',
    mount(c) {
      const CW = 38, CH = 30, X0 = 24, Y0 = 52;
      let cells = '';
      for (let i = 0; i < 32; i++) cells += `<rect id="th${i}" class="box" x="${X0 + (i % 8) * (CW + 4)}" y="${Y0 + Math.floor(i / 8) * (CH + 4)}" width="${CW}" height="${CH}" rx="6"/><text class="m xs" x="${X0 + (i % 8) * (CW + 4) + CW / 2}" y="${Y0 + Math.floor(i / 8) * (CH + 4) + 19}" text-anchor="middle">${i}</text>`;
      const f = c.fig(420, 300, `<text class="b sm" x="24" y="22">One warp: 32 threads</text><text id="ps" class="m xs b" x="396" y="22" text-anchor="end"></text>${cells}
        <text class="b sm" x="24" y="226">Time</text><rect class="well" x="24" y="236" width="372" height="22" rx="6"/><rect id="p1" class="f-cmp" x="24" y="236" width="0" height="22" rx="6"/><rect id="p2" class="f-mem" x="24" y="236" width="0" height="22" rx="6"/>
        <text id="pl" class="xs mute" x="24" y="282"></text>`);
      c.legend([['cmp', 'Takes the if branch'], ['mem', 'Takes the else branch']]);
      const st = c.stats([{ k: 'p', label: 'Passes needed', value: '', cls: 'cmp' }, { k: 'e', label: 'Threads doing useful work', value: '', cls: 'ok' }]);
      let k = 16, run = 0;
      function colors(active) { for (let i = 0; i < 32; i++) { const a = i < k, on = active === 'a' ? a : active === 'b' ? !a : true; f.q('#th' + i).setAttribute('class', on ? (a ? 't-cmp' : 't-mem') : 'box'); f.q('#th' + i).style.opacity = on ? 1 : 0.35; } }
      async function play() {
        const id = ++run, passes = (k === 0 || k === 32) ? 1 : 2, half = 372 / 2;
        st.set('p', passes, passes === 1 ? 'no divergence' : 'both paths run in turn'); st.set('e', passes === 1 ? '32 of 32' : 'about half', passes === 1 ? 'every pass' : 'each pass');
        st.cls('e', passes === 1 ? 'ok' : 'bad'); f.q('#p1').setAttribute('width', 0); f.q('#p2').setAttribute('width', 0);
        if (passes === 1) { colors('all'); f.q('#ps').textContent = 'one pass'; await c.tween(600, p => f.q('#p1').setAttribute('width', 372 * p)); f.q('#p1').setAttribute('class', k === 32 ? 'f-cmp' : 'f-mem'); f.q('#pl').textContent = 'All threads agree, so one pass does all the work.'; return; }
        f.q('#p1').setAttribute('class', 'f-cmp'); colors('a'); f.q('#ps').textContent = 'pass 1: if branch'; f.q('#pl').textContent = 'Pass 1: the else threads wait, masked out.';
        await c.tween(700, p => f.q('#p1').setAttribute('width', half * p)); if (id !== run) return;
        colors('b'); f.q('#ps').textContent = 'pass 2: else branch'; f.q('#pl').textContent = 'Pass 2: the if threads wait. Total time doubled.'; f.q('#p2').setAttribute('x', 24 + half);
        await c.tween(700, p => f.q('#p2').setAttribute('width', half * p)); if (id !== run) return; colors('all');
      }
      const sl = c.slider({ label: 'Threads taking the if branch', min: 0, max: 32, step: 1, value: 16, fmt: v => v + ' of 32', onInput: v => { k = v; play(); } });
      c.note('A warp runs on one of an SM’s schedulers. When a warp stalls on memory the scheduler swaps in another, so thousands of warps stay in flight and hide latency.');
      c.play(async () => { await play(); await c.wait(900); k = 32; sl.set(32, true); await play(); await c.wait(900); k = 16; sl.set(16, true); await play(); });
    }
  });

  /* 20 --------------------------------------------------------------- */
  S.push({
    id: 'gates', layer: 15, tag: 'The silicon',
    title: 'One gate type can build every other',
    alt: 'Four logic gates with lamps showing their outputs for the inputs A and B. A circuit built only from NAND gates reproduces NOT, AND and OR.',
    text: 'Every computation reduces to Boolean logic, formalized by George Boole in 1847. **AND** outputs 1 only when both inputs are 1. **OR** outputs 1 when any input is. **NOT** flips a bit. The surprise is that **NAND**, not AND, is enough: [[nand|NAND gates]] alone can build any other gate, so any computation can be built from them.',
    hint: 'Click the inputs A and B, then choose a gate to build from NAND gates only.',
    takeaway: 'Everything a computer does reduces to one simple gate repeated billions of times.',
    mount(c) {
      const nand = (a, b) => !(a && b);
      const CIR = {
        not: { name: 'NOT A', want: (a, b) => !a, gates: [['g1', 220, 190, 'A', 'A']], out: 'g1' },
        and: { name: 'A AND B', want: (a, b) => a && b, gates: [['g1', 150, 190, 'A', 'B'], ['g2', 290, 190, 'g1', 'g1']], out: 'g2' },
        or: { name: 'A OR B', want: (a, b) => a || b, gates: [['g1', 150, 160, 'A', 'A'], ['g2', 150, 236, 'B', 'B'], ['g3', 290, 198, 'g1', 'g2']], out: 'g3' }
      };
      const IN = { A: [36, 166], B: [36, 226] };
      const stt = { A: true, B: false, kind: 'and' };
      const f = c.fig(420, 304, `<text class="b sm" x="20" y="20">Live gates</text><g id="lamps"></g><text class="b sm" x="20" y="118">Built only from NAND gates</text><g id="cir"></g>
        <g class="clk" id="iA" role="button" tabindex="0" aria-label="Input A"><circle id="ca" r="14" cx="36" cy="166"/><text class="b sm" x="36" y="171" text-anchor="middle" id="ta">A</text></g>
        <g class="clk" id="iB" role="button" tabindex="0" aria-label="Input B"><circle id="cb" r="14" cx="36" cy="226"/><text class="b sm" x="36" y="231" text-anchor="middle" id="tb">B</text></g>`);
      const st = c.stats([{ k: 'm', label: 'NAND-only circuit matches the real gate', value: '', cls: 'ok' }]);
      function draw() {
        const A = stt.A, B = stt.B, C = CIR[stt.kind], val = { A, B };
        C.gates.forEach(([id, , , a, b]) => { val[id] = nand(val[a], val[b]); });
        const real = [['AND', A && B], ['OR', A || B], ['NOT A', !A], ['NAND', nand(A, B)]];
        f.q('#lamps').innerHTML = real.map(([n, v], i) => `<g><rect class="${v ? 't-data' : 'box'}" x="${20 + i * 98}" y="30" width="90" height="62" rx="10"/><text class="b sm" x="${65 + i * 98}" y="56" text-anchor="middle">${n}</text><circle class="${v ? 'f-data' : 'f-mute'}" cx="${65 + i * 98}" cy="76" r="7" style="${v ? '' : 'fill:var(--line)'}"/><text class="m xs b" x="${81 + i * 98}" y="80">${v ? 1 : 0}</text></g>`).join('');
        let w = '', g = '';
        const src = id => IN[id] || null, outPos = id => { const gt = C.gates.find(x => x[0] === id); return [gt[1] + 32, gt[2]]; };
        const wire = (from, to, v) => { const dx = (from[0] + to[0]) / 2; return `<path class="${v ? 's-data s3' : 'ln'}" d="M${from[0]} ${from[1]} H${dx} V${to[1]} H${to[0]}" fill="none" style="${v ? 'fill:none' : ''}"/>`; };
        C.gates.forEach(([id, x, y, a, b]) => {
          [[a, -10], [b, 10]].forEach(([s, dy]) => { const from = IN[s] ? [IN[s][0] + 14, IN[s][1]] : outPos(s); w += wire(from, [x - 32, y + dy], val[s]); });
          g += `<rect class="${val[id] ? 't-data' : 'box'}" x="${x - 32}" y="${y - 20}" width="64" height="40" rx="8"/><text class="b xs" x="${x}" y="${y + 4}" text-anchor="middle">NAND</text>`;
        });
        const o = outPos(C.out); w += wire(o, [372, o[1]], val[C.out]);
        g += `<circle class="${val[C.out] ? 'f-data' : ''}" cx="384" cy="${o[1]}" r="12" style="${val[C.out] ? '' : 'fill:var(--line)'}"/><text class="m xs b" x="384" y="${o[1] + 4}" text-anchor="middle" style="fill:${val[C.out] ? 'var(--on-data)' : 'var(--ink)'}">${val[C.out] ? 1 : 0}</text>`;
        f.q('#cir').innerHTML = w + g;
        f.q('#ca').setAttribute('style', `fill:${A ? 'var(--data)' : 'var(--line)'}`); f.q('#cb').setAttribute('style', `fill:${B ? 'var(--data)' : 'var(--line)'}`);
        f.q('#ta').style.fill = A ? 'var(--on-data)' : ''; f.q('#tb').style.fill = B ? 'var(--on-data)' : '';
        f.q('#ta').textContent = 'A'; f.q('#tb').textContent = 'B';
        const ok = val[C.out] === !!C.want(A, B); st.set('m', ok ? C.name + ': match' : C.name + ': no match', 'for A=' + (A ? 1 : 0) + ', B=' + (B ? 1 : 0));
      }
      [['iA', 'A'], ['iB', 'B']].forEach(([id, k]) => { const g = f.q('#' + id), t = () => { stt[k] = !stt[k]; draw(); }; c.on(g, 'click', t); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); });
      const sg = c.seg({ label: 'Build this gate from NAND', options: [['not', 'NOT'], ['and', 'AND'], ['or', 'OR']], value: 'and', onChange: v => { stt.kind = v; draw(); } });
      draw();
      c.play(async () => { for (const [k, a, b] of [['and', true, true], ['not', true, false], ['or', false, true], ['and', true, false]]) { await c.wait(1100); stt.kind = k; stt.A = a; stt.B = b; sg.set(k); draw(); } });
    }
  });

  /* 21 --------------------------------------------------------------- */
  S.push({
    id: 'adder', layer: 15, tag: 'The silicon',
    title: 'Gates add numbers',
    alt: 'Four full adders chained in a row add two four-bit numbers. Each adder passes a carry to its left neighbor. Clicking the input bits changes the sum.',
    text: 'From gates we build **arithmetic**. A full adder takes two bits and a carry and produces a sum bit and a new carry. Chain four of them and you can add any two 4-bit numbers. A GPU does this with billions of gates, switching trillions of times per second.',
    hint: 'Click the input bits to change A and B, then watch the carries ripple.',
    takeaway: 'Addition is gates passing a carry along. Multiplication is more of the same.',
    mount(c) {
      const A = [0, 1, 0, 1], B = [0, 0, 1, 1];
      const bx = i => 90 + i * 80;
      let inner = '<text class="xs mute" x="8" y="44">A</text><text class="xs mute" x="8" y="84">B</text><text class="xs mute" x="8" y="236">Sum</text>';
      for (let i = 0; i < 4; i++) {
        const x = bx(i);
        inner += `<text class="m xs mute" x="${x}" y="16" text-anchor="middle">bit ${3 - i}</text>`;
        inner += `<g class="clk" data-i="${i}" data-r="a" role="button" tabindex="0" aria-label="A bit ${3 - i}"><rect class="box" id="ar${i}" x="${x - 27}" y="26" width="28" height="26" rx="7"/><text class="m b sm" id="at${i}" x="${x - 13}" y="44" text-anchor="middle"></text></g>`;
        inner += `<g class="clk" data-i="${i}" data-r="b" role="button" tabindex="0" aria-label="B bit ${3 - i}"><rect class="box" id="br${i}" x="${x - 1}" y="66" width="28" height="26" rx="7"/><text class="m b sm" id="bt${i}" x="${x + 13}" y="84" text-anchor="middle"></text></g>`;
        inner += `<path id="wa${i}" class="ln" d="M${x - 13} 52 V112"/><path id="wb${i}" class="ln" d="M${x + 13} 92 V112"/>`;
        inner += `<rect class="t-ctl" x="${x - 26}" y="112" width="52" height="76" rx="9"/><text class="b xs" x="${x}" y="134" text-anchor="middle">Full</text><text class="b xs" x="${x}" y="148" text-anchor="middle">adder</text><text id="fe${i}" class="m xs" x="${x}" y="176" text-anchor="middle"></text>`;
        inner += `<path id="ws${i}" class="ln" d="M${x} 188 V214"/><rect id="sr${i}" class="box" x="${x - 16}" y="214" width="32" height="26" rx="7"/><text id="st${i}" class="m b sm" x="${x}" y="232" text-anchor="middle"></text>`;
      }
      for (let i = 0; i < 4; i++) {
        const x1 = bx(i) - 26, x2 = i === 0 ? 44 : bx(i - 1) + 26;
        inner += `<path id="wc${i}" class="ln" d="M${x1} 150 H${x2}" marker-end="url(#ah-ink)"/>`;
        if (i > 0) inner += `<text id="cl${i}" class="m b xs" x="${(x1 + x2) / 2}" y="142" text-anchor="middle"></text>`;
      }
      inner += `<rect id="cor" class="box" x="8" y="137" width="32" height="26" rx="7"/><text id="cot" class="m b sm" x="24" y="155" text-anchor="middle"></text><text class="xs b" x="6" y="128">carry out</text>`;
      inner += `<path class="ln" d="M410 150 H${bx(3) + 26}" marker-end="url(#ah-ink)"/><text class="xs b" x="412" y="138" text-anchor="end">carry in</text><text class="m b xs" x="${(410 + bx(3) + 26) / 2}" y="168" text-anchor="middle">0</text>`;
      const f = c.fig(420, 262, inner);
      const st = c.stats([{ k: 'a', label: 'A', value: '', cls: 'data' }, { k: 'b', label: 'B', value: '', cls: 'mem' }, { k: 's', label: 'A + B', value: '', cls: 'ok' }]);
      function calc() {
        let carry = 0; const S = [], CO = [];
        for (let i = 3; i >= 0; i--) { const a = A[i], b = B[i], s = a ^ b ^ carry, co = (a & b) | (carry & (a ^ b)); S[i] = s; CO[i] = co; f.q('#fe' + i).textContent = `${a}+${b}+${carry}`; carry = co; }
        for (let i = 0; i < 4; i++) {
          f.q('#at' + i).textContent = A[i]; f.q('#bt' + i).textContent = B[i]; f.q('#st' + i).textContent = S[i];
          f.q('#ar' + i).setAttribute('class', A[i] ? 't-data' : 'box'); f.q('#br' + i).setAttribute('class', B[i] ? 't-mem' : 'box'); f.q('#sr' + i).setAttribute('class', S[i] ? 't-ok' : 'box');
          f.q('#wa' + i).setAttribute('class', A[i] ? 's-data s3' : 'ln'); f.q('#wb' + i).setAttribute('class', B[i] ? 's-mem s3' : 'ln'); f.q('#ws' + i).setAttribute('class', S[i] ? 's-ok s3' : 'ln');
          f.q('#wc' + i).setAttribute('class', CO[i] ? 's-cmp s3' : 'ln');
          if (i > 0) f.q('#cl' + i).textContent = CO[i];
        }
        f.q('#cot').textContent = CO[0]; f.q('#cor').setAttribute('class', CO[0] ? 't-cmp' : 'box');
        const n = arr => arr.reduce((x, y) => x * 2 + y, 0), sum = n(S) + CO[0] * 16;
        st.set('a', n(A), A.join('')); st.set('b', n(B), B.join('')); st.set('s', sum, (CO[0] ? '1' : '') + S.join('') + ' in binary');
      }
      f.qa('.clk').forEach(g => { const i = +g.dataset.i, arr = g.dataset.r === 'a' ? A : B, t = () => { arr[i] ^= 1; calc(); }; c.on(g, 'click', t); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); });
      c.note('Each full adder: sum = a XOR b XOR carry-in. Carry-out = (a AND b) OR (carry-in AND (a XOR b)). The small numbers above the arrows are carry bits.');
      calc();
      c.demo(1800, async () => { for (const [a, b] of [[[1, 1, 1, 1], [0, 0, 0, 1]], [[0, 1, 1, 0], [0, 1, 0, 1]]]) { a.forEach((v, i) => A[i] = v); b.forEach((v, i) => B[i] = v); calc(); await c.wait(1600); } });
    }
  });

  /* 22 --------------------------------------------------------------- */
  S.push({
    id: 'fab', layer: 16, tag: 'The silicon',
    title: 'It begins with sand',
    alt: 'Six stages of making a chip: sand, purified silicon, a crystal pulled from a melt, sliced wafers, extreme ultraviolet lithography, and finished chips.',
    text: 'Chips start as **sand**. Silicon dioxide is purified to 11 nines: one impurity atom per hundred billion. A seed crystal dipped into the 1,414°C melt is pulled up slowly, and the atoms line up as one perfect crystal. Wafers are sliced off, and [[euv|extreme ultraviolet]] light at 13.5 nm prints the patterns.',
    hint: 'Step through the six stages.',
    takeaway: 'The machines that print the finest features cost hundreds of millions each, and one company on Earth builds them.',
    mount(c) {
      const STG = [['sand', 'Sand'], ['pure', 'Purify'], ['crystal', 'Grow'], ['wafer', 'Slice'], ['euv', 'Print'], ['chips', 'Chips']];
      const MSG = { sand: '**Sand.** Silicon dioxide, the raw material.', pure: '**Purify.** 99.999999999% silicon, called 11 nines: one impurity atom in every hundred billion.', crystal: '**Crystal.** Melted at 1,414°C, a seed crystal is dipped in and slowly pulled up. Czochralski invented this in 1916.', wafer: '**Wafers.** The ingot is sliced into thin discs.', euv: '**Lithography.** Tin droplets are vaporized 50,000 times a second. The plasma emits 13.5 nm light that prints the pattern.', chips: '**Chips.** Hundreds of steps over up to three months, in clean rooms where one dust speck can ruin a chip.' };
      const f = c.fig(420, 300, `<g id="sg"></g>`);
      const g = () => f.q('#sg');
      let run = 0, cur = 'sand';
      const rnd = c.rnd;
      const grains = n => Array.from({ length: n }, () => { const x = rnd(104, 316), top = 130 * (1 - Math.pow((x - 210) / 106, 2)); return `<circle class="f-warn" cx="${x.toFixed(1)}" cy="${(262 - rnd(0, top)).toFixed(1)}" r="${rnd(2, 4.6).toFixed(1)}" style="opacity:.85"/>`; }).join('');
      async function stage(k) {
        cur = k; const id = ++run, live = () => id === run, q = s => live() ? f.q(s) : null;
        c.say(MSG[k]);
        if (k === 'sand') g().innerHTML = '<text class="b md" x="210" y="40" text-anchor="middle">Sand: silicon dioxide, SiO₂</text>' + grains(170) + '<line class="axis" x1="90" x2="330" y1="268" y2="268"/>';
        if (k === 'pure') { g().innerHTML = '<text class="b xl m" x="210" y="62" text-anchor="middle">99.999999999%</text><text class="b sm" x="210" y="90" text-anchor="middle">11 nines</text>' + Array.from({ length: 100 }, (_, i) => `<circle class="f-mem" cx="${129 + (i % 10) * 18}" cy="${116 + Math.floor(i / 10) * 11}" r="3.2"/>`).join('') + '<text class="xs" x="210" y="250" text-anchor="middle">100 silicon atoms shown. You would have to look at</text><text class="xs" x="210" y="266" text-anchor="middle">100 billion atoms to find one impurity atom.</text>'; }
        if (k === 'crystal') {
          g().innerHTML = `<rect id="rod" class="box" x="206" y="34" width="8" height="186"/><rect id="boule" class="t-data" x="170" y="220" width="80" height="0" rx="4"/><rect class="t-cmp" x="130" y="220" width="160" height="62" rx="12"/><text class="xs b" x="210" y="256" text-anchor="middle">melt, 1,414°C</text><text class="xs b" x="210" y="22" text-anchor="middle">seed crystal rises and turns</text>`;
          await c.tween(2400, p => { const bo = q('#boule'), rod = q('#rod'); if (!bo) return; const hh = 150 * p; bo.setAttribute('y', 220 - hh); bo.setAttribute('height', hh); rod.setAttribute('height', 186 - hh); }, c.ease.io);
          const lb = q('#boule'); if (lb) g().insertAdjacentHTML('beforeend', '<text class="xs b" x="262" y="150">single crystal</text>');
        }
        if (k === 'wafer') {
          g().innerHTML = `<rect class="t-data" x="60" y="60" width="110" height="170" rx="6"/>${Array.from({ length: 7 }, (_, i) => `<path class="ln thin" d="M60 ${84 + i * 20} H170" id="cut${i}" style="opacity:0"/>`).join('')}<text class="xs b" x="115" y="248" text-anchor="middle">ingot</text><g id="wfg" style="opacity:0"><ellipse class="t-ok" cx="300" cy="150" rx="70" ry="22"/><text class="b sm" x="300" y="146" text-anchor="middle">300 mm wide</text><text class="xs" x="300" y="164" text-anchor="middle">0.775 mm thick</text></g><text class="xs mute" x="300" y="206" text-anchor="middle" id="wfn" style="opacity:0">one wafer</text>`;
          for (let i = 0; i < 7; i++) { const cu = q('#cut' + i); if (!cu) return; cu.style.opacity = 1; await c.wait(170); }
          const w = q('#wfg'); if (!w) return; w.style.opacity = 1; const n = q('#wfn'); if (n) n.style.opacity = 1;
        }
        if (k === 'euv') {
          g().innerHTML = `<text class="xs b" x="20" y="24">tin droplet</text><circle id="dr" class="f-warn" cx="40" cy="60" r="6"/><path id="ls" class="s-bad s3" d="M40 160 H110" style="stroke:var(--bad);opacity:0"/><text class="xs mute" x="20" y="184">laser pulse</text><g id="pl" style="opacity:0"><circle class="f-cmp" cx="110" cy="160" r="20" style="opacity:.35"/><circle class="f-warn" cx="110" cy="160" r="9"/></g><path id="rays" class="s-data s2" d="M110 160 L210 90 L300 232" style="fill:none;opacity:0"/><rect class="t-mem" x="196" y="76" width="32" height="14" rx="3"/><text class="xs mute" x="236" y="86">mirror</text><ellipse class="t-ok" cx="300" cy="244" rx="64" ry="14"/><text class="xs b" x="300" y="272" text-anchor="middle">wafer</text><text class="b sm" x="330" y="150" text-anchor="middle" id="nm" style="opacity:0">13.5 nm light</text>`;
          const set = (s, o) => { const e = q(s); if (e) e.style.opacity = o; return !!e; };
          for (let n = 0; n < 2 && live(); n++) {
            const dr = q('#dr'); if (!dr) return;
            c.place(dr, { x: 40, y: 60 }); await c.fx(dr, { y: 160 }, 700, c.ease.in);
            if (!(set('#ls', 1) && set('#pl', 1) && set('#rays', 1) && set('#nm', 1))) return;
            await c.wait(450);
            if (!(set('#ls', 0) && set('#pl', 0) && set('#dr', 0))) return;
            await c.wait(350); set('#dr', 1);
          }
        }
        if (k === 'chips') {
          let d = ''; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { const x = 118 + i * 15.5, y = 44 + j * 15.5; if ((x - 210) ** 2 + (y - 140) ** 2 < 92 ** 2) d += `<rect class="${(i * 7 + j * 3) % 11 === 0 ? 'f-bad' : 't-data'}" x="${x}" y="${y}" width="13" height="13" rx="2"/>`; }
          g().innerHTML = `<circle class="box" cx="210" cy="142" r="100"/>${d}<text class="xs b" x="210" y="270" text-anchor="middle">each square is one chip, red ones fail testing</text>`;
        }
      }
      const sg = c.seg({ label: 'Stage', options: STG, value: 'sand', onChange: v => stage(v) });
      stage('sand');
      c.play(async () => { for (const [k] of STG.slice(1)) { await c.wait(1900); sg.set(k); await stage(k); } });
    }
  });

  /* 23 --------------------------------------------------------------- */
  S.push({
    id: 'transistor', layer: 17, tag: 'The silicon',
    title: 'A transistor is a switch with no moving parts',
    alt: 'A CMOS inverter: a p-type transistor to the supply and an n-type transistor to ground. One is always off. A chart shows current drawn from the supply spiking only at the moments the input switches.',
    text: 'Logic gates are built from **transistors**, invented at Bell Labs in 1947. A voltage on the gate switches current on or off. [[cmos|CMOS]] pairs two types so that **one is always off**, which means a steady circuit draws almost no power. Power is spent only when a bit flips.',
    hint: 'Flip the input and see which transistor conducts. Then watch the supply current.',
    takeaway: 'CMOS spends power only when a bit changes, so idle chips stay cool.',
    mount(c) {
      const stt = { vin: 0 }, buf = new Array(160).fill(0);
      const f = c.fig(420, 396, `
        <text class="b sm" x="200" y="20" text-anchor="middle">Supply (1)</text><path id="w0" class="ln s3" d="M200 28 V52"/>
        <rect id="pm" class="box" x="140" y="52" width="120" height="60" rx="10"/><text class="b sm" x="200" y="76" text-anchor="middle">p-type</text><text id="pt" class="m b sm" x="200" y="98" text-anchor="middle"></text>
        <path id="w1" class="ln s3" d="M200 112 V152"/><circle class="box" cx="200" cy="156" r="5"/>
        <path id="w2" class="ln" d="M205 156 H336"/><circle id="lamp" class="box" cx="354" cy="156" r="16"/><text id="ol" class="m b sm" x="354" y="161" text-anchor="middle"></text><text class="xs mute" x="354" y="188" text-anchor="middle">output</text>
        <path id="w3" class="ln s3" d="M200 160 V200"/>
        <rect id="nm" class="box" x="140" y="200" width="120" height="60" rx="10"/><text class="b sm" x="200" y="224" text-anchor="middle">n-type</text><text id="nt" class="m b sm" x="200" y="246" text-anchor="middle"></text>
        <path id="w4" class="ln s3" d="M200 260 V282"/><text class="b sm" x="200" y="300" text-anchor="middle">Ground (0)</text>
        <path class="ln" d="M64 156 H100 V82 H140 M100 156 V230 H140"/>
        <g class="clk" id="sw" role="button" tabindex="0" aria-label="Input voltage"><rect id="swr" class="box" x="16" y="136" width="48" height="40" rx="9"/><text id="swt" class="m b sm" x="40" y="161" text-anchor="middle"></text></g><text class="xs mute" x="40" y="128" text-anchor="middle">input</text>
        <text class="b sm" x="20" y="332">Current drawn from the supply</text><line class="axis" x1="20" x2="400" y1="386" y2="386"/><path id="chart" class="s-cmp s2" d="" style="fill:none"/>`);
      const st = c.stats([{ k: 's', label: 'Current when steady', value: '≈ 0', cls: 'ok' }, { k: 'p', label: 'Which transistor conducts', value: '' }]);
      let spike = 0;
      function paint() {
        const v = stt.vin, pOn = v === 0, nOn = v === 1;
        f.q('#pm').setAttribute('class', pOn ? 't-ok' : 'box'); f.q('#nm').setAttribute('class', nOn ? 't-ok' : 'box');
        f.q('#pt').textContent = pOn ? 'ON' : 'OFF'; f.q('#nt').textContent = nOn ? 'ON' : 'OFF';
        f.q('#w0').setAttribute('class', pOn ? 's-data s3' : 'ln'); f.q('#w1').setAttribute('class', pOn ? 's-data s3' : 'ln'); f.q('#w2').setAttribute('class', pOn ? 's-data s3' : 'ln');
        f.q('#w3').setAttribute('class', nOn ? 's-mem s3' : 'ln'); f.q('#w4').setAttribute('class', nOn ? 's-mem s3' : 'ln');
        f.q('#lamp').setAttribute('class', pOn ? 't-data' : 'box'); f.q('#ol').textContent = pOn ? 1 : 0;
        f.q('#swr').setAttribute('class', v ? 't-ctl' : 'box'); f.q('#swt').textContent = v;
        st.set('p', pOn ? 'p-type' : 'n-type', pOn ? 'it connects the output to the supply' : 'it connects the output to ground');
      }
      const flip = () => { stt.vin = 1 - stt.vin; spike = 1; paint(); };
      c.loop(dt => { spike = Math.max(0, spike - dt / 260); buf.push(spike); buf.shift(); let d = ''; buf.forEach((s, i) => { d += (i ? 'L' : 'M') + (20 + i / (buf.length - 1) * 380).toFixed(1) + ' ' + (386 - s * s * 44).toFixed(1); }); f.q('#chart').setAttribute('d', d); });
      const sw = f.q('#sw'); c.on(sw, 'click', flip); c.on(sw, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      c.btn('Switch 5 times', async () => { for (let i = 0; i < 5; i++) { flip(); await c.wait(420); } }, { small: true });
      c.note('Real transistors switch in picoseconds. The current spike is the brief moment both devices partly conduct while the output changes. Real chips also leak a little at rest; scene 25 shows why.');
      paint();
      c.play(async () => { for (let i = 0; i < 4; i++) { await c.wait(1200); flip(); } });
    }
  });

  /* 24 --------------------------------------------------------------- */
  S.push({
    id: 'silicon', layer: 17, tag: 'The silicon',
    title: 'Doping turns silicon into a switch',
    alt: 'A silicon lattice. Adding phosphorus frees an electron, adding boron leaves a hole. Joining the two creates a PN junction whose depletion region narrows with forward voltage so current flows.',
    text: 'Silicon is a **semiconductor**: its electrons are held across a 1.1 eV gap. Add **phosphorus** and extra electrons roam free (N-type). Add **boron** and holes that carry positive charge appear (P-type). Where N meets P, a depletion region forms. This **PN junction** works inside every transistor, LED and solar cell.',
    hint: 'Pick a material. For the junction, slide the voltage across it.',
    takeaway: 'A little voltage opens the junction one way and keeps it shut the other: the diode behavior all transistors build on.',
    mount(c) {
      const stt = { mode: 'pure', v: 0 };
      const f = c.fig(420, 316, `<g id="sc"></g>`);
      const st = c.stats([{ k: 'a', label: 'Band gap', value: '1.1 eV', cls: 'mem' }, { k: 'b', label: 'Current', value: '–', cls: 'cmp' }]);
      const carriers = [];
      function lattice() {
        let g = '';
        for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = 60 + i * 60, y = 64 + j * 60; if (i < 5) g += `<line class="ln thin" x1="${x + 14}" y1="${y}" x2="${x + 46}" y2="${y}"/>`; if (j < 3) g += `<line class="ln thin" x1="${x}" y1="${y + 14}" x2="${x}" y2="${y + 46}"/>`; }
        for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = 60 + i * 60, y = 64 + j * 60, dop = (i === 3 && j === 1); const cls = dop ? (stt.mode === 'n' ? 't-data' : 't-cmp') : 'box'; g += `<circle class="${stt.mode === 'pure' || !dop ? 'box' : cls}" cx="${x}" cy="${y}" r="15"/><text class="xs b" x="${x}" y="${y + 4}" text-anchor="middle">${dop && stt.mode !== 'pure' ? (stt.mode === 'n' ? 'P' : 'B') : 'Si'}</text>`; }
        g += `<g id="car"></g><text class="b sm" x="20" y="22">${stt.mode === 'pure' ? 'Pure silicon: electrons are bound' : stt.mode === 'n' ? 'N-type: phosphorus adds a free electron (green dot)' : 'P-type: boron leaves a hole (orange ring)'}</text>`;
        f.q('#sc').innerHTML = g; carriers.length = 0;
        if (stt.mode !== 'pure') { const x = 60 + 3 * 60, y = 64 + 60; carriers.push({ x: x + 30, y: y + 30, vx: c.rnd(-1, 1), vy: c.rnd(-1, 1), kind: stt.mode }); }
        st.set('b', '–', '');
      }
      function junction() {
        const v = stt.v, dep = Math.max(8, 76 * Math.sqrt(Math.max(0.05, 1 - v / 0.75)) / 1.2), I = 1e-12 * (Math.exp(Math.min(v, 0.9) / 0.0259) - 1), cx = 210;
        let g = `<rect class="t-data" x="30" y="52" width="${cx - dep / 2 - 30}" height="180" rx="8"/><rect class="t-cmp" x="${cx + dep / 2}" y="52" width="${390 - cx - dep / 2}" height="180" rx="8"/><rect class="well" x="${cx - dep / 2}" y="52" width="${dep}" height="180"/>`;
        g += `<text class="b sm" x="40" y="74">N side</text><text class="b sm" x="380" y="74" text-anchor="end">P side</text><text class="xs b" x="${cx}" y="46" text-anchor="middle">depletion region</text>`;
        for (let k = 0; k < 7; k++) { g += `<circle class="f-data" cx="${50 + k * 18}" cy="${110 + (k * 37) % 100}" r="5" stroke="var(--stage)" stroke-width="1.5"/><circle class="none-f s-cmp s2" cx="${390 - 20 - k * 18}" cy="${120 + (k * 29) % 100}" r="5"/>`; }
        g += `<path class="ln s-ink" d="M${cx - 80} 262 H${cx + 80}" marker-end="url(#ah-ink)" style="opacity:${v > 0.3 ? 1 : 0.2}"/><text class="xs b" x="${cx}" y="284" text-anchor="middle">${v > 0.3 ? 'current flows' : v < 0 ? 'blocked: the region widens' : 'barrier holds'}</text><text class="b sm" x="20" y="22">PN junction at ${v.toFixed(2)} V</text>`;
        f.q('#sc').innerHTML = g;
        st.set('b', I < 1e-9 ? '≈ ' + (I * 1e12).toFixed(1) + ' pA' : I < 1e-3 ? (I * 1e3).toFixed(2) + ' mA' : I.toFixed(2) + ' A', v > 0.3 ? 'rises sharply past about 0.5 V' : 'a trickle');
      }
      c.loop(dt => { if (stt.mode === 'pure' || stt.mode === 'pn') return; const el = f.q('#car'); if (!el) return; let out = ''; carriers.forEach(p => { p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; if (p.x < 45 || p.x > 345) p.vx *= -1; if (p.y < 45 || p.y > 255) p.vy *= -1; p.vx += c.rnd(-0.08, 0.08); p.vy += c.rnd(-0.08, 0.08); p.vx = c.clamp(p.vx, -1.2, 1.2); p.vy = c.clamp(p.vy, -1.2, 1.2); out += p.kind === 'n' ? `<circle class="f-data" cx="${p.x}" cy="${p.y}" r="6" stroke="var(--stage)" stroke-width="2"/>` : `<circle class="none-f s-cmp" cx="${p.x}" cy="${p.y}" r="7" style="stroke-width:3"/>`; }); el.innerHTML = out; });
      function show() { stt.mode === 'pn' ? junction() : lattice(); sl.el.style.display = stt.mode === 'pn' ? '' : 'none'; }
      const sg = c.seg({ label: 'Material', options: [['pure', 'Pure silicon'], ['n', 'N-type'], ['p', 'P-type'], ['pn', 'PN junction']], value: 'pure', onChange: v => { stt.mode = v; show(); } });
      const sl = c.slider({ label: 'Voltage across the junction', min: -1, max: 0.8, step: 0.02, value: 0, fmt: v => v.toFixed(2) + ' V', onInput: v => { stt.v = v; junction(); } });
      show();
      c.play(async () => { await c.wait(900); stt.mode = 'n'; sg.set('n'); show(); await c.wait(1500); stt.mode = 'p'; sg.set('p'); show(); await c.wait(1500); stt.mode = 'pn'; sg.set('pn'); stt.v = 0; sl.set(0, true); show(); for (const v of [-0.8, 0.0, 0.6]) { await c.wait(900); stt.v = v; sl.set(v, true); junction(); } });
    }
  });

  /* 25 --------------------------------------------------------------- */
  S.push({
    id: 'tunneling', layer: 18, tag: 'The edge of physics',
    title: 'At one nanometer, electrons leak through walls',
    alt: 'A wave meets a barrier. Inside the barrier it decays exponentially, and a tiny part emerges on the other side. The thinner the barrier, the larger the leak, by a factor of about six for every tenth of a nanometer.',
    text: 'Everything at this scale is electrons responding to electromagnetism, which between two protons is about **10³⁶ times stronger than gravity**. Electrons also behave as probability waves, so **quantum tunneling** lets them pass barriers a ball never could. Through about 1 nm of insulator, current leaks even when the transistor is off.',
    hint: 'Thin the barrier and watch the leak probability rise.',
    takeaway: 'Transistors have shrunk until electrons tunnel through their insulators. A thinner insulator no longer helps.',
    mount(c) {
      const KAPPA = 8.87, PXN = 54, X1 = 210 - 0, stt = { d: 1.5 }; // KAPPA in 1/nm for a 3 eV barrier
      const f = c.fig(420, 280, `<text class="b sm" x="20" y="22">An electron wave meets a barrier</text><g id="bar"></g><path id="wl" class="s-data s3" d="" style="fill:none"/><path id="wr" class="s-data s3" d="" style="fill:none"/><path id="wi" class="s-cmp s3" d="" style="fill:none"/><text id="bl" class="xs b" x="210" y="250" text-anchor="middle"></text>`);
      const st = c.stats([{ k: 'p', label: 'Chance an electron tunnels through', value: '', cls: 'cmp' }, { k: 'x', label: 'Each 0.1 nm thinner', value: '× 5.9', sub: 'more leakage', cls: 'bad' }]);
      let ph = 0;
      const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
      const sci = v => { const e = Math.floor(Math.log10(v)); return (v / Math.pow(10, e)).toFixed(1) + ' × 10' + String(e).replace(/[-0-9]/g, ch => SUP[ch]); };
      function draw() {
        const d = stt.d, w = d * PXN, x0 = 210 - w / 2, x1 = 210 + w / 2, MID = 130, A = 40;
        f.q('#bar').innerHTML = `<rect class="t-bad" x="${x0}" y="52" width="${w}" height="170" rx="4"/><text class="xs b" x="210" y="44" text-anchor="middle">barrier: ${d.toFixed(1)} nm</text>`;
        let l = '', r = '', inn = '';
        for (let x = 24; x <= x0; x += 3) l += (l ? 'L' : 'M') + x + ' ' + (MID + A * Math.sin((x - ph) / 7)).toFixed(1);
        for (let x = x0; x <= x1; x += 2) { const env = Math.exp(-KAPPA * (x - x0) / PXN); inn += (inn ? 'L' : 'M') + x + ' ' + (MID + A * env * Math.sin((x0 - ph) / 7)).toFixed(1); }
        const T = Math.exp(-2 * KAPPA * d), amp = Math.max(2.5, A * Math.sqrt(T));
        for (let x = x1; x <= 398; x += 3) r += (r ? 'L' : 'M') + x + ' ' + (MID + amp * Math.sin((x - ph) / 7)).toFixed(1);
        f.q('#wl').setAttribute('d', l); f.q('#wi').setAttribute('d', inn); f.q('#wr').setAttribute('d', r);
        f.q('#bl').textContent = 'transmitted wave drawn larger than its real size';
        st.set('p', sci(T), T > 1e-6 ? '1 in ' + fmt.n(Math.round(1 / T)) : '1 in ' + sci(1 / T));
      }
      c.loop(dt => { ph += dt * 0.012; draw(); });
      c.slider({ label: 'Barrier thickness (nm)', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) + ' nm', onInput: v => { stt.d = v; draw(); } });
      c.note('Estimate for a 3 eV barrier: probability ≈ exp(−2·κ·d) with κ ≈ 8.9 per nm. Real gate stacks use other materials to fight leakage.');
      draw();
    }
  });

  /* 26 --------------------------------------------------------------- */
  S.push({
    id: 'return', layer: [1, 18], tag: 'The way back',
    title: 'The answer travels back up the same 18 layers',
    alt: 'A marker rises through all eighteen layers, starting at electrons and ending at your screen. A chronological list of inventions and the people behind them lights up as the answer passes the layer each one belongs to.',
    text: 'The answer travels back up through the same 18 layers. Each one took years of work by people you will never meet. Watch the names and years on the right light up as the answer passes the layer each belongs to.',
    takeaway: 'You asked a question. Physics, engineering and a great many people answered it.',
    mount(c) {
      const CR = [
        [15, '1847', 'George Boole formalizes logic'],
        [16, '1916', 'Jan Czochralski grows single crystals'],
        [17, '1947', 'Shockley, Bardeen and Brattain build the transistor at Bell Labs'],
        [6, '1974', 'Vint Cerf and Bob Kahn design the internet protocols'],
        [5, '1976', 'Whitfield Diffie and Martin Hellman publish public key exchange'],
        [4, '1995', 'Brendan Eich writes JavaScript at Netscape in 10 days'],
        [11, '2017', 'Google researchers introduce the transformer'],
        [16, '2019', 'EUV lithography enters volume chip production'],
        [8, 'Today', 'Cable ships keep laying fiber across ocean floors']
      ];
      const h = c.html(`<div class="ret"><ol class="map18">${LAYERS.map((l, i) => `<li data-l="${i + 1}"><span>${String(i + 1).padStart(2, '0')}</span>${l}</li>`).join('')}</ol><div class="credits">${CR.map(([l, y, tx]) => `<div class="cr" data-l="${l}"><b>${y}<em>layer ${l}</em></b><span>${tx}</span></div>`).join('')}</div></div><p class="kicker" style="margin:12px 0 0">A quarter second for you. The oldest idea in this list is from 1847.</p>`);
      const rows = [...h.qa('.map18 li')].reverse();
      c.play(async () => {
        for (const r of rows) {
          rows.forEach(x => x.classList.remove('now')); r.classList.add('on', 'now');
          h.qa('.cr[data-l="' + r.dataset.l + '"]').forEach(x => x.classList.add('on'));
          await c.wait(320);
        }
        rows.forEach(x => x.classList.remove('now'));
      });
    }
  });

  /* 27 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each has a short explanation, right or wrong.',
    quiz: [
      { q: 'Why do keyboards wire their keys as a grid of rows and columns?', o: ['Keys are faster that way', 'It needs far fewer wires: about 24 instead of 104', 'It stops keys from bouncing', 'USB requires it'], a: 1, why: 'The controller powers one row at a time and reads the columns, so rows plus columns wires cover rows times columns keys.' },
      { q: 'What problem does debouncing solve?', o: ['Keys wearing out', 'USB packets arriving out of order', 'Typing too fast', 'One press producing many edges as the contacts chatter'], a: 3, why: 'Mechanical contacts bounce for a few milliseconds. Firmware waits for a steady signal and reports one press.' },
      { q: 'In a Diffie-Hellman exchange, what crosses the network?', o: ['The shared secret', 'Each side’s private number', 'Only public values, never the secret', 'The encrypted message only'], a: 2, why: 'Each side sends a value derived from its private number. Both compute the same secret locally without ever sending it.' },
      { q: 'Why does BGP often choose a longer path?', o: ['Business agreements decide which networks carry traffic', 'Shorter paths are always broken', 'It picks random routes', 'Longer paths are encrypted'], a: 0, why: 'A route exists only where two networks agreed to carry each other’s traffic. Policy and cost matter more than hop count.' },
      { q: 'What happens when the 32 threads of a warp diverge at an if-else?', o: ['The warp crashes', 'Half the threads are deleted', 'The GPU switches to the CPU', 'Both paths run one after the other, with the other threads masked'], a: 3, why: 'A warp executes one instruction at a time for all its threads, so a split costs a second pass.' },
      { q: 'Why is the NAND gate special?', o: ['It is the fastest gate', 'Any digital circuit can be built from NAND gates alone', 'It uses no power', 'It was invented first'], a: 1, why: 'NOT, AND and OR can all be built from NAND, so NAND alone can build any computation.' },
      { q: 'Why does a CMOS circuit use almost no power when nothing changes?', o: ['Its transistors are very small', 'It runs on batteries', 'One of the two paired transistors is always off, so no current flows', 'The clock is stopped'], a: 2, why: 'The p-type and n-type transistors are never both on in a steady state, so power is spent only while switching.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice">' + Array.from({ length: 9 }, (_, i) => `<rect class="${['a', 'b', 'c'][i % 3]}" x="${60 + i * 6}" y="${14 + i * 13}" width="${200 - i * 12}" height="9" rx="4.5" style="fill:${i < 3 ? 'var(--data-soft)' : i < 6 ? 'var(--mem-soft)' : 'var(--cmp-soft)'};stroke:${i < 3 ? 'var(--data)' : i < 6 ? 'var(--mem)' : 'var(--cmp)'};stroke-width:1"/>`).join('') + '<circle class="orbit" cx="160" cy="75" r="0" style="fill:none"/></svg>';
  window.LESSONS.push({
    id: 'journey', n: 1,
    title: 'One Question, 18 Layers',
    tagline: 'Follow one keypress down through 18 layers until you reach single electrons.',
    preview,
    rail: { names: LAYERS },
    scenes: S
  });
})();
