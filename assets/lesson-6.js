/* Lesson 6: Video. Seeing video (scenes 1 to 7), then making it (scenes 8 to 16), then the quiz. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const big = v => v >= 1e9 ? kit.sci(v, 1) : fmt.n(Math.round(v));

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'stack', tag: 'Seeing video',
    title: 'A clip is a stack of pictures',
    alt: 'A deck of frames drawn one behind another. Sliders set the clip length, the frame rate and the picture size. Counters show how many frames, numbers and tokens the clip holds, and how many pairs full attention would compare.',
    text: 'A video is a **stack of frames**. At 24 frames per second, one second of 224 × 224 color video holds about **3.6 million numbers**. Cut every frame into 16 × 16 patches and a 10-second clip becomes **47,040 tokens**. Full attention over that many tokens compares **2.2 billion pairs** in one layer.',
    hint: 'Shorten the clip or lower the frame rate.',
    mission: 'Keep full attention under 1 billion pairs.',
    takeaway: 'Frames multiply the token count, and attention grows with its square.',
    mount(c) {
      const f = c.fig(420, 236, '<g id="deck"></g><g id="tag"></g>');
      const st = c.stats([{ k: 'f', label: 'Frames', value: '', cls: 'data' }, { k: 'n', label: 'Numbers in the clip', value: '', cls: 'mem' }, { k: 't', label: 'Tokens, 16 px patches', value: '', cls: 'cmp' }, { k: 'p', label: 'Full attention pairs', value: '', cls: 'bad' }]);
      let secs = 10, fps = 24, side = 224;
      function draw() {
        const F = secs * fps, shown = Math.min(F, 14), W = 150, H = 96; let g = '';
        for (let i = shown - 1; i >= 0; i--) {
          const x = 24 + i * 7, y = 122 - i * 6, u = shown > 1 ? i / (shown - 1) : 0;
          g += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" class="box"/><rect x="${x + 4}" y="${y + 4}" width="${W - 8}" height="${H - 24}" rx="3" style="fill:var(--mem-soft)"/><rect x="${x + 4}" y="${y + H - 24}" width="${W - 8}" height="20" rx="3" style="fill:var(--data-soft)"/><circle cx="${(x + 24 + (1 - u) * 100).toFixed(1)}" cy="${(y + 56 - Math.sin((1 - u) * Math.PI) * 30).toFixed(1)}" r="7" class="f-cmp"/>`;
        }
        f.q('#deck').innerHTML = g;
        f.q('#tag').innerHTML = `<text class="lg b" x="300" y="70">${fmt.n(F)}</text><text class="sm" x="300" y="90">frames</text><text class="xs mute" x="300" y="116">${secs} s × ${fps} per second</text><text class="xs mute" x="300" y="132">each ${side} × ${side} px</text>${F > shown ? `<text class="xs mute" x="300" y="156">The deck shows ${shown}.</text>` : ''}`;
        const num = F * side * side * 3, tok = F * Math.pow(side / 16, 2), pairs = tok * tok;
        st.set('f', fmt.n(F), secs + ' s at ' + fps + ' frames per second'); st.set('n', big(num), fmt.n(Math.round(num / (side * side * 3))) + ' photos of ' + side + ' px');
        st.set('t', fmt.n(tok), 'a text prompt is about 2,000'); st.set('p', big(pairs), pairs < 1e9 ? 'under a billion' : 'over a billion');
        c.mission.set(pairs < 1e9);
      }
      c.slider({ label: 'Clip length (seconds)', min: 1, max: 10, step: 1, value: 10, fmt: v => v + ' s', onInput: v => { secs = v; draw(); } });
      c.slider({ label: 'Frames per second', values: [4, 8, 12, 16, 24, 30], value: 24, fmt: v => v, onInput: v => { fps = v; draw(); } });
      c.slider({ label: 'Frame size (pixels per side)', values: [112, 224, 336, 448], value: 224, fmt: v => v, onInput: v => { side = v; draw(); } });
      draw();
      c.demo(1500, async () => { fps = 8; draw(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'alias', tag: 'Seeing video',
    title: 'Too few frames make motion lie',
    alt: 'A dial with a dot that spins at a fixed speed. Numbered dots show where the camera samples it. Sliders set the spin speed and the frame rate. When the frame rate is too low, the dot appears to turn backward or stand still.',
    text: 'A video model never sees all the motion. It sees **sampled frames**, often 8 to 32 for a whole clip. If an action turns faster than half the sampling rate, the samples cannot tell which way it moved. A dot spinning 3 times a second, sampled 4 times a second, **looks like it turns backward**. This effect is called [[aliasing]].',
    hint: 'Raise the frame rate until the dot turns the right way.',
    mission: 'Find a frame rate where the dot appears to turn forward at its true speed.',
    takeaway: 'Sample at more than twice the fastest motion you care about, or the clip shows something else.',
    mount(c) {
      const CX = 128, CY = 126, R = 80, TX = 252;
      const f = c.fig(420, 254, `<circle class="well" cx="${CX}" cy="${CY}" r="${R}"/><circle cx="${CX}" cy="${CY}" r="3" class="ink-f"/><path id="app" fill="none" style="stroke-width:5;stroke-linecap:round"/><path id="head" style="stroke-width:1"/><g id="dots"></g><g id="info"></g>`);
      const st = c.stats([{ k: 'a', label: 'Apparent speed', value: '', cls: 'ctl' }, { k: 'n', label: 'Frame rate needed', value: '', cls: 'ok' }]);
      let spin = 3, fps = 4;
      const pt = (deg, r) => [CX + r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)];
      function draw() {
        const dth = 360 * spin / fps; let w = dth % 360; if (w > 180) w -= 360; if (w <= -180) w += 360;
        const app = w * fps / 360, state = Math.abs(w) < 1e-6 ? 'frozen' : Math.abs(Math.abs(w) - 180) < 1e-6 ? 'ambiguous' : w > 0 ? 'forward' : 'backward';
        let d = '';
        const grp = {}; for (let k = 0; k < 8; k++) { const key = (((-90 + k * dth) % 360) + 360) % 360, id = key.toFixed(1); (grp[id] = grp[id] || { a: -90 + k * dth, ks: [] }).ks.push(k + 1); }
        Object.values(grp).sort((x, y) => y.ks[0] - x.ks[0]).forEach(g => { const p = pt(g.a, R), n = g.ks.length, lab = n === 1 ? String(g.ks[0]) : n === 2 ? g.ks.join(',') : g.ks[0] + '-' + g.ks[n - 1], first = g.ks[0] === 1; d += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${n === 1 ? 9 : 14}" class="${first ? 'f-ctl' : 't-mem'}"/><text class="xs b" x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" style="${first ? 'fill:var(--on-accent)' : ''}">${lab}</text>`; });
        f.q('#dots').innerHTML = d;
        const a0 = -90, a1 = -90 + w, p0 = pt(a0, 56), p1 = pt(a1, 56), col = state === 'forward' ? 'var(--ok)' : state === 'backward' ? 'var(--bad)' : 'var(--ink-3)';
        const app_ = f.q('#app'); app_.style.stroke = col;
        app_.setAttribute('d', state === 'frozen' ? '' : `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A56 56 0 ${Math.abs(w) > 180 ? 1 : 0} ${w > 0 ? 1 : 0} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`);
        const dir = w > 0 ? 1 : -1, tang = (a1 + 90 * dir) * Math.PI / 180, hd = f.q('#head'); hd.style.fill = col; hd.style.stroke = col;
        hd.setAttribute('d', state === 'frozen' ? '' : `M${(p1[0]).toFixed(1)} ${(p1[1]).toFixed(1)} L${(p1[0] - Math.cos(tang) * 10 + Math.cos(tang + Math.PI / 2) * 6).toFixed(1)} ${(p1[1] - Math.sin(tang) * 10 + Math.sin(tang + Math.PI / 2) * 6).toFixed(1)} L${(p1[0] - Math.cos(tang) * 10 - Math.cos(tang + Math.PI / 2) * 6).toFixed(1)} ${(p1[1] - Math.sin(tang) * 10 - Math.sin(tang + Math.PI / 2) * 6).toFixed(1)}Z`);
        const verdict = { forward: 'Forward. Correct.', backward: 'Backward. Wrong way.', frozen: 'Frozen. No motion seen.', ambiguous: 'Could be either way.' }[state];
        f.q('#info').innerHTML = `<text class="b sm" x="${TX}" y="40">Truth</text><text class="xs" x="${TX}" y="58">${spin} turns per second</text><text class="b sm" x="${TX}" y="90">Camera</text><text class="xs" x="${TX}" y="108">${fps} frames per second</text><text class="xs mute" x="${TX}" y="124">each frame: ${dth.toFixed(0)}° of turn</text><text class="b sm" x="${TX}" y="156">You see</text><text class="xs b" x="${TX}" y="174" style="fill:${state === 'forward' ? 'var(--ok)' : state === 'backward' ? 'var(--bad)' : 'var(--ink-2)'}">${verdict}</text>`;
        st.set('a', (app >= 0 ? '+' : '') + app.toFixed(2) + ' turns/s', 'true speed: ' + spin); st.set('n', '> ' + 2 * spin + ' per second', 'twice the spin speed');
        c.mission.set(state === 'forward' && Math.abs(app - spin) < 1e-6);
      }
      c.slider({ label: 'True spin (turns per second)', min: 1, max: 5, step: 0.5, value: 3, fmt: v => v.toFixed(1), onInput: v => { spin = v; draw(); } });
      const sl = c.slider({ label: 'Frames per second', min: 2, max: 30, step: 1, value: 4, fmt: v => v, onInput: v => { fps = v; draw(); } });
      c.note('Numbers are the first 8 frames. Samples that land on the same spot share one dot. The arc is the motion you would infer from frame 1 to frame 2.');
      draw();
      c.play(async () => { await c.wait(500); await c.tween(2800, p => { fps = Math.round(2 + p * 10); sl.set(fps, true); draw(); }, c.ease.io); await c.wait(300); await c.tween(900, p => { fps = Math.round(12 - p * 8); sl.set(fps, true); draw(); }, c.ease.io); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'tubelet', tag: 'Seeing video',
    title: 'Tubelets: patches that span frames',
    alt: 'Eight frames drawn as a diagonal stack with a grid on each. One column of cells through the stack is colored in groups. Each group is a tubelet that becomes one token. Controls set how many frames a tubelet spans and how many frames the clip has. Counters show tokens and numbers per token.',
    text: 'Video transformers cut the clip into [[tubelet|tubelets]]: a 16 × 16 patch that also spans several frames. ViViT and VideoMAE use **2 frames** per tubelet. A tubelet carries t × 768 numbers and becomes one token, so longer tubelets mean **fewer tokens** with more detail in each.',
    hint: 'Change the tubelet length and the clip length.',
    mission: 'Get under 2,000 tokens for a 32-frame clip.',
    takeaway: 'Longer tubelets shrink the sequence. Neighboring frames are so similar that little is lost.',
    mount(c) {
      const f = c.fig(420, 262, '<g id="stack"></g><g id="side"></g>');
      const st = c.stats([{ k: 't', label: 'Tokens in the clip', value: '', cls: 'cmp' }, { k: 'n', label: 'Numbers inside one token', value: '', cls: 'mem' }]);
      let t = 1, T = 32;
      const COL = ['f-ctl', 'f-mem', 'f-cmp', 'f-data'];
      function draw() {
        let g = '', hi = ''; const N = 6, cell = 17, sz = N * cell, FR = 8;
        for (let k = FR - 1; k >= 0; k--) {
          const x = 22 + k * 14, y = 128 - k * 11;
          g += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" class="box"/>`;
          for (let i = 1; i < N; i++) g += `<line class="grid" x1="${x + i * cell}" x2="${x + i * cell}" y1="${y}" y2="${y + sz}"/><line class="grid" y1="${y + i * cell}" y2="${y + i * cell}" x1="${x}" x2="${x + sz}"/>`;
          hi += `<rect x="${x + 3 * cell + 1}" y="${y + 2 * cell + 1}" width="${cell - 2}" height="${cell - 2}" class="${COL[Math.floor(k / t) % 4]}" style="stroke:var(--stage);stroke-width:1.5"/>`;
        }
        g += hi;
        f.q('#stack').innerHTML = g + `<text class="xs mute" x="22" y="${128 + sz + 22}">8 of the clip’s frames, front to back</text>`;
        f.q('#side').innerHTML = `<text class="b sm" x="268" y="52">One tubelet</text><text class="xs" x="268" y="70">${t} frame${t > 1 ? 's' : ''} × 16 × 16 px</text><text class="xs m b" x="268" y="88">= ${fmt.n(t * 768)} numbers</text><text class="xs mute" x="268" y="106">becomes 1 token</text><text class="b sm" x="268" y="144">Same color</text><text class="xs" x="268" y="162">= one token</text><text class="xs mute" x="268" y="180">${8 / t} token${8 / t > 1 ? 's' : ''} in this column</text>`;
        const tok = (T / t) * 196;
        st.set('t', fmt.n(tok), T + ' frames ÷ ' + t + ' × 196 patches'); st.set('n', fmt.n(t * 768), t + ' × 16 × 16 × 3');
        c.mission.set(T === 32 && tok < 2000);
      }
      c.seg({ label: 'Tubelet length (frames)', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8']], value: '1', onChange: v => { t = +v; draw(); } });
      c.seg({ label: 'Frames in the clip', options: [['8', '8'], ['16', '16'], ['32', '32'], ['64', '64']], value: '32', onChange: v => { T = +v; draw(); } });
      draw();
      c.demo(1400, async () => { t = 4; draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'divided', tag: 'Seeing video',
    title: 'Divided attention: time, then space',
    alt: 'A grid of tokens with eight rows for frames and twelve columns for positions. Clicking a token marks which tokens it attends to under four patterns: joint, space only, time only, and divided. Counters show how many tokens it looks at and how many pairs the whole grid needs.',
    text: 'Joint space-time attention lets every token see all T × P tokens. [[divided attention|Divided attention]], from TimeSformer, splits it into two cheap steps: first across **time** at the same place, then across **space** inside the same frame. Each token compares with **T + P** tokens, and information still spreads everywhere within two layers.',
    hint: 'Click a token, then switch between the four patterns.',
    takeaway: 'Two small attentions replace one huge one: T + P comparisons per token, not T × P.',
    mount(c) {
      const TT = 8, PP = 12, X0 = 62, Y0 = 36, CW = 28, CH = 22;
      let cells = ''; for (let r = 0; r < TT; r++) for (let q = 0; q < PP; q++) cells += `<rect id="c${r}_${q}" x="${X0 + q * CW}" y="${Y0 + r * CH}" width="${CW - 3}" height="${CH - 3}" rx="3" class="well"/>`;
      let lab = ''; for (let r = 0; r < TT; r++) lab += `<text class="xs m mute" x="${X0 - 8}" y="${Y0 + r * CH + 14}" text-anchor="end">f${r + 1}</text>`;
      const f = c.fig(420, 250, `<text class="xs mute" x="${X0}" y="26">position in the frame →</text>${lab}${cells}<rect id="sel" class="none-f ink-s" rx="4" style="stroke-width:3"/><text id="cap" class="xs mute" x="${X0}" y="${Y0 + TT * CH + 18}"></text>`);
      const st = c.stats([{ k: 'e', label: 'Tokens this one looks at', value: '', cls: 'cmp' }, { k: 'p', label: 'Pairs for the whole grid', value: '', cls: 'mem' }]);
      let row = 3, col = 6, mode = 'joint';
      function draw() {
        for (let r = 0; r < TT; r++) for (let q = 0; q < PP; q++) {
          const e = f.q('#c' + r + '_' + q); let cl = 'well';
          if (mode === 'joint') cl = 'f-ctl'; else if (mode === 'space' && r === row) cl = 'f-ctl'; else if (mode === 'time' && q === col) cl = 'f-mem';
          else if (mode === 'div') { if (r === row && q === col) cl = 'f-ctl'; else if (r === row) cl = 'f-ctl'; else if (q === col) cl = 'f-mem'; }
          e.setAttribute('class', cl); e.style.opacity = cl === 'well' ? 1 : (mode === 'joint' ? 0.45 : 0.85);
        }
        const s = f.q('#sel'); s.setAttribute('x', X0 + col * CW - 1.5); s.setAttribute('y', Y0 + row * CH - 1.5); s.setAttribute('width', CW); s.setAttribute('height', CH);
        const per = { joint: TT * PP, space: PP, time: TT, div: TT + PP }[mode], N = TT * PP;
        f.q('#cap').textContent = { joint: 'Joint: all ' + N + ' tokens.', space: 'Space only: the same frame.', time: 'Time only: the same position.', div: 'Divided: violet row (space), blue column (time).' }[mode];
        st.set('e', per, mode === 'div' ? PP + ' in space + ' + TT + ' in time' : 'of ' + N + ' tokens'); st.set('p', fmt.n(N * per), mode === 'joint' ? 'N × N' : (N * N / (N * per)).toFixed(1) + '× fewer than joint');
      }
      c.seg({ label: 'Attention pattern', options: [['joint', 'Joint'], ['space', 'Space only'], ['time', 'Time only'], ['div', 'Divided']], value: 'joint', onChange: v => { mode = v; draw(); } });
      c.on(f.svg, 'click', ev => {
        const pt = f.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const m = f.svg.getScreenCTM(); if (!m) return;
        const q = pt.matrixTransform(m.inverse()), cc = Math.floor((q.x - X0) / CW), rr = Math.floor((q.y - Y0) / CH);
        if (cc < 0 || rr < 0 || cc >= PP || rr >= TT) return; row = rr; col = cc; draw();
      });
      c.note('Grid shown: 8 frames × 12 positions. A real clip has far more of both.');
      draw();
      c.demo(1500, async () => { mode = 'div'; draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'savings', tag: 'Seeing video',
    title: 'The saving has a hard ceiling',
    alt: 'A chart of the saving from divided attention against the number of frames, on a log axis, with a dotted line showing the frame count as a ceiling. The curve always stays below the line. Controls set the frames and the frame size, and counters show tokens, pairs, and the saving.',
    text: 'With T frames and P patches per frame, joint attention compares **(T·P)²** pairs and divided attention compares **T·P·(T + P)**. The saving is **T·P ÷ (T + P)**, which is always **below the smaller of T and P**. TimeSformer at 8 frames and 224 px saves 7.7 times. At 16 frames and 448 px it saves about **15.7 times**.',
    hint: 'Raise the frames or the frame size. Or use a preset.',
    mission: 'Reach at least a 15 times saving.',
    takeaway: 'With 16 frames you can never save 16 times, however large the picture. More frames raise the ceiling.',
    mount(c) {
      const ch = kit.chart({ x: 44, y: 18, w: 356, h: 118, xmin: 4, xmax: 128, ymin: 0, ymax: 130, xlog: true, xt: [4, 8, 16, 32, 64, 128], yt: [0, 30, 60, 90, 120], xf: v => v, xlabel: 'frames T (log scale)' });
      const f = c.fig(420, 232, `${ch.svg}<path id="cap" class="ln dash"/><path id="cur" class="s-data s3" fill="none"/><circle id="dot" r="6" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/><text id="lbl" class="xs b" x="0" y="0"></text><text class="xs mute" x="${ch.x0 + 8}" y="${ch.y0 + 10}">dotted: the ceiling, saving = T</text><g id="bars"></g>`);
      c.legend([['data', 'Saving at this frame size'], ['mute', 'Ceiling']]);
      const st = c.stats([{ k: 'n', label: 'Tokens, T × P', value: '', cls: 'cmp' }, { k: 'j', label: 'Joint pairs', value: '', cls: 'bad' }, { k: 'd', label: 'Divided pairs', value: '', cls: 'ok' }, { k: 's', label: 'Saving', value: '', cls: 'data' }]);
      let T = 8, side = 224; const slT = c.slider({ label: 'Frames T', values: [4, 8, 16, 32, 64, 96, 128], value: 8, fmt: v => v, onInput: v => { T = v; draw(); } }), slS = c.slider({ label: 'Frame size (pixels per side)', values: [112, 224, 336, 448], value: 224, fmt: v => v, onInput: v => { side = v; draw(); } });
      c.btn('TimeSformer: 8 × 224', () => { slT.set(8); slS.set(224); }, { small: true }); c.btn('TimeSformer-HR: 16 × 448', () => { slT.set(16); slS.set(448); }, { small: true });
      function draw() {
        const P = Math.pow(side / 16, 2), N = T * P, sv = T * P / (T + P), pts = [], cap = [];
        for (let t = 4; t <= 128.01; t *= 1.06) { pts.push([ch.X(t), ch.Y(t * P / (t + P))]); cap.push([ch.X(t), ch.Y(Math.min(130, t))]); }
        f.q('#cur').setAttribute('d', kit.path(pts)); f.q('#cap').setAttribute('d', kit.path(cap));
        f.q('#dot').setAttribute('cx', ch.X(T)); f.q('#dot').setAttribute('cy', ch.Y(sv));
        const lb = f.q('#lbl'); lb.textContent = sv.toFixed(1) + '×'; lb.setAttribute('x', Math.min(ch.x1 - 34, ch.X(T) + 10)); lb.setAttribute('y', ch.Y(sv) + 16);
        st.set('n', fmt.n(N), T + ' × ' + P); st.set('j', big(N * N), 'N × N'); st.set('d', big(N * (T + P)), 'N × (T + P)'); st.set('s', sv.toFixed(1) + '×', 'ceiling: ' + Math.min(T, P));
        c.mission.set(sv >= 15);
      }
      draw();
      c.demo(1500, async () => { slT.set(32); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'videomae', tag: 'Seeing video',
    title: 'Hide 90% of the tubelets, in tubes',
    alt: 'Six frames, each a seven by seven grid of patches. A slider hides a share of the patches and a switch picks random masking or tube masking. With random masking many hidden patches have a visible copy in a neighboring frame, marked in red. With tube masking the same positions are hidden in every frame, so there are no such copies.',
    text: 'VideoMAE hides **90 to 95%** of the tubelets, more than the 75% used for images, because video repeats itself over time. With random masking, a hidden patch often has a **visible copy in the next frame**, so the model can cheat. [[tube masking|Tube masking]] hides the same positions in every frame and removes that shortcut.',
    hint: 'Switch between random and tube masking, then raise the ratio.',
    mission: 'Hide 90% of the patches with zero copyable ones.',
    takeaway: 'Tube masking blocks the shortcut of copying from a neighboring frame, so the model must learn motion.',
    mount(c) {
      const FR = 6, N = 7, CS = 8, X0 = 12, Y0 = 44;
      const r = kit.rng(31), rank = Array.from({ length: FR }, () => Array.from({ length: N * N }, () => r())), shared = Array.from({ length: N * N }, () => r());
      const f = c.fig(420, 214, `<g id="grid"></g><text class="xs mute" x="${X0}" y="26">Six frames, 7 × 7 patches each</text><text class="xs mute" x="${X0}" y="${Y0 + N * (CS + 1) + 36}">Green: visible. Gray: hidden.</text><text class="xs mute" x="${X0}" y="${Y0 + N * (CS + 1) + 52}">Red: hidden, but the same spot is visible in a neighbor frame.</text>`);
      const st = c.stats([{ k: 'h', label: 'Patches hidden', value: '', cls: 'mem' }, { k: 'l', label: 'Hidden but copyable from a neighbor frame', value: '', cls: 'bad' }]);
      let ratio = 75, tube = false;
      function draw() {
        const m = Math.round(ratio / 100 * N * N), hid = Array.from({ length: FR }, (_, t) => { const src = tube ? shared : rank[t], order = src.map((v, i) => i).sort((a, b) => src[a] - src[b]), s = new Set(order.slice(0, m)); return s; });
        let g = '', hidden = 0, leaks = 0;
        for (let t = 0; t < FR; t++) {
          const fx = X0 + t * 66;
          for (let k = 0; k < N * N; k++) {
            const x = fx + (k % N) * (CS + 1), y = Y0 + Math.floor(k / N) * (CS + 1), h = hid[t].has(k);
            let leak = false; if (h) { hidden++; if ((t > 0 && !hid[t - 1].has(k)) || (t < FR - 1 && !hid[t + 1].has(k))) { leak = true; leaks++; } }
            g += `<rect x="${x}" y="${y}" width="${CS}" height="${CS}" rx="1.5" class="${h ? (leak ? 'f-bad' : 'well') : 'f-data'}" style="${h && !leak ? 'opacity:.55' : ''}"/>`;
          }
          g += `<text class="xs m mute" x="${fx + 28}" y="${Y0 + N * (CS + 1) + 14}" text-anchor="middle">f${t + 1}</text>`;
        }
        f.q('#grid').innerHTML = g;
        const share = hidden ? leaks / hidden : 0;
        st.set('h', Math.round(hidden / (FR * N * N) * 100) + '%', hidden + ' of ' + FR * N * N); st.set('l', Math.round(share * 100) + '%', tube ? 'tube masking: none by design' : 'random: about 1 − ratio² in the middle frames');
        c.mission.set(ratio >= 90 && leaks === 0);
      }
      c.slider({ label: 'Share of patches hidden (%)', min: 50, max: 95, step: 5, value: 75, fmt: v => v + '%', onInput: v => { ratio = v; draw(); } });
      const tg = c.toggle({ label: 'Tube masking: same positions in every frame', value: false, onChange: v => { tube = v; draw(); } });
      draw();
      c.demo(1500, async () => { ratio = 90; tube = true; tg.set(true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'vllm', tag: 'Seeing video',
    title: 'Frames become tokens in a prompt',
    alt: 'A one-hour timeline with a tick for every sampled frame, and a bar showing how much of a 128,000-token context window the visual tokens use, with a marker at 32,000. Controls set how many frames are sampled per second and how many tokens each frame gets after pooling.',
    text: 'A video language model turns sampled frames into visual tokens and puts them in the prompt. A **1-hour video** at 1 frame per second is 3,600 frames. At 196 tokens each that is **705,600 tokens**, far past a 128,000-token window. So systems **sample fewer frames**, **pool each frame to fewer tokens**, or both.',
    hint: 'Lower the sampling rate and the tokens per frame.',
    mission: 'Fit the hour in 32,000 tokens with a frame at least every 8 seconds.',
    takeaway: 'Tokens = frames × tokens per frame. Sampling and pooling are the two levers, and both give up detail.',
    mount(c) {
      const f = c.fig(420, 218, `<text class="b sm" x="16" y="24">One hour of video, one tick per sampled frame</text><rect class="well" x="16" y="34" width="388" height="26" rx="6"/><g id="ticks"></g><g id="bars"></g>`);
      const st = c.stats([{ k: 'f', label: 'Frames sampled', value: '', cls: 'data' }, { k: 't', label: 'Visual tokens', value: '', cls: 'cmp' }, { k: 'g', label: 'Gap between frames', value: '', cls: 'mem' }]);
      let fps = 1, tpf = 196;
      function draw() {
        const frames = Math.round(3600 * fps), tok = frames * tpf, gap = 1 / fps, shown = Math.min(frames, 130); let tk = '';
        for (let i = 0; i < shown; i++) { const x = 18 + (i + 0.5) / shown * 384; tk += `<line class="ln" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="38" y2="56" style="stroke:var(--data);stroke-width:1.6"/>`; }
        f.q('#ticks').innerHTML = tk;
        const CTX = 128000, frac = tok / CTX, mx = x => 16 + x * 388 / 1;
        f.q('#bars').innerHTML = kit.bar(16, 100, 388, 16, Math.min(1, frac), frac > 1 ? 'f-bad' : 'f-cmp', 'Share of a 128,000-token context window', frac > 1 ? 'over by ' + (frac - 1).toFixed(1) + '×' : Math.round(frac * 100) + '%') +
          `<line class="ln" x1="${mx(0.25)}" x2="${mx(0.25)}" y1="94" y2="124" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${mx(0.25)}" y="138" text-anchor="middle">32,000 budget</text>` +
          `<text class="xs mute" x="16" y="172">${fmt.n(frames)} frames × ${tpf} tokens = ${fmt.n(tok)} tokens</text><text class="xs mute" x="16" y="190">${tpf === 196 ? 'Full 14 × 14 grid per frame.' : tpf === 64 ? 'Each frame pooled to an 8 × 8 grid.' : 'Each frame pooled to a 4 × 4 grid.'}</text>`;
        st.set('f', fmt.n(frames), fps + ' per second'); st.set('t', fmt.n(tok), Math.round(frac * 100) + '% of 128,000'); st.set('g', gap >= 10 ? Math.round(gap) + ' s' : +gap.toFixed(1) + ' s', gap <= 8 ? 'short enough' : 'misses short events');
        c.mission.set(tok <= 32000 && gap <= 8);
      }
      c.slider({ label: 'Frames sampled per second', values: [0.05, 0.125, 0.25, 0.5, 1, 2], value: 1, fmt: v => v, onInput: v => { fps = v; draw(); } });
      c.seg({ label: 'Tokens per frame', options: [['196', '196'], ['64', '64'], ['16', '16']], value: '196', onChange: v => { tpf = +v; draw(); } });
      draw();
      c.demo(1500, async () => { fps = 0.125; tpf = 64; draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'vae3d', tag: 'Making video',
    title: 'A 3D VAE shrinks a clip first',
    alt: 'A row of seventeen small frames above a row of latent frames. The first frame is encoded alone and every later group of frames becomes one latent frame. Controls set the time factor, the space factor and the number of channels. Counters show the latent shape and the compression of an 81-frame 720p clip.',
    text: 'Video generators first compress the clip with a 3D [[vae|VAE]]. A common setting is **4 × in time and 8 × 8 in space** with 16 channels. It is **causal**: the first frame is encoded alone, and each later group of 4 frames depends only on earlier frames. So an image is just a one-frame video, and one VAE serves both.',
    hint: 'Change the time factor, the space factor and the channels.',
    mission: 'Compress the clip at least 100 times.',
    takeaway: 'Frame count becomes 1 + (frames − 1) ÷ 4. All later work happens on the small latent clip.',
    mount(c) {
      const f = c.fig(420, 214, '<text class="b sm" x="16" y="24">17 frames in</text><g id="raw"></g><g id="links"></g><text id="lt" class="b sm" x="16" y="152"></text><g id="lat"></g>');
      const st = c.stats([{ k: 's', label: 'Latent clip shape', value: '', cls: 'mem' }, { k: 'r', label: 'Compression', value: '', cls: 'data' }]);
      let ft = 4, fs = 8, ch = 16;
      function draw() {
        const FR = 17, W = 17, G = 6.4; let raw = '', links = '', lat = '';
        for (let i = 0; i < FR; i++) raw += `<rect x="${(16 + i * (W + G * 0.2 + 1.6)).toFixed(1)}" y="36" width="${W}" height="30" rx="3" class="${i === 0 ? 'f-ctl' : 'f-mem'}" style="opacity:${i === 0 ? 1 : 0.8}"/>`;
        const xAt = i => 16 + i * (W + G * 0.2 + 1.6), Lt = 1 + 16 / ft;
        for (let j = 0; j < Lt; j++) {
          const a = j === 0 ? 0 : 1 + (j - 1) * ft, b = j === 0 ? 0 : j * ft, x0 = xAt(a), x1 = xAt(b) + W, cx = (x0 + x1) / 2;
          lat += `<rect x="${x0.toFixed(1)}" y="164" width="${(x1 - x0).toFixed(1)}" height="30" rx="4" class="${j === 0 ? 't-ctl' : 't-mem'}"/>`;
          links += `<path class="ln thin" d="M${x0.toFixed(1)} 66 L${x0.toFixed(1)} 164 M${x1.toFixed(1)} 66 L${x1.toFixed(1)} 164" style="opacity:.35"/>`;
        }
        f.q('#raw').innerHTML = raw; f.q('#links').innerHTML = links; f.q('#lat').innerHTML = lat;
        f.q('#lt').textContent = Lt + ' latent frames out. The first one (violet) stands alone.';
        const FR2 = 81, Lt2 = 1 + 80 / ft, H = 720 / fs, Wd = 1280 / fs, vals = Lt2 * H * Wd * ch, raw2 = FR2 * 720 * 1280 * 3, ratio = raw2 / vals;
        st.set('s', Lt2 + ' × ' + H + ' × ' + Wd + ' × ' + ch, 'frames × height × width × channels'); st.set('r', Math.round(ratio) + '×', fmt.n(raw2) + ' → ' + fmt.n(vals) + ' numbers');
        c.mission.set(ratio >= 100);
      }
      c.seg({ label: 'Time factor', options: [['1', '1×'], ['2', '2×'], ['4', '4×'], ['8', '8×']], value: '4', onChange: v => { ft = +v; draw(); } });
      c.seg({ label: 'Space factor per side', options: [['4', '4×'], ['8', '8×'], ['16', '16×']], value: '8', onChange: v => { fs = +v; draw(); } });
      c.seg({ label: 'Latent channels', options: [['4', '4'], ['8', '8'], ['16', '16']], value: '16', onChange: v => { ch = +v; draw(); } });
      c.note('The drawing shows 17 frames. The numbers are for an 81-frame 720p clip, about 5 seconds at 16 frames per second.');
      draw();
      c.demo(1500, async () => { ch = 4; draw(); });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'patchify', tag: 'Making video',
    title: 'Even the small clip is a long sequence',
    alt: 'Three bars on a log scale: tokens for a 1024 pixel image, tokens for the video clip, and a marker at 20,000. Controls set the spatial patch size and whether two latent frames are grouped in time. Counters show the number of tokens and the attention pairs per layer.',
    text: 'The transformer sees **patches of latent**. A patch of 1 frame × 2 × 2 positions is common. For the 5-second 720p clip that gives **75,600 tokens**, about 18 times a 1024 px image. One attention layer compares **5.7 billion pairs**. Bigger patches shrink the sequence and cost fine detail.',
    hint: 'Try bigger patches, and grouping two latent frames.',
    mission: 'Get the sequence under 20,000 tokens.',
    takeaway: 'Compression and patching decide the sequence length. Attention cost follows its square.',
    mount(c) {
      const f = c.fig(420, 188, '<g id="bars"></g>');
      const st = c.stats([{ k: 't', label: 'Tokens in the clip', value: '', cls: 'cmp' }, { k: 'p', label: 'Attention pairs per layer', value: '', cls: 'bad' }]);
      let ps = 2, pt = 1;
      const lg = v => kit.clamp((Math.log10(v) - 3) / 3, 0.01, 1);
      function draw() {
        const tok = Math.ceil(21 / pt) * Math.ceil(90 / ps) * Math.ceil(160 / ps), img = 4096;
        f.q('#bars').innerHTML = kit.bar(16, 34, 388, 16, lg(img), 'f-mem', 'A 1024 px image, patch 2', fmt.n(img)) + kit.bar(16, 84, 388, 16, lg(tok), tok < 20000 ? 'f-ok' : 'f-cmp', 'This clip: 21 latent frames of 90 × 160', fmt.n(tok)) +
          `<line class="ln" x1="${16 + lg(20000) * 388}" x2="${16 + lg(20000) * 388}" y1="86" y2="112" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${16 + lg(20000) * 388}" y="126" text-anchor="middle">20,000</text><text class="xs mute" x="16" y="160">Log scale from 1,000 to 1,000,000 tokens.</text><text class="xs mute" x="16" y="176">Sizes round up when a side does not divide evenly.</text>`;
        st.set('t', fmt.n(tok), (tok / img).toFixed(1) + '× the image'); st.set('p', big(tok * tok), 'tokens × tokens');
        c.mission.set(tok < 20000);
      }
      c.seg({ label: 'Spatial patch (latent positions per side)', options: [['1', '1'], ['2', '2'], ['4', '4']], value: '2', onChange: v => { ps = +v; draw(); } });
      c.seg({ label: 'Latent frames per patch', options: [['1', '1'], ['2', '2']], value: '1', onChange: v => { pt = +v; draw(); } });
      draw();
      c.demo(1500, async () => { ps = 4; draw(); });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'dit3d', tag: 'Making video',
    title: 'Full 3D attention or two smaller ones',
    alt: 'A log-log chart of attention pairs per layer against the number of latent frames. Full 3D attention rises with the square of the frame count while factorized spatial plus temporal attention rises almost in a straight line. A marker shows the chosen clip length and counters show both costs and their ratio.',
    text: 'Inside the [[dit|diffusion transformer]] there are two designs. **Full 3D attention** lets every token see every token: best for keeping objects consistent, most expensive. **Factorized** blocks alternate spatial and temporal attention, as in Latte. CogVideoX pays for the full version. The gap **widens with clip length**.',
    hint: 'Slide the clip length and watch the two costs.',
    takeaway: 'Full attention grows with the square of the frame count. Factorized attention grows almost linearly.',
    mount(c) {
      const P = 3600;
      const ch = kit.chart({ x: 50, y: 16, w: 350, h: 130, xmin: 1, xmax: 100, ymin: 1e7, ymax: 1e12, xlog: true, ylog: true, xt: [1, 3, 10, 30, 100], yt: [1e8, 1e9, 1e10, 1e11, 1e12], xf: v => v, yf: v => '10' + kit.sup(Math.round(Math.log10(v))), xlabel: 'latent frames (log scale)' });
      const full = T => Math.pow(T * P, 2), fact = T => T * P * (T + P), curve = fn => { const pts = []; for (let t = 1; t <= 100.01; t *= 1.08) pts.push([ch.X(t), ch.Y(Math.min(1e12, fn(t)))]); return pts; };
      const f = c.fig(420, 218, `${ch.svg}<path class="s-bad s3" fill="none" d="${kit.path(curve(full))}"/><path class="s-ok s3" fill="none" d="${kit.path(curve(fact))}"/><line id="mk" class="ln" y1="${ch.y0}" y2="${ch.y1}" style="stroke:var(--ink);stroke-width:1.5;stroke-dasharray:4 3"/><circle id="d1" r="5.5" class="f-bad" style="stroke:var(--stage);stroke-width:2"/><circle id="d2" r="5.5" class="f-ok" style="stroke:var(--stage);stroke-width:2"/>`);
      c.legend([['bad', 'Full 3D attention'], ['ok', 'Factorized: spatial, then temporal']]);
      const st = c.stats([{ k: 'a', label: 'Full pairs per layer', value: '', cls: 'bad' }, { k: 'b', label: 'Factorized pairs per layer', value: '', cls: 'ok' }, { k: 'r', label: 'Ratio', value: '', cls: 'data' }]);
      let T = 21;
      function draw() {
        const x = ch.X(T); f.q('#mk').setAttribute('x1', x); f.q('#mk').setAttribute('x2', x);
        f.q('#d1').setAttribute('cx', x); f.q('#d1').setAttribute('cy', ch.Y(full(T))); f.q('#d2').setAttribute('cx', x); f.q('#d2').setAttribute('cy', ch.Y(fact(T)));
        st.set('a', big(full(T)), fmt.n(T * P) + ' tokens'); st.set('b', big(fact(T)), 'T × P × (T + P)'); st.set('r', (full(T) / fact(T)).toFixed(1) + '×', T + ' latent frames, ' + fmt.n(P) + ' per frame');
      }
      const sl = c.slider({ label: 'Latent frames in the clip', values: [1, 3, 5, 9, 13, 21, 41, 81], value: 21, fmt: v => v, onInput: v => { T = v; draw(); } });
      c.note('Each frame has 3,600 tokens (45 × 80). 21 latent frames is the 81-frame clip from the last scene.');
      draw();
      c.play(async () => { await c.wait(500); for (const v of [41, 81, 21]) { T = v; sl.set(v, true); draw(); await c.wait(800); } });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'cond', tag: 'Making video',
    title: 'One model, four tasks, one mask',
    alt: 'A row of twelve latent frames. Clicking a frame locks it as given or unlocks it so the model generates it. Preset buttons set common patterns, and a label names the task the pattern describes.',
    text: 'One trained network can do **many tasks** if you say which frames are given. A **mask channel** marks given frames with 1 and frames to generate with 0. Lock none and you get **text to video**. Lock the first frame for **image to video**. Lock the first and last for **interpolation**. Lock the first few for **extension**.',
    hint: 'Click frames to lock them, or use a preset.',
    mission: 'Lock only the first and last frame, so the model fills the gap.',
    takeaway: 'The same weights serve every task. Only the mask and the given frames change.',
    mount(c) {
      const F = 12, W = 28, X0 = 16, Y0 = 56, stepX = 33;
      let cells = ''; for (let i = 0; i < F; i++) cells += `<g class="clk" data-i="${i}" role="button" tabindex="0" aria-label="Frame ${i + 1}"><rect id="r${i}" x="${X0 + i * stepX}" y="${Y0}" width="${W}" height="46" rx="6"/><text class="xs m mute" x="${X0 + i * stepX + W / 2}" y="${Y0 - 6}" text-anchor="middle">${i + 1}</text><text id="q${i}" class="xs b" x="${X0 + i * stepX + W / 2}" y="${Y0 + 28}" text-anchor="middle"></text><text id="m${i}" class="xs m b" x="${X0 + i * stepX + W / 2}" y="${Y0 + 76}" text-anchor="middle"></text></g>`;
      const f = c.fig(420, 218, `<text class="b sm" x="${X0}" y="30">Latent frames of the clip</text>${cells}<text class="xs mute" x="${X0}" y="${Y0 + 62}">mask channel</text><text id="task" class="b sm" x="${X0}" y="170"></text><text id="d1" class="xs mute" x="${X0}" y="188"></text><text class="xs mute" x="${X0}" y="206">Green: given. Dashed: generated by the model.</text>`);
      const st = c.stats([{ k: 'g', label: 'Frames given', value: '', cls: 'ok' }, { k: 'm', label: 'Frames to generate', value: '', cls: 'mem' }]);
      let given = new Set();
      const task = () => {
        const g = Array.from(given).sort((a, b) => a - b), n = g.length;
        if (n === 0) return ['Text to video', 'Nothing is given. The model invents every frame.'];
        if (n === 1 && g[0] === 0) return ['Image to video', 'The first frame is fixed and the model animates it.'];
        if (n === 1 && g[0] === F - 1) return ['Ending frame', 'The model builds a clip that ends on the given frame.'];
        if (n === 2 && g[0] === 0 && g[1] === F - 1) return ['Interpolation', 'The model fills the gap between two given frames.'];
        if (g[0] === 0 && g[n - 1] === n - 1) return ['Extension', 'The first ' + n + ' frames are given. The model continues the clip.'];
        return ['Custom pattern', n + ' frames are given. The model fills in the rest.'];
      };
      function draw() {
        for (let i = 0; i < F; i++) {
          const on = given.has(i), r = f.q('#r' + i); r.setAttribute('class', on ? 'f-ok' : 'well'); r.style.strokeDasharray = on ? '' : '4 3';
          f.q('#q' + i).textContent = on ? '' : '?'; f.q('#m' + i).textContent = on ? '1' : '0';
        }
        const t = task(); f.q('#task').textContent = t[0]; f.q('#d1').textContent = t[1];
        st.set('g', given.size, 'mask value 1'); st.set('m', F - given.size, 'mask value 0');
        c.mission.set(given.size === 2 && given.has(0) && given.has(F - 1));
      }
      f.qa('.clk').forEach(g => { const act = () => { const i = +g.dataset.i; if (given.has(i)) given.delete(i); else given.add(i); draw(); }; c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
      c.btn('Text to video', () => { given = new Set(); draw(); }, { small: true });
      c.btn('Image to video', () => { given = new Set([0]); draw(); }, { small: true });
      c.btn('Extension', () => { given = new Set([0, 1, 2, 3]); draw(); }, { small: true });
      draw();
      c.demo(1400, async () => { given = new Set([0]); draw(); await c.wait(700); given = new Set([0, F - 1]); draw(); });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'curate', tag: 'Making video',
    title: 'Most raw clips should be thrown away',
    alt: 'Eight clip cards with simple pictures and labels. Clicking a card switches it between keep and drop. A line below explains the last choice. A counter shows how many decisions are right.',
    text: 'Raw video is mostly unusable for training. Pipelines cut videos into **single-shot clips**, then filter them: **motion** that is neither frozen nor chaotic, **sharpness**, **burned-in text**, **watermarks**. A language model then writes a **detailed caption** for each kept clip. Most clips fail at least one filter.',
    hint: 'Click a clip to switch between keep and drop.',
    mission: 'Sort all 8 clips correctly.',
    takeaway: 'Whatever stays in the data gets learned: cuts, logos and subtitles included.',
    mount(c) {
      const CARDS = [
        { a: 'Steady walk', b: 'down a street', keep: true, why: 'One shot, clear motion, steady camera.', pic: '<circle cx="30" cy="16" r="4" class="ink-f"/><path class="ln s2" d="M30 21 V33 M30 33 L24 44 M30 33 L36 44 M30 25 L24 31 M30 25 L36 29"/><path class="ln s2" d="M46 28 H68" marker-end="url(#ah-ink)"/>' },
        { a: 'Slideshow:', b: 'nothing moves', keep: false, why: 'Nothing moves, so it teaches no motion.', pic: '<rect x="8" y="12" width="26" height="26" rx="3" class="well"/><circle cx="21" cy="25" r="6" class="f-cmp"/><text class="b sm" x="40" y="30" text-anchor="middle">=</text><rect x="46" y="12" width="26" height="26" rx="3" class="well"/><circle cx="59" cy="25" r="6" class="f-cmp"/>' },
        { a: 'Scene cut', b: 'at 3 seconds', keep: false, why: 'A cut inside a clip teaches that objects teleport. Split at the cut.', pic: '<rect x="4" y="4" width="36" height="42" rx="3" style="fill:var(--mem-soft)"/><path d="M8 40 L20 18 L32 40 Z" style="fill:var(--mem)"/><rect x="40" y="4" width="36" height="42" rx="3" style="fill:var(--data-soft)"/><circle cx="58" cy="24" r="9" class="f-data"/><path class="ln s2" d="M44 2 L36 48" style="stroke:var(--bad)"/>' },
        { a: 'Subtitles', b: 'burned in', keep: false, why: 'The model would learn to paint subtitles into new videos.', pic: '<rect x="4" y="4" width="72" height="42" rx="3" class="well"/><rect x="10" y="20" width="60" height="6" rx="2" style="fill:var(--ink-3)"/><rect x="16" y="31" width="48" height="6" rx="2" style="fill:var(--ink-3)"/>' },
        { a: 'Waves on a', b: 'beach, tripod', keep: true, why: 'Continuous natural motion from a fixed camera.', pic: '<path class="ln s2" d="M6 18 q8 -8 16 0 t16 0 t16 0 t16 0" style="stroke:var(--mem)"/><path class="ln s2" d="M6 30 q8 -8 16 0 t16 0 t16 0 t16 0" style="stroke:var(--mem)"/><path class="ln s2" d="M6 42 q8 -8 16 0 t16 0 t16 0 t16 0" style="stroke:var(--mem)"/>' },
        { a: 'Heavy shake', b: 'and blur', keep: false, why: 'Blur removes the detail the model needs to learn.', pic: '<path class="ln s2" d="M6 28 l7 -14 l7 28 l7 -28 l7 28 l7 -28 l7 28 l7 -14" style="opacity:.35;transform:translate(3px,-2px)"/><path class="ln s2" d="M6 28 l7 -14 l7 28 l7 -28 l7 28 l7 -28 l7 28 l7 -14"/>' },
        { a: 'Stock logo', b: 'across frame', keep: false, why: 'The model would learn to paint watermarks.', pic: '<rect x="4" y="4" width="72" height="42" rx="3" class="well"/><text class="b md" x="40" y="32" text-anchor="middle" style="fill:var(--ink-3);opacity:.7" transform="rotate(-18 40 28)">LOGO</text>' },
        { a: 'Dog catches', b: 'a ball, sharp', keep: true, why: 'Sharp, one shot, a clear action from start to end.', pic: '<path class="ln s2 dash" d="M8 42 Q30 -6 62 20"/><circle cx="62" cy="20" r="6" class="f-cmp"/><ellipse cx="22" cy="40" rx="9" ry="5" class="ink-f" style="opacity:.8"/><circle cx="32" cy="36" r="4" class="ink-f" style="opacity:.8"/>' }
      ];
      const CW = 96, CH = 114, GX = 10, GY = 10, X0 = 3, Y0 = 8;
      let svg = ''; CARDS.forEach((cd, i) => { const x = X0 + (i % 4) * (CW + GX), y = Y0 + Math.floor(i / 4) * (CH + GY); svg += `<g class="clk" data-i="${i}" role="button" tabindex="0" aria-label="${cd.a} ${cd.b}"><rect id="cr${i}" x="${x}" y="${y}" width="${CW}" height="${CH}" rx="10"/><g transform="translate(${x + 8} ${y + 8})"><rect width="80" height="50" rx="4" style="fill:var(--stage)"/>${cd.pic}</g><text class="xs b" x="${x + CW / 2}" y="${y + 76}" text-anchor="middle">${cd.a}</text><text class="xs b" x="${x + CW / 2}" y="${y + 90}" text-anchor="middle">${cd.b}</text><text id="cs${i}" class="xs m b" x="${x + CW / 2}" y="${y + 108}" text-anchor="middle"></text></g>`; });
      const f = c.fig(420, 286, `${svg}<text id="l1" class="b sm" x="6" y="${Y0 + 2 * CH + GY + 24}"></text><text id="l2" class="xs mute" x="6" y="${Y0 + 2 * CH + GY + 42}"></text>`);
      const st = c.stats([{ k: 'k', label: 'Clips kept', value: '', cls: 'ok' }, { k: 'c', label: 'Decisions correct', value: '', cls: 'data' }]);
      const keep = CARDS.map(() => true); let last = -1;
      function draw() {
        let good = 0;
        CARDS.forEach((cd, i) => {
          const r = f.q('#cr' + i), right = keep[i] === cd.keep; if (right) good++;
          r.setAttribute('class', keep[i] ? 't-ok' : 't-bad'); f.q('#cs' + i).textContent = keep[i] ? 'KEEP' : 'DROP';
        });
        if (last >= 0) { const cd = CARDS[last], right = keep[last] === cd.keep; f.q('#l1').textContent = cd.a + ' ' + cd.b + (right ? ': right.' : ': not yet.'); f.q('#l2').textContent = right ? cd.why : 'Ask what a model would learn from this clip.'; }
        else { f.q('#l1').textContent = 'All clips start as keep.'; f.q('#l2').textContent = 'Click the ones a model should not learn from.'; }
        st.set('k', keep.filter(Boolean).length + ' of 8'); st.set('c', good + ' of 8');
        c.mission.set(good === 8);
      }
      f.qa('.clk').forEach(g => { const act = () => { const i = +g.dataset.i; keep[i] = !keep[i]; last = i; draw(); }; c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
      draw();
      c.demo(1400, async () => { for (let i = 0; i < 8; i++) { if (keep[i] !== CARDS[i].keep) { keep[i] = CARDS[i].keep; last = i; draw(); await c.wait(450); } } });
    }
  });

  /* 13 --------------------------------------------------------------- */
  S.push({
    id: 'progressive', tag: 'Making video',
    title: 'Train cheap first, finish expensive',
    alt: 'Four training stages from images only to full 720p clips. Two bars on log scales show the tokens per sample and the attention pairs per layer for the chosen stage, with a marker at one billion pairs.',
    text: 'Training on long, high-resolution clips from the start would waste compute. Teams train in **stages**: images, then short low-resolution clips, then longer and larger ones, reusing the weights each time. From the first stage to the last, **tokens grow about 300 times** and **attention pairs about 87,000 times**.',
    hint: 'Step through the stages and read the two bars.',
    mission: 'Find the first stage where one attention layer needs over a billion pairs.',
    takeaway: 'Early stages are cheap enough to run many steps. Only the last stage pays the full cost.',
    mount(c) {
      const STG = { A: { n: 'A. Images', d: '256 × 256 px, 1 frame', lat: '1 × 32 × 32', tok: 256 }, B: { n: 'B. Short clips, low resolution', d: '256 × 256 px, 17 frames', lat: '5 × 32 × 32', tok: 5 * 256 }, C: { n: 'C. 480p clips', d: '832 × 480 px, 81 frames', lat: '21 × 60 × 104', tok: 21 * 30 * 52 }, D: { n: 'D. 720p clips', d: '1280 × 720 px, 81 frames', lat: '21 × 90 × 160', tok: 21 * 45 * 80 } };
      const f = c.fig(420, 230, '<g id="info"></g><g id="bars"></g>');
      const st = c.stats([{ k: 't', label: 'Tokens per sample', value: '', cls: 'cmp' }, { k: 'p', label: 'Attention pairs per layer', value: '', cls: 'bad' }]);
      let sel = 'A'; const lgT = v => kit.clamp((Math.log10(v) - 2) / 4, 0.01, 1), lgP = v => kit.clamp((Math.log10(v) - 4) / 7, 0.01, 1);
      function draw() {
        const s = STG[sel], pairs = s.tok * s.tok;
        f.q('#info').innerHTML = `<text class="b sm" x="16" y="24">${s.n}</text><text class="xs" x="16" y="42">${s.d}</text><text class="xs m" x="16" y="58">latent ${s.lat} → ${fmt.n(s.tok)} tokens</text><text class="xs mute" x="16" y="74">patches of 1 frame × 2 × 2</text>`;
        f.q('#bars').innerHTML = kit.bar(16, 96, 388, 14, lgT(s.tok), 'f-cmp', 'Tokens per sample (log scale, 100 to 1,000,000)', fmt.n(s.tok)) + kit.bar(16, 150, 388, 14, lgP(pairs), pairs > 1e9 ? 'f-bad' : 'f-mem', 'Attention pairs per layer (log scale, 10,000 to 100 billion)', big(pairs)) +
          `<line class="ln" x1="${16 + lgP(1e9) * 388}" x2="${16 + lgP(1e9) * 388}" y1="152" y2="178" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${16 + lgP(1e9) * 388}" y="192" text-anchor="middle">1 billion</text><text class="xs mute" x="16" y="216">An example schedule, not any one model’s recipe.</text>`;
        st.set('t', fmt.n(s.tok), (s.tok / 256).toFixed(s.tok === 256 ? 0 : 0) + '× stage A'); st.set('p', big(pairs), fmt.n(Math.round(pairs / 65536)) + '× stage A');
        c.mission.set(sel === 'C');
      }
      c.seg({ label: 'Training stage', options: [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']], value: 'A', onChange: v => { sel = v; draw(); } });
      draw();
      c.demo(1500, async () => { sel = 'C'; draw(); });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'cost', tag: 'Making video',
    title: 'What one clip costs on one GPU',
    alt: 'A bar on a log scale shows the estimated time to generate one 5-second clip on one GPU, with a marker at 60 seconds. Controls set the model size, the resolution, the number of denoising steps and whether guidance doubles the calls. A second bar shows the share of compute that goes to attention.',
    text: 'Each denoising step runs the whole transformer on all the tokens. Cost is **calls × (2 × parameters × tokens + 4 × layers × width × tokens²)**. For a large model at 720p with 50 steps and guidance, that is **100 calls over 75,600 tokens**, about half an hour on one H100. Attention takes most of it.',
    hint: 'Shrink the model, the resolution, or the number of calls.',
    mission: 'Get one clip under 60 seconds on one GPU.',
    takeaway: 'Steps, guidance, resolution and model size all multiply. Cutting any one of them helps.',
    mount(c) {
      const M = { '1.3B': { P: 1.3e9, L: 30, d: 1536 }, '5B': { P: 5e9, L: 32, d: 3072 }, '14B': { P: 14e9, L: 40, d: 5120 } };
      const f = c.fig(420, 188, '<g id="bars"></g>');
      const st = c.stats([{ k: 'c', label: 'Calls', value: '', cls: 'cmp' }, { k: 'f', label: 'Compute per clip', value: '', cls: 'mem' }, { k: 't', label: 'Time on one GPU', value: '', cls: 'data' }]);
      let mdl = '14B', res = '720p', steps = 50, guid = true;
      const lgT = v => kit.clamp(Math.log10(v) / 3.7, 0.01, 1), tf = s => s < 90 ? Math.round(s) + ' s' : s < 5400 ? (s / 60).toFixed(1) + ' min' : (s / 3600).toFixed(1) + ' h';
      function draw() {
        const m = M[mdl], N = res === '720p' ? 75600 : 32760, lin = 2 * m.P * N, att = 4 * m.L * m.d * N * N, calls = steps * (guid ? 2 : 1), flops = (lin + att) * calls, secs = flops / (0.4 * 989e12), share = att / (lin + att);
        f.q('#bars').innerHTML = kit.bar(16, 34, 388, 16, lgT(secs), secs < 60 ? 'f-ok' : 'f-cmp', 'Time for one 5-second clip (log scale, 1 s to 5,000 s)', tf(secs)) +
          `<line class="ln" x1="${16 + lgT(60) * 388}" x2="${16 + lgT(60) * 388}" y1="36" y2="62" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${16 + lgT(60) * 388}" y="76" text-anchor="middle">60 s</text>` +
          kit.bar(16, 112, 388, 16, share, 'f-mem', 'Share of compute spent on attention', Math.round(share * 100) + '%') + `<text class="xs mute" x="16" y="160">${fmt.n(N)} tokens per clip. Peak 989 TFLOPS, 40% used (assumed).</text><text class="xs mute" x="16" y="176">Linear layers and attention only. Real speed also depends on memory.</text>`;
        st.set('c', calls, steps + ' steps' + (guid ? ' × 2' : '')); st.set('f', kit.sci(flops, 1), 'floating-point operations'); st.set('t', tf(secs), secs < 60 ? 'under a minute' : 'over a minute');
        c.mission.set(secs < 60);
      }
      c.seg({ label: 'Model size (typical shapes)', options: [['1.3B', '1.3B'], ['5B', '5B'], ['14B', '14B']], value: '14B', onChange: v => { mdl = v; draw(); } });
      c.seg({ label: 'Resolution', options: [['480p', '480p'], ['720p', '720p']], value: '720p', onChange: v => { res = v; draw(); } });
      c.slider({ label: 'Denoising steps', values: [5, 10, 20, 30, 50], value: 50, fmt: v => v, onInput: v => { steps = v; draw(); } });
      const tg = c.toggle({ label: 'Guidance: two calls per step', value: true, onChange: v => { guid = v; draw(); } });
      draw();
      c.demo(1500, async () => { mdl = '1.3B'; res = '480p'; steps = 20; draw(); });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'consistency', tag: 'Making video',
    title: 'Frames must agree with each other',
    alt: 'Twelve dots show where a generated ball appears in twelve frames. The true path is a straight dotted line. A slider sets how strongly neighboring frames share their errors. With no coupling the dots jump up and down. With strong coupling they follow a smooth path.',
    text: 'A ball moves in a straight line, but a model makes a small random error in each frame. If frames are made **independently**, the errors jump from frame to frame and the video flickers. **Temporal attention** lets neighboring frames share their errors, so the path stays smooth. The slider sets how much of the previous frame’s error carries over.',
    hint: 'Raise the temporal coupling and watch the dots settle.',
    mission: 'Get the average jump between frames under 3 pixels.',
    takeaway: 'Flicker is uncorrelated error. Linking the frames makes errors move together.',
    mount(c) {
      const r = kit.rng(77), eps = Array.from({ length: 12 }, () => kit.gauss(r)), BASE = 112, AMP = 26, X0 = 36, DX = 32.7;
      const f = c.fig(420, 226, `<line class="ln dash" x1="${X0 - 14}" x2="${X0 + 11 * DX + 14}" y1="${BASE}" y2="${BASE}"/><text class="xs mute" x="${X0 - 14}" y="${BASE - 8}">true path</text><path id="path" class="s-cmp s2" fill="none"/><g id="dots"></g><g id="nums"></g><text class="xs mute" x="16" y="212">The ball should sit on the dotted line in every frame. Toy model.</text>`);
      const st = c.stats([{ k: 'j', label: 'Average jump between frames', value: '', cls: 'cmp' }, { k: 'w', label: 'Largest error', value: '', cls: 'bad' }]);
      let rho = 0;
      function draw() {
        const n = []; for (let k = 0; k < 12; k++) n.push(k === 0 ? eps[0] : rho * n[k - 1] + Math.sqrt(1 - rho * rho) * eps[k]);
        const ys = n.map(v => kit.clamp(BASE + v * AMP, 22, 200)), xs = n.map((_, k) => X0 + k * DX);
        f.q('#path').setAttribute('d', kit.path(xs.map((x, k) => [x, ys[k]])));
        f.q('#dots').innerHTML = xs.map((x, k) => `<circle cx="${x.toFixed(1)}" cy="${ys[k].toFixed(1)}" r="5.5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/>`).join('');
        f.q('#nums').innerHTML = xs.map((x, k) => `<text class="xs m mute" x="${x.toFixed(1)}" y="196" text-anchor="middle">${k + 1}</text>`).join('');
        let jump = 0; for (let k = 1; k < 12; k++) jump += Math.abs((n[k] - n[k - 1]) * AMP); jump /= 11;
        const worst = Math.max(...n.map(v => Math.abs(v * AMP)));
        st.set('j', jump.toFixed(1) + ' px', jump < 3 ? 'smooth' : 'visible flicker'); st.set('w', worst.toFixed(0) + ' px', 'from the true path');
        c.mission.set(jump < 3);
      }
      const sl = c.slider({ label: 'Temporal coupling', min: 0, max: 99, step: 1, value: 0, fmt: v => v + '%', onInput: v => { rho = v / 100; draw(); } });
      draw();
      c.play(async () => { await c.wait(500); await c.tween(2600, p => { rho = Math.round(p * 99) / 100; sl.set(Math.round(rho * 100), true); draw(); }, c.ease.io); await c.wait(300); await c.tween(900, p => { rho = Math.round((1 - p) * 99) / 100; sl.set(Math.round(rho * 100), true); draw(); }, c.ease.io); rho = 0; sl.set(0, true); draw(); });
    }
  });

  /* 16 --------------------------------------------------------------- */
  S.push({
    id: 'failures', tag: 'Making video',
    title: 'Match the glitch to its likely cause',
    alt: 'Four glitches on the left and four likely causes on the right, in a different order. Clicking a glitch and then a cause pairs them. When all four are paired, right pairs turn green and wrong ones turn red.',
    text: 'Generated clips fail in recognizable ways, and each failure points to a part of the pipeline from this lesson: **temporal attention**, **VAE compression**, **frame rate**, or **training data**. Real failures often have several causes, but each of these is the first thing to check.',
    hint: 'Click a glitch, then its likely cause. Pair all four.',
    mission: 'Pair all four glitches with their likely causes.',
    takeaway: 'Every glitch maps to one stage of the pipeline, so you know where to look first.',
    mount(c) {
      const left = ['A person’s left hand turns into a right hand halfway through the clip.', 'Small text on a sign flickers from frame to frame.', 'The motion is choppy, with visible jumps between frames.', 'The subject stands still while only the camera drifts.'];
      const right = ['Frames are weakly tied together: temporal attention is too limited.', 'The VAE compresses space heavily and drops fine detail.', 'Too few frames, or a very large compression in time.', 'Training data was mostly static clips.'];
      const why = ['Identity drift means frames are not tied together.', 'Fine detail is what the VAE loses first.', 'Too few frames leave visible jumps.', 'The model rarely saw a moving subject.'];
      const nt = c.note('');
      const mt = kit.matcher(c, { left, right, answer: [0, 1, 2, 3], order: [2, 0, 3, 1], onChange: s => {
        c.mission.set(s.all && s.good === 4);
        nt.textContent = !s.all ? 'Pair every glitch. Click a linked item to unlink it.' : s.good === 4 ? 'All four match. ' + why.join(' ') : s.good + ' of 4 match. Click a red item to unlink it and try again.';
      } });
      c.btn('Start over', () => mt.reset(), { small: true });
      c.demo(1500, async () => { mt.solve(); });
    }
  });

  /* 17 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'Why do video models sample 8 to 32 frames instead of using every frame?', o: ['Attention cost grows with the square of the token count, and neighboring frames are nearly identical', 'Cameras only record 8 frames', 'Frames cannot be turned into tokens', 'It makes the picture sharper'], a: 0, why: 'Every extra frame adds a full picture of tokens, and attention compares every pair. Neighbors carry almost the same information.' },
      { q: 'A dot spins 3 times per second and you sample 4 frames per second. What do you see?', o: ['It turns forward at 3 turns per second', 'It looks like it turns backward', 'It looks frozen', 'It looks twice as fast'], a: 1, why: 'Each sample advances 270 degrees, which looks like 90 degrees backward. Sampling must exceed twice the spin rate.' },
      { q: '32 frames at 224 px with 4 × 16 × 16 tubelets. How many tokens?', o: ['6,272', '3,136', '784', '1,568'], a: 3, why: '32 ÷ 4 = 8 time steps, and 14 × 14 = 196 patches per step. 8 × 196 = 1,568.' },
      { q: 'What limits the saving from divided space-time attention?', o: ['It can never reach the smaller of the frame count and the patches per frame', 'The number of heads', 'The size of the vocabulary', 'The GPU memory clock'], a: 0, why: 'The saving is T·P ÷ (T + P), which is always below min(T, P). With 16 frames it stays under 16 times.' },
      { q: 'Why does VideoMAE use tube masking?', o: ['It is faster to code', 'It hides fewer patches', 'A hidden patch cannot be copied from the same spot in a neighboring frame', 'It removes the decoder'], a: 2, why: 'With random masking, a hidden patch often has a visible copy one frame away. Tube masking hides the same positions in every frame.' },
      { q: 'What does a causal 3D VAE do with the first frame?', o: ['It drops it', 'It averages it with the last frame', 'It doubles it', 'It encodes the first frame alone, so an image is a one-frame video'], a: 3, why: 'Later groups of frames depend only on earlier ones. That lets one VAE handle both images and videos.' },
      { q: 'Why split videos at scene cuts before training?', o: ['Cuts make files larger', 'A cut inside a clip teaches that objects can teleport', 'Models cannot read colors across a cut', 'Cuts remove audio'], a: 1, why: 'The model learns whatever is in the data. Single-shot clips keep motion continuous.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g style="stroke:var(--line);stroke-width:1.5"><rect x="96" y="22" width="120" height="76" rx="8" style="fill:var(--panel)"/><rect x="84" y="32" width="120" height="76" rx="8" style="fill:var(--panel)"/><rect x="72" y="42" width="120" height="76" rx="8" style="fill:var(--panel)"/><rect x="60" y="52" width="120" height="76" rx="8" style="fill:var(--panel)"/></g>'
    + '<rect x="66" y="58" width="108" height="50" rx="4" style="fill:var(--mem-soft)"/><rect x="66" y="108" width="108" height="14" rx="3" style="fill:var(--data-soft)"/><circle cx="148" cy="80" r="9" style="fill:var(--warn)"/><path d="M80 108 L106 74 L126 100 L138 90 L160 108 Z" style="fill:var(--mem)"/>'
    + '<circle cx="240" cy="92" r="22" style="fill:var(--ctl);opacity:.9"/><path d="M233 80 L254 92 L233 104 Z" style="fill:var(--on-accent)"/>'
    + '<text x="60" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">frames, tubelets, latents</text></svg>';

  window.LESSONS.push({
    id: 'video', n: 6, track: 'vision', order: 2,
    title: 'Video: How Models Watch and Make Clips',
    tagline: 'Frames, tubelets and attention, then 3D VAEs, space-time transformers and the data behind generated video.',
    preview,
    scenes: S
  });
})();
