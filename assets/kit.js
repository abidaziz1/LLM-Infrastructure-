/* Shared drawing helpers for lessons: seeded random numbers, a tiny pixel picture, charts, grids. */
(function () {
  'use strict';
  const { fmt } = window.LLMI;

  const kit = {
    /* Seeded random numbers so every visit shows the same noise. */
    rng(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    gauss(r) { let u = 0; while (!u) u = r(); const v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp(a, b, t) { return a + (b - a) * t; },
    sup(n) { const S = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }; return String(n).replace(/[-0-9]/g, d => S[d]); },
    /* 1.2 x 10^5 style text with real superscripts. */
    sci(v, d) { if (v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); const m = v / Math.pow(10, e); return (+m.toFixed(d == null ? 1 : d)) + ' × 10' + kit.sup(e); },
    path(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''); },

    /* A small landscape picture, sampled at any n x n size. Returns a flat array of [r, g, b] with values 0 to 255. */
    picture(n) {
      const out = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n, y = (j + 0.5) / n;
        const k = Math.min(1, y / 0.7);
        let c = [kit.lerp(86, 190, k), kit.lerp(156, 218, k), kit.lerp(232, 246, k)];
        if ((x - 0.76) ** 2 + (y - 0.2) ** 2 < 0.011) c = [255, 213, 84];                       /* sun */
        const top = 0.26 + Math.abs(x - 0.3) * 1.53;                                              /* mountain */
        if (y > top && y < 0.72) c = y < 0.4 ? [240, 244, 250] : [112, 126, 152];
        const hill = 0.68 + 0.05 * Math.sin(x * 5.5 + 0.6);                                       /* ground */
        if (y > hill) { const g = (y - hill) / 0.32; c = [kit.lerp(84, 62, g), kit.lerp(168, 130, g), kit.lerp(92, 72, g)]; }
        if (x > 0.6 && x < 0.86 && y > 0.6 && y < 0.82) c = [196, 78, 66];                       /* house walls */
        if (y > 0.5 && y <= 0.6 && x > 0.6 - (y - 0.6) * 0.9 && x < 0.86 + (y - 0.6) * 0.9) c = [118, 62, 54]; /* roof */
        if (x > 0.7 && x < 0.76 && y > 0.7 && y < 0.82) c = [250, 226, 150];                     /* door */
        if (x > 0.1 && x < 0.15 && y > 0.7 && y < 0.88) c = [110, 78, 52];                       /* trunk */
        if ((x - 0.125) ** 2 + (y - 0.64) ** 2 < 0.0085) c = [40, 118, 66];                      /* leaves */
        out.push(c.map(v => Math.round(kit.clamp(v, 0, 255))));
      }
      return out;
    },
    rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; },
    /* Pixel grid as SVG rects. ids: give each rect an id prefix so a scene can recolor it later. */
    pixels(img, n, x0, y0, size, o) {
      o = o || {}; const s = size / n; let out = '';
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i;
        out += '<rect' + (o.id ? ' id="' + o.id + k + '"' : '') + ' x="' + (x0 + i * s).toFixed(2) + '" y="' + (y0 + j * s).toFixed(2) + '" width="' + (s + (o.bleed == null ? 0.35 : o.bleed)).toFixed(2) + '" height="' + (s + (o.bleed == null ? 0.35 : o.bleed)).toFixed(2) + '" style="fill:' + kit.rgb(img[k]) + '"/>';
      }
      return out;
    },

    /* Chart frame. Returns { svg, X, Y, x0, y0, x1, y1 }. Log axes take the min and max as plain values. */
    chart(o) {
      const x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
      const X = v => x0 + ((o.xlog ? Math.log10(v) - Math.log10(o.xmin) : v - o.xmin) / (o.xlog ? Math.log10(o.xmax) - Math.log10(o.xmin) : o.xmax - o.xmin)) * o.w;
      const Y = v => y1 - ((o.ylog ? Math.log10(v) - Math.log10(o.ymin) : v - o.ymin) / (o.ylog ? Math.log10(o.ymax) - Math.log10(o.ymin) : o.ymax - o.ymin)) * o.h;
      let g = '';
      (o.yt || []).forEach(v => { g += '<line class="grid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="xs m mute" x="' + (x0 - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + (o.yf ? o.yf(v) : v) + '</text>'; });
      (o.xt || []).forEach(v => { g += '<line class="grid" y1="' + y0 + '" y2="' + y1 + '" x1="' + X(v).toFixed(1) + '" x2="' + X(v).toFixed(1) + '"/><text class="xs m mute" x="' + X(v).toFixed(1) + '" y="' + (y1 + 16) + '" text-anchor="middle">' + (o.xf ? o.xf(v) : v) + '</text>'; });
      g += '<line class="axis" x1="' + x0 + '" x2="' + x1 + '" y1="' + y1 + '" y2="' + y1 + '"/><line class="axis" x1="' + x0 + '" x2="' + x0 + '" y1="' + y0 + '" y2="' + y1 + '"/>';
      if (o.xlabel) g += '<text class="xs mute" x="' + ((x0 + x1) / 2) + '" y="' + (y1 + 32) + '" text-anchor="middle">' + o.xlabel + '</text>';
      if (o.ylabel) g += '<text class="xs mute" x="' + (x0 - 2) + '" y="' + (y0 - 8) + '">' + o.ylabel + '</text>';
      return { svg: g, X, Y, x0, y0, x1, y1 };
    },
    /* Row of token chips. items are strings. Returns svg text; chip i has id prefix+i. */
    chips(items, x, y, cw, ch, gap, o) {
      o = o || {}; let out = '';
      items.forEach((t, i) => {
        const xx = x + i * (cw + gap);
        out += '<g' + (o.id ? ' id="' + o.id + i + '"' : '') + '><rect class="' + (o.cls || 'box') + '" x="' + xx + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="' + (o.rx == null ? 6 : o.rx) + '"/><text class="xs b" x="' + (xx + cw / 2) + '" y="' + (y + ch / 2 + 4) + '" text-anchor="middle">' + t + '</text></g>';
      });
      return out;
    },
    /* Horizontal bar with a label above and a value at its end. */
    bar(x, y, w, h, frac, cls, label, value) {
      return '<text class="xs b" x="' + x + '" y="' + (y - 5) + '">' + label + '</text>' +
        '<rect class="well" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + Math.min(7, h / 2) + '"/>' +
        '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + Math.max(2, w * kit.clamp(frac, 0, 1)).toFixed(1) + '" height="' + h + '" rx="' + Math.min(7, h / 2) + '"/>' +
        (value != null ? '<text class="xs m b" x="' + (x + w) + '" y="' + (y - 5) + '" text-anchor="end">' + value + '</text>' : '');
    },
    fmt
  };

  window.LLMI.kit = kit;
})();
