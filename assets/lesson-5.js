/* Lesson 5: Images, how models see and draw */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const IMG = kit.picture(28);              /* one block stands for 8 x 8 real pixels of a 224 x 224 photo */
  const logFrac = (v, lo, hi) => kit.clamp((Math.log10(Math.max(v, 1)) - lo) / (hi - lo), 0, 1);

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'pixels', tag: 'Seeing',
    title: 'A photo is far too long to read pixel by pixel',
    alt: 'A picture beside two pairs of bars. The photo holds 150,528 numbers, about 75 times a long chat message. Comparing every pair of those numbers takes about 23 billion comparisons per layer.',
    text: 'A language model reads a prompt of about 2,000 tokens. A 224 × 224 color photo holds **150,528 numbers**, about 75 times as many. Attention compares every item with every other, so the work grows with the **square**: **about 23 billion comparisons** in one layer.',
    hint: 'Change the image size and watch both pairs of bars.',
    takeaway: 'Treat every pixel as a token and attention becomes impossible. Images need a much shorter sequence.',
    mount(c) {
      const TEXT = 2000;
      const f = c.fig(420, 292, `
        ${kit.pixels(IMG, 28, 20, 40, 132)}
        <rect class="none-f ink-s" x="20" y="40" width="132" height="132" rx="3"/>
        <text class="b sm" x="20" y="28">The photo</text>
        <text id="dims" class="m xs mute" x="86" y="192" text-anchor="middle"></text>
        <g id="bars"></g>`);
      const st = c.stats([{ k: 'n', label: 'Numbers in the photo', value: '', cls: 'cmp' }, { k: 'r', label: 'Compared with a chat message', value: '', cls: 'mem' }, { k: 'p', label: 'Comparisons per layer', value: '', cls: 'bad' }]);
      function draw(side) {
        const n = side * side * 3, pairs = n * n;
        f.q('#dims').textContent = side + ' × ' + side + ' × 3';
        f.q('#bars').innerHTML =
          '<text class="b sm" x="176" y="28">Numbers to read</text>' +
          kit.bar(176, 54, 224, 14, logFrac(n, 3, 11), 'f-cmp', 'Photo', kit.sci(n, 1)) +
          kit.bar(176, 92, 224, 14, logFrac(TEXT, 3, 11), 'f-mem', 'Chat message', '2 × 10³') +
          '<text class="b sm" x="176" y="148">Attention comparisons per layer</text>' +
          kit.bar(176, 174, 224, 14, logFrac(pairs, 3, 11), 'f-cmp', 'Photo', kit.sci(pairs, 1)) +
          kit.bar(176, 212, 224, 14, logFrac(TEXT * TEXT, 3, 11), 'f-mem', 'Chat message', '4 × 10⁶') +
          '<text class="xs mute" x="400" y="248" text-anchor="end">bars use a log scale: each tick is 10× more</text>';
        st.set('n', fmt.n(n)); st.set('r', n >= TEXT ? '× ' + fmt.n(n / TEXT, n / TEXT < 10 ? 1 : 0) : '× ' + (n / TEXT).toFixed(2), 'a prompt is about 2,000 tokens');
        st.set('p', pairs >= 1e9 ? fmt.si(pairs, 1) : fmt.n(pairs), pairs >= 1e9 ? 'billions per layer, per head' : '');
      }
      const sl = c.slider({ label: 'Image width and height (pixels)', values: [32, 64, 112, 224, 448, 896], value: 224, fmt: v => v, onInput: draw });
      c.note('Real photos are larger than 224 × 224. The number of comparisons grows with the fourth power of the image side.');
      draw(224);
      c.demo(1800, async () => { for (const v of [448, 112, 224]) { sl.set(v); await c.wait(1300); } });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'patches', tag: 'Seeing',
    title: 'Cut the image into patches',
    alt: 'The photo overlaid with a grid of square patches. A slider changes the patch size, and counters show how many patches result and how many comparisons attention needs.',
    text: 'The 2020 breakthrough was to stop thinking in pixels. Cut the image into squares of **16 × 16 pixels**, called [[patch|patches]]. A 224 × 224 photo becomes a row of **196 patches**, a sequence a transformer handles easily.',
    hint: 'Slide the patch size. Click a patch to count its numbers.',
    mission: 'Find the patch size that gives at least 100 patches and under 50,000 comparisons.',
    takeaway: 'Patches turn 150,528 pixel values into 196 tokens, and attention drops from about 23 billion comparisons to 38,416.',
    mount(c) {
      const W = 224, X0 = 98, Y0 = 18;
      const f = c.fig(420, 262, `${kit.pixels(IMG, 28, X0, Y0, W)}<g id="grid"></g><rect id="pick" class="none-f s-ctl" x="0" y="0" width="0" height="0" style="stroke-width:3;opacity:0"/><text id="cap" class="sm b" x="210" y="${Y0 + W + 22}" text-anchor="middle"></text>`);
      const st = c.stats([{ k: 'n', label: 'Patches', value: '', cls: 'data' }, { k: 'v', label: 'Numbers per patch', value: '', cls: 'mem' }, { k: 'p', label: 'Comparisons per layer', value: '', cls: 'cmp' }]);
      let p = 8, sel = null;
      function draw() {
        const g = W / p, N = g * g, bp = (p / 8) * (W / 28);        /* patch width in drawing units */
        let ln = '';
        for (let i = 1; i < g; i++) { const o = i * bp; ln += `<line x1="${X0 + o}" y1="${Y0}" x2="${X0 + o}" y2="${Y0 + W}"/><line x1="${X0}" y1="${Y0 + o}" x2="${X0 + W}" y2="${Y0 + o}"/>`; }
        f.q('#grid').innerHTML = `<g style="stroke:#fff;stroke-width:${g > 20 ? 0.6 : 1.2};opacity:.9">${ln}</g>`;
        const pk = f.q('#pick');
        if (sel && sel.i < g && sel.j < g) { pk.setAttribute('x', X0 + sel.i * bp); pk.setAttribute('y', Y0 + sel.j * bp); pk.setAttribute('width', bp); pk.setAttribute('height', bp); pk.style.opacity = 1; f.q('#cap').textContent = 'This patch: ' + p + ' × ' + p + ' × 3 = ' + fmt.n(p * p * 3) + ' numbers'; }
        else { pk.style.opacity = 0; sel = null; f.q('#cap').textContent = g + ' × ' + g + ' patches of ' + p + ' × ' + p + ' pixels'; }
        st.set('n', fmt.n(N), g + ' × ' + g); st.set('v', fmt.n(p * p * 3), p + ' × ' + p + ' × 3'); st.set('p', fmt.n(N * N));
        c.mission.set(N >= 100 && N * N < 50000);
      }
      c.on(f.svg, 'click', e => {
        const r = f.svg.getBoundingClientRect(), sc = 420 / r.width, x = (e.clientX - r.left) * sc - X0, y = (e.clientY - r.top) * sc - Y0, g = W / p, bp = W / g;
        if (x < 0 || y < 0 || x >= W || y >= W) return;
        sel = { i: Math.floor(x / bp), j: Math.floor(y / bp) }; draw();
      });
      c.slider({ label: 'Patch size (pixels)', values: [8, 16, 32, 56, 112, 224], value: 8, fmt: v => v, onInput: v => { p = v; draw(); } });
      draw();
      c.demo(2000, async () => { sel = { i: 3, j: 5 }; draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'embed', tag: 'Seeing',
    title: 'A patch becomes one vector',
    alt: 'A single patch is flattened into a strip of 768 numbers, multiplied by a learned matrix, and becomes an embedding vector. Choosing a larger embedding size makes the matrix and the output longer.',
    text: 'Flatten one patch into a strip: 16 × 16 × 3 color channels is **768 raw numbers**. A learned matrix turns that strip into an [[embedding]] of whatever length the model needs. In practice this is one strided convolution. You have just tokenized an image, with no vocabulary.',
    hint: 'Pick an embedding size and toggle the convolution view.',
    takeaway: 'The matrix is learned during training, so the model chooses its own visual words.',
    mount(c) {
      const r = kit.rng(7), patch = [];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) patch.push(IMG[(16 + j) * 28 + 17 + i]);
      let strip = '';
      for (let i = 0; i < 64; i++) { const px = patch[(i * 3) % 16][i % 3]; strip += `<rect x="${20 + i * 5.9}" y="132" width="5.2" height="22" rx="1" style="fill:rgb(${px},${px},${px})"/>`; }
      let wm = '';
      for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) wm += `<rect x="${24 + i * 11.6}" y="${192 + j * 11.4}" width="10" height="10" rx="2" class="f-ctl" style="opacity:${(0.25 + r() * 0.75).toFixed(2)}"/>`;
      const f = c.fig(420, 296, `
        <text class="b sm" x="20" y="22">1. One patch, 16 × 16 pixels</text>
        ${kit.pixels(patch, 4, 20, 32, 64, { bleed: 0 })}<rect class="none-f ink-s" x="20" y="32" width="64" height="64" rx="2"/>
        <rect id="kern" class="none-f s-ctl" x="20" y="32" width="64" height="64" style="stroke-width:3;opacity:0"/>
        <path class="ln s2" d="M92 64 H128" marker-end="url(#ah-ink)"/>
        <text class="xs mute" x="132" y="60">× 3 color channels</text><text class="xs mute" x="132" y="76">flatten</text>
        <text class="b sm" x="20" y="124">2. 768 raw numbers</text>${strip}
        <text class="b sm" x="20" y="180">3. Learned matrix</text>
        <rect class="box" x="20" y="186" width="148" height="92" rx="8"/>${wm}
        <text id="mdim" class="m xs b" x="94" y="290" text-anchor="middle"></text>
        <path class="ln s2" d="M178 232 H208" marker-end="url(#ah-ink)"/>
        <text class="b sm" x="216" y="196">4. Embedding</text><g id="out"></g>`);
      const st = c.stats([{ k: 'w', label: 'Learned weights in the matrix', value: '', cls: 'ctl' }, { k: 'd', label: 'Numbers per patch after', value: '', cls: 'data' }]);
      let D = 768, conv = false;
      function draw() {
        const cells = Math.max(3, Math.round(D / 48)), cw = 184 / cells;
        let o = '';
        for (let i = 0; i < cells; i++) o += `<rect class="f-data" x="${216 + i * cw}" y="212" width="${cw - 2}" height="40" rx="2" style="opacity:${(0.45 + ((i * 37) % 10) / 20).toFixed(2)}"/>`;
        f.q('#out').innerHTML = o + `<text class="m xs b" x="216" y="270">${D} numbers</text>`;
        f.q('#mdim').textContent = '768 × ' + D;
        f.q('#kern').style.opacity = conv ? 1 : 0;
        st.set('w', fmt.n(768 * D), '768 × ' + D + (conv ? ', the convolution filters' : ''));
        st.set('d', fmt.n(D), 'was 768 raw values');
      }
      c.seg({ label: 'Embedding size', options: [[192, '192'], [384, '384'], [768, '768'], [1024, '1,024']], value: 768, onChange: v => { D = v; draw(); } });
      c.toggle({ label: 'Show it as a strided convolution', value: false, onChange: v => { conv = v; draw(); c.say(v ? '**Same math.** A 16 × 16 filter bank slides over the image and jumps 16 pixels each time, so every patch is visited once.' : ''); } });
      draw();
      c.demo(1500, async () => { conv = true; draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'cls', tag: 'Seeing',
    title: 'A summary token joins the patches',
    alt: 'A seven by seven grid of patches over the photo with a summary token labeled CLS beside it. Choosing a layer changes how strongly the summary token attends to each patch: spread out in layer 1, concentrated on the house and mountain by layer 12.',
    text: 'Patches alone give no single answer for the whole image. So we prepend a special token, [[cls token|CLS]]. It holds no pixels. Through attention it learns to gather information from every patch, and at the last layer it holds the image summary used for classification.',
    hint: 'Switch layers and click a patch to read its weight.',
    takeaway: 'CLS is a learnable blank slot that attention fills with a summary of the whole image.',
    mount(c) {
      const N = 7, W = 224, X0 = 20, Y0 = 16, pw = W / N;
      /* how important each patch is for naming the picture (house, mountain peak, sun) */
      const imp = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N, y = (j + 0.5) / N;
        let v = 0;
        if (x > 0.58 && x < 0.88 && y > 0.5 && y < 0.84) v = 1;
        if (Math.abs(x - 0.3) < 0.2 && y > 0.25 && y < 0.55) v = Math.max(v, 0.75);
        if ((x - 0.76) ** 2 + (y - 0.2) ** 2 < 0.02) v = Math.max(v, 0.45);
        imp.push(v);
      }
      let cells = '';
      for (let k = 0; k < N * N; k++) { const i = k % N, j = Math.floor(k / N); cells += `<g class="clk" data-k="${k}" role="button" tabindex="0" aria-label="Patch ${k + 1}"><rect id="h${k}" class="f-cmp" x="${X0 + i * pw}" y="${Y0 + j * pw}" width="${pw}" height="${pw}" style="opacity:0"/><rect class="none-f" x="${X0 + i * pw}" y="${Y0 + j * pw}" width="${pw}" height="${pw}" style="stroke:#fff;stroke-width:1;opacity:.8"/></g>`; }
      const f = c.fig(420, 304, `${kit.pixels(IMG, 28, X0, Y0, W)}${cells}
        <rect class="t-ctl" x="290" y="40" width="96" height="46" rx="10"/><text class="b md" x="338" y="68" text-anchor="middle">CLS</text>
        <text class="xs mute" x="338" y="104" text-anchor="middle">no pixels, learnable</text>
        <path class="ln s2" d="M280 63 H262" marker-end="url(#ah-ctl)" style="stroke:var(--ctl)"/>
        <text class="b sm" x="290" y="140">Attention from CLS</text>
        <g id="top"></g>
        <text class="b sm" x="20" y="${Y0 + W + 22}">Sequence: [CLS] + 196 patches = 197 tokens</text>
        ${kit.chips(['CLS', 'p1', 'p2', 'p3', 'p4', '…', 'p196'], 20, Y0 + W + 32, 44, 20, 6, { cls: 't-ctl' })}`);
      const st = c.stats([{ k: 'a', label: 'Strongest patch', value: '', cls: 'cmp' }, { k: 's', label: 'Attention spread over', value: '', cls: 'mem' }]);
      let layer = 12, pick = -1, w = [];
      function weights() {
        const T = { 1: 0.0, 6: 1.6, 12: 3.4 }[layer], r = kit.rng(layer);
        const lg = imp.map(v => T * v + 0.35 * kit.gauss(r)), mx = Math.max(...lg), ex = lg.map(v => Math.exp(v - mx)), s = ex.reduce((a, b) => a + b, 0);
        w = ex.map(v => v / s);
      }
      function draw() {
        weights();
        const mx = Math.max(...w);
        w.forEach((v, k) => { f.q('#h' + k).style.opacity = (0.08 + 0.85 * v / mx).toFixed(2); });
        const idx = w.map((v, k) => k).sort((a, b) => w[b] - w[a]).slice(0, 3);
        f.q('#top').innerHTML = idx.map((k, i) => `<text class="xs m" x="290" y="${160 + i * 18}">patch ${k + 1}: ${(w[k] * 100).toFixed(1)}%</text>`).join('') + `<text class="xs mute" x="290" y="${160 + 3 * 18 + 4}">even share: ${(100 / (N * N)).toFixed(1)}%</text>`;
        const ent = -w.reduce((a, v) => a + v * Math.log(v + 1e-9), 0), eff = Math.exp(ent);
        st.set('a', (mx * 100).toFixed(1) + '%', 'patch ' + (w.indexOf(mx) + 1));
        st.set('s', '≈ ' + Math.round(eff) + ' patches', 'of ' + N * N + ' (effective count)');
        if (pick >= 0) c.say('**Patch ' + (pick + 1) + '** gets ' + (w[pick] * 100).toFixed(1) + '% of the summary token’s attention at layer ' + layer + '.');
      }
      f.qa('.clk').forEach(g => { const act = () => { pick = +g.dataset.k; draw(); }; c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
      const sg = c.seg({ label: 'Layer', options: [[1, 'Layer 1'], [6, 'Layer 6'], [12, 'Layer 12']], value: 12, onChange: v => { layer = v; draw(); } });
      c.note('These attention weights are a hand-built illustration of how the pattern sharpens with depth. Real models learn their own.');
      draw();
      c.play(async () => { for (const v of [1, 6, 12]) { layer = v; sg.set(v); draw(); await c.wait(1300); } });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'position', tag: 'Seeing',
    title: 'Patches need to know where they are',
    alt: 'A four by four puzzle of shuffled picture tiles. Clicking two tiles swaps them. A switch shows each tile’s position number, which makes the puzzle easy to solve.',
    text: 'A transformer has no built-in sense of order. A patch knows its content but not its place, and a nose patch could be anywhere. The fix is to **add a learned position embedding** to every patch. Simple 1D numbers work almost as well as 2D coordinates.',
    hint: 'Swap tiles to rebuild the photo. Then switch the position tags on and off.',
    mission: 'Rebuild the photo with all 16 tiles in place.',
    takeaway: 'Content plus a position tag lets attention tell patches apart, even from a shuffled bag.',
    mount(c) {
      const G = 4, SZ = 56, X0 = 98, Y0 = 14, NP = 28 / G;                 /* 7 x 7 picture pixels per tile */
      let perm = [], seed = 3, tags = false, sel = -1, swaps = 0;
      function tilePixels(src) {
        const ti = src % G, tj = Math.floor(src / G), out = [];
        for (let j = 0; j < NP; j++) for (let i = 0; i < NP; i++) out.push(IMG[(tj * NP + j) * 28 + ti * NP + i]);
        return out;
      }
      const f = c.fig(420, 296, `<g id="tiles"></g><text id="msg" class="b sm" x="210" y="${Y0 + G * SZ + 24}" text-anchor="middle"></text>
        <text class="xs mute" x="210" y="${Y0 + G * SZ + 46}" text-anchor="middle">patch vector + position vector = what attention reads</text>`);
      const st = c.stats([{ k: 'c', label: 'Tiles in place', value: '', cls: 'ok' }, { k: 's', label: 'Swaps so far', value: '', cls: 'mem' }]);
      function shuffle() {
        const r = kit.rng(seed++); perm = Array.from({ length: 16 }, (_, i) => i);
        do { for (let i = 15; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } } while (perm.every((v, i) => v === i));
        swaps = 0; sel = -1; draw();
      }
      function draw() {
        let o = '';
        perm.forEach((src, k) => {
          const x = X0 + (k % G) * SZ, y = Y0 + Math.floor(k / G) * SZ;
          o += `<g class="clk" data-k="${k}" role="button" tabindex="0" aria-label="Tile ${k + 1}">${kit.pixels(tilePixels(src), NP, x, y, SZ - 2, { bleed: 0.3 })}<rect class="none-f ${k === sel ? 's-ctl' : 'ink-s'}" x="${x}" y="${y}" width="${SZ - 2}" height="${SZ - 2}" style="stroke-width:${k === sel ? 4 : 1}"/>`;
          if (tags) o += `<rect x="${x + 3}" y="${y + 3}" width="22" height="16" rx="4" style="fill:rgba(10,14,28,.72)"/><text class="xs m b" x="${x + 14}" y="${y + 15}" text-anchor="middle" style="fill:#fff">${src + 1}</text>`;
          o += '</g>';
        });
        f.q('#tiles').innerHTML = o;
        f.qa('.clk').forEach(g => { const act = () => pickTile(+g.dataset.k); c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
        const ok = perm.filter((v, i) => v === i).length;
        st.set('c', ok + ' of 16'); st.set('s', swaps);
        f.q('#msg').textContent = ok === 16 ? 'Solved in ' + swaps + ' swaps.' : tags ? 'Each tag is a tile’s true position. Put tile n in slot n.' : 'No position tags. Match the picture from memory.';
        c.mission.set(ok === 16);
      }
      function pickTile(k) {
        if (sel < 0) sel = k; else { if (sel !== k) { [perm[sel], perm[k]] = [perm[k], perm[sel]]; swaps++; } sel = -1; }
        draw();
      }
      c.toggle({ label: 'Show position tags', value: false, onChange: v => { tags = v; draw(); } });
      c.btn('Shuffle again', shuffle, { small: true });
      c.note('Slot numbers run left to right, top to bottom: 1 to 16.');
      shuffle();
      c.demo(1500, async () => { tags = true; draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'attn', tag: 'Seeing',
    title: 'Every patch looks at every other patch',
    alt: 'A five by five patch grid over the photo. A chosen patch shades every other patch by how much it attends to it. A layer slider moves from local attention in early layers to attention spread over similar patches across the whole image in deep layers.',
    text: '[[attention|Self-attention]] lets every patch attend to every other patch and to CLS: 197 × 197 = **38,809 pairs** per head, with 12 heads running in parallel. Early layers look at neighbors. Deeper layers connect patches across the whole image.',
    hint: 'Click a patch, then slide through the layers.',
    takeaway: 'Early layers act locally. Deeper layers link far-apart patches that belong together.',
    mount(c) {
      const N = 5, W = 200, X0 = 20, Y0 = 20, pw = W / N;
      const col = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = Math.floor(j * 28 / N); y < Math.floor((j + 1) * 28 / N); y++) for (let x = Math.floor(i * 28 / N); x < Math.floor((i + 1) * 28 / N); x++) { const p = IMG[y * 28 + x]; r += p[0]; g += p[1]; b += p[2]; n++; }
        col.push([r / n, g / n, b / n]);
      }
      const cos = (a, b) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
      let cells = '';
      for (let k = 0; k < N * N; k++) { const i = k % N, j = Math.floor(k / N); cells += `<g class="clk" data-k="${k}" role="button" tabindex="0" aria-label="Choose patch ${k + 1}"><rect id="a${k}" class="f-ctl" x="${X0 + i * pw}" y="${Y0 + j * pw}" width="${pw}" height="${pw}" style="opacity:0"/><rect class="none-f" x="${X0 + i * pw}" y="${Y0 + j * pw}" width="${pw}" height="${pw}" style="stroke:#fff;stroke-width:1;opacity:.75"/></g>`; }
      const f = c.fig(420, 262, `${kit.pixels(IMG, 28, X0, Y0, W)}${cells}<rect id="q" class="none-f s-cmp" x="0" y="0" width="${pw}" height="${pw}" style="stroke-width:4"/>
        <text class="b sm" x="244" y="38">Chosen patch attends to…</text>
        <text class="xs mute" x="244" y="58">violet = more attention</text>
        <g id="meter"></g>`);
      const st = c.stats([{ k: 'd', label: 'Average attention distance', value: '', cls: 'mem' }, { k: 'p', label: 'Pairs per head, per layer', value: '38,809', sub: '197 × 197', cls: 'cmp' }, { k: 'h', label: 'With 12 heads', value: '465,708', sub: 'relationships per layer', cls: 'cmp' }]);
      let layer = 1, q = 18;
      function draw() {
        const sig = [0.7, 1.0, 1.4, 2.0, 3.0, 5.0][Math.min(5, Math.floor((layer - 1) / 2))], lam = 5 * (layer - 1) / 11;
        const lg = col.map((cc, k) => { const dx = (k % N) - (q % N), dy = Math.floor(k / N) - Math.floor(q / N); return -(dx * dx + dy * dy) / (2 * sig * sig) - lam * 1.3 * Math.hypot(col[q][0] - cc[0], col[q][1] - cc[1]) / 40; });
        const mx = Math.max(...lg), ex = lg.map(v => Math.exp(v - mx)), sum = ex.reduce((a, b) => a + b, 0), w = ex.map(v => v / sum), wm = Math.max(...w);
        w.forEach((v, k) => { f.q('#a' + k).style.opacity = (0.04 + 0.9 * v / wm).toFixed(2); });
        const i = q % N, j = Math.floor(q / N), qq = f.q('#q'); qq.setAttribute('x', X0 + i * pw); qq.setAttribute('y', Y0 + j * pw);
        let dist = 0; w.forEach((v, k) => { dist += v * Math.hypot((k % N) - i, Math.floor(k / N) - j); });
        st.set('d', dist.toFixed(1) + ' patches', layer <= 3 ? 'neighbors only' : layer <= 8 ? 'widening' : 'whole image');
        f.q('#meter').innerHTML = kit.bar(244, 90, 156, 14, kit.clamp(dist / 3.2, 0, 1), 'f-mem', 'Distance it reaches', dist.toFixed(1)) +
          `<text class="b sm" x="244" y="150">Layer ${layer} of 12</text>` +
          `<text class="xs mute" x="244" y="170">${layer <= 3 ? 'mostly the closest patches' : layer <= 8 ? 'neighbors plus similar colors' : 'similar patches anywhere'}</text>`;
      }
      f.qa('.clk').forEach(g => { const act = () => { q = +g.dataset.k; draw(); }; c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
      const sl = c.slider({ label: 'Layer', min: 1, max: 12, step: 1, value: 1, fmt: v => v, onInput: v => { layer = v; draw(); } });
      c.note('Illustration: weights come from distance plus color similarity, with similarity counting more at depth. Real heads learn many different patterns.');
      draw();
      c.play(async () => { for (const v of [1, 4, 8, 12]) { sl.set(v, true); layer = v; draw(); await c.wait(1200); } });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'mae', tag: 'Seeing',
    title: 'Hide three quarters of the image and rebuild it',
    alt: 'A fourteen by fourteen grid of patches over the photo. A slider hides a share of the patches. The encoder only processes the visible ones, so its work shrinks with the mask ratio. A button fills the hidden patches with a rough guess.',
    text: '[[masked autoencoder|Masked autoencoders]] hide **75%** of the patches, far more than BERT’s 15% for text. The encoder processes only the visible 25%. A light decoder adds the masked slots later. Training runs about **3× faster**, and the model must understand the scene to rebuild it.',
    hint: 'Slide the mask ratio. Then press Fill the gaps.',
    mission: 'Hide about 75% of the patches, the MAE setting.',
    takeaway: 'Images are redundant, so hiding most of them forces understanding and saves compute.',
    mount(c) {
      const N = 14, W = 196, X0 = 20, Y0 = 18, pw = W / N;
      const r = kit.rng(11), rank = Array.from({ length: N * N }, () => r());
      const order = rank.map((v, k) => k).sort((a, b) => rank[a] - rank[b]);        /* first entries get hidden first */
      const mean = [];
      for (let k = 0; k < N * N; k++) { const i = k % N, j = Math.floor(k / N); let a = [0, 0, 0]; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const p = IMG[(j * 2 + dy) * 28 + i * 2 + dx]; a[0] += p[0] / 4; a[1] += p[1] / 4; a[2] += p[2] / 4; } mean.push(a); }
      let cells = '';
      for (let k = 0; k < N * N; k++) cells += `<rect id="m${k}" x="${X0 + (k % N) * pw}" y="${Y0 + Math.floor(k / N) * pw}" width="${pw + 0.3}" height="${pw + 0.3}" style="fill:var(--well);opacity:0"/>`;
      const f = c.fig(420, 268, `${kit.pixels(IMG, 28, X0, Y0, W)}${cells}<rect class="none-f ink-s" x="${X0}" y="${Y0}" width="${W}" height="${W}"/>
        <text class="b sm" x="236" y="34">Encoder sees</text><g id="enc"></g>
        <text class="b sm" x="236" y="124">Encoder work</text><g id="work"></g>
        <text id="note" class="xs mute" x="236" y="214"></text>`);
      const st = c.stats([{ k: 'v', label: 'Visible patches', value: '', cls: 'data' }, { k: 'w', label: 'Encoder tokens vs unmasked', value: '', cls: 'cmp' }]);
      let ratio = 15, filled = false;
      function guess(hidden) {
        const g = mean.map(a => a.slice()), known = new Set(); for (let k = 0; k < N * N; k++) if (!hidden.has(k)) known.add(k);
        for (let it = 0; it < 40; it++) for (const k of hidden) {
          const i = k % N, j = Math.floor(k / N); let a = [0, 0, 0], n = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue; const q = y * N + x; if (known.has(q) || it > 0) { a[0] += g[q][0]; a[1] += g[q][1]; a[2] += g[q][2]; n++; } }
          if (n) g[k] = a.map(v => v / n);
        }
        return g;
      }
      function draw() {
        const nh = Math.round(ratio / 100 * N * N), hidden = new Set(order.slice(0, nh)), g = filled ? guess(hidden) : null;
        for (let k = 0; k < N * N; k++) { const e = f.q('#m' + k); if (hidden.has(k)) { e.style.opacity = 1; e.style.fill = filled ? kit.rgb(g[k].map(Math.round)) : 'var(--well)'; } else e.style.opacity = 0; }
        const vis = N * N - nh;
        f.q('#enc').innerHTML = kit.bar(236, 52, 164, 16, vis / (N * N), 'f-data', vis + ' of ' + N * N + ' patches', null);
        f.q('#work').innerHTML = kit.bar(236, 148, 164, 16, vis / (N * N), 'f-cmp', Math.round(vis / (N * N) * 100) + '% of the full cost', null);
        f.q('#note').textContent = ratio === 15 ? 'BERT hides 15% of its text tokens.' : ratio >= 72 && ratio <= 78 ? 'MAE hides 75% of its patches.' : filled ? 'Toy guess: neighbor average.' : '';
        st.set('v', vis + ' of ' + N * N, ratio + '% hidden'); st.set('w', (vis / (N * N) * 100).toFixed(0) + '%', vis > 0 ? '≈ ' + (N * N / vis).toFixed(1) + '× fewer tokens' : 'nothing to encode');
        c.mission.set(ratio >= 72 && ratio <= 78);
      }
      c.slider({ label: 'Share of patches hidden (%)', min: 0, max: 95, step: 1, value: 15, fmt: v => v + '%', onInput: v => { ratio = v; draw(); } });
      c.toggle({ label: 'Fill the gaps with a rough guess', value: false, onChange: v => { filled = v; draw(); } });
      c.note('A real MAE decoder is a small transformer that predicts the missing pixels. The guess here only averages nearby visible patches.');
      draw();
      c.demo(1600, async () => { filled = true; draw(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  const SHAPES = [
    { name: 'a red circle', svg: (x, y) => `<circle cx="${x + 36}" cy="${y + 36}" r="26" style="fill:#e5484d"/>` },
    { name: 'a blue square', svg: (x, y) => `<rect x="${x + 10}" y="${y + 10}" width="52" height="52" rx="4" style="fill:#3b82f6"/>` },
    { name: 'a green triangle', svg: (x, y) => `<polygon points="${x + 36},${y + 8} ${x + 66},${y + 62} ${x + 6},${y + 62}" style="fill:#30a46c"/>` },
    { name: 'a yellow star', svg: (x, y) => { let p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 13 : 30; p.push((x + 36 + r * Math.cos(a)).toFixed(1) + ',' + (y + 38 + r * Math.sin(a)).toFixed(1)); } return `<polygon points="${p.join(' ')}" style="fill:#f5b301"/>`; } }
  ];
  S.push({
    id: 'clip', tag: 'Seeing',
    title: 'CLIP learns by matching pictures to captions',
    alt: 'Four shape pictures above four shuffled captions. Clicking a picture and then a caption links them. When all four are linked, a similarity grid shows bright cells on the diagonal for correct pairs.',
    text: 'CLIP trains an image encoder and a text encoder together on **400 million image and caption pairs**, using a [[contrastive loss]]. Matching pairs should get similar [[embedding|embeddings]]. Wrong pairs should get low similarity. After training, a photo of a dog and the words “a photo of a dog” get nearly the same embedding.',
    hint: 'Click a picture, then its caption. Link all four.',
    mission: 'Pair all four pictures with their right captions.',
    takeaway: 'Contrastive training needs no labels, only pairs that belong together.',
    mount(c) {
      const CAP = [3, 0, 2, 1];                          /* caption slot j shows SHAPES[CAP[j]].name */
      const f = c.fig(420, 308, `<g id="pics"></g><g id="caps"></g><g id="links"></g><g id="mat"></g><text id="msg" class="b sm" x="20" y="292"></text>`);
      let pair = [-1, -1, -1, -1], selP = -1;
      const cx = j => 20 + j * 100 + 46, px = i => 24 + i * 100 + 36;
      function draw() {
        f.q('#pics').innerHTML = SHAPES.map((s, i) => `<g class="clk" data-i="${i}" role="button" tabindex="0" aria-label="Picture ${i + 1}"><rect class="${selP === i ? 't-ctl' : 'box'}" x="${24 + i * 100}" y="20" width="72" height="72" rx="10" style="${selP === i ? 'stroke-width:3' : ''}"/>${s.svg(24 + i * 100, 20)}</g>`).join('');
        f.q('#caps').innerHTML = CAP.map((k, j) => `<g class="clk" data-j="${j}" role="button" tabindex="0" aria-label="${SHAPES[k].name}"><rect class="box" x="${20 + j * 100}" y="176" width="92" height="34" rx="8"/><text class="xs b" x="${cx(j)}" y="${198}" text-anchor="middle">${SHAPES[k].name}</text></g>`).join('');
        f.q('#links').innerHTML = pair.map((j, i) => j < 0 ? '' : `<path class="ln s2" d="M${px(i)} 92 L${cx(j)} 176" style="stroke:${CAP[j] === i ? 'var(--ok)' : 'var(--bad)'};stroke-width:2.5"/>`).join('');
        const all = pair.every(j => j >= 0), good = pair.filter((j, i) => j >= 0 && CAP[j] === i).length;
        let m = '';
        if (all) {
          m += '<text class="b sm" x="20" y="232">Similarity of every picture with every caption</text>';
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const hit = pair[i] === j; m += `<rect class="${hit ? (CAP[j] === i ? 'f-ok' : 'f-bad') : 'well'}" x="${20 + j * 22}" y="${240 + i * 12}" width="20" height="10" rx="2" style="${hit ? '' : 'opacity:.9'}"/>`; }
          m += `<text class="xs mute" x="116" y="256">${good === 4 ? 'Bright diagonal: every right pair is close.' : 'Training would pull the red links together and the rest apart.'}</text>`;
        }
        f.q('#mat').innerHTML = m;
        f.q('#msg').textContent = good === 4 ? 'All four pairs match. That is one tiny training batch.' : all ? good + ' of 4 right. Click a picture to relink it.' : '';
        f.qa('.clk').forEach(g => {
          const act = () => { if (g.dataset.i != null) { const i = +g.dataset.i; if (pair[i] >= 0) { pair[i] = -1; selP = -1; } else selP = selP === i ? -1 : i; } else if (selP >= 0) { const j = +g.dataset.j; pair = pair.map(v => v === j ? -1 : v); pair[selP] = j; selP = -1; } draw(); };
          c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        });
        c.mission.set(good === 4);
      }
      c.btn('Start over', () => { pair = [-1, -1, -1, -1]; selP = -1; draw(); }, { small: true });
      c.note('Real CLIP compares 32,768 pairs in one batch. Every right pair has to beat every wrong pair.');
      draw();
      c.demo(1500, async () => { for (let i = 0; i < 4; i++) { pair[i] = CAP.indexOf(i); draw(); await c.wait(500); } });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'zeroshot', tag: 'Seeing',
    title: 'Words and pictures share one space',
    alt: 'A map where pictures and text prompts sit in the same two-dimensional space. Choosing a color and a shape for a prompt marks the closest pictures and ranks them by similarity.',
    text: 'Because both encoders write into one **shared embedding space**, you can describe any concept in words and find matching images. That is [[zero-shot]] classification: no label for the class was ever used in training.',
    hint: 'Pick a color and a shape and see which pictures answer.',
    takeaway: 'A text prompt becomes a point on the map. The nearest pictures are the answer.',
    mount(c) {
      const COLS = ['red', 'blue', 'green', 'yellow'], FILL = ['#e5484d', '#3b82f6', '#30a46c', '#f5b301'], SH = ['circle', 'square', 'triangle', 'star'];
      const X0 = 52, Y0 = 26, CW = 80, CH = 52;
      const r = kit.rng(21), dots = [];
      for (let ci = 0; ci < 4; ci++) for (let si = 0; si < 4; si++) for (let k = 0; k < 5; k++) dots.push({ ci, si, x: X0 + si * CW + CW / 2 + (r() - 0.5) * 46, y: Y0 + ci * CH + CH / 2 + (r() - 0.5) * 30 });
      let grid = '';
      SH.forEach((s, si) => { grid += `<text class="xs b" x="${X0 + si * CW + CW / 2}" y="${Y0 + 4 * CH + 18}" text-anchor="middle">${s}</text>`; });
      COLS.forEach((cn, ci) => { grid += `<text class="xs b" x="${X0 - 8}" y="${Y0 + ci * CH + CH / 2 + 4}" text-anchor="end">${cn}</text>`; });
      const f = c.fig(420, 304, `<rect class="well" x="${X0}" y="${Y0}" width="${CW * 4}" height="${CH * 4}" rx="8"/>${grid}<g id="dots"></g><g id="q"></g><g id="rank"></g>`);
      const st = c.stats([{ k: 't', label: 'Best match', value: '', cls: 'ok' }, { k: 's', label: 'Closest five pictures', value: '', cls: 'data' }]);
      let col = 0, sh = 0;
      function draw() {
        const qx = X0 + sh * CW + CW / 2, qy = Y0 + col * CH + CH / 2;
        const scored = dots.map(d => ({ d, s: 1 / (1 + (Math.hypot(d.x - qx, d.y - qy) / 28) ** 2) })).sort((a, b) => b.s - a.s);
        const top = new Set(scored.slice(0, 5).map(o => o.d));
        f.q('#dots').innerHTML = dots.map(d => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${top.has(d) ? 7 : 4.5}" style="fill:${FILL[d.ci]};opacity:${top.has(d) ? 1 : 0.55};stroke:${top.has(d) ? 'var(--ink)' : 'none'};stroke-width:1.5"/>`).join('');
        f.q('#q').innerHTML = `<rect x="${qx - 8}" y="${qy - 8}" width="16" height="16" transform="rotate(45 ${qx} ${qy})" class="f-ctl" style="stroke:var(--stage);stroke-width:2"/><text class="xs b" x="${qx}" y="${qy - 16}" text-anchor="middle" style="fill:var(--ctl)">text</text>`;
        const best = scored[0].d;
        st.set('t', SH[best.si] + ', ' + COLS[best.ci], 'prompt: “a photo of a ' + COLS[col] + ' ' + SH[sh] + '”');
        st.set('s', scored.slice(0, 5).filter(o => o.d.ci === col && o.d.si === sh).length + ' of 5 are ' + COLS[col] + ' ' + SH[sh] + 's', 'similarity ' + scored[0].s.toFixed(2) + ' down to ' + scored[4].s.toFixed(2));
        f.q('#rank').innerHTML = `<text class="xs mute" x="${X0}" y="${Y0 + 4 * CH + 40}">Diamond: your prompt. Big dots: nearest pictures.</text>`;
      }
      c.seg({ label: 'Color in the prompt', options: COLS.map((n, i) => [i, n]), value: 0, onChange: v => { col = v; draw(); } });
      c.seg({ label: 'Shape in the prompt', options: SH.map((n, i) => [i, n]), value: 0, onChange: v => { sh = v; draw(); } });
      c.note('A toy two-dimensional map. Real embedding spaces have hundreds of dimensions, but nearest-neighbor search works the same way.');
      draw();
      c.demo(1500, async () => { col = 2; sh = 3; draw(); });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'vtokens', tag: 'Seeing',
    title: 'Pictures become tokens a language model can read',
    alt: 'A pipeline: image, vision encoder, projector, visual tokens placed before the text tokens, then a language model that only writes text. Below, a bar shows how many tokens the picture uses against a 4,096-token context window for three strategies.',
    text: 'A multimodal model uses the vision encoder as a **visual tokenizer**. Its patch embeddings become tokens placed before the text, and the language model only ever writes text. Resolution is the catch: double the image side and the tokens **quadruple**. Tiling and compression keep the budget in check.',
    hint: 'Raise the resolution, then try each strategy.',
    mission: 'Fit a 1,024 × 1,024 photo into under 1,000 tokens.',
    takeaway: 'Image tokens go before the text and use up context. Quality costs context, so systems tile or compress.',
    mount(c) {
      const f = c.fig(420, 278, `
        ${['Image', 'Vision encoder', 'Projector', 'Language model'].map((t, i) => `<rect class="${['t-data', 't-mem', 't-ctl', 't-cmp'][i]}" x="${6 + i * 104}" y="22" width="96" height="38" rx="9"/><text class="xs b" x="${54 + i * 104}" y="45" text-anchor="middle">${t}</text>${i < 3 ? `<path class="ln s2" d="M${102 + i * 104} 41 H${110 + i * 104}" marker-end="url(#ah-ink)"/>` : ''}`).join('')}
        <text class="xs mute" x="12" y="78">patch embeddings become visual tokens, placed in front of the text tokens</text>
        <g id="bars"></g>`);
      const st = c.stats([{ k: 't', label: 'Visual tokens', value: '', cls: 'cmp' }, { k: 'w', label: 'Share of a 4,096-token window', value: '', cls: 'mem' }, { k: 'p', label: 'Attention pairs among them', value: '', cls: 'bad' }]);
      let res = 224, mode = 'plain';
      const tokens = () => mode === 'plain' ? (res / 16) ** 2 : mode === 'tile' ? 85 + 170 * Math.ceil(res / 512) ** 2 : (res / 16) ** 2 / 16;
      function draw() {
        const t = Math.round(tokens()), share = t / 4096;
        f.q('#bars').innerHTML =
          '<text class="b sm" x="12" y="108">Tokens used by the picture</text>' +
          `<rect class="well" x="12" y="118" width="396" height="22" rx="7"/><rect class="${t > 4096 ? 'f-bad' : t < 1000 ? 'f-ok' : 'f-cmp'}" x="12" y="118" width="${Math.max(2, 396 * Math.min(1, t / 8192)).toFixed(1)}" height="22" rx="7"/>` +
          `<line class="ln" x1="${12 + 396 * 4096 / 8192}" x2="${12 + 396 * 4096 / 8192}" y1="112" y2="148" style="stroke:var(--ink);stroke-width:2"/><text class="xs b" x="${12 + 396 * 0.5 - 4}" y="162" text-anchor="end">4,096 window</text>` +
          `<line class="ln" x1="${12 + 396 * 1000 / 8192}" x2="${12 + 396 * 1000 / 8192}" y1="112" y2="148" style="stroke:var(--ok);stroke-width:2"/><text class="xs b" x="${12 + 396 * 1000 / 8192 + 4}" y="162" style="fill:var(--ok)">1,000</text>` +
          `<text class="xs m b" x="408" y="106" text-anchor="end">${fmt.n(t)} tokens</text>` +
          `<text class="xs mute" x="12" y="196">${mode === 'plain' ? 'Plain: one token per 16 × 16 patch.' : mode === 'tile' ? 'Tiling: a low-resolution thumbnail plus 512 × 512 crops, 170 tokens each.' : 'Compression: a learned projector squeezes the visual tokens 16 times.'}</text>` +
          `<text class="xs mute" x="12" y="214">${res >= 1024 ? 'Resolution ' + res + ' × ' + res + ' keeps fine print readable.' : 'Resolution ' + res + ' × ' + res + ': small text may blur.'}</text>`;
        st.set('t', fmt.n(t), (res / 16) + ' × ' + (res / 16) + ' patches before any saving');
        st.set('w', (share * 100).toFixed(share < 0.1 ? 1 : 0) + '%', t > 4096 ? 'does not fit' : 'fits');
        st.set('p', fmt.n(t * t)); st.cls('w', t > 4096 ? 'bad' : 'mem');
        c.mission.set(res >= 1024 && t < 1000);
      }
      c.slider({ label: 'Image width and height (pixels)', values: [224, 336, 672, 1024], value: 224, fmt: v => v, onInput: v => { res = v; draw(); } });
      c.seg({ label: 'Strategy', options: [['plain', 'Plain'], ['tile', 'Tile + thumbnail'], ['comp', 'Compress 16×']], value: 'plain', onChange: v => { mode = v; draw(); } });
      c.note('Tile counts follow OpenAI’s published image pricing (85 + 170 per tile). Compression ratios vary by model.');
      draw();
      c.demo(1800, async () => { res = 1024; mode = 'plain'; draw(); await c.wait(1200); mode = 'tile'; draw(); });
    }
  });

  /* diffusion helpers ------------------------------------------------ */
  const BETA = [0], AB = [1];
  for (let t = 1; t <= 1000; t++) { const b = 1e-4 + (0.02 - 1e-4) * (t - 1) / 999; BETA[t] = b; AB[t] = AB[t - 1] * (1 - b); }
  const X0IMG = IMG.map(p => p.map(v => v / 127.5 - 1));            /* picture scaled to -1 .. 1 */
  const noiseField = seed => { const r = kit.rng(seed); return IMG.map(() => [kit.gauss(r), kit.gauss(r), kit.gauss(r)]); };
  const toRgb = v => 'rgb(' + v.map(x => Math.round(kit.clamp((x + 1) * 127.5, 0, 255))).join(',') + ')';

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'noise', tag: 'Drawing',
    title: 'Diffusion adds noise in a thousand small steps',
    alt: 'The photo at the left dissolves into static as a slider moves from step 0 to step 1,000. Two bars show how much signal and how much noise remain.',
    text: 'A [[diffusion model]] generates images by **reversing added noise**. Take a clean image and add a little Gaussian noise, a thousand tiny times, until only static is left. Then train a network to undo one step at a time.',
    hint: 'Drag the step slider, or press Play.',
    takeaway: 'Each forward step adds only a little noise, so each reverse step is a small, learnable denoising job.',
    mount(c) {
      const EPS = noiseField(5), SZ = 168, X0 = 20, Y0 = 36;
      const f = c.fig(420, 250, `<g id="im">${kit.pixels(IMG, 28, X0, Y0, SZ, { id: 'n' })}</g><rect class="none-f ink-s" x="${X0}" y="${Y0}" width="${SZ}" height="${SZ}" rx="3"/>
        <text class="b sm" x="${X0}" y="26">The picture at step <tspan id="tt" class="m">0</tspan> of 1,000</text><g id="right"></g>`);
      const st = c.stats([{ k: 'a', label: 'Signal left, √ᾱ', value: '', cls: 'data' }, { k: 'n', label: 'Noise added, √(1 − ᾱ)', value: '', cls: 'cmp' }]);
      let t = 0; const px = [];
      for (let k = 0; k < 784; k++) px.push(f.q('#n' + k));
      function draw() {
        const a = Math.sqrt(AB[t]), s = Math.sqrt(1 - AB[t]);
        for (let k = 0; k < 784; k++) px[k].style.fill = toRgb([0, 1, 2].map(i => a * X0IMG[k][i] + s * EPS[k][i]));
        f.q('#tt').textContent = t;
        f.q('#right').innerHTML = kit.bar(214, 70, 186, 16, a, 'f-data', 'Signal kept', a.toFixed(2)) + kit.bar(214, 122, 186, 16, s, 'f-cmp', 'Noise mixed in', s.toFixed(2)) +
          `<text class="xs mute" x="214" y="172">${t === 0 ? 'A clean photograph.' : t < 120 ? 'Slightly grainy. A tiny nudge.' : t < 450 ? 'Structure fades.' : t < 900 ? 'Mostly static.' : 'Pure static. No picture is hidden here.'}</text>`;
        st.set('a', a.toFixed(3)); st.set('n', s.toFixed(3));
      }
      const sl = c.slider({ label: 'Step t', min: 0, max: 1000, step: 10, value: 0, fmt: v => v, onInput: v => { t = v; draw(); } });
      c.btn('Play forward', async () => { for (let v = 0; v <= 1000; v += 20) { sl.set(v); await c.wait(40); } }, { small: true });
      draw();
      c.play(async () => { await c.wait(500); await c.tween(3400, p => { t = Math.round(p * 100) * 10; sl.set(t, true); draw(); }, c.ease.io); });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'schedule', tag: 'Drawing',
    title: 'One equation jumps to any step',
    alt: 'A chart with step on the horizontal axis. The signal weight falls from 1 to almost 0 while the noise weight rises from 0 to 1. The two curves cross near step 259.',
    text: 'The [[noise schedule]] adds a little more each step: variance **β** grows from 0.0001 to 0.02. Because Gaussians add up to Gaussians, the whole chain collapses into one formula: **xₜ = √ᾱ · x₀ + √(1 − ᾱ) · ε**. Two weights mix the clean image and fresh noise.',
    hint: 'Drag the marker along the curves.',
    mission: 'Find the step where signal and noise are mixed equally.',
    takeaway: 'Training can pick any step directly. There is no need to run the chain from step 1.',
    mount(c) {
      const ch = kit.chart({ x: 44, y: 22, w: 356, h: 150, xmin: 0, xmax: 1000, ymin: 0, ymax: 1, xt: [0, 250, 500, 750, 1000], yt: [0, 0.5, 1], yf: v => v.toFixed(1), xlabel: 'step t' });
      let sig = [], noi = [];
      for (let t = 0; t <= 1000; t += 10) { sig.push([ch.X(t), ch.Y(Math.sqrt(AB[t]))]); noi.push([ch.X(t), ch.Y(Math.sqrt(1 - AB[t]))]); }
      const f = c.fig(420, 252, `${ch.svg}<path class="s-data s3" d="${kit.path(sig)}" fill="none"/><path class="s-cmp s3" d="${kit.path(noi)}" fill="none"/>
        <line id="mk" class="ln" x1="0" x2="0" y1="${ch.y0}" y2="${ch.y1}" style="stroke:var(--ink);stroke-width:1.5;stroke-dasharray:4 3"/><circle id="d1" r="5.5" class="f-data" style="stroke:var(--stage);stroke-width:2"/><circle id="d2" r="5.5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/>
        <text id="eq" class="b sm" x="210" y="${ch.y1 + 48}" text-anchor="middle"></text>`);
      const st = c.stats([{ k: 'b', label: 'β at this step', value: '', cls: 'mem' }, { k: 'a', label: 'ᾱ, signal power left', value: '', cls: 'data' }, { k: 'r', label: 'Noise ÷ signal', value: '', cls: 'cmp' }]);
      c.legend([['data', 'Signal weight √ᾱ'], ['cmp', 'Noise weight √(1 − ᾱ)']]);
      let t = 900;
      function draw() {
        const a = Math.sqrt(AB[t]), s = Math.sqrt(1 - AB[t]), x = ch.X(t);
        f.q('#mk').setAttribute('x1', x); f.q('#mk').setAttribute('x2', x);
        f.q('#d1').setAttribute('cx', x); f.q('#d1').setAttribute('cy', ch.Y(a)); f.q('#d2').setAttribute('cx', x); f.q('#d2').setAttribute('cy', ch.Y(s));
        f.q('#eq').textContent = Math.abs(a - s) < 0.05 ? 'Equal parts picture and noise' : a > s ? 'More picture than noise' : 'More noise than picture';
        st.set('b', BETA[Math.max(1, t)].toFixed(4)); st.set('a', t === 0 ? '1' : AB[t] >= 0.01 ? AB[t].toFixed(3) : kit.sci(AB[t], 1)); st.set('r', (s / a).toFixed(2), 'at t = ' + t);
        c.mission.set(Math.abs(t - 259) <= 14);
      }
      c.slider({ label: 'Step t', min: 0, max: 1000, step: 1, value: 900, fmt: v => v, onInput: v => { t = v; draw(); } });
      draw();
      c.demo(1500, async () => { t = 259; draw(); });
    }
  });

  /* 13 --------------------------------------------------------------- */
  S.push({
    id: 'predict', tag: 'Drawing',
    title: 'The network’s job: guess the noise',
    alt: 'Three pictures in a row: a noisy photo, the network’s guess of the noise, and the cleaned photo made by subtracting that guess. Sliders set the noise level and the guess quality, and a counter shows the remaining error.',
    text: 'Given a noisy image and the step number, the network predicts the **noise** that was added. Subtract the scaled prediction and you get an estimate of the clean image. The training loss is plain **mean squared error** between true noise and predicted noise.',
    hint: 'Raise the prediction quality until the cleaned picture matches the original.',
    mission: 'At step 400 or later, clean the picture to within 10% error.',
    takeaway: 'A perfect noise guess recovers the image. At high noise a small guess error becomes a big image error.',
    mount(c) {
      const EPS = noiseField(5), ETA = noiseField(99), SZ = 118, Y0 = 44, XS = [12, 151, 290];
      const f = c.fig(420, 252, `${XS.map((x, i) => kit.pixels(IMG, 28, x, Y0, SZ, { id: 'abc'[i] })).join('')}${XS.map(x => `<rect class="none-f ink-s" x="${x}" y="${Y0}" width="${SZ}" height="${SZ}" rx="3"/>`).join('')}
        <text class="b sm" x="${XS[0]}" y="34">Noisy image xₜ</text><text class="b sm" x="${XS[1]}" y="34">Guessed noise</text><text class="b sm" x="${XS[2]}" y="34">Cleaned estimate</text>
        <path class="ln s2" d="M132 ${Y0 + SZ / 2} H149" marker-end="url(#ah-ink)"/><path class="ln s2" d="M271 ${Y0 + SZ / 2} H288" marker-end="url(#ah-ink)"/>
        <text class="xs mute" x="${XS[0]}" y="${Y0 + SZ + 18}">network input</text><text class="xs mute" x="${XS[1]}" y="${Y0 + SZ + 18}">network output</text><text class="xs mute" x="${XS[2]}" y="${Y0 + SZ + 18}">(xₜ − s · guess) ÷ a</text>
        <text id="verdict" class="b sm" x="210" y="224" text-anchor="middle"></text>`);
      const st = c.stats([{ k: 'e', label: 'Error of the cleaned picture', value: '', cls: 'bad' }, { k: 'g', label: 'Amplification of guess error', value: '', cls: 'mem' }]);
      const A = [[], [], []];
      for (let i = 0; i < 3; i++) for (let k = 0; k < 784; k++) A[i].push(f.q('#' + 'abc'[i] + k));
      let t = 500, q = 40;
      function draw() {
        const a = Math.sqrt(AB[t]), s = Math.sqrt(1 - AB[t]), qq = q / 100; let se = 0;
        for (let k = 0; k < 784; k++) {
          const xt = [], eh = [], x0h = [];
          for (let i = 0; i < 3; i++) { xt[i] = a * X0IMG[k][i] + s * EPS[k][i]; eh[i] = qq * EPS[k][i] + (1 - qq) * ETA[k][i]; x0h[i] = (xt[i] - s * eh[i]) / a; const d = x0h[i] - X0IMG[k][i]; se += d * d; }
          A[0][k].style.fill = toRgb(xt); A[1][k].style.fill = toRgb(eh.map(v => v * 0.5)); A[2][k].style.fill = toRgb(x0h);
        }
        const rms = Math.sqrt(se / (784 * 3)), err = rms / 2 * 100;
        st.set('e', err > 100 ? 'over 100%' : err.toFixed(1) + '%', 'average error, whole brightness range = 100%'); st.set('g', '× ' + (s / a).toFixed(1), 'a small guess error is multiplied by s ÷ a');
        f.q('#verdict').textContent = err < 10 ? 'Close to the original.' : err < 35 ? 'Recognizable, but grainy.' : 'Still mostly noise.';
        c.mission.set(t >= 400 && err < 10);
      }
      c.slider({ label: 'Noise level, step t', min: 50, max: 950, step: 10, value: 500, fmt: v => v, onInput: v => { t = v; draw(); } });
      c.slider({ label: 'Quality of the noise guess', min: 0, max: 100, step: 1, value: 40, fmt: v => v + '%', onInput: v => { q = v; draw(); } });
      draw();
      c.demo(1600, async () => { q = 97; draw(); });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'weights', tag: 'Drawing',
    title: 'Why plain averaging beat the “correct” weights',
    alt: 'A log-log chart of the share of total loss weight given to each step. The exact weights start near 5% at step 1, fall to about 0.05% near step 350 and rise again slightly. Plain averaging is a flat line at 0.1%. Two bars compare image quality: FID 13.51 for the exact weights and 3.17 for plain averaging.',
    text: 'The exact variational bound weights every step differently, and it favors the nearly clean steps. Ho et al. dropped those weights and used **plain mean squared error** at every step. Quality on CIFAR-10, measured by [[fid|FID]], improved from **13.51 to 3.17**.',
    hint: 'Slide through the steps and compare the two weights.',
    takeaway: 'Lower FID is better. Easy, almost clean steps took too much of the training signal, so equal weights won.',
    mount(c) {
      const W = []; let tot = 0;
      for (let t = 1; t <= 1000; t++) { W[t] = BETA[t] / (2 * (1 - BETA[t]) * (1 - AB[t])); tot += W[t]; }
      const sh = t => W[t] / tot, EQ = 1 / 1000;
      let s100 = 0; for (let t = 1; t <= 100; t++) s100 += sh(t);
      const ch = kit.chart({ x: 50, y: 20, w: 350, h: 112, xmin: 1, xmax: 1000, ymin: 0.0001, ymax: 0.1, xlog: true, ylog: true, xt: [1, 10, 100, 1000], yt: [0.0001, 0.001, 0.01, 0.1], yf: v => +(v * 100).toPrecision(2) + '%', xf: v => v, xlabel: 'step t (log scale)' });
      const pts = []; for (let t = 1; t <= 1000; t += 3) pts.push([ch.X(t), ch.Y(sh(t))]); pts.push([ch.X(1000), ch.Y(sh(1000))]);
      const f = c.fig(420, 276, `${ch.svg}<path class="s-cmp s3" d="${kit.path(pts)}" fill="none"/><line class="ln" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(EQ)}" y2="${ch.Y(EQ)}" style="stroke:var(--data);stroke-width:3"/>
        <line id="mk" class="ln" x1="0" x2="0" y1="${ch.y0}" y2="${ch.y1}" style="stroke:var(--ink);stroke-width:1.5;stroke-dasharray:4 3"/><circle id="d1" r="5.5" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/><circle id="d2" r="5.5" class="f-data" style="stroke:var(--stage);stroke-width:2"/>
        ${kit.bar(20, 186, 380, 14, 13.51 / 15, 'f-bad', 'Exact weights: FID 13.51', null)}${kit.bar(20, 224, 380, 14, 3.17 / 15, 'f-ok', 'Plain averaging: FID 3.17', null)}
        <text class="xs mute" x="20" y="266">CIFAR-10 image quality, Ho et al. (2020). Lower is better.</text>`);
      c.legend([['cmp', 'Exact weights'], ['data', 'Plain averaging, 0.1% per step']]);
      const st = c.stats([{ k: 'e', label: 'Exact weight at this step', value: '', cls: 'cmp' }, { k: 'r', label: 'Exact weight on steps 1 to 100', value: (s100 * 100).toFixed(0) + '%', sub: (s100 / 0.1).toFixed(1) + '× a fair 10% share', cls: 'mem' }]);
      let t = 2;
      function draw() {
        const x = ch.X(t), v = sh(t);
        f.q('#mk').setAttribute('x1', x); f.q('#mk').setAttribute('x2', x);
        f.q('#d1').setAttribute('cx', x); f.q('#d1').setAttribute('cy', ch.Y(v));
        f.q('#d2').setAttribute('cx', x); f.q('#d2').setAttribute('cy', ch.Y(EQ));
        st.set('e', (v * 100).toFixed(v < 0.01 ? 3 : 2) + '%', (v / EQ).toFixed(1) + '× the plain share');
      }
      const sl = c.slider({ label: 'Step t', min: 1, max: 1000, log: true, round: true, value: 2, fmt: v => Math.round(v), onInput: v => { t = Math.max(1, Math.min(1000, Math.round(v))); draw(); } });
      c.note('Weights come from the DDPM schedule with the reverse variance fixed to β. Each share is one step’s weight divided by the sum over all 1,000 steps.');
      draw();
      c.play(async () => { await c.wait(500); await c.tween(2400, p => { t = Math.max(1, Math.min(1000, Math.round(Math.pow(1000, 0.1 + p * 0.9)))); sl.set(t, true); draw(); }, c.ease.io); await c.wait(300); await c.tween(1200, p => { t = Math.max(1, Math.min(1000, Math.round(Math.pow(1000, 1 - p * 0.9)))); sl.set(t, true); draw(); }, c.ease.io); });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'unet', tag: 'Drawing',
    title: 'One network handles every noise level',
    alt: 'A U-shaped network diagram. The encoder shrinks the picture from 64 by 64 to 16 by 16, a bottleneck with self-attention sits at the bottom, the decoder grows it back, and skip connections copy detail across at each size. A time-step embedding feeds every block.',
    text: 'A [[u-net|U-Net]] does the denoising. The encoder shrinks the image through residual blocks to 16 × 16, the decoder grows it back, and **skip connections** copy detail across at every size. The step number is encoded as a sinusoidal vector and added inside every block, so one network adapts to every noise level.',
    hint: 'Click a block to read what it does. Slide t to change the time embedding.',
    takeaway: 'Same weights, different behavior: the time embedding tells every layer how noisy its input is.',
    mount(c) {
      const BL = {
        e0: ['Encoder, 64 × 64', 'Convolutions with residual blocks read the noisy image at full detail.'],
        e1: ['Encoder, 32 × 32', 'Downsampling halves the size. Each block sees a wider part of the picture.'],
        e2: ['Encoder, 16 × 16', 'The coarsest level. A block here sees the whole picture’s layout.'],
        mid: ['Bottleneck with attention', 'Self-attention connects distant positions that convolutions miss.'],
        d2: ['Decoder, 16 × 16', 'Upsampling starts. It also receives the skip connection from the encoder.'],
        d1: ['Decoder, 32 × 32', 'Detail from the encoder arrives through the skip connection.'],
        d0: ['Decoder, 64 × 64', 'The last blocks write the predicted noise at full resolution.']
      };
      const box = (id, x, y, w, lab, cls) => `<g class="clk" data-b="${id}" role="button" tabindex="0" aria-label="${BL[id][0]}"><rect class="${cls}" x="${x}" y="${y}" width="${w}" height="36" rx="8"/><text class="xs b" x="${x + w / 2}" y="${y + 22}" text-anchor="middle">${lab}</text><circle cx="${x + 10}" cy="${y + 4}" r="7" class="f-ctl"/><text class="xs b" x="${x + 10}" y="${y + 8}" text-anchor="middle" style="fill:var(--on-accent);font-size:9px">t</text></g>`;
      const f = c.fig(420, 316, `
        <text class="b sm" x="20" y="18">noisy image</text><text class="b sm" x="400" y="18" text-anchor="end">noise guess</text>
        ${box('e0', 20, 30, 110, '64 × 64', 't-mem')}${box('e1', 20, 96, 110, '32 × 32', 't-mem')}${box('e2', 20, 162, 110, '16 × 16', 't-mem')}
        ${box('mid', 140, 228, 140, '16 × 16 + attention', 't-cmp')}
        ${box('d2', 290, 162, 110, '16 × 16', 't-data')}${box('d1', 290, 96, 110, '32 × 32', 't-data')}${box('d0', 290, 30, 110, '64 × 64', 't-data')}
        <path class="ln s2" d="M75 66 V94" marker-end="url(#ah-ink)"/><path class="ln s2" d="M75 132 V160" marker-end="url(#ah-ink)"/><path class="ln s2" d="M75 198 V214 H140 V246" marker-end="url(#ah-ink)"/>
        <path class="ln s2" d="M280 246 H345 V198" marker-end="url(#ah-ink)"/><path class="ln s2" d="M345 162 V134" marker-end="url(#ah-ink)"/><path class="ln s2" d="M345 96 V68" marker-end="url(#ah-ink)"/>
        <path class="ln s2" d="M130 48 H290" stroke-dasharray="5 4"/><path class="ln s2" d="M130 114 H290" stroke-dasharray="5 4"/><path class="ln s2" d="M130 180 H290" stroke-dasharray="5 4"/>
        <text class="xs mute" x="210" y="44" text-anchor="middle">skip connection</text>
        <g id="temb"></g>`);
      const st = c.stats([{ k: 't', label: 'Step number', value: '', cls: 'ctl' }, { k: 'd', label: 'Embedding length', value: '16 numbers here', sub: '128 to 512 in real models', cls: 'mem' }]);
      let t = 500;
      function draw() {
        let o = `<text class="xs b" x="210" y="${68}" text-anchor="middle" style="fill:var(--ctl)">time embedding for t = ${t}</text>`;
        for (let i = 0; i < 16; i++) { const fr = Math.pow(10000, -Math.floor(i / 2) / 8), v = i % 2 ? Math.cos(t * fr) : Math.sin(t * fr); o += `<rect x="${150 + i * 7.5}" y="${112 - Math.abs(v) * 28}" width="6" height="${Math.max(1, Math.abs(v) * 28)}" class="f-ctl" style="opacity:${v < 0 ? 0.4 : 1}"/>`; }
        f.q('#temb').innerHTML = o + `<line class="axis" x1="148" x2="272" y1="112" y2="112"/>`;
        st.set('t', t);
      }
      f.qa('.clk').forEach(g => { const act = () => { const b = BL[g.dataset.b]; c.say('**' + b[0] + '.** ' + b[1]); f.qa('.clk rect:first-child').forEach(r => r.style.strokeWidth = ''); g.querySelector('rect').style.strokeWidth = '3.5'; }; c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
      const sl = c.slider({ label: 'Step t', min: 1, max: 1000, step: 1, value: 500, fmt: v => v, onInput: v => { t = v; draw(); } });
      c.note('The small t badge on each block marks where the time embedding is added, between its two convolutions.');
      draw();
      c.play(async () => { await c.wait(500); for (const v of [50, 250, 900]) { t = v; sl.set(v, true); draw(); await c.wait(900); } });
    }
  });

  /* the movie played backward: blurred guesses ------------------------ */
  const blurCache = {};
  function blurred(r) {
    const key = Math.round(r * 4); if (blurCache[key]) return blurCache[key];
    const R = key / 4; if (R < 0.2) return (blurCache[key] = IMG);
    const rad = Math.ceil(R * 2.2), w = []; let ws = 0;
    for (let i = -rad; i <= rad; i++) { const g = Math.exp(-(i * i) / (2 * R * R)); w.push(g); ws += g; }
    const tmp = IMG.map(() => [0, 0, 0]), out = [];
    for (let j = 0; j < 28; j++) for (let i = 0; i < 28; i++) { const a = [0, 0, 0]; for (let d = -rad; d <= rad; d++) { const p = IMG[j * 28 + kit.clamp(i + d, 0, 27)], g = w[d + rad]; a[0] += p[0] * g; a[1] += p[1] * g; a[2] += p[2] * g; } tmp[j * 28 + i] = a.map(v => v / ws); }
    for (let j = 0; j < 28; j++) for (let i = 0; i < 28; i++) { const a = [0, 0, 0]; for (let d = -rad; d <= rad; d++) { const p = tmp[kit.clamp(j + d, 0, 27) * 28 + i], g = w[d + rad]; a[0] += p[0] * g; a[1] += p[1] * g; a[2] += p[2] * g; } out.push(a.map(v => v / ws)); }
    return (blurCache[key] = out);
  }

  /* 16 --------------------------------------------------------------- */
  S.push({
    id: 'reverse', tag: 'Drawing',
    title: 'Generating reverses the noise, coarse to fine',
    alt: 'Two pictures side by side. The left one is the noisy image at the chosen step. The right one is the network’s guess of the clean picture. Sliding from step 1,000 down to 0 turns static into a photo, and the guess goes from one flat color to sharp detail.',
    text: 'To make a picture, start from **pure static** and undo the noise steps in reverse order. At every step the network **guesses the clean picture**, and the sampler moves a small step toward that guess. Early guesses are blurry, because at high noise many pictures would fit. Later guesses commit to detail.',
    hint: 'Drag the step from 1,000 down to 0 and watch the guess sharpen.',
    takeaway: 'Coarse layout is decided first, fine detail last. Nothing is drawn in one shot.',
    mount(c) {
      const EPS = noiseField(5), SZ = 168, XS = [20, 232], Y0 = 40;
      const f = c.fig(420, 262, `${kit.pixels(IMG, 28, XS[0], Y0, SZ, { id: 'p' })}${kit.pixels(IMG, 28, XS[1], Y0, SZ, { id: 'q' })}
        <rect class="none-f ink-s" x="${XS[0]}" y="${Y0}" width="${SZ}" height="${SZ}" rx="3"/><rect class="none-f ink-s" x="${XS[1]}" y="${Y0}" width="${SZ}" height="${SZ}" rx="3"/>
        <text class="b sm" x="${XS[0]}" y="30">Noisy picture at step <tspan id="tt" class="m">1000</tspan></text><text class="b sm" x="${XS[1]}" y="30">Guess of the clean image</text>
        <text id="msg" class="b sm" x="210" y="${Y0 + SZ + 26}" text-anchor="middle"></text>
        <text class="xs mute" x="210" y="${Y0 + SZ + 46}" text-anchor="middle">Toy: this network already knows the photo. A real one invents a new picture.</text>`);
      const st = c.stats([{ k: 'r', label: 'Noise ÷ signal', value: '', cls: 'cmp' }, { k: 'b', label: 'Blur of the guess', value: '', cls: 'mem' }]);
      const A = [], B = []; for (let k = 0; k < 784; k++) { A.push(f.q('#p' + k)); B.push(f.q('#q' + k)); }
      let t = 1000;
      function draw() {
        const a = Math.sqrt(AB[Math.max(1, t)]), s = t === 0 ? 0 : Math.sqrt(1 - AB[t]), nu = a > 0 ? s / a : 0, rad = t === 0 ? 0 : Math.min(14, 1.2 * nu), G = blurred(rad);
        const aa = t === 0 ? 1 : a;
        for (let k = 0; k < 784; k++) { A[k].style.fill = toRgb([0, 1, 2].map(i => aa * X0IMG[k][i] + s * EPS[k][i])); B[k].style.fill = kit.rgb(G[k].map(Math.round)); }
        f.q('#tt').textContent = t;
        f.q('#msg').textContent = t >= 800 ? 'Only the average color is clear.' : t >= 500 ? 'Big shapes appear: sky, ground, mountain.' : t >= 250 ? 'The layout is fixed. Edges are soft.' : t > 20 ? 'Details sharpen.' : 'Done: a clean picture.';
        st.set('r', t === 0 ? '0' : nu < 100 ? nu.toFixed(2) : '> 100'); st.set('b', rad < 0.2 ? 'none' : rad >= 14 ? 'whole image' : rad.toFixed(1) + ' px', 'blur radius in picture pixels');
      }
      const sl = c.slider({ label: 'Step t (1,000 = pure static)', min: 0, max: 1000, step: 10, value: 1000, fmt: v => v, onInput: v => { t = v; draw(); } });
      c.btn('Play backward', async () => { for (let v = 1000; v >= 0; v -= 20) { sl.set(v); await c.wait(40); } }, { small: true });
      draw();
      c.play(async () => { await c.wait(600); await c.tween(4200, p => { t = Math.round((1 - p) * 100) * 10; sl.set(t, true); draw(); }, c.ease.io); });
    }
  });

  /* ring toy helpers (scenes 17 to 19) -------------------------------- */
  const RK = 8, RR = 1.0, RS0 = 0.05, RMAX = 2.5, RMIN = 0.02;
  const RMU = Array.from({ length: RK }, (_, k) => [RR * Math.cos(2 * Math.PI * k / RK), RR * Math.sin(2 * Math.PI * k / RK)]);
  function rscore(x, y, s) {
    const v = RS0 * RS0 + s * s; let m = -1e9; const l = [];
    for (let k = 0; k < RK; k++) { const dx = x - RMU[k][0], dy = y - RMU[k][1], e = -(dx * dx + dy * dy) / (2 * v); l.push(e); if (e > m) m = e; }
    let z = 0, ax = 0, ay = 0;
    for (let k = 0; k < RK; k++) { const w = Math.exp(l[k] - m); z += w; ax += w * (RMU[k][0] - x); ay += w * (RMU[k][1] - y); }
    return [ax / z / v, ay / z / v];
  }
  function nearBlob(x, y) { let d = 1e9, b = 0; for (let k = 0; k < RK; k++) { const e = Math.hypot(x - RMU[k][0], y - RMU[k][1]); if (e < d) { d = e; b = k; } } return { d, b, on: d < 3 * RS0 }; }
  /* One trajectory from (x, y) at noise level smax down to RMIN. mode 'ode' is deterministic, 'sde' adds fresh noise each step. */
  function rpath(x, y, N, geo, mode, rnd, smax) {
    smax = smax || RMAX; const sg = i => geo ? smax * Math.pow(RMIN / smax, i / N) : smax + (RMIN - smax) * i / N, pts = [[x, y]];
    for (let i = 0; i < N; i++) {
      const a = sg(i), b = sg(i + 1), sc = rscore(x, y, a);
      if (mode === 'sde') { const d = a * a - b * b; x += d * sc[0] + Math.sqrt(d) * kit.gauss(rnd); y += d * sc[1] + Math.sqrt(d) * kit.gauss(rnd); }
      else { x += (a - b) * a * sc[0]; y += (a - b) * a * sc[1]; }
      pts.push([x, y]);
    }
    const sc = rscore(x, y, RMIN); x += RMIN * RMIN * sc[0]; y += RMIN * RMIN * sc[1]; pts.push([x, y]);
    return pts;
  }
  const PX = 16, PY = 14, PS = 240, PU = PS / 3.6;                       /* plot box and pixels per unit */
  const gx = x => PX + PS / 2 + x * PU, gy = y => PY + PS / 2 - y * PU;
  const plotBase = () => `<rect class="well" x="${PX}" y="${PY}" width="${PS}" height="${PS}" rx="10"/>` + RMU.map(m => `<circle class="none-f ink-s" cx="${gx(m[0]).toFixed(1)}" cy="${gy(m[1]).toFixed(1)}" r="${(3 * RS0 * PU).toFixed(1)}" style="stroke-width:1.2;opacity:.6"/>`).join('');
  const ringNums = () => RMU.map((m, k) => `<text class="xs m mute" x="${gx(m[0] * 1.2).toFixed(1)}" y="${(gy(m[1] * 1.2) + 4).toFixed(1)}" text-anchor="middle">${k + 1}</text>`).join('');
  const inBox = v => kit.clamp(v, -1.74, 1.74);
  function arrowPath(cx, cy, ux, uy, len, hs) {
    const x1 = cx - ux * len / 2, y1 = cy - uy * len / 2, x2 = cx + ux * len / 2, y2 = cy + uy * len / 2, nx = -uy, ny = ux, bx = x2 - ux * hs, by = y2 - uy * hs, r = (v) => v.toFixed(1);
    return 'M' + r(x1) + ' ' + r(y1) + 'L' + r(x2) + ' ' + r(y2) + 'M' + r(bx + nx * hs * 0.6) + ' ' + r(by + ny * hs * 0.6) + 'L' + r(x2) + ' ' + r(y2) + 'L' + r(bx - nx * hs * 0.6) + ' ' + r(by - ny * hs * 0.6);
  }

  /* 17 --------------------------------------------------------------- */
  S.push({
    id: 'steps', tag: 'Drawing',
    title: 'Fewer steps, faster pictures',
    alt: 'A square plot with eight small target rings and 300 points that start as random noise. A slider sets how many equal steps the points take toward the rings. With few steps most points end between the rings. A switch changes to smaller steps near the end, which puts most points on the rings with far fewer steps.',
    text: 'Sampling moves a point from noise to data in steps, and each step costs **one network call**. Equal-sized steps need many calls. Better solvers take **big steps early and small ones near the end**. That is how DDIM and its successors reach good images in **20 to 50 steps**, and distilled models in 1 to 4.',
    hint: 'Change the number of steps. Then switch on smarter step sizes.',
    mission: 'Land 90% of the points on a ring with 10 steps or fewer.',
    takeaway: 'The step count trades speed for accuracy. Smarter step sizes shift the whole trade.',
    mount(c) {
      const r0 = kit.rng(21), P0 = Array.from({ length: 300 }, () => [kit.gauss(r0) * RMAX, kit.gauss(r0) * RMAX]), TX = 280, TW = 128;
      const f = c.fig(420, 270, `${plotBase()}<g id="dots"></g>
        <text class="b sm" x="${TX}" y="34">Step noise levels</text><line class="axis" x1="${TX}" x2="${TX + TW}" y1="86" y2="86"/><g id="ticks"></g>
        <text class="xs mute" x="${TX}" y="108">very noisy</text><text class="xs mute" x="${TX + TW}" y="108" text-anchor="end">clean</text>
        <text class="xs mute" x="${TX}" y="150">Green: on a ring.</text><text class="xs mute" x="${TX}" y="166">Red: missed.</text><text class="xs mute" x="${TX}" y="188">Red points that left</text><text class="xs mute" x="${TX}" y="202">the box sit on its edge.</text>`);
      const st = c.stats([{ k: 'on', label: 'Points on a ring', value: '', cls: 'ok' }, { k: 'n', label: 'Network calls per image', value: '', cls: 'cmp' }]);
      let N = 3, geo = false;
      function draw() {
        let on = 0, dots = '';
        for (const p of P0) {
          const q = rpath(p[0], p[1], N, geo, 'ode'), e = q[q.length - 1], nb = nearBlob(e[0], e[1]); if (nb.on) on++;
          dots += `<circle cx="${gx(inBox(e[0])).toFixed(1)}" cy="${gy(inBox(e[1])).toFixed(1)}" r="2.3" class="${nb.on ? 'f-ok' : 'f-bad'}" style="opacity:.9"/>`;
        }
        f.q('#dots').innerHTML = dots;
        let tk = ''; for (let i = 0; i <= N; i++) { const s = geo ? RMAX * Math.pow(RMIN / RMAX, i / N) : RMAX + (RMIN - RMAX) * i / N; tk += `<line class="ln" x1="${(TX + (1 - s / RMAX) * TW).toFixed(1)}" x2="${(TX + (1 - s / RMAX) * TW).toFixed(1)}" y1="76" y2="86" style="stroke:var(--ink-2);stroke-width:1.2"/>`; }
        f.q('#ticks').innerHTML = tk;
        const pc = Math.round(on / P0.length * 100);
        st.set('on', pc + '%', on + ' of ' + P0.length + ' points'); st.set('n', N, '≈ ' + (N * 0.04).toFixed(2) + ' s if a call takes 40 ms (assumed)');
        c.mission.set(pc >= 90 && N <= 10);
      }
      const sl = c.slider({ label: 'Number of steps', values: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 30, 50, 100], value: 3, fmt: v => v, onInput: v => { N = v; draw(); } });
      const tg = c.toggle({ label: 'Smarter step sizes: small near the end', value: false, onChange: v => { geo = v; draw(); } });
      c.note('Toy: eight rings, exact scores, plain Euler steps. Real image models need about 20 to 50 steps with good solvers.');
      draw();
      c.demo(1500, async () => { geo = true; tg.set(true); N = 8; sl.set(8, true); draw(); });
    }
  });

  /* 18 --------------------------------------------------------------- */
  S.push({
    id: 'score', tag: 'Drawing',
    title: 'The network learns arrows that point toward data',
    alt: 'A square plot with a grid of arrows and eight small rings. At high noise every arrow points toward the middle. At low noise each arrow points at the nearest ring. Clicking the plot drops a point that follows the arrows and settles on a ring.',
    text: 'The noise predictor really learns a **direction field**: at each position and noise level, which way the data lies. In math this is the [[score]], the gradient of the log density. Slide the noise level down and the field changes from one shared direction toward the average into eight separate directions.',
    hint: 'Slide the noise level. Click the plot to drop a point and watch it follow the arrows.',
    mission: 'Get 5 dropped points to settle on a ring.',
    takeaway: 'High noise points to the average of everything. Low noise points to one specific example.',
    mount(c) {
      const G = 13, TX = 280;
      const f = c.fig(420, 270, `${plotBase()}<path id="arrows" class="s-ctl" fill="none" style="stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.85"/><g id="drops"></g>
        <text class="b sm" x="${TX}" y="34">What the field says</text><g id="says"></g>
        <text class="xs mute" x="${TX}" y="196">Click the plot to</text><text class="xs mute" x="${TX}" y="212">drop a point.</text><text id="l1" class="xs b" x="${TX}" y="238"></text><text id="l2" class="xs mute" x="${TX}" y="254"></text>`);
      const st = c.stats([{ k: 's', label: 'Noise level σ', value: '', cls: 'cmp' }, { k: 'd', label: 'Dropped points on a ring', value: '0 of 0', cls: 'ok' }]);
      let sig = 1.5, drops = [], landed = 0, total = 0;
      function arrows() {
        let d = '';
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
          const x = -1.7 + i * 3.4 / (G - 1), y = -1.7 + j * 3.4 / (G - 1), sc = rscore(x, y, sig), m = Math.hypot(sc[0], sc[1]); if (m < 1e-9) continue;
          d += arrowPath(gx(x), gy(y), sc[0] / m, -sc[1] / m, 13, 4.5);
        }
        f.q('#arrows').setAttribute('d', d);
        const lines = sig >= 1 ? ['Very noisy.', 'Every arrow points', 'toward the middle,', 'the average of all', 'eight rings.'] : sig >= 0.3 ? ['Medium noise.', 'The arrows split by', 'region. Coarse', 'layout comes', 'first.'] : ['Low noise.', 'Each arrow points', 'at the closest ring:', 'one specific', 'example.'];
        f.q('#says').innerHTML = lines.map((s, i) => `<text class="xs" x="${TX}" y="${56 + i * 16}">${s}</text>`).join('');
        st.set('s', sig.toFixed(2), sig >= 1 ? 'very noisy' : sig >= 0.3 ? 'medium' : 'nearly clean');
      }
      function paint() {
        f.q('#drops').innerHTML = drops.map(dr => {
          const m = Math.max(1, Math.round(dr.prog * (dr.pts.length - 1))), pts = dr.pts.slice(0, m + 1).map(p => [gx(inBox(p[0])), gy(inBox(p[1]))]), e = pts[pts.length - 1];
          return `<path class="ink-s" fill="none" d="${kit.path(pts)}" style="stroke-width:1.6;opacity:.8"/><circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="4.5" class="${dr.prog >= 1 ? (dr.on ? 'f-ok' : 'f-bad') : 'f-ctl'}" style="stroke:var(--stage);stroke-width:2"/>`;
        }).join('');
      }
      c.on(f.svg, 'click', ev => {
        const pt = f.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const m = f.svg.getScreenCTM(); if (!m) return;
        const q = pt.matrixTransform(m.inverse()), x = (q.x - PX - PS / 2) / PU, y = -(q.y - PY - PS / 2) / PU;
        if (Math.abs(x) > 1.8 || Math.abs(y) > 1.8) return;
        const pts = rpath(x, y, 50, true, 'ode', null, sig), e = pts[pts.length - 1], dr = { pts, prog: 0, on: nearBlob(e[0], e[1]).on };
        drops.push(dr); if (drops.length > 10) drops.shift(); total++;
        c.tween(1500, p => { dr.prog = p; paint(); }, c.ease.io).then(() => { if (dr.on) landed++; st.set('d', landed + ' of ' + total); const nb = nearBlob(e[0], e[1]); f.q('#l1').textContent = dr.on ? 'Settled on ring ' + (nb.b + 1) + '.' : 'Stopped between rings.'; f.q('#l2').textContent = dr.on ? '' : 'Arrows cancel on the line between two rings.'; c.mission.set(landed >= 5); });
      });
      c.slider({ label: 'Noise level σ', min: 0.02, max: 2.5, log: true, value: 1.5, fmt: v => v.toFixed(2), onInput: v => { sig = v; arrows(); } });
      c.note('Arrows show direction only. The points follow the exact deterministic flow of this toy.');
      arrows();
      c.play(async () => { await c.wait(500); for (const q of [[-1.2, 0.9], [1.4, 0.4], [0.1, -1.3]]) { const pts = rpath(q[0], q[1], 50, true, 'ode', null, sig), e = pts[pts.length - 1], dr = { pts, prog: 0, on: nearBlob(e[0], e[1]).on }; drops.push(dr); await c.tween(900, p => { dr.prog = p; paint(); }, c.ease.io); } });
    }
  });

  /* 19 --------------------------------------------------------------- */
  S.push({
    id: 'roads', tag: 'Drawing',
    title: 'Add noise while sampling, or do not',
    alt: 'Six points start from random noise and travel to the rings. A switch picks a sampler that adds fresh noise at every step, which draws jagged paths, or one with no fresh noise, which draws smooth paths. Running twice from the same start gives the same endpoints only with the smooth sampler.',
    text: 'Three views of the same model agree. [[ddpm|DDPM]] is a chain of small noisy steps. The **score SDE** is that chain in continuous time. The **probability-flow ODE** keeps the same distribution of results but removes the randomness. [[ddim|DDIM]] is its discrete form. With no fresh noise, **the same start gives the same picture**.',
    hint: 'Run each sampler twice and compare where the points end.',
    takeaway: 'Noisy samplers explore. Deterministic ones repeat, which image editing and inversion rely on.',
    mount(c) {
      const TX = 280, r0 = kit.rng(8), START = []; while (START.length < 6) { const x = kit.gauss(r0) * 0.9, y = kit.gauss(r0) * 0.9; if (Math.abs(x) < 1.6 && Math.abs(y) < 1.6 && Math.hypot(x, y) > 0.35 && RMU.every(m => Math.hypot(x - m[0] * 1.2, y - m[1] * 1.2) > 0.4)) START.push([x, y]); }
      const f = c.fig(420, 270, `${plotBase()}${ringNums()}<g id="paths"></g>
        <text class="b sm" x="${TX}" y="34">Sampler</text><g id="who"></g>
        <text class="b sm" x="${TX}" y="108">Rings reached</text><g id="cmp"></g>`);
      const st = c.stats([{ k: 'run', label: 'Runs so far', value: '0', cls: 'mem' }, { k: 'same', label: 'Same ring as the run before', value: '', cls: 'ok' }]);
      let mode = 'sde', seed = 100, runs = 0, busy = false; const last = { sde: null, ode: null }, ends = { sde: [], ode: [] };
      const col = m => m === 'sde' ? 'cmp' : 'mem';
      function render(paths, frac) {
        let o = '';
        paths.forEach((pts, i) => {
          const m = Math.max(1, Math.round(frac * (pts.length - 1))), seg = pts.slice(0, m + 1).map(p => [gx(inBox(p[0])), gy(inBox(p[1]))]), e = seg[seg.length - 1];
          o += `<path class="s-${col(mode)}" fill="none" d="${kit.path(seg)}" style="stroke-width:1.5;opacity:.9"/>`;
          if (frac >= 1) o += `<circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="4.8" class="f-${col(mode)}" style="stroke:var(--stage);stroke-width:2"/>`;
        });
        f.q('#paths').innerHTML = o + starts();
      }
      const who = () => { f.q('#who').innerHTML = mode === 'sde' ? `<text class="xs" x="${TX}" y="54">Fresh noise each step</text><text class="xs mute" x="${TX}" y="70">DDPM, SDE</text>` : `<text class="xs" x="${TX}" y="54">No fresh noise</text><text class="xs mute" x="${TX}" y="70">DDIM, ODE</text>`; };
      const starts = () => START.map((p, i) => `<circle cx="${gx(p[0]).toFixed(1)}" cy="${gy(p[1]).toFixed(1)}" r="3" class="ink-f"/><text class="xs m b" x="${(gx(p[0]) + 6).toFixed(1)}" y="${(gy(p[1]) - 5).toFixed(1)}">${i + 1}</text>`).join('');
      const clearStarts = () => { f.q('#paths').innerHTML = starts(); };
      async function run() {
        if (busy) return; busy = true;
        const rnd = kit.rng(seed++), paths = START.map(p => rpath(p[0], p[1], 80, true, mode, rnd, 1.0)), blobs = paths.map(q => nearBlob(q[q.length - 1][0], q[q.length - 1][1]).b);
        await c.tween(2200, p => render(paths, p), c.ease.io);
        runs++;
        const prev = last[mode]; let same = null;
        if (prev) same = blobs.filter((b, i) => b === prev[i]).length;
        last[mode] = blobs;
        st.set('run', runs); st.set('same', same == null ? 'run again' : same + ' of 6', same == null ? 'this sampler has run once' : mode === 'ode' ? 'identical endpoints' : 'a new picture each run');
        f.q('#cmp').innerHTML = [`<text class="xs m mute" x="${TX}" y="128">start  1 2 3 4 5 6</text>`, `<text class="xs m b" x="${TX}" y="146">now    ${blobs.map(b => b + 1).join(' ')}</text>`, prev ? `<text class="xs m" x="${TX}" y="164">last   ${prev.map(b => b + 1).join(' ')}</text>` : `<text class="xs m mute" x="${TX}" y="164">last   none yet</text>`].join('');
        busy = false;
      }
      c.seg({ label: 'Sampler', options: [['sde', 'Fresh noise each step'], ['ode', 'No fresh noise']], value: 'sde', onChange: v => { mode = v; clearStarts(); who(); } });
      c.btn('Run from the same six starts', run, { small: true });
      c.note('The six numbered dots are the fixed starting points. Rings are numbered 1 to 8, counterclockwise from the right.');
      clearStarts(); who(); st.set('same', 'run again', 'run each sampler at least twice');
      c.play(async () => { await c.wait(500); mode = 'sde'; await run(); await c.wait(300); await run(); });
    }
  });

  /* 20 --------------------------------------------------------------- */
  S.push({
    id: 'latent', tag: 'Drawing',
    title: 'Draw in a smaller space',
    alt: 'Two grids. The left one is the full-size photo in pixels. The right one is a much smaller latent grid. Controls set the image size, the compression factor and the number of latent channels. Counters show how many numbers each space holds and how much cheaper a self-attention layer becomes.',
    text: 'Diffusion on every pixel is expensive. [[latent|Latent]] diffusion first compresses the image with a trained [[vae|autoencoder]], runs the whole denoising process on the small grid, and decodes once at the end. At 512 × 512, a factor of 8 turns **786,432 numbers into 16,384**, which is 48 times fewer. A self-attention layer compares 4,096 positions instead of 262,144.',
    hint: 'Change the compression factor and the channel count.',
    mission: 'Make self-attention at least 1,000 times cheaper than on raw pixels.',
    takeaway: 'Compress once, then run all the denoising steps on the small grid.',
    mount(c) {
      const f = c.fig(420, 300, `<text class="b sm" x="20" y="22">Pixel space</text><g id="pix"></g><text class="b sm" x="290" y="22">Latent space</text><g id="lat"></g>
        <path class="ln s2" d="M138 82 H280" marker-end="url(#ah-ink)"/><text id="enc" class="xs b" x="209" y="74" text-anchor="middle"></text>
        <path class="ln s2 dash" d="M280 126 H138" marker-end="url(#ah-ink)"/><text class="xs mute" x="209" y="142" text-anchor="middle">decode once, last</text>
        <text id="c1" class="xs m" x="20" y="166"></text><text id="c2" class="xs m" x="290" y="166"></text><text class="xs mute" x="290" y="182">All denoising runs here.</text>
        <g id="att"></g>`);
      const st = c.stats([{ k: 'v', label: 'Numbers per image after compression', value: '', cls: 'data' }, { k: 'a', label: 'Self-attention cost vs raw pixels', value: '', cls: 'cmp' }]);
      let L = 512, fac = 2, ch = 4;
      function draw() {
        const n = L / fac, vals = n * n * ch, pixVals = L * L * 3, ratio = pixVals / vals, cheaper = Math.pow(fac, 4);
        const cells = Math.min(n, 36), SZ = 110, pic = [];
        for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) { const k = Math.floor((j + 0.5) / cells * 28) * 28 + Math.floor((i + 0.5) / cells * 28); pic.push(IMG[k]); }
        f.q('#pix').innerHTML = kit.pixels(IMG, 28, 20, 34, SZ) + `<rect class="none-f ink-s" x="20" y="34" width="${SZ}" height="${SZ}" rx="3"/>`;
        f.q('#lat').innerHTML = kit.pixels(pic, cells, 290, 34, SZ, { bleed: 0.2 }) + `<rect class="none-f s-ctl" x="290" y="34" width="${SZ}" height="${SZ}" rx="3" style="stroke-width:2.5"/>`;
        f.q('#enc').textContent = fac === 1 ? 'no compression' : 'encode ÷ ' + fac + ' per side';
        f.q('#c1').textContent = `${L}×${L}×3 = ${fmt.n(pixVals)}`; f.q('#c2').textContent = `${n}×${n}×${ch} = ${fmt.n(vals)}`;
        const pp = Math.pow(L, 4), pl = Math.pow(n, 4), lg = v => kit.clamp((Math.log10(v) - 3) / 9, 0.01, 1);
        f.q('#att').innerHTML = `<text class="b sm" x="20" y="226">Attention pairs per layer, log scale</text>` +
          kit.bar(20, 250, 380, 12, lg(pp), 'f-cmp', 'Raw pixels', kit.sci(pp, 1)) + kit.bar(20, 282, 380, 12, lg(pl), 'f-data', 'Latent grid', kit.sci(pl, 1));
        st.set('v', fmt.n(vals), ratio >= 10 ? Math.round(ratio) + '× fewer than ' + fmt.n(pixVals) : ratio.toFixed(1) + '× fewer than ' + fmt.n(pixVals)); st.set('a', cheaper === 1 ? '1×' : fmt.n(cheaper) + '× cheaper', fmt.n(n * n) + ' positions vs ' + fmt.n(L * L));
        c.mission.set(cheaper >= 1000);
      }
      c.seg({ label: 'Image side (pixels)', options: [['256', '256'], ['512', '512'], ['1024', '1024']], value: '512', onChange: v => { L = +v; draw(); } });
      c.seg({ label: 'Compression per side', options: [['1', '1×'], ['2', '2×'], ['4', '4×'], ['8', '8×'], ['16', '16×'], ['32', '32×']], value: '2', onChange: v => { fac = +v; draw(); } });
      c.seg({ label: 'Latent channels', options: [['4', '4'], ['16', '16']], value: '4', onChange: v => { ch = +v; draw(); } });
      c.note('Illustration: a real latent is learned, not a smaller copy of the photo. Stable Diffusion uses factor 8 with 4 channels. Newer models use 16.');
      draw();
      c.demo(1500, async () => { fac = 8; draw(); });
    }
  });

  /* helpers for the steering scenes ----------------------------------- */
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* Toy tokenizer: short words stay whole, long words split into pieces of up to 5 letters. Real CLIP uses byte-pair encoding. */
  function toyTokens(text) {
    const out = [];
    (text.toLowerCase().match(/[a-z0-9]+|[^\sa-z0-9]/g) || []).forEach(w => {
      if (/^[a-z0-9]+$/.test(w) && w.length > 6) { for (let i = 0; i < w.length; i += 5) out.push(w.slice(i, i + 5)); } else out.push(w);
    });
    return out;
  }
  const LONG_PROMPT = 'a small red house with a brown roof and a yellow door under a tall snowy mountain, a green tree on the left, a bright yellow sun in the top right corner, a blue sky with no clouds, green grass in the foreground, soft morning light, highly detailed, sharp focus, warm colors, calm and quiet mood, painted in the style of a travel poster, wide angle view, centered composition';

  /* 21 --------------------------------------------------------------- */
  S.push({
    id: 'textenc', tag: 'Steering',
    title: 'Your prompt becomes 77 vectors',
    alt: 'A text box turns a prompt into tokens. The tokens fill the first slots of a strip of 77 slots and the rest is padding. Every slot becomes a column of 768 numbers, drawn as a heat map.',
    text: 'The image model never reads words. A **text encoder** (CLIP’s text half in Stable Diffusion) splits your prompt into tokens, pads or cuts it to **77 slots**, and turns every slot into **768 numbers**. The denoiser then looks at that 77 × 768 table of 59,136 values.',
    hint: 'Type a prompt. Then try the very long one.',
    takeaway: 'The table always has 77 rows. Words past the limit are cut off and never reach the image model.',
    mount(c) {
      const f = c.fig(420, 272, `<text class="b sm" x="12" y="20">Tokens</text><g id="chips"></g><text class="b sm" x="12" y="124">77 slots</text><g id="strip"></g>
        <text class="b sm" x="12" y="196">Each slot becomes 768 numbers (12 shown)</text><g id="heat"></g>`);
      const st = c.stats([{ k: 't', label: 'Slots used', value: '', cls: 'data' }, { k: 'n', label: 'Numbers given to the image model', value: '59,136', sub: '77 × 768, always', cls: 'mem' }]);
      const CW = 396 / 77;
      let prompt = 'a red house under a snowy mountain';
      function draw() {
        const toks = toyTokens(prompt), cut = Math.max(0, toks.length - 75), kept = toks.slice(0, 75), seq = ['[start]'].concat(kept, ['[end]']);
        const show = seq.slice(0, 14); let chips = '';
        show.forEach((t, i) => { const r = Math.floor(i / 7), x = 12 + (i % 7) * 58, y = 30 + r * 32, edge = t === '[start]' || t === '[end]'; chips += `<rect class="${edge ? 't-ctl' : 't-data'}" x="${x}" y="${y}" width="54" height="26" rx="7"/><text class="xs b" x="${x + 27}" y="${y + 17}" text-anchor="middle">${t.replace('&', '&amp;').replace('<', '&lt;')}</text>`; });
        if (seq.length > 14) chips += `<text class="xs mute" x="12" y="106">+ ${seq.length - 14} more tokens</text>`;
        f.q('#chips').innerHTML = chips;
        let strip = '', heat = '';
        for (let i = 0; i < 77; i++) {
          const used = i < seq.length, x = 12 + i * CW, edge = used && (i === 0 || i === seq.length - 1);
          strip += `<rect x="${x.toFixed(2)}" y="134" width="${(CW - 0.8).toFixed(2)}" height="20" rx="1.5" class="${used ? (edge ? 'f-ctl' : 'f-data') : 'well'}"/>`;
          const r = kit.rng(hashStr(used ? seq[i] : 'pad' + i));
          for (let j = 0; j < 12; j++) { const v = kit.clamp(kit.gauss(r) * 0.6, -1, 1); heat += `<rect x="${x.toFixed(2)}" y="${(204 + j * 5).toFixed(1)}" width="${(CW - 0.8).toFixed(2)}" height="4.2" style="fill:var(--${v > 0 ? 'cmp' : 'mem'});opacity:${used ? (0.15 + 0.85 * Math.abs(v)).toFixed(2) : 0.08}"/>`; }
        }
        f.q('#strip').innerHTML = strip + `<text class="xs mute" x="12" y="170">${seq.length} used, ${77 - seq.length} padding${cut ? ', ' + cut + ' words cut off' : ''}</text>`;
        f.q('#heat').innerHTML = heat;
        st.set('t', seq.length + ' of 77', cut ? cut + ' tokens past the limit were cut' : 'start and end count as slots');
      }
      const tx = c.text({ label: 'Your prompt', value: prompt, max: 600, onInput: v => { prompt = v; draw(); } });
      c.btn('Try a very long prompt', () => tx.set(LONG_PROMPT), { small: true });
      c.note('Toy tokenizer: real CLIP uses byte-pair encoding, so token counts differ. The colors are made-up numbers, not real embeddings.');
      draw();
      c.demo(1500, async () => { tx.set(LONG_PROMPT); });
    }
  });

  /* 22 --------------------------------------------------------------- */
  const WORDS = ['red', 'house', 'snowy', 'mountain', 'sun', 'tree', 'grass'];
  const WSET = { red: ['wall', 'roof'], house: ['wall', 'roof', 'door'], snowy: ['snow'], mountain: ['snow', 'rock'], sun: ['sun'], tree: ['trunk', 'leaves'], grass: ['grass'] };
  function labelAt(x, y) {                                           /* same shapes as kit.picture */
    let l = 'sky';
    if ((x - 0.76) ** 2 + (y - 0.2) ** 2 < 0.011) l = 'sun';
    if (y > 0.26 + Math.abs(x - 0.3) * 1.53 && y < 0.72) l = y < 0.4 ? 'snow' : 'rock';
    if (y > 0.68 + 0.05 * Math.sin(x * 5.5 + 0.6)) l = 'grass';
    if (x > 0.6 && x < 0.86 && y > 0.6 && y < 0.82) l = 'wall';
    if (y > 0.5 && y <= 0.6 && x > 0.6 - (y - 0.6) * 0.9 && x < 0.86 + (y - 0.6) * 0.9) l = 'roof';
    if (x > 0.7 && x < 0.76 && y > 0.7 && y < 0.82) l = 'door';
    if (x > 0.1 && x < 0.15 && y > 0.7 && y < 0.88) l = 'trunk';
    if ((x - 0.125) ** 2 + (y - 0.64) ** 2 < 0.0085) l = 'leaves';
    return l;
  }
  S.push({
    id: 'crossattn', tag: 'Steering',
    title: 'Every patch attends to the words',
    alt: 'The photo is divided into a 14 by 14 grid. Words from the prompt are listed at the right. Clicking a word shades the patches that attend to it. Clicking a patch shows how much that patch attends to each word, as bars.',
    text: 'Inside the denoiser, [[cross-attention]] lets every image position attend to every word. Queries come from image patches. Keys and values come from the 77 text vectors. At the 64 × 64 level that is a **4,096 × 77** attention map per head. Each word ends up with most weight on the region where its object is drawn.',
    hint: 'Click a word to see where it attends. Click a patch to see which words it attends to.',
    mission: 'Click a patch on the sun and see which word it attends to most.',
    takeaway: 'Words steer the picture through attention: each patch takes more from the words that describe it.',
    mount(c) {
      const G = 14, SZ = 168, X0 = 16, Y0 = 36, CS = SZ / G, RX = 204;
      const lab = []; for (let k = 0; k < G * G; k++) lab.push(labelAt(((k % G) + 0.5) / G, (Math.floor(k / G) + 0.5) / G));
      const wts = k => { const lg = WORDS.map(w => WSET[w].includes(lab[k]) ? 3.2 : 0), m = Math.max(...lg), e = lg.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
      let cells = ''; for (let k = 0; k < G * G; k++) cells += `<rect id="o${k}" x="${(X0 + (k % G) * CS).toFixed(1)}" y="${(Y0 + Math.floor(k / G) * CS).toFixed(1)}" width="${CS.toFixed(1)}" height="${CS.toFixed(1)}" style="fill:var(--ctl);opacity:0"/>`;
      let rows = ''; WORDS.forEach((w, i) => { const y = 40 + i * 28; rows += `<g class="clk" data-w="${i}" role="button" tabindex="0" aria-label="Word ${w}"><rect id="rw${i}" class="box" x="${RX}" y="${y}" width="${204}" height="24" rx="8"/><text class="xs b" x="${RX + 10}" y="${y + 16}">${w}</text><rect class="well" x="${RX + 84}" y="${y + 7}" width="80" height="10" rx="4"/><rect id="rb${i}" class="f-ctl" x="${RX + 84}" y="${y + 7}" width="2" height="10" rx="4"/><text id="rv${i}" class="xs m" x="${RX + 198}" y="${y + 16}" text-anchor="end"></text></g>`; });
      const f = c.fig(420, 262, `<text class="b sm" x="${X0}" y="26">Prompt: red house, snowy mountain, sun, tree, grass</text>${kit.pixels(IMG, 28, X0, Y0, SZ)}${cells}<rect class="none-f ink-s" x="${X0}" y="${Y0}" width="${SZ}" height="${SZ}"/><rect id="sel" class="none-f s-ctl" width="${CS.toFixed(1)}" height="${CS.toFixed(1)}" style="stroke-width:3;display:none"/>
        ${rows}<text id="m1" class="b sm" x="${X0}" y="${Y0 + SZ + 22}"></text><text id="m2" class="b sm" x="${X0}" y="${Y0 + SZ + 39}"></text>`);
      const st = c.stats([{ k: 'w', label: 'Word shown on the picture', value: '', cls: 'ctl' }, { k: 'p', label: 'Chosen patch attends most to', value: 'none yet', cls: 'data' }]);
      let selW = 1, selP = -1;
      function draw() {
        const w = WORDS[selW];
        for (let k = 0; k < G * G; k++) f.q('#o' + k).style.opacity = WSET[w].includes(lab[k]) ? 0.62 : 0;
        WORDS.forEach((_, i) => { f.q('#rw' + i).style.stroke = i === selW ? 'var(--ctl)' : ''; f.q('#rw' + i).style.strokeWidth = i === selW ? '3' : ''; });
        let top = '';
        if (selP >= 0) {
          const p = wts(selP), im = p.indexOf(Math.max(...p)); top = p[im] > 0.2 ? WORDS[im] : 'no single word';
          WORDS.forEach((_, i) => { f.q('#rb' + i).setAttribute('width', Math.max(2, 80 * p[i]).toFixed(1)); f.q('#rv' + i).textContent = Math.round(p[i] * 100) + '%'; });
          const s = f.q('#sel'); s.style.display = ''; s.setAttribute('x', (X0 + (selP % G) * CS).toFixed(1)); s.setAttribute('y', (Y0 + Math.floor(selP / G) * CS).toFixed(1));
          const mm = top === 'no single word' ? ['Sky: no word owns', 'this patch.'] : ['This patch attends', 'most to “' + top + '”.']; f.q('#m1').textContent = mm[0]; f.q('#m2').textContent = mm[1];
        } else { WORDS.forEach((_, i) => { f.q('#rb' + i).setAttribute('width', 2); f.q('#rv' + i).textContent = ''; }); f.q('#sel').style.display = 'none'; f.q('#m1').textContent = 'Click the picture'; f.q('#m2').textContent = 'to choose a patch.'; }
        st.set('w', w); st.set('p', selP < 0 ? 'none yet' : top, selP < 0 ? '' : 'label here: ' + lab[selP]);
        c.mission.set(selP >= 0 && lab[selP] === 'sun');
      }
      f.qa('.clk').forEach(g => { const act = () => { selW = +g.dataset.w; draw(); }; c.on(g, 'click', ev => { ev.stopPropagation(); act(); }); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
      c.on(f.svg, 'click', ev => {
        const pt = f.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const m = f.svg.getScreenCTM(); if (!m) return;
        const q = pt.matrixTransform(m.inverse()), i = Math.floor((q.x - X0) / CS), j = Math.floor((q.y - Y0) / CS);
        if (i < 0 || j < 0 || i >= G || j >= G) return; selP = j * G + i; draw();
      });
      c.note('Toy: the weights come from the picture’s shapes. A real model learns them. Sky patches match no word, so their attention spreads evenly.');
      draw();
      c.demo(1400, async () => { selP = 2 * G + 11; draw(); });
    }
  });

  /* 23 --------------------------------------------------------------- */
  const erf = x => { const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
  const cdf = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
  S.push({
    id: 'guidance', tag: 'Steering',
    title: 'Turn the prompt up',
    alt: 'A chart with three bell curves. A wide gray one for results with an empty prompt, a narrower violet one for results with the prompt, and an orange one for the guided result. A slider sets the guidance scale. As it grows the orange curve moves past the violet one and gets narrower. Counters show how many samples fit the prompt and how much variety remains.',
    text: 'The network predicts noise twice per step, once with your prompt and once with an empty one, then **extrapolates**: empty + w × (prompt − empty). That is classifier-free guidance, and w is the [[guidance scale]]. A larger w matches the prompt more tightly and gives less variety. Stable Diffusion defaults to **w = 7.5**.',
    hint: 'Raise the guidance scale and watch both counters.',
    mission: 'Find a scale where at least 85% fit the prompt and the spread stays above 0.4.',
    takeaway: 'Guidance trades variety for prompt fit. It costs two network calls per step.',
    mount(c) {
      const MU_U = 0, S_U = 2, MU_C = 2, S_C = 1;
      const ch = kit.chart({ x: 40, y: 22, w: 360, h: 150, xmin: -4, xmax: 6, ymin: 0, ymax: 1.45, xt: [-4, -2, 0, 2, 4, 6], yt: [0, 0.5, 1], yf: v => v.toFixed(1), xlabel: 'one feature of the image (toy)' });
      const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
      const curve = (m, s) => { const pts = []; for (let x = -4; x <= 6.0001; x += 0.1) pts.push([ch.X(x), ch.Y(Math.min(1.45, pdf(x, m, s)))]); return pts; };
      const guided = w => { const lam = w / (S_C * S_C) + (1 - w) / (S_U * S_U); return { m: (w * MU_C / (S_C * S_C) + (1 - w) * MU_U / (S_U * S_U)) / lam, s: 1 / Math.sqrt(lam) }; };
      const f = c.fig(420, 256, `${ch.svg}<rect x="${ch.X(1).toFixed(1)}" y="${ch.y0}" width="${(ch.X(3) - ch.X(1)).toFixed(1)}" height="${ch.y1 - ch.y0}" style="fill:var(--ok);opacity:.13"/><text class="xs mute" x="${((ch.X(1) + ch.X(3)) / 2).toFixed(1)}" y="${ch.y0 + 11}" text-anchor="middle">fits the prompt</text>
        <path class="ln dash" d="${kit.path(curve(MU_U, S_U))}"/><path class="s-ctl s2" fill="none" d="${kit.path(curve(MU_C, S_C))}"/><path id="g" class="s-cmp s3" fill="none"/>
        <text class="b sm" x="210" y="${ch.y1 + 48}" text-anchor="middle">guided = empty + w × (prompt − empty)</text><text id="msg" class="xs mute" x="210" y="${ch.y1 + 66}" text-anchor="middle"></text>`);
      c.legend([['mute', 'Empty prompt'], ['ctl', 'With the prompt'], ['cmp', 'Guided']]);
      const st = c.stats([{ k: 'fit', label: 'Samples that fit the prompt', value: '', cls: 'ok' }, { k: 'sd', label: 'Spread (variety)', value: '', cls: 'mem' }, { k: 'c', label: 'Network calls per step', value: '2', sub: 'prompt and empty prompt', cls: 'cmp' }]);
      let w = 1;
      function draw() {
        const g = guided(w), fit = cdf(3, g.m, g.s) - cdf(1, g.m, g.s);
        f.q('#g').setAttribute('d', kit.path(curve(g.m, g.s)));
        f.q('#msg').textContent = w < 1 ? 'Below 1 the model partly ignores the prompt.' : w === 1 ? 'w = 1: plain prompt sampling, no extra push.' : w < 6 ? 'The result moves past the prompt’s own center.' : w <= 8 ? 'The usual range. Stable Diffusion defaults to 7.5.' : 'Very strong: results repeat and colors can oversaturate.';
        st.set('fit', Math.round(fit * 100) + '%', 'inside the shaded band'); st.set('sd', g.s.toFixed(2), g.s >= 0.4 ? 'plenty of variety' : 'results look alike');
        c.mission.set(fit >= 0.85 && g.s >= 0.395);
      }
      const sl = c.slider({ label: 'Guidance scale w', min: 0, max: 15, step: 0.5, value: 1, fmt: v => v.toFixed(1), onInput: v => { w = v; draw(); } });
      c.note('Toy: one feature, two bell curves. Real models apply the same formula to noise predictions at every step.');
      draw();
      c.play(async () => { await c.wait(600); await c.tween(2600, p => { w = Math.max(1, Math.round(p * 30) / 2); sl.set(w, true); draw(); }, c.ease.io); await c.wait(300); await c.tween(1000, p => { w = Math.max(1, Math.round((1 - p) * 15 * 2) / 2); sl.set(w, true); draw(); }, c.ease.io); w = 1; sl.set(1, true); draw(); });
    }
  });

  /* 24 --------------------------------------------------------------- */
  S.push({
    id: 'pipeline', tag: 'Steering',
    title: 'Put the pipeline in order',
    alt: 'Five stage cards sit in a shuffled row. Clicking them in the order they run fills five numbered slots: the text encoder and the random noise first, then the denoising loop, then the decoder, then the finished image. A slider sets the number of denoising steps. Bars show how many network calls each stage makes.',
    text: 'A text-to-image model has five stages. Two inputs are prepared first: **text vectors** and **random noise** in latent space. A loop of **20 to 50 denoising steps** turns the noise into a clean latent, using the text through cross-attention and guidance. A **decoder** writes the pixels once, at the end.',
    hint: 'Click the stages in the order they run.',
    mission: 'Put all five stages in the right order.',
    takeaway: 'The loop makes almost all the network calls: steps × 2 with guidance. Encoder and decoder run once each.',
    mount(c) {
      const ST = [
        { id: 'text', a: 'Text', b: 'encoder', d: '77 × 768', cls: 'ctl' },
        { id: 'noise', a: 'Random', b: 'noise', d: '64×64×4', cls: 'mem' },
        { id: 'loop', a: 'Denoise', b: 'loop', d: '', cls: 'cmp' },
        { id: 'vae', a: 'VAE', b: 'decoder', d: 'to pixels', cls: 'data' },
        { id: 'img', a: 'Finished', b: 'image', d: '512×512', cls: 'ok' }
      ];
      const need = { text: 'Nothing has to come before this one.', noise: 'Nothing has to come before this one.', loop: 'The loop needs both the text vectors and the starting noise.', vae: 'The decoder needs a clean latent, so the loop comes first.', img: 'No pixels exist until the decoder has run.' };
      const BW = 74, BH = 60, XS = i => 9 + i * 82;
      const f = c.fig(420, 308, `<text class="b sm" x="9" y="22">Slots, in running order</text><g id="slots"></g><text class="b sm" x="9" y="116">Shuffled stages</text><g id="pool"></g><text id="msg" class="b sm" x="9" y="214"></text>
        <text class="b sm" x="9" y="244">Network calls for one image</text><g id="calls"></g>`);
      const st = c.stats([{ k: 'p', label: 'Placed correctly', value: '', cls: 'ok' }, { k: 'm', label: 'Wrong clicks', value: '0', cls: 'bad' }]);
      let order = [], placed = [], mistakes = 0, seed = 5, steps = 30, flash = '';
      const ok = k => { const n = placed.length; return n < 2 ? (k === 'text' || k === 'noise') && !placed.includes(k) : k === ST[n].id; };
      const box = (s, x, y, filled, extra) => `<rect class="${filled ? 't-' + s.cls : 'box'}" x="${x}" y="${y}" width="${BW}" height="${BH}" rx="10" style="${extra || ''}"/><text class="xs b" x="${x + BW / 2}" y="${y + 22}" text-anchor="middle">${s.a}</text><text class="xs b" x="${x + BW / 2}" y="${y + 37}" text-anchor="middle">${s.b}</text><text class="xs m mute" x="${x + BW / 2}" y="${y + 52}" text-anchor="middle">${s.id === 'loop' ? steps + ' steps' : s.d}</text>`;
      function draw() {
        let sl = '';
        for (let i = 0; i < 5; i++) { const s = placed[i] ? ST.find(q => q.id === placed[i]) : null; sl += s ? box(s, XS(i), 32, true) : `<rect class="well" x="${XS(i)}" y="32" width="${BW}" height="${BH}" rx="10" style="stroke-dasharray:4 4"/><text class="lg b" x="${XS(i) + BW / 2}" y="${32 + BH / 2 + 7}" text-anchor="middle" style="fill:var(--ink-3)">${i + 1}</text>`; }
        f.q('#slots').innerHTML = sl;
        const left = order.filter(k => !placed.includes(k));
        f.q('#pool').innerHTML = left.map((k, i) => `<g class="clk" data-k="${k}" role="button" tabindex="0" aria-label="${ST.find(q => q.id === k).a} ${ST.find(q => q.id === k).b}">${box(ST.find(q => q.id === k), XS(i), 124, false, flash === k ? 'stroke:var(--bad);stroke-width:3' : '')}</g>`).join('');
        f.qa('#pool .clk').forEach(g => { const act = () => pick(g.dataset.k); c.on(g, 'click', act); c.on(g, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); });
        const done = placed.length === 5;
        f.q('#msg').textContent = done ? 'In order: encoder, noise, loop, decoder, image.' : flash ? need[flash] : 'Each stage needs the output of the one before it.';
        st.set('p', placed.length + ' of 5'); st.set('m', mistakes);
        const rows = [['Text encoder', 1, 'f-ctl'], ['Denoising loop', steps * 2, 'f-cmp'], ['VAE decoder', 1, 'f-data']];
        f.q('#calls').innerHTML = rows.map((r, i) => { const y = 256 + i * 20; return `<text class="xs" x="9" y="${y + 9}">${r[0]}</text><rect class="well" x="112" y="${y}" width="236" height="10" rx="5"/><rect class="${r[2]}" x="112" y="${y}" width="${Math.max(3, 236 * r[1] / 102).toFixed(1)}" height="10" rx="5"/><text class="xs m b" x="411" y="${y + 9}" text-anchor="end">${r[1]} ${r[1] === 1 ? 'call' : 'calls'}</text>`; }).join('');
        c.mission.set(done);
      }
      function shuffle() {
        const r = kit.rng(seed++); order = ST.map(s => s.id);
        do { for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } } while (order.join() === ST.map(s => s.id).join());
        placed = []; mistakes = 0; flash = ''; draw();
      }
      async function pick(k) {
        if (placed.length === 5) return;
        if (ok(k)) { placed.push(k); flash = ''; draw(); }
        else { mistakes++; flash = k; draw(); await c.wait(1100); if (flash === k) { flash = ''; draw(); } }
      }
      c.btn('Shuffle again', shuffle, { small: true });
      c.slider({ label: 'Denoising steps', min: 10, max: 50, step: 5, value: 30, fmt: v => v, onInput: v => { steps = v; draw(); } });
      c.note('Text encoder and noise can come in either order. Both must be ready before the loop starts. Calls assume guidance, so each step makes two.');
      shuffle();
      c.demo(1300, async () => { placed = []; draw(); for (const k of ['text', 'noise', 'loop', 'vae', 'img']) { placed.push(k); draw(); await c.wait(450); } });
    }
  });

  /* 25 --------------------------------------------------------------- */
  S.push({
    id: 'shifts', tag: 'Steering',
    title: 'Three changes behind today’s image models',
    alt: 'Three tabs. Transformer: a grid of latent tokens whose count depends on the patch size, feeding a stack of transformer blocks. Straight paths: a curved diffusion path and a straight flow path between a data point and a noise point, with arrows along each. Few steps: bars comparing network calls per image for a 50-step teacher and distilled students.',
    text: 'Since 2020, three things changed. **Transformers** replaced the U-Net. [[flow matching|Flow matching]] trains along straight lines instead of noise arcs. [[distillation|Distillation]] shrinks 50 steps to 1 to 4. FLUX.1 is a 12-billion-parameter transformer trained with rectified flow, and its schnell version makes a picture in 1 to 4 steps.',
    hint: 'Open each tab and change its control.',
    takeaway: 'Better network, straighter training paths, fewer steps. Together they cut the cost of one image sharply.',
    mount(c) {
      const f = c.fig(420, 286, '<g id="view"></g>');
      const st = c.stats([{ k: 'a', label: '', value: '', cls: 'mem' }, { k: 'b', label: '', value: '', cls: 'cmp' }]);
      const setLabel = (k, text) => { st.el.children[k === 'a' ? 0 : 1].querySelector('span').textContent = text; };
      let tab = 'net', patch = 2, s = 0.5, mode = '50';
      const X0 = [1.4, -0.6], EP = [0.6, 1.4], gx2 = x => gx(x - 0.55), gy2 = y => gy(y - 0.1);
      const arc = u => { const a = Math.sqrt(1 - u * u); return [a * X0[0] + u * EP[0], a * X0[1] + u * EP[1]]; };
      const line = u => [(1 - u) * X0[0] + u * EP[0], (1 - u) * X0[1] + u * EP[1]];
      const arcDir = u => { const a = Math.sqrt(1 - u * u), da = -u / a; return [-(da * X0[0] + EP[0]), -(da * X0[1] + EP[1])]; };   /* generation direction: toward data */
      const lineDir = () => [X0[0] - EP[0], X0[1] - EP[1]];
      const unit = v => { const m = Math.hypot(v[0], v[1]); return [v[0] / m, -v[1] / m]; };                                         /* svg y points down */
      const plen = fn => { let L = 0, p = fn(0); for (let i = 1; i <= 200; i++) { const q = fn(i / 200 * 0.9999); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return L; };
      const CALLS = { '50': 100, '8': 8, '4': 4, '1': 1 };
      const nt = c.note('');
      const segNet = c.seg({ label: 'Patch size of the latent grid', options: [['2', 'Patch 2'], ['4', 'Patch 4'], ['8', 'Patch 8']], value: '2', onChange: v => { patch = +v; draw(); } });
      const slFlow = c.slider({ label: 'Noise share s', min: 0, max: 0.95, step: 0.05, value: 0.5, fmt: v => v.toFixed(2), onInput: v => { s = v; draw(); } });
      const segFew = c.seg({ label: 'Sampler', options: [['50', '50 steps'], ['8', '8 steps'], ['4', '4 steps'], ['1', '1 step']], value: '50', onChange: v => { mode = v; draw(); } });
      c.seg({ label: 'Change', options: [['net', 'Transformer'], ['flow', 'Straight paths'], ['few', 'Few steps']], value: 'net', onChange: v => { tab = v; draw(); } });
      function draw() {
        segNet.el.style.display = tab === 'net' ? '' : 'none'; slFlow.el.style.display = tab === 'flow' ? '' : 'none'; segFew.el.style.display = tab === 'few' ? '' : 'none';
        const V = f.q('#view');
        if (tab === 'net') {
          const n = 32 / patch, tok = n * n, SZ = 150; let g = kit.pixels(IMG, 28, 16, 40, SZ);
          for (let i = 1; i < n; i++) { const p = 16 + i * SZ / n, q = 40 + i * SZ / n; g += `<line x1="${p.toFixed(1)}" x2="${p.toFixed(1)}" y1="40" y2="${40 + SZ}" style="stroke:var(--stage);stroke-width:1;opacity:.75"/><line y1="${q.toFixed(1)}" y2="${q.toFixed(1)}" x1="16" x2="${16 + SZ}" style="stroke:var(--stage);stroke-width:1;opacity:.75"/>`; }
          V.innerHTML = `<text class="b sm" x="16" y="30">Latent grid cut into ${n} × ${n} tokens</text>${g}<rect class="none-f ink-s" x="16" y="40" width="${SZ}" height="${SZ}"/>
            <text class="xs mute" x="16" y="${40 + SZ + 18}">32 × 32 latent, patch size ${patch}</text>
            <path class="ln s2" d="M170 115 H196" marker-end="url(#ah-ink)"/>
            <rect class="t-data" x="204" y="40" width="200" height="26" rx="8"/><text class="xs b" x="304" y="57" text-anchor="middle">${tok} tokens</text>
            <path class="ln s2" d="M304 68 V80" marker-end="url(#ah-ink)"/>
            <rect class="t-cmp" x="204" y="84" width="200" height="26" rx="8"/><text class="xs b" x="304" y="101" text-anchor="middle">Transformer block</text>
            <rect class="t-cmp" x="204" y="116" width="200" height="26" rx="8"/><text class="xs b" x="304" y="133" text-anchor="middle">Transformer block</text>
            <text class="xs mute" x="304" y="158" text-anchor="middle">... 28 blocks in DiT-XL</text>
            <path class="ln s2" d="M304 164 V176" marker-end="url(#ah-ink)"/>
            <rect class="t-mem" x="204" y="180" width="200" height="26" rx="8"/><text class="xs b" x="304" y="197" text-anchor="middle">Predicted noise</text>
            <text class="xs mute" x="204" y="228">Step t and the prompt enter</text><text class="xs mute" x="204" y="243">every block.</text>`;
          nt.textContent = 'Peebles and Xie (2023) replaced the U-Net with a plain transformer on latent patches. DiT-XL/2 reached FID 2.27 on class-conditional ImageNet 256 × 256, and quality improved as tokens and model size grew.';
          st.set('a', tok, 'tokens in the grid'); st.set('b', fmt.n(tok * tok), 'attention pairs per layer');
          setLabel('a', 'Tokens'); setLabel('b', 'Attention pairs per layer');
        } else if (tab === 'flow') {
          const ap = [0.1, 0.3, 0.5, 0.7, 0.9]; let arrows = '';
          ap.forEach(u => { const a = arc(u), d = unit(arcDir(u)), l = line(u), e = unit(lineDir()); arrows += `<path class="s-mem" fill="none" d="${arrowPath(gx2(a[0]), gy2(a[1]), d[0], d[1], 24, 7)}" style="stroke-width:2;stroke-linecap:round"/><path class="s-ctl" fill="none" d="${arrowPath(gx2(l[0]), gy2(l[1]), e[0], e[1], 24, 7)}" style="stroke-width:2;stroke-linecap:round"/>`; });
          const A = [], L = []; for (let i = 0; i <= 60; i++) { const u = i / 60 * 0.999; const a = arc(u), l = line(u); A.push([gx2(a[0]), gy2(a[1])]); L.push([gx2(l[0]), gy2(l[1])]); }
          const ma = arc(s), ml = line(s);
          V.innerHTML = `<text class="b sm" x="${PX}" y="12">Training path between one picture and one noise sample</text>
            <g transform="translate(0 2)"><rect class="well" x="${PX}" y="${PY}" width="${PS}" height="${PS}" rx="10"/>
            <path class="s-mem" fill="none" d="${kit.path(A)}" style="stroke-width:2;opacity:.5"/><path class="s-ctl" fill="none" d="${kit.path(L)}" style="stroke-width:2;opacity:.5"/>${arrows}
            <circle cx="${gx2(X0[0]).toFixed(1)}" cy="${gy2(X0[1]).toFixed(1)}" r="6" class="f-data" style="stroke:var(--stage);stroke-width:2"/><text class="xs b" x="${(gx2(X0[0]) + 9).toFixed(1)}" y="${(gy2(X0[1]) + 4).toFixed(1)}">picture</text>
            <circle cx="${gx2(EP[0]).toFixed(1)}" cy="${gy2(EP[1]).toFixed(1)}" r="6" class="f-cmp" style="stroke:var(--stage);stroke-width:2"/><text class="xs b" x="${(gx2(EP[0]) + 9).toFixed(1)}" y="${(gy2(EP[1]) + 4).toFixed(1)}">noise</text>
            <circle cx="${gx2(ma[0]).toFixed(1)}" cy="${gy2(ma[1]).toFixed(1)}" r="5" class="ink-f" style="stroke:var(--stage);stroke-width:2"/><circle cx="${gx2(ml[0]).toFixed(1)}" cy="${gy2(ml[1]).toFixed(1)}" r="5" class="ink-f" style="stroke:var(--stage);stroke-width:2"/></g>
            <line x1="280" x2="296" y1="48" y2="48" class="s-mem" style="stroke-width:3.5;stroke-linecap:round"/><text class="b sm" x="302" y="52">Diffusion</text><text class="xs m" x="280" y="72">x = √(1−s²)·picture</text><text class="xs m" x="280" y="86">    + s·noise</text><text class="xs mute" x="280" y="106">The arrow keeps turning.</text>
            <line x1="280" x2="296" y1="132" y2="132" class="s-ctl" style="stroke-width:3.5;stroke-linecap:round"/><text class="b sm" x="302" y="136">Flow matching</text><text class="xs m" x="280" y="156">x = (1−s)·picture</text><text class="xs m" x="280" y="170">    + s·noise</text><text class="xs mute" x="280" y="190">One arrow, everywhere.</text>`;
          const ratio = plen(arc) / plen(line), t0 = Math.atan2(arcDir(0.1)[1], arcDir(0.1)[0]), t1 = Math.atan2(arcDir(0.9)[1], arcDir(0.9)[0]);
          nt.textContent = 'Flow matching and rectified flow (used by Stable Diffusion 3 and FLUX) train the network to predict one constant velocity along a straight line. A straight path can be crossed in large steps with little error.';
          setLabel('a', 'Path length ratio'); setLabel('b', 'Turn of the diffusion arrow');
          st.set('a', '× ' + ratio.toFixed(2), 'diffusion path ÷ straight line'); st.set('b', Math.abs((t1 - t0) * 180 / Math.PI).toFixed(0) + '°', 'from s = 0.1 to 0.9. Flow matching: 0°');
        } else {
          const rows = [['50', 'Teacher: 50 steps with guidance'], ['8', 'Student: 8 steps'], ['4', 'Student: 4 steps'], ['1', 'Student: 1 step']];
          V.innerHTML = `<text class="b sm" x="16" y="26">Network calls for one picture</text>` + rows.map((r, i) => { const y = 52 + i * 46, v = CALLS[r[0]]; return kit.bar(16, y, 388, 16, v / 100, r[0] === mode ? 'f-cmp' : 'f-mem', r[1], v + (v === 1 ? ' call' : ' calls')); }).join('') +
            `<text class="xs mute" x="16" y="${52 + 4 * 46 - 12}">Students assume guidance is distilled in, so one call per step.</text>`;
          nt.textContent = 'A student network is trained to match what the teacher makes in many steps. Progressive distillation halves the steps again and again. Consistency models jump from any point straight to the end. Adversarial distillation adds a discriminator. Quality drops as steps shrink, by an amount that depends on the method.';
          setLabel('a', 'Calls per picture'); setLabel('b', 'Savings');
          st.set('a', CALLS[mode] + (CALLS[mode] === 1 ? ' call' : ' calls'), 'for this sampler'); st.set('b', mode === '50' ? 'baseline' : '× ' + (100 / CALLS[mode]) + ' fewer', 'than the 50-step teacher');
        }
      }
      draw();
      c.play(async () => { await c.wait(600); tab = 'flow'; draw(); await c.tween(1800, p => { s = p * 0.9; slFlow.set(s, true); draw(); }, c.ease.io); await c.wait(300); tab = 'few'; draw(); for (const m of ['8', '4', '1']) { mode = m; draw(); await c.wait(700); } tab = 'net'; draw(); });
    }
  });

  /* 26 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'A 224 × 224 image is cut into 16 × 16 patches. How many patches does the transformer get, before the CLS token?', o: ['49', '256', '196', '14'], a: 2, why: '224 ÷ 16 = 14 patches per side, and 14 × 14 = 196. With CLS the sequence has 197 tokens.' },
      { q: 'Why does a masked autoencoder train faster than one that encodes every patch?', o: ['The encoder only processes the 25% of patches that stay visible', 'It uses smaller images', 'It skips the decoder', 'It trains on text instead of pixels'], a: 0, why: 'Hiding 75% of the patches means the big encoder handles a quarter of the tokens. A light decoder fills in the rest.' },
      { q: 'What does CLIP training push together?', o: ['Every pixel with its neighbor', 'A photo and its own caption, against the other captions in the batch', 'A caption and the next word of a different caption', 'Two crops of the same photo only'], a: 1, why: 'A contrastive loss raises the score of true photo and caption pairs and lowers it for all mismatched pairs in the batch.' },
      { q: 'In DDPM, what does the network predict at each step?', o: ['The next pixel row', 'The final image in one shot', 'The caption of the image', 'The noise that was added'], a: 3, why: 'The network predicts the added noise. Subtracting a scaled copy gives an estimate of the clean image.' },
      { q: 'Why is latent diffusion cheaper than diffusion on pixels?', o: ['It uses fewer denoising steps by default', 'The denoiser works on a grid about 48 times smaller, such as 64 × 64 × 4 instead of 512 × 512 × 3', 'It never needs a text encoder', 'It removes the noise schedule'], a: 1, why: 'A trained autoencoder compresses the image once. Every denoising step then runs on the small grid, and a decoder writes the pixels at the end.' },
      { q: 'What happens as the guidance scale goes from 1 up to 15?', o: ['The picture follows the prompt less and varies more', 'Nothing changes except speed', 'It follows the prompt more closely, varies less, and colors can oversaturate', 'The number of denoising steps drops'], a: 2, why: 'Guidance extrapolates from the empty prompt toward the prompt. That sharpens prompt fit and shrinks variety. It costs two network calls per step.' },
      { q: 'You fix the starting noise and use a sampler with no fresh noise at each step (DDIM style). What do you get on repeated runs?', o: ['The same picture every time', 'A different picture every time', 'Pure noise', 'A blurry average of all pictures'], a: 0, why: 'With no randomness after the start, the path from noise to image is fixed. That is why seeds are repeatable and why image inversion and editing work.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g style="stroke:var(--line);stroke-width:1.5"><rect x="22" y="34" width="76" height="76" rx="8" style="fill:var(--panel)"/><rect x="122" y="34" width="76" height="76" rx="8" style="fill:var(--panel)"/><rect x="222" y="34" width="76" height="76" rx="8" style="fill:var(--panel)"/></g>'
    + '<g style="fill:var(--ink-3)"><circle cx="38" cy="52" r="3" opacity=".7"/><circle cx="62" cy="48" r="2.5" opacity=".5"/><circle cx="82" cy="60" r="3" opacity=".8"/><circle cx="46" cy="76" r="2.5" opacity=".6"/><circle cx="70" cy="84" r="3" opacity=".7"/><circle cx="88" cy="96" r="2.5" opacity=".5"/><circle cx="36" cy="98" r="3" opacity=".6"/><circle cx="58" cy="102" r="2.5" opacity=".8"/></g>'
    + '<path d="M128 100 L158 56 L178 82 L190 70 L194 100 Z" style="fill:var(--mem);opacity:.45"/><g style="fill:var(--ink-3)"><circle cx="140" cy="48" r="2.5" opacity=".6"/><circle cx="172" cy="46" r="3" opacity=".7"/><circle cx="186" cy="88" r="2.5" opacity=".5"/><circle cx="134" cy="76" r="2.5" opacity=".6"/><circle cx="150" cy="104" r="3" opacity=".5"/></g>'
    + '<rect x="224" y="36" width="72" height="72" rx="7" style="fill:var(--mem-soft)"/><path d="M228 106 L258 58 L278 86 L290 74 L294 106 Z" style="fill:var(--mem)"/><circle cx="278" cy="52" r="8" style="fill:var(--warn)"/>'
    + '<g style="stroke:var(--ink-3);stroke-width:2;fill:none;stroke-linecap:round"><path d="M104 72 H116"/><path d="M112 68 L116 72 L112 76"/><path d="M204 72 H216"/><path d="M212 68 L216 72 L212 76"/></g>'
    + '<text x="22" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">noise to picture</text><text x="22" y="132" style="font:600 11px var(--font-mono);fill:var(--ink-3)">patches, words, steps</text></svg>';

  window.LESSONS.push({
    id: 'images', n: 5, track: 'vision', order: 1,
    title: 'Images: How Models See and Draw',
    tagline: 'Patches, CLIP, and diffusion: how a model reads a photo and paints one from noise.',
    preview,
    scenes: S
  });
})();
