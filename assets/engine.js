/* LLM Infrastructure Animated: engine
   One pause-aware clock drives every wait, tween and loop, so Pause, Speed and test fast-forward (?speed=12) work the same everywhere.
   A lesson is { id, n, title, tagline, scenes: [{ id, title, text, hint, takeaway, mount(c) }], quiz }.
   Each scene mounts into a fresh stage through a Ctx (c). Leaving a scene cancels everything it started. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- utils */
  window.LESSONS = window.LESSONS || [];
  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var rint = function (a, b) { return Math.floor(rnd(a, b + 1)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('llmi:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('llmi:' + k, JSON.stringify(v)); } catch (e) { /* storage can be blocked */ } }
  };

  var fmt = {
    n: function (v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); },
    si: function (v, d) {
      d = d == null ? 1 : d; var a = Math.abs(v);
      var t = function (x, s) { return String(+x.toFixed(d)) + s; };
      if (a >= 1e12) return t(v / 1e12, 'T');
      if (a >= 1e9) return t(v / 1e9, 'B');
      if (a >= 1e6) return t(v / 1e6, 'M');
      if (a >= 1e3) return t(v / 1e3, 'K');
      return String(Math.round(v));
    },
    bytes: function (b, d) {
      d = d == null ? 1 : d; var a = Math.abs(b);
      if (a >= 1e12) return (b / 1e12).toFixed(d) + ' TB';
      if (a >= 1e9) return (b / 1e9).toFixed(d) + ' GB';
      if (a >= 1e6) return (b / 1e6).toFixed(d) + ' MB';
      if (a >= 1e3) return (b / 1e3).toFixed(d) + ' KB';
      return Math.round(b) + ' B';
    },
    ms: function (ms, d) {
      if (ms >= 1000) return (ms / 1000).toFixed(d == null ? 1 : Math.min(d, 2)) + ' s';
      if (ms >= 100) return Math.round(ms) + ' ms';
      if (ms >= 10) return ms.toFixed(1) + ' ms';
      return ms.toFixed(2) + ' ms';
    },
    usd: function (v) { if (v >= 100) return '$' + v.toFixed(0); if (v >= 1) return '$' + v.toFixed(2); if (v >= 0.01) return '$' + v.toFixed(2); return '$' + v.toFixed(3); }
  };

  function make(ns, tag, attrs, kids) {
    var el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { if (p.indexOf('--') === 0) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; });
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.append(c.nodeType ? c : document.createTextNode(c));
      });
    })(kids || []);
    return el;
  }
  function h(tag, attrs) { return make(null, tag, attrs, Array.prototype.slice.call(arguments, 2)); }
  function s(tag, attrs) { return make(SVGNS, tag, attrs, Array.prototype.slice.call(arguments, 2)); }

  /* Caption markup: **bold**, `code`, [[glossary term]] or [[term|shown text]]. */
  function md(str) {
    return esc(str)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (m, k, label) { return '<button type="button" class="term" data-k="' + k.trim().toLowerCase() + '">' + (label || k) + '</button>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  var ICONS = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>',
    next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    prev: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    auto: '<path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    star: '<path d="M12 3.4l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>'
  };
  function ico(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  /* SVG arrowheads, one per role color (CSS variables follow the theme). */
  var DEFS = '<defs>' + [['ah-ink', 'var(--ink-3)'], ['ah-data', 'var(--data)'], ['ah-mem', 'var(--mem)'], ['ah-cmp', 'var(--cmp)'], ['ah-ctl', 'var(--ctl)'], ['ah-ok', 'var(--ok)'], ['ah-bad', 'var(--bad)']].map(function (a) {
    return '<marker id="' + a[0] + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M1.2 1.2L8.8 5 1.2 8.8z" style="fill:' + a[1] + '"/></marker>';
  }).join('') + '</defs>';

  /* --------------------------------------------------------------- clock */
  var params = new URLSearchParams(location.search);
  var TEST = Math.max(0.05, parseFloat(params.get('speed')) || 1);
  var FORCE_REDUCE = params.get('reduce') === '1';
  function reduced() { return FORCE_REDUCE || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var CANCEL = { cancelled: true };

  var clock = { now: 0, paused: false, rate: 1, last: 0, timers: [], tweens: [], loops: [] };
  clock.after = function (ms, fn) { var t = { at: clock.now + ms, res: fn, rej: function () {}, ctx: null }; clock.timers.push(t); return t; };
  clock.cancel = function (t) { var i = clock.timers.indexOf(t); if (i >= 0) clock.timers.splice(i, 1); };
  /* Leaving a scene silently drops its pending waits and tweens: their promises never settle, so nothing runs against a dead stage. */
  clock.drop = function (ctx) {
    clock.timers = clock.timers.filter(function (t) { return t.ctx !== ctx; });
    clock.tweens = clock.tweens.filter(function (t) { return t.ctx !== ctx; });
    clock.loops = clock.loops.filter(function (l) { return l.ctx !== ctx; });
  };
  function never() { return new Promise(function () {}); }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!clock.last) { clock.last = ts; return; }
    var raw = clamp(ts - clock.last, 0, 64);
    clock.last = ts;
    if (clock.paused) return;
    var dt = raw * clock.rate * TEST;
    if (dt <= 0) return;
    clock.now += dt;
    var now = clock.now, i;
    if (clock.timers.length) {
      var due = [], keep = [];
      clock.timers.forEach(function (t) { (t.at <= now ? due : keep).push(t); });
      clock.timers = keep;
      due.forEach(function (t) { t.res(); });
    }
    if (clock.tweens.length) {
      var list = clock.tweens, done = [];
      clock.tweens = [];
      list.forEach(function (tw) {
        var p = clamp((now - tw.t0) / tw.ms, 0, 1);
        try { tw.fn(tw.e(p)); } catch (err) { console.error(err); }
        if (p >= 1) done.push(tw); else clock.tweens.push(tw);
      });
      done.forEach(function (tw) { tw.res(); });
    }
    if (clock.loops.length) {
      clock.loops.slice().forEach(function (l) { try { l.fn(dt, now); } catch (err) { console.error(err); } });
    }
  }
  requestAnimationFrame(frame);

  var ease = {
    lin: function (t) { return t; },
    in: function (t) { return t * t * t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    io: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    bounce: function (t) { var n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; }
  };

  /* Element transform state: x, y, s (scale), r (degrees). Works for SVG (transform attr) and HTML (style). */
  var TS = new WeakMap();
  function tstate(el) {
    var o = TS.get(el);
    if (!o) {
      o = { x: 0, y: 0, s: 1, r: 0, svg: el instanceof SVGElement };
      var tr = el.getAttribute && el.getAttribute('transform');
      if (tr) {
        var m = /translate\(\s*(-?[\d.e+-]+)[\s,]+(-?[\d.e+-]+)\s*\)/.exec(tr); if (m) { o.x = +m[1]; o.y = +m[2]; }
        var r = /rotate\(\s*(-?[\d.e+-]+)/.exec(tr); if (r) o.r = +r[1];
        var sc = /scale\(\s*(-?[\d.e+-]+)/.exec(tr); if (sc) o.s = +sc[1];
      }
      TS.set(el, o);
    }
    return o;
  }
  function paint(el, o) {
    if (o.svg) el.setAttribute('transform', 'translate(' + o.x.toFixed(2) + ' ' + o.y.toFixed(2) + ')' + (o.r ? ' rotate(' + o.r.toFixed(2) + ')' : '') + (o.s !== 1 ? ' scale(' + o.s.toFixed(4) + ')' : ''));
    else el.style.transform = 'translate(' + o.x.toFixed(2) + 'px,' + o.y.toFixed(2) + 'px)' + (o.r ? ' rotate(' + o.r.toFixed(2) + 'deg)' : '') + (o.s !== 1 ? ' scale(' + o.s.toFixed(4) + ')' : '');
  }
  function place(el, p) {
    if (!el) return;
    var o = tstate(el);
    if ('x' in p) o.x = p.x; if ('y' in p) o.y = p.y; if ('s' in p) o.s = p.s; if ('r' in p) o.r = p.r;
    if ('x' in p ||  'y' in p || 's' in p || 'r' in p) paint(el, o);
    if ('o' in p) el.style.opacity = p.o;
  }

  /* ------------------------------------------------------------- scene ctx */
  var uid = 0;
  function Ctx(player, def, stage, ctrl) {
    this.player = player; this.def = def; this.stage = stage; this.ctrl = ctrl;
    this.alive = true; this.playing = false; this.finished = false; this.offs = []; this.cleanups = []; this.id = ++uid;
    this.h = h; this.s = s; this.md = md; this.ease = ease; this.fmt = fmt; this.place = place;
    this.lerp = lerp; this.clamp = clamp; this.rnd = rnd; this.rint = rint; this.pick = pick; this.$ = $; this.$$ = $$; this.ico = ico;
  }
  var P = Ctx.prototype;

  /* structure */
  P.fig = function (w, hgt, inner, opts) {
    opts = opts || {};
    var f = h('figure', { class: 'fig' });
    var svg = s('svg', { class: 'sv' + (opts.cls ? ' ' + opts.cls : ''), viewBox: '0 0 ' + w + ' ' + hgt, role: 'img', 'aria-label': opts.label || this.def.alt || this.def.title });
    svg.innerHTML = DEFS + (inner || '');
    f.append(svg);
    f.append(h('figcaption', { class: 'sr', text: opts.label || this.def.alt || this.def.title }));
    (opts.into || this.stage).append(f);
    return { f: f, svg: svg, q: function (sel) { return svg.querySelector(sel); }, qa: function (sel) { return $$(sel, svg); } };
  };
  P.html = function (markup, cls, into) {
    var d = h('div', { class: cls || '' });
    d.innerHTML = markup;
    (into || this.stage).append(d);
    return { el: d, q: function (sel) { return d.querySelector(sel); }, qa: function (sel) { return $$(sel, d); } };
  };
  P.say = function (text) {
    var el = this._say;
    if (!el) { el = this._say = h('p', { class: 'say', 'aria-hidden': 'true' }); this.stage.append(el); }
    el.innerHTML = md(text || '');
  };

  /* time */
  P.wait = function (ms) {
    var self = this;
    if (!self.alive) return never();
    return new Promise(function (res, rej) {
      if (reduced()) return setTimeout(function () { if (self.alive) res(); }, 0);
      clock.timers.push({ at: clock.now + ms, res: res, rej: rej, ctx: self });
    });
  };
  P.tween = function (ms, fn, e) {
    var self = this;
    if (!self.alive) return never();
    return new Promise(function (res, rej) {
      if (reduced() || ms <= 0) { fn(1); return res(); }
      fn(0);
      clock.tweens.push({ t0: clock.now, ms: ms, fn: fn, e: e || ease.io, res: res, rej: rej, ctx: self });
    });
  };
  P.fx = function (el, to, ms, e) {
    var o = tstate(el);
    var from = { x: o.x, y: o.y, s: o.s, r: o.r, o: el.style.opacity === '' ? 1 : +el.style.opacity };
    var keys = Object.keys(to).filter(function (k) { return k in from; });
    return this.tween(ms == null ? 500 : ms, function (p) {
      var patch = {};
      keys.forEach(function (k) { patch[k] = lerp(from[k], to[k], p); });
      place(el, patch);
    }, e);
  };
  P.fxAll = function (els, to, ms, e) { var self = this; return Promise.all(els.map(function (el) { return self.fx(el, to, ms, e); })); };
  P.along = function (el, path, ms, e, off) {
    off = off || { x: 0, y: 0 };
    var L = path.getTotalLength();
    return this.tween(ms, function (p) { var pt = path.getPointAtLength(L * p); place(el, { x: pt.x + off.x, y: pt.y + off.y }); }, e);
  };
  P.draw = function (path, ms, e) {
    var L = path.getTotalLength();
    path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
    return this.tween(ms == null ? 600 : ms, function (p) { path.style.strokeDashoffset = L * (1 - p); }, e).then(function () { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; });
  };
  P.count = function (el, from, to, ms, f) {
    f = f || function (v) { return String(Math.round(v)); };
    return this.tween(ms == null ? 700 : ms, function (p) { el.textContent = f(lerp(from, to, p)); }, ease.out);
  };
  P.type = function (el, text, cps) {
    cps = cps || 38; var ms = text.length / cps * 1000;
    return this.tween(ms, function (p) { el.textContent = text.slice(0, Math.round(text.length * p)); }, ease.lin);
  };
  P.attr = function (el, name, from, to, ms, e) { return this.tween(ms == null ? 500 : ms, function (p) { el.setAttribute(name, lerp(from, to, p)); }, e); };
  P.loop = function (fn) {
    if (reduced()) return function () {};
    var l = { fn: fn, ctx: this };
    clock.loops.push(l);
    return function () { var i = clock.loops.indexOf(l); if (i >= 0) clock.loops.splice(i, 1); };
  };
  P.spawn = function (fn) { return Promise.resolve().then(fn).catch(function (e) { if (e !== CANCEL) console.error(e); }); };
  P.forever = function (fn) {
    if (reduced()) return;
    var self = this;
    this.spawn(function () { return (function iter() { if (!self.alive) return; return self.wait(16).then(fn).then(iter); })(); });
  };
  P.every = function (ms, fn) { var self = this; this.forever(function () { return self.wait(ms).then(fn); }); };
  P.play = function (fn) {
    var self = this; this.playing = true;
    return this.spawn(function () { return Promise.resolve().then(fn).then(function () { if (self.alive) self.finish(); }, function (e) { if (self.alive) self.finish(); throw e; }); });
  };
  P.finish = function () { if (!this.alive || this.finished) return; this.finished = true; this.player.sceneDone(this); };
  P.cleanup = function (fn) { this.cleanups.push(fn); };
  /* Auto-play only: after ms, run fn unless the learner already touched this scene. */
  P.demo = function (ms, fn) {
    var self = this;
    return this.spawn(function () { return self.wait(ms).then(function () { if (self.player.auto && !self.touched) return fn(); }); });
  };
  P.teardown = function () {
    this.alive = false; clock.drop(this);
    this.offs.forEach(function (f) { f(); });
    this.cleanups.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
  };

  /* events */
  P.on = function (el, type, fn, opts) {
    var self = this, gesture = /^(click|input|change|pointerdown|keydown)$/.test(type);
    var w = function (ev) {
      if (!self.alive) return;
      if (gesture && ev.isTrusted) { self.touched = true; self.player.touch(); }
      try { fn(ev); } catch (e) { console.error(e); }
    };
    el.addEventListener(type, w, opts);
    this.offs.push(function () { el.removeEventListener(type, w, opts); });
    return w;
  };

  /* widgets */
  P.row = function (into) { var r = h('div', { class: 'row' }); (into || this.ctrl).append(r); return r; };
  P.note = function (text, into) { var n = h('p', { class: 'note', html: md(text) }); (into || this.ctrl).append(n); return n; };
  P.btn = function (label, fn, o) {
    o = o || {};
    var b = h('button', { type: 'button', class: 'btn' + (o.kind ? ' ' + o.kind : '') + (o.small ? ' sm' : '') }, o.icon ? h('span', { html: ico(o.icon), style: { display: 'inline-flex' } }) : null, label);
    this.on(b, 'click', fn);
    (o.into || this.ctrl).append(b);
    return b;
  };
  P.slider = function (o) {
    var self = this, iid = 'rg' + (++uid), vals = o.values, log = !!o.log;
    var min = vals ? 0 : (o.min == null ? 0 : o.min), max = vals ? vals.length - 1 : (o.max == null ? 100 : o.max), step = vals ? 1 : (log ? 0.001 : (o.step || 1));
    var lo = log ? Math.log(o.min) : min, hi = log ? Math.log(o.max) : max;
    var toVal = function (raw) { raw = +raw; if (vals) return vals[raw]; if (log) { var v = Math.exp(lerp(Math.log(o.min), Math.log(o.max), raw)); return o.round ? Math.round(v) : v; } return raw; };
    var toRaw = function (v) { if (vals) return Math.max(0, vals.indexOf(v)); if (log) return (Math.log(v) - Math.log(o.min)) / (Math.log(o.max) - Math.log(o.min)); return v; };
    var f = o.fmt || String;
    var wrap = h('div', { class: 'ctl' });
    var out = h('output', { for: iid });
    var inp = h('input', { type: 'range', id: iid, min: log ? 0 : min, max: log ? 1 : max, step: step, value: toRaw(o.value == null ? (vals ? vals[0] : min) : o.value) });
    wrap.append(h('label', { class: 'l', for: iid, text: o.label }), out, inp);
    var upd = function () { var raw = +inp.value, a = log ? 0 : min, b = log ? 1 : max; out.textContent = f(toVal(raw)); inp.style.setProperty('--p', ((raw - a) / (b - a) * 100) + '%'); };
    this.on(inp, 'input', function () { upd(); if (o.onInput) o.onInput(toVal(inp.value)); });
    upd();
    (o.into || this.ctrl).append(wrap);
    return { el: wrap, input: inp, get: function () { return toVal(inp.value); }, set: function (v, silent) { inp.value = toRaw(v); upd(); if (!silent && o.onInput) o.onInput(toVal(inp.value)); } };
  };
  P.seg = function (o) {
    var self = this, val = o.value, wrap = h('div', { class: 'segwrap' }), box = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': o.label || 'Options' });
    var btns = o.options.map(function (op) {
      var b = h('button', { type: 'button', role: 'radio', 'data-v': op[0], 'aria-checked': String(op[0] === val), text: op[1] });
      self.on(b, 'click', function () { set(op[0]); if (o.onChange) o.onChange(op[0]); });
      box.append(b); return b;
    });
    function set(v) { val = v; btns.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.v === String(v) || b.dataset.v == v)); }); }
    if (o.label) wrap.append(h('span', { class: 'l', text: o.label }));
    wrap.append(box);
    (o.into || this.ctrl).append(wrap);
    return { el: wrap, get: function () { return val; }, set: set };
  };
  P.text = function (o) {
    var iid = 'tx' + (++uid);
    var wrap = h('div', { class: 'ctl txt' }, h('label', { class: 'l', for: iid, text: o.label }), h('input', { type: 'text', id: iid, value: o.value || '', maxlength: o.max || 80, autocomplete: 'off', spellcheck: 'false' }));
    var inp = wrap.querySelector('input');
    this.on(inp, 'input', function () { if (o.onInput) o.onInput(inp.value); });
    (o.into || this.ctrl).append(wrap);
    return { el: wrap, input: inp, get: function () { return inp.value; }, set: function (v) { inp.value = v; if (o.onInput) o.onInput(v); } };
  };
  P.toggle = function (o) {
    var self = this, on = !!o.value;
    var b = h('button', { type: 'button', class: 'sw', role: 'switch', 'aria-checked': String(on) }, h('i'), h('span', { text: o.label }));
    this.on(b, 'click', function () { on = !on; b.setAttribute('aria-checked', String(on)); if (o.onChange) o.onChange(on); });
    (o.into || this.ctrl).append(b);
    return { el: b, get: function () { return on; }, set: function (v) { on = !!v; b.setAttribute('aria-checked', String(on)); } };
  };
  P.stats = function (specs, into) {
    var grid = h('div', { class: 'stats' }), map = {};
    specs.forEach(function (sp) {
      var b = h('b', { text: sp.value == null ? '' : sp.value }), sub = h('small', { text: sp.sub || '' });
      var el = h('div', { class: 'stat' + (sp.cls ? ' ' + sp.cls : '') }, h('span', { text: sp.label }), b, sub);
      grid.append(el); map[sp.k] = { el: el, b: b, sub: sub };
    });
    (into || this.stage).append(grid);
    return { el: grid, set: function (k, v, sub) { var m = map[k]; if (!m) return; m.b.textContent = v; if (sub != null) m.sub.textContent = sub; }, cls: function (k, c) { var m = map[k]; if (m) m.el.className = 'stat' + (c ? ' ' + c : ''); } };
  };
  P.legend = function (items, into) {
    var l = h('div', { class: 'legend' });
    items.forEach(function (it) { l.append(h('span', null, h('i', { class: it[0] }), it[1])); });
    (into || this.stage).append(l); return l;
  };

  /* ---------------------------------------------------------------- quiz */
  function mountQuiz(c, qs, lesson) {
    var box = h('div', { class: 'qz' });
    c.stage.append(box);
    var i = 0, score = 0, wrong = [];
    function ask() {
      var q = qs[i];
      box.innerHTML = '';
      box.append(h('div', { class: 'qn', text: 'Question ' + (i + 1) + ' of ' + qs.length }), h('h3', { html: md(q.q) }));
      var opts = h('div', { class: 'opts' });
      q.o.forEach(function (txt, k) { opts.append(h('button', { type: 'button', class: 'opt', 'data-k': k }, h('span', { class: 'k', text: 'ABCD'.charAt(k) }), h('span', { html: md(txt) }))); });
      var why = h('div', { class: 'why', hidden: true }), row = h('div', { class: 'row' });
      box.append(opts, why, row);
      $$('.opt', opts).forEach(function (b) {
        c.on(b, 'click', function () {
          var k = +b.dataset.k, ok = k === q.a;
          if (ok) score++; else wrong.push(i);
          $$('.opt', opts).forEach(function (x, j) {
            x.disabled = true;
            var badge = $('.k', x);
            if (j === q.a) { x.classList.add('right'); badge.innerHTML = ico('check'); badge.style.color = 'var(--ok)'; }
            else if (j === k) { x.classList.add('wrong'); badge.innerHTML = ico('x'); badge.style.color = 'var(--bad)'; }
            if (badge.firstChild && badge.firstChild.style) badge.firstChild.style.width = '16px';
          });
          why.hidden = false; why.innerHTML = '<b>' + (ok ? 'Correct.' : 'Not quite.') + '</b> ' + md(q.why);
          var nb = h('button', { type: 'button', class: 'btn pri' }, i + 1 < qs.length ? 'Next question' : 'See result');
          c.on(nb, 'click', function () { i++; if (i < qs.length) ask(); else result(); });
          row.append(nb); nb.focus({ preventScroll: true });
        });
      });
    }
    function result() {
      var best = store.get('q:' + lesson.id, 0);
      if (score > best) store.set('q:' + lesson.id, score);
      store.set('done:' + lesson.id, true);
      var earned = score * 5 >= qs.length * 4;
      if (earned) awardStar(c.player, c.player.idx);
      box.innerHTML = '';
      var msg = score === qs.length ? 'Every answer right. You can explain this lesson to someone else.' : score >= qs.length - 1 ? 'Close to perfect. Review the scene behind the question you missed.' : 'Worth another pass. Use the scene list to jump back to the parts you missed.';
      var res = h('div', { class: 'res' }, h('div', { class: 'qn', text: 'Result' }), h('div', { class: 'score', text: score + ' / ' + qs.length }), h('p', { text: msg }), h('p', { class: 'starline' + (earned ? ' on' : ''), html: ico('star') + '<span>' + (earned ? 'Star earned for this lesson.' : 'Score at least 80% to earn this lesson\u2019s quiz star.') + '</span>' }));
      var row = h('div', { class: 'row' });
      var again = h('button', { type: 'button', class: 'btn' }, 'Try again');
      c.on(again, 'click', function () { i = 0; score = 0; wrong = []; ask(); });
      row.append(again);
      var ord = orderedLessons(), at = ord.indexOf(lesson), nextL = at >= 0 ? ord[at + 1] : null;
      if (nextL) row.append(h('a', { class: 'btn pri', href: '#lesson-' + nextL.n }, 'Next: ' + nextL.title));
      row.append(h('a', { class: 'btn', href: '#' }, 'All lessons'));
      res.append(row); box.append(res);
    }
    ask();
  }


  /* -------------------------------------------------------------- missions */
  /* A scene may declare mission: 'Goal text'. The scene calls c.mission.set(true) when the goal is met.
     The first time that happens during hands-on play, the scene earns a star. Auto-play shows the goal being met but earns nothing. */
  function starKey(L) { return 's:' + L.id; }
  function starTotal(L) { return L.scenes.filter(function (sc) { return sc.mission || sc.quiz; }).length; }
  function starCount(L) { return Math.min(starTotal(L), store.get(starKey(L), []).length); }
  function awardStar(p, idx) {
    var arr = store.get(starKey(p.lesson), []);
    if (arr.indexOf(idx) < 0) { arr.push(idx); store.set(starKey(p.lesson), arr); }
    p.updateStars();
  }
  function makeMission(p, c, d) {
    var m = typeof d.mission === 'string' ? { goal: d.mission } : d.mission;
    var had = store.get(starKey(p.lesson), []).indexOf(p.idx) >= 0;
    var state = h('span', { class: 'sr', text: had ? 'Mission cleared earlier.' : 'Mission not met yet.' });
    var el = h('div', { class: 'mission' + (had ? ' cleared' : ''), role: 'status' },
      h('span', { class: 'mi', html: ico('target') }),
      h('div', { class: 'mt' }, h('b', { text: m.title || 'Mission' }), h('span', { text: m.goal }), state),
      h('span', { class: 'ms', html: ico('star'), title: 'Star' }));
    c.ctrl.append(el);
    var api = {
      el: el, cleared: had, met: false,
      set: function (ok) {
        ok = !!ok;
        if (ok !== api.met) { api.met = ok; el.classList.toggle('met', ok); }
        if (ok && !api.cleared && (c.touched || p.auto)) {
          api.cleared = true; el.classList.add('cleared', 'pulse'); state.textContent = 'Mission cleared. Star earned.';
          setTimeout(function () { el.classList.remove('pulse'); }, 1200);
          if (!p.auto) awardStar(p, p.idx);
        } else if (ok) state.textContent = 'Mission met.';
        else if (!api.cleared) state.textContent = 'Mission not met yet.';
      }
    };
    return api;
  }

  /* -------------------------------------------------------------- player */
  var LESSONS = function () { return (window.LESSONS || []).slice().sort(function (a, b) { return a.n - b.n; }); };
  var player = null;

  function buildPlayer(mount) {
    var root = h('div', { class: 'app', id: 'player', hidden: true });
    root.innerHTML =
      '<header class="topbar"><div class="wrap bar">' +
      '<a class="back" href="#">' + ico('prev') + '<span>All lessons</span></a>' +
      '<div class="ltitle"><span class="lnum" id="pNum"></span><span class="lname" id="pName"></span></div>' +
      '<div class="acts"><span class="starchip" id="pStars" hidden title="Stars earned in this lesson"></span><button type="button" class="ibtn" id="pMenu" aria-label="Scene list and settings" aria-haspopup="dialog">' + ico('list') + '</button></div>' +
      '</div></header>' +
      '<main class="wrap player">' +
      '<nav class="rail" id="pRail" aria-label="Lesson progress"></nav>' +
      '<div class="head"><p class="eyebrow" id="pEye"></p><h1 class="stitle" id="pTitle" tabindex="-1"></h1></div>' +
      '<div class="stage" id="pStage" data-state="playing"></div>' +
      '<p class="shint" id="pHint"></p>' +
      '<div class="ctrl" id="pCtrl"></div>' +
      '<p class="scap" id="pCap" aria-live="polite"></p>' +
      '<p class="stake" id="pTake"></p>' +
      '</main>' +
      '<footer class="dock"><div class="pbar"><i id="pBar"></i></div><div class="wrap dockin">' +
      '<button type="button" class="btn" id="pPrev" aria-label="Previous scene">' + ico('prev') + '<span class="lbl">Back</span></button>' +
      '<div class="mid">' +
      '<button type="button" class="ibtn" id="pPlay" aria-label="Pause">' + ico('pause') + '</button>' +
      '<button type="button" class="ibtn" id="pReplay" aria-label="Replay this scene">' + ico('replay') + '</button>' +
      '<button type="button" class="ibtn" id="pAuto" aria-pressed="false" aria-label="Auto-play the lesson">' + ico('auto') + '</button>' +
      '<button type="button" class="ibtn txt" id="pSpeed" aria-label="Playback speed 1 times">1×</button>' +
      '</div>' +
      '<button type="button" class="btn pri" id="pNext" aria-label="Next scene"><span class="lbl">Next</span>' + ico('next') + '</button>' +
      '</div></footer>';
    mount.append(root);

    var p = {
      root: root, lesson: null, idx: 0, ctx: null, auto: false, autoT: null, popFor: null,
      el: {}, speeds: [1, 0.5, 2], si: 0
    };
    ['pNum', 'pName', 'pStars', 'pRail', 'pEye', 'pTitle', 'pCap', 'pHint', 'pTake', 'pStage', 'pCtrl', 'pBar', 'pPrev', 'pPlay', 'pReplay', 'pAuto', 'pSpeed', 'pNext', 'pMenu'].forEach(function (id) { p.el[id] = $('#' + id, root); });

    p.setPaused = function (v) {
      clock.paused = v; root.classList.toggle('is-paused', v);
      p.el.pPlay.innerHTML = ico(v ? 'play' : 'pause'); p.el.pPlay.setAttribute('aria-label', v ? 'Play' : 'Pause');
    };
    p.touch = function () { if (clock.paused) p.setPaused(false); p.cancelAuto(); };
    p.cancelAuto = function () { if (p.autoT) { clock.cancel(p.autoT); p.autoT = null; } };
    p.setAuto = function (v) {
      p.auto = v; p.el.pAuto.setAttribute('aria-pressed', String(v)); p.el.pAuto.setAttribute('aria-label', v ? 'Auto-play is on' : 'Auto-play the lesson');
      if (!v) p.cancelAuto(); else if (p.ctx && p.ctx.finished) p.armAuto();
      p.syncSheet();
    };
    p.armAuto = function () {
      p.cancelAuto();
      if (!p.auto || !p.lesson) return;
      if (p.idx >= p.lesson.scenes.length - 1) return;
      var d = p.lesson.scenes[p.idx];
      if (d.quiz) return;
      var words = ((d.title || '') + ' ' + (d.text || '') + ' ' + (d.takeaway || '')).split(/\s+/).length;
      var ms = Math.max(4200, 1800 + words * 230) * (d.hint ? 1.5 : 1) * (d.mission ? 1.5 : 1) * (d.slow || 1);
      p.autoT = clock.after(ms, function () { p.autoT = null; if (p.auto) p.next(); });
    };
    p.sceneDone = function (c) {
      p.el.pStage.dataset.state = 'done';
      p.el.pTake.classList.add('show');
      var v = store.get('v:' + p.lesson.id, []);
      if (v.indexOf(p.idx) < 0) { v.push(p.idx); store.set('v:' + p.lesson.id, v); }
      p.markSeen();
      p.armAuto();
    };
    p.updateStars = function () {
      var L = p.lesson; if (!L) return;
      var tot = starTotal(L); p.el.pStars.hidden = !tot;
      if (tot) { var n = starCount(L); p.el.pStars.innerHTML = ico('star') + '<span><b>' + n + '</b>/' + tot + '</span>'; p.el.pStars.classList.toggle('full', n === tot); p.el.pStars.setAttribute('aria-label', n + ' of ' + tot + ' stars earned'); }
    };
    p.next = function () { if (p.idx < p.lesson.scenes.length - 1) p.go(p.idx + 1); };
    p.prev = function () { if (p.idx > 0) p.go(p.idx - 1); };
    p.layerOf = function (d) { return d.layer == null ? null : d.layer; };

    p.open = function (lesson, idx) {
      p.lesson = lesson;
      p.el.pNum.textContent = 'Lesson ' + lesson.n;
      p.el.pName.textContent = lesson.title;
      document.title = lesson.title + ' | LLM Infrastructure Animated';
      p.buildRail(); p.updateStars();
      p.go(clamp(idx || 0, 0, lesson.scenes.length - 1), true);
    };

    p.buildRail = function () {
      var L = p.lesson, rail = p.el.pRail;
      rail.innerHTML = '';
      var items = L.rail ? L.rail.names.map(function (nm, i) { return { label: 'Layer ' + (i + 1) + ': ' + nm, first: L.scenes.findIndex(function (sc) { return sc.layer != null && [].concat(sc.layer).indexOf(i + 1) >= 0; }) }; })
        : L.scenes.map(function (sc, i) { return { label: (i + 1) + '. ' + sc.title, first: i }; });
      items.forEach(function (it, i) {
        var b = h('button', { type: 'button', class: 'tick', 'aria-label': it.label }, h('i'), h('span', { text: it.label.replace(/^Layer (\d+): /, '$1 ') }));
        b.addEventListener('click', function () { if (it.first >= 0) p.go(it.first); });
        rail.append(b);
      });
      p.ticks = $$('.tick', rail); p.tickScene = items.map(function (it) { return it.first; });
    };

    p.markSeen = function () {
      var L = p.lesson, v = store.get('v:' + L.id, []);
      p.ticks.forEach(function (t, i) {
        var f = p.tickScene[i], seen = false;
        if (L.rail) seen = L.scenes.some(function (sc, k) { return v.indexOf(k) >= 0 && sc.layer != null && [].concat(sc.layer).indexOf(i + 1) >= 0; });
        else seen = v.indexOf(f) >= 0;
        t.classList.toggle('seen', seen);
      });
    };

    p.go = function (idx, first) {
      var L = p.lesson, d = L.scenes[idx];
      if (p.ctx) p.ctx.teardown();
      p.cancelAuto();
      p.closePop();
      p.idx = idx;
      var n = L.scenes.length;
      var eye = L.rail && d.layer != null ? (Array.isArray(d.layer) ? 'All 18 layers' : 'Layer ' + d.layer + ' of ' + L.rail.names.length + ' · ' + L.rail.names[d.layer - 1]) : 'Scene ' + (idx + 1) + ' of ' + n + (d.tag ? ' · ' + d.tag : '');
      p.el.pEye.textContent = eye;
      p.el.pTitle.textContent = d.title;
      p.el.pCap.innerHTML = md(d.text || '');
      p.el.pHint.innerHTML = d.hint ? '<b>Try it</b><span>' + md(d.hint) + '</span>' : '';
      p.el.pTake.innerHTML = '';
      p.el.pTake.textContent = '';
      p.el.pTake.classList.remove('show');
      if (d.takeaway) p.el.pTake.innerHTML = md(d.takeaway);
      p.el.pBar.style.width = ((idx + 1) / n * 100) + '%';
      p.el.pPrev.disabled = idx === 0; p.el.pPrev.setAttribute('aria-disabled', String(idx === 0));
      p.el.pNext.disabled = idx === n - 1; p.el.pNext.setAttribute('aria-disabled', String(idx === n - 1));
      var ranges = Array.isArray(d.layer) ? d.layer : (d.layer == null ? [] : [d.layer]);
      p.ticks.forEach(function (t, i) {
        var on = L.rail ? (Array.isArray(d.layer) ? true : ranges.indexOf(i + 1) >= 0) : i === idx;
        t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
      });
      p.markSeen();
      p.el.pStage.innerHTML = ''; p.el.pCtrl.innerHTML = '';
      p.el.pStage.dataset.state = 'playing';
      p.el.pStage.classList.remove('enter'); void p.el.pStage.offsetWidth; p.el.pStage.classList.add('enter');
      var c = new Ctx(p, d, p.el.pStage, p.el.pCtrl);
      p.ctx = c;
      try {
        if (d.mission) c.mission = makeMission(p, c, d);
        if (d.quiz) mountQuiz(c, d.quiz, L);
        else { var r = d.mount(c); if (typeof r === 'function') c.cleanup(r); }
      } catch (err) {
        console.error(err);
        p.el.pStage.append(h('div', { class: 'err', text: 'This scene failed to load: ' + err.message }));
      }
      if (!c.playing) c.finish();
      store.set('last:' + L.id, idx);
      try { history.replaceState(null, '', '#lesson-' + L.n + '-' + (idx + 1)); } catch (e) { /* sandboxed frame */ }
      if (!first) window.scrollTo(0, 0);
    };

    p.replay = function () { p.go(p.idx, true); };

    /* scene list + settings sheet */
    p.syncSheet = function () {
      var sh = $('.sheet', document); if (!sh) return;
      var a = $('[data-opt="auto"]', sh); if (a) a.setAttribute('aria-checked', String(p.auto));
    };
    p.openSheet = function () {
      p.closeSheet();
      var L = p.lesson, v = store.get('v:' + L.id, []), stars = store.get(starKey(L), []);
      var shade = h('div', { class: 'shade', id: 'shade' });
      var list = h('ol');
      L.scenes.forEach(function (sc, i) {
        var won = stars.indexOf(i) >= 0;
        var b = h('button', { type: 'button', 'aria-current': String(i === p.idx) }, h('span', { class: 'n', text: String(i + 1).padStart(2, '0') }), h('span', { text: sc.title }), sc.mission || sc.quiz ? h('span', { class: 'sk' + (won ? ' won' : ''), html: ico(won ? 'star' : 'target'), title: won ? 'Star earned' : 'Mission' }) : v.indexOf(i) >= 0 ? h('span', { class: 'ck', html: ico('check') }) : h('span'));
        b.addEventListener('click', function () { p.closeSheet(); p.go(i); });
        list.append(h('li', null, b));
      });
      var opts = h('div', { class: 'opts' });
      var sw = h('button', { type: 'button', class: 'sw', role: 'switch', 'data-opt': 'auto', 'aria-checked': String(p.auto) }, h('i'), h('span', { text: 'Auto-play: advance scenes on their own' }));
      sw.addEventListener('click', function () { p.setAuto(!p.auto); });
      var th = h('button', { type: 'button', class: 'btn sm' }, 'Theme: ' + (document.documentElement.dataset.theme || 'match system'));
      th.addEventListener('click', function () { var cur = document.documentElement.dataset.theme; var nx = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark'; if (nx) document.documentElement.dataset.theme = nx; else delete document.documentElement.dataset.theme; store.set('theme', nx); th.textContent = 'Theme: ' + (nx || 'match system'); });
      opts.append(sw, th);
      var close = h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Close', html: ico('close') });
      var sheet = h('aside', { class: 'sheet', role: 'dialog', 'aria-label': 'Scenes and settings' }, h('header', null, h('span', { text: 'Scenes' }), close), list, opts);
      close.addEventListener('click', p.closeSheet); shade.addEventListener('click', p.closeSheet);
      root.append(shade, sheet);
      var cur = $('[aria-current="true"]', list); if (cur) cur.scrollIntoView({ block: 'center' });
      close.focus();
    };
    p.closeSheet = function () { $$('.shade, .sheet', root).forEach(function (e) { e.remove(); }); };

    /* glossary popover */
    p.closePop = function () { var o = $('.pop', document); if (o) o.remove(); p.popFor = null; };
    p.showTerm = function (btn) {
      var k = btn.dataset.k, g = (window.GLOSSARY || {})[k];
      if (p.popFor === btn) return p.closePop();
      p.closePop();
      var pop = h('div', { class: 'pop', role: 'tooltip' }, h('b', { text: g ? g.t : k }), g ? g.d : 'No definition yet.');
      document.body.append(pop);
      var r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = clamp(r.left + r.width / 2 - pw / 2, 12, window.innerWidth - pw - 12);
      var top = r.bottom + 8; if (top + ph > window.innerHeight - 90) top = Math.max(12, r.top - ph - 8);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      p.popFor = btn;
    };

    /* wiring */
    p.el.pNext.addEventListener('click', function () { p.cancelAuto(); p.next(); });
    p.el.pPrev.addEventListener('click', function () { p.cancelAuto(); p.prev(); });
    p.el.pPlay.addEventListener('click', function () { p.setPaused(!clock.paused); });
    p.el.pReplay.addEventListener('click', function () { p.replay(); });
    p.el.pAuto.addEventListener('click', function () { p.setAuto(!p.auto); });
    p.el.pSpeed.addEventListener('click', function () {
      p.si = (p.si + 1) % p.speeds.length; clock.rate = p.speeds[p.si];
      p.el.pSpeed.textContent = clock.rate + '×'; p.el.pSpeed.setAttribute('aria-label', 'Playback speed ' + clock.rate + ' times');
    });
    p.el.pMenu.addEventListener('click', p.openSheet);
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('.term');
      if (t) { ev.preventDefault(); p.showTerm(t); } else if (!ev.target.closest('.pop')) p.closePop();
    });
    document.addEventListener('keydown', function (ev) {
      if (root.hidden) return;
      if (ev.key === 'Escape') { p.closePop(); p.closeSheet(); return; }
      var tag = (ev.target.tagName || '').toLowerCase();
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); p.cancelAuto(); p.next(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); p.cancelAuto(); p.prev(); }
      else if ((ev.key === ' ' || ev.key === 'k') && tag !== 'button' && tag !== 'a') { ev.preventDefault(); p.setPaused(!clock.paused); }
      else if (ev.key === 'r' || ev.key === 'R') p.replay();
      else if (ev.key === 'a' || ev.key === 'A') p.setAuto(!p.auto);
      else if (ev.key === 'm' || ev.key === 'M') p.openSheet();
    });
    return p;
  }

  /* ----------------------------------------------------------------- hub */
  var TRACKS = [
    { id: 'start', title: 'Start here', blurb: 'Follow one question from your keyboard down to single electrons and back.' },
    { id: 'agents', title: 'Agents and caching', blurb: 'How a coding agent loops, and why a repeated prompt should be paid for once.' },
    { id: 'inference', title: 'Inference engineering', blurb: 'Why a token takes 30 ms, and every trick that makes serving faster, cheaper and bigger.' },
    { id: 'vision', title: 'Images and video', blurb: 'How models see, draw and film.' },
    { id: 'training', title: 'Training', blurb: 'How huge models are trained, how far scaling goes, and how code models learn from tests.' },
    { id: 'frontier', title: 'Frontier and safety', blurb: 'Thinking without words, aligning goals, and what happened when agents left their sandbox.' }
  ];
  function orderedLessons() {
    var out = [];
    TRACKS.forEach(function (T) {
      LESSONS().filter(function (L) { return (L.track || 'start') === T.id; }).sort(function (a, b) { return (a.order || a.n) - (b.order || b.n); }).forEach(function (L) { out.push(L); });
    });
    LESSONS().forEach(function (L) { if (out.indexOf(L) < 0) out.push(L); });
    return out;
  }
  function renderHub(el) {
    var all = orderedLessons(), totalScenes = 0, totalStars = 0, gotStars = 0;
    function card(L) {
      var v = store.get('v:' + L.id, []), n = L.scenes.length, done = store.get('done:' + L.id, false);
      var pct = Math.round(Math.min(1, v.length / n) * 100);
      var last = store.get('last:' + L.id, 0);
      var href = '#lesson-' + L.n + (v.length && !done && last > 0 ? '-' + (last + 1) : '');
      var label = done ? 'Review lesson' : v.length ? 'Continue' : 'Start lesson';
      var interactive = L.scenes.filter(function (sc) { return sc.hint; }).length;
      var st = starTotal(L), sc = starCount(L);
      totalScenes += n; totalStars += st; gotStars += sc;
      return '<li><a class="card" href="' + href + '"><div class="pv" aria-hidden="true">' + (L.preview || '') + '</div><div class="tx">' +
        '<span class="num">Lesson ' + L.n + '</span><h3>' + esc(L.title) + '</h3><p>' + esc(L.tagline) + '</p>' +
        '<div class="meta"><span>' + n + ' scenes</span><span>' + interactive + ' to try</span><span>about ' + Math.max(5, Math.round(n * 0.65)) + ' min</span>' + (st ? '<span class="stm' + (sc === st ? ' full' : '') + '">' + ico('star') + sc + '/' + st + '</span>' : '') + '</div>' +
        '<div class="prog" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
        '<span class="go">' + label + ico('arrow') + '</span></div></a></li>';
    }
    var sections = TRACKS.map(function (T) {
      var ls = all.filter(function (L) { return (L.track || 'start') === T.id; });
      if (!ls.length) return '';
      return '<section class="track" aria-labelledby="tr-' + T.id + '"><div class="trh"><h2 id="tr-' + T.id + '">' + esc(T.title) + '</h2><p>' + esc(T.blurb) + '</p></div><ul class="cards">' + ls.map(card).join('') + '</ul></section>';
    }).join('');
    var spare = all.filter(function (L) { return !TRACKS.some(function (T) { return T.id === (L.track || 'start'); }); });
    if (spare.length) sections += '<section class="track"><div class="trh"><h2>More lessons</h2></div><ul class="cards">' + spare.map(card).join('') + '</ul></section>';
    var words = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Eleven', 12: 'Twelve', 13: 'Thirteen', 14: 'Fourteen', 15: 'Fifteen', 16: 'Sixteen', 17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen', 20: 'Twenty' };
    el.innerHTML =
      '<div class="wrap hub">' +
      '<p class="eyebrow-s">LLM infrastructure, animated</p>' +
      '<h1>See how AI works, one animation at a time</h1>' +
      '<p class="lede">' + (words[all.length] || all.length) + ' short lessons. Every idea is a moving picture you can slow down, replay and poke with a slider or a button. Clear missions to earn stars. No background needed.</p>' +
      '<p class="tally"><span>' + all.length + ' lessons</span><span>' + totalScenes + ' scenes</span><span class="stm' + (gotStars && gotStars === totalStars ? ' full' : '') + '">' + ico('star') + gotStars + ' of ' + totalStars + ' stars</span></p>' +
      sections +
      '<div class="howto">' +
      '<div><b>Two ways to learn</b>Press <kbd>Next</kbd> and explore each scene yourself, or switch on auto-play and let a lesson play through on its own.</div>' +
      '<div><b>Look for “Try it”</b>Scenes with a Try it box have a control that changes the picture. Change one thing and watch what moves.</div>' +
      '<div><b>Missions and stars</b>Some scenes set a goal, such as getting a number under a target. Meet it yourself to earn a star. Each quiz scored 80% or better earns one too.</div>' +
      '<div><b>Tap underlined words</b>Dotted underlines open a one-line definition. Keys: <kbd>←</kbd> <kbd>→</kbd> move, <kbd>Space</kbd> pauses, <kbd>R</kbd> replays.</div>' +
      '</div></div>';
  }

  /* -------------------------------------------------------------- routing */
  var hubEl, playerMount;
  function route() {
    var m = /^#lesson-(\d+)(?:-(\d+))?$/.exec(location.hash);
    var L = m && LESSONS().filter(function (l) { return l.n === +m[1]; })[0];
    if (L) {
      hubEl.hidden = true;
      if (!player) player = buildPlayer(playerMount);
      player.root.hidden = false;
      var idx = m[2] ? +m[2] - 1 : 0;
      if (player.lesson !== L || (m[2] && player.idx !== idx)) { if (clock.paused) player.setPaused(false); player.open(L, idx); }
      var t = $('#pTitle'); if (t) t.focus({ preventScroll: true });
    } else {
      if (player) { if (player.ctx) player.ctx.teardown(); player.ctx = null; player.lesson = null; player.root.hidden = true; player.closePop(); player.closeSheet(); }
      hubEl.hidden = false; renderHub(hubEl);
      document.title = 'LLM Infrastructure Animated';
    }
  }

  function boot() {
    hubEl = $('#hub'); playerMount = $('#playerMount');
    var th = store.get('theme', ''); if (th) document.documentElement.dataset.theme = th;
    var t = params.get('theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', function () { if (player && player.lesson) store.set('last:' + player.lesson.id, player.idx); });
    document.addEventListener('visibilitychange', function () { if (player && player.lesson) store.set('last:' + player.lesson.id, player.idx); });
    route();
  }

  var errors = [];
  window.addEventListener('error', function (e) { errors.push(String(e.message)); });
  window.addEventListener('unhandledrejection', function (e) { errors.push(String(e.reason && e.reason.message || e.reason)); });

  window.LLMI = { starCount: starCount, starTotal: starTotal, orderedLessons: orderedLessons, clock: clock, ease: ease, fmt: fmt, h: h, s: s, md: md, ico: ico, $: $, $$: $$, esc: esc, errors: errors, store: store, place: place,
    get player() { return player; }, route: route,
    goto: function (n, i) { location.hash = '#lesson-' + n + '-' + ((i || 0) + 1); route(); },
    state: function () { return { lesson: player && player.lesson && player.lesson.n, idx: player && player.idx, done: player && player.ctx && player.ctx.finished, stage: player && player.el.pStage.dataset.state }; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
