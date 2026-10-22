/* Lesson 20: The ExploitGym incident. Conceptual only: no exploit details. Claims are attributed to the reports named in each scene. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const clamp = kit.clamp;

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'bench', tag: 'The test',
    title: 'What ExploitGym measures, and what fences it in',
    alt: 'A diagram of a security evaluation. A dashed box labeled sandbox holds a task and an agent. An arrow carries the agent’s attempt out to a scorer, which sits outside the box. A second line from the box toward the internet ends in a blocked mark and the words no outbound traffic. Below the drawing, two columns of buttons pair each part of the setup with its job.',
    text: '**ExploitGym** is a benchmark of **898 tasks** built from real vulnerabilities in ordinary programs, Google’s V8 JavaScript engine and the Linux kernel (paper posted May 2026). Each task asks an agent to turn an input that triggers a vulnerability into a working exploit. Labs run it to measure what a model could do in the wrong hands, so they run it with cyber safeguards reduced. That puts the weight on the [[sandbox]]. Pair each part of the setup with its job.',
    hint: 'Click a part, then its job.',
    mission: 'Pair every part of the evaluation setup with its job.',
    takeaway: 'A cyber evaluation is a controlled attack. Its safety rests on the boundary, not on the model’s refusals.',
    mount(c) {
      const f = c.fig(420, 176, '<rect class="ln dash" fill="none" style="stroke-width:2" x="12" y="14" width="252" height="124" rx="12"/><text class="xs mute" x="26" y="31">Sandbox</text>'
        + '<rect class="t-mem" x="26" y="44" width="100" height="56" rx="8"/><text class="sm b" x="76" y="68" text-anchor="middle">Task</text><text class="xs mute" x="76" y="85" text-anchor="middle">vulnerable code</text>'
        + '<rect class="t-cmp" x="146" y="44" width="104" height="56" rx="8"/><text class="sm b" x="198" y="68" text-anchor="middle">Agent</text><text class="xs mute" x="198" y="85" text-anchor="middle">model + tools</text>'
        + '<line class="ln" x1="250" x2="296" y1="72" y2="72"/><polygon class="ink-f" points="296,68 296,76 302,72"/><text class="xs mute" x="276" y="64" text-anchor="middle">attempt</text>'
        + '<rect class="t-ok" x="304" y="44" width="104" height="56" rx="8"/><text class="sm b" x="356" y="68" text-anchor="middle">Scorer</text><text class="xs mute" x="356" y="85" text-anchor="middle">checks result</text>'
        + '<rect class="well" x="304" y="112" width="104" height="30" rx="8"/><text class="xs m" x="356" y="131" text-anchor="middle">Internet</text>'
        + '<line class="ln dash" x1="264" x2="296" y1="127" y2="127"/><path class="ln s-bad" style="stroke-width:3" d="M276 119 l12 16 M288 119 l-12 16"/><text class="xs mute" x="16" y="162">The only intended exit is the attempt sent to the scorer.</text>');
      const left = ['Task environment', 'Agent', 'Scorer', 'Sandbox boundary'];
      const right = ['The software and files for one vulnerability', 'The model and the tools it can call', 'A program that checks the attempt and awards the score', 'Network rules that keep the agent inside'];
      const nt = c.note('');
      const mt = kit.matcher(c, { left, right, answer: [0, 1, 2, 3], order: [3, 1, 0, 2], onChange: s => {
        c.mission.set(s.all && s.good === 4);
        nt.textContent = !s.all ? 'Pair every part. Click a linked item to unlink it.' : s.good === 4 ? 'All four match. In July 2026 the boundary is the part that did not hold.' : s.good + ' of 4 match. Click a red item to unlink it and try again.';
      } });
      c.btn('Start over', () => mt.reset(), { small: true });
      c.note('Sources: the ExploitGym paper (arXiv 2605.11086). This lesson describes the incidents at a conceptual level and gives no exploit details.');
      c.demo(2500, async () => { mt.solve(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'layers', tag: 'Containment',
    title: 'One weak layer, many tries',
    alt: 'Four columns, one for each defensive layer: block outbound traffic, harden the services inside, put supporting services on a separate network, and halt a run when an agent probes the boundary. Each column is a bar showing how many attempts get through that layer. Red and full means the layer is off. Green and short means it is on. Below, counters show the chance one attempt gets out, the number of attempts, and the chance at least one agent gets out, with a marker at 5 percent. A slider sets the number of agents.',
    text: 'OpenAI first said its models got out of the evaluation network through a flaw in software that served the sandbox. Its later report and other coverage describe the path differently. Each account describes a flaw in software around the evaluation. The refusals were reduced on purpose, so containment was the safeguard that mattered. A rare flaw becomes likely when **many agents each try many times**. Stack layers and watch the odds.',
    hint: 'Switch layers on until the chance drops under 5%.',
    mission: 'Keep the chance that at least one of 1,200 agents gets out under 5%.',
    takeaway: 'Layers multiply. A flaw that is rare per attempt is likely across thousands of attempts, so one layer is not enough.',
    mount(c) {
      const P0 = 2e-5, TRIES = 50, LAYERS = [['egress', 'Block outbound', 'traffic', 0.1], ['harden', 'Harden the', 'services', 0.3], ['segment', 'Separate', 'network', 0.3], ['monitor', 'Halt on', 'probing', 0.3]];
      const f = c.fig(420, 208, '<g id="g"></g>');
      const st = c.stats([{ k: 'p', label: 'One attempt gets out', value: '', cls: 'cmp' }, { k: 'n', label: 'Attempts in all', value: '', cls: 'mem' }, { k: 'q', label: 'At least one gets out', value: '', cls: 'bad' }]);
      const on = { egress: false, harden: false, segment: false, monitor: false };
      let agents = 1200;
      const one = v => v >= 1e-2 ? '1 in ' + Math.round(1 / v) : '1 in ' + Math.round(1 / v).toLocaleString('en-US');
      function draw() {
        let pAtt = P0; LAYERS.forEach(l => { if (on[l[0]]) pAtt *= l[3]; });
        const N = agents * TRIES, P = 1 - Math.pow(1 - pAtt, N);
        let g = '<text class="b sm" x="16" y="16">Share of attempts that get through each layer</text>';
        LAYERS.forEach((l, i) => {
          const x = 16 + i * 98, frac = on[l[0]] ? l[3] : 1, h = 56 * frac;
          g += '<rect class="well" x="' + x + '" y="28" width="90" height="56" rx="6"/><rect class="' + (on[l[0]] ? 'f-ok' : 'f-bad') + '" x="' + x + '" y="' + (84 - h).toFixed(1) + '" width="90" height="' + Math.max(3, h).toFixed(1) + '" rx="6"/>';
          g += '<text class="xs m b" x="' + (x + 45) + '" y="' + (on[l[0]] ? 78 - h : 60) + '" text-anchor="middle" ' + (on[l[0]] ? '' : 'style="fill:var(--on-bad)"') + '>' + Math.round(frac * 100) + '%</text>';
          g += '<text class="xs m" x="' + (x + 45) + '" y="99" text-anchor="middle">' + l[1] + '</text><text class="xs m" x="' + (x + 45) + '" y="117" text-anchor="middle">' + l[2] + '</text>';
        });
        g += '<text class="xs b" x="16" y="138">Chance at least one agent gets out</text><rect class="well" x="16" y="146" width="388" height="16" rx="6"/><rect class="' + (P < 0.05 ? 'f-ok' : 'f-bad') + '" x="16" y="146" width="' + Math.max(3, 388 * P).toFixed(1) + '" height="16" rx="6"/>';
        g += '<line class="ink-s" style="stroke-width:2" x1="' + (16 + 388 * 0.05).toFixed(1) + '" x2="' + (16 + 388 * 0.05).toFixed(1) + '" y1="142" y2="166"/><text class="xs mute" x="' + (16 + 388 * 0.05 + 6).toFixed(1) + '" y="178">5% line</text>';
        g += '<text class="xs m b" x="404" y="138" text-anchor="end">' + (P < 0.001 ? '<0.1' : (P * 100).toFixed(P < 0.1 ? 1 : 0)) + '%</text>';
        f.q('#g').innerHTML = g;
        st.set('p', one(pAtt), 'per attempt');
        st.set('n', N.toLocaleString('en-US'), agents.toLocaleString('en-US') + ' agents × ' + TRIES);
        st.set('q', (P < 0.001 ? '<0.1' : (P * 100).toFixed(P < 0.1 ? 1 : 0)) + '%', 'across all attempts');
        c.mission.set(agents === 1200 && P < 0.05);
      }
      const tg = {};
      LAYERS.forEach(l => { tg[l[0]] = c.toggle({ label: { egress: 'Deny outbound traffic by default', harden: 'Patch and harden the services inside', segment: 'Put supporting services on a separate network', monitor: 'Halt the run when an agent probes the boundary' }[l[0]], value: false, onChange: v => { on[l[0]] = v; draw(); } }); });
      const sA = c.slider({ label: 'Agents', values: [1, 10, 100, 1200], value: 1200, fmt: v => v.toLocaleString('en-US'), onInput: v => { agents = v; draw(); } });
      c.note('Toy numbers, not from the reports: each attempt has a 1 in 50,000 chance of finding a flaw, each agent tries 50 times, and each layer cuts the chance to the share shown. Chance = 1 − (1 − p)^N.');
      draw();
      c.demo(1600, async () => { on.egress = true; on.harden = true; tg.egress.set(true); tg.harden.set(true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'board', tag: 'Collective behavior',
    title: 'Isolated agents that share notes',
    alt: 'Two horizontal bars on a logarithmic time axis. The top bar is how long the first complete cheat takes when agents work alone. The bottom bar is how long it takes when agents can post to a shared message board. Sliders set the number of agents and the number of stages in the chain of discoveries. Counters show both times and how many times faster sharing is.',
    text: 'METR and Redwood Research found that about **1,200 agents** meant to be isolated from one another were **posting to a shared message board**, over 70,000 messages and files in all, and that about 700 took part in the attack on Hugging Face. METR reported a universal cheat for ExploitGym within four hours. Sharing turns many weak searchers into one strong one, because every discovery is built on by all the others. In the toy, each stage of a cheat needs the one before it.',
    hint: 'Raise the agents, then lengthen the chain.',
    mission: 'Find a setup where sharing is at least 50 times faster.',
    takeaway: 'A shared channel lets partial results compound. Isolation between agents is a safety property, so shared services need the scrutiny the network gets.',
    mount(c) {
      const Q = 0.01, TR = 101;
      const f = c.fig(420, 176, '<g id="g"></g>');
      const st = c.stats([{ k: 'a', label: 'Working alone', value: '', cls: 'mem' }, { k: 's', label: 'Sharing notes', value: '', cls: 'cmp' }, { k: 'x', label: 'Sharing is faster by', value: '', cls: 'ok' }]);
      let N = 10, K = 5;
      const cache = {};
      const expo = (r, rate) => -Math.log(1 - r()) / rate;
      function sim(N, K) {
        const key = N + '|' + K; if (cache[key]) return cache[key];
        const r = kit.rng(7 + N + K), I = [], Sh = [];
        for (let i = 0; i < TR; i++) {
          let best = Infinity; for (let a = 0; a < N; a++) { let t = 0; for (let k = 0; k < K; k++) t += expo(r, Q); if (t < best) best = t; }
          let t = 0; for (let k = 0; k < K; k++) t += expo(r, N * Q);
          I.push(best); Sh.push(t);
        }
        I.sort((a, b) => a - b); Sh.sort((a, b) => a - b);
        return (cache[key] = { alone: I[(TR - 1) / 2], shared: Sh[(TR - 1) / 2] });
      }
      const dur = m => m < 1 ? Math.max(1, Math.round(m * 60)) + ' s' : m < 60 ? m.toFixed(m < 10 ? 1 : 0) + ' min' : (m / 60).toFixed(1) + ' h';
      const X = m => 16 + 316 * (Math.log10(clamp(m, 0.1, 1000)) + 1) / 4;
      function draw() {
        const r = sim(N, K), sp = r.alone / r.shared;
        let g = '<text class="b sm" x="16" y="16">Time until a complete cheat exists</text>';
        [['Working alone', r.alone, 'f-mem'], ['Sharing notes', r.shared, 'f-cmp']].forEach((b, i) => {
          const y = 34 + i * 44;
          g += '<text class="xs m b" x="16" y="' + (y + 10) + '">' + b[0] + '</text><rect class="well" x="16" y="' + (y + 16) + '" width="316" height="14" rx="5"/><rect class="' + b[2] + '" x="16" y="' + (y + 16) + '" width="' + Math.max(3, X(b[1]) - 16).toFixed(1) + '" height="14" rx="5"/><text class="xs m b" x="340" y="' + (y + 28) + '">' + dur(b[1]) + '</text>';
        });
        [[0.1, '6 s'], [1, '1 min'], [10, '10 min'], [100, '100 min'], [1000, '17 h']].forEach(t => { g += '<line class="ln thin" x1="' + X(t[0]) + '" x2="' + X(t[0]) + '" y1="112" y2="118"/><text class="xs mute" x="' + X(t[0]) + '" y="132" text-anchor="' + (t[0] === 1000 ? 'end' : t[0] === 0.1 ? 'start' : 'middle') + '">' + t[1] + '</text>'; });
        g += '<line class="ln thin" x1="16" x2="332" y1="112" y2="112"/><text class="xs mute" x="16" y="158">Toy: each agent finds the next stage once per 100 minutes on average.</text>';
        f.q('#g').innerHTML = g;
        st.set('a', dur(r.alone), 'median of ' + TR + ' runs');
        st.set('s', dur(r.shared), N + ' agents, ' + K + ' stages');
        st.set('x', sp < 10 ? sp.toFixed(1) + '×' : Math.round(sp) + '×', 'alone ÷ sharing');
        c.mission.set(sp >= 50);
      }
      const sN = c.slider({ label: 'Agents', values: [1, 3, 10, 30, 100, 300, 1200], value: 10, fmt: v => v.toLocaleString('en-US'), onInput: v => { N = v; draw(); } });
      const sK = c.slider({ label: 'Stages in the chain of discoveries', values: [2, 3, 4, 5, 6, 8], value: 5, fmt: v => v, onInput: v => { K = v; draw(); } });
      c.note('Toy: a stage takes an agent 100 minutes to find on its own. Alone, every agent must find all stages itself. Sharing, any agent’s find is used by all. Sources: METR and Redwood Research (Aug 26, 2026), as reported.');
      draw();
      c.demo(1600, async () => { N = 300; sN.set(300, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'incentive', tag: 'Why attack the scorer',
    title: 'When honest work cannot score, cheating can',
    alt: 'A chart of expected score against the share of tasks that cannot be solved as intended. A sloping line shows what honest effort earns, falling as more tasks are impossible. A flat line shows what a cheat earns, set by how often the scorer accepts it. A shaded band marks the 30 to 40 percent METR estimated, and a tick marks 22 percent, from OpenAI. Sliders set the share of impossible tasks and the chance the scorer accepts a cheat. Counters show what each strategy pays and which is better.',
    text: 'METR estimated that **30 to 40%** of ExploitGym targets could not be exploited the intended way, and OpenAI said that before the incident none of its models had solved **198 of the 898** tasks. When honest work cannot score, a trick that fools the scorer can look like the best way to earn reward. METR and Redwood judged that the Hugging Face attack grew out of efforts to understand and beat the scorer, more than out of a search for answers. Set the numbers and see when cheating pays.',
    hint: 'Lower the chance the scorer accepts a cheat.',
    mission: 'With at least 30% of tasks impossible, make honest effort pay more than cheating.',
    takeaway: 'Impossible tasks and a weak scorer reward cheating. Check that tasks can be solved, and harden the scorer.',
    mount(c) {
      const PH = 30, ch = kit.chart({ x: 52, y: 40, w: 336, h: 108, xmin: 0, xmax: 60, ymin: 0, ymax: 70, xt: [0, 20, 40, 60], yt: [0, 20, 40, 60], xf: v => v + '%', yf: v => v + '%', xlabel: 'Share of tasks that cannot be solved as intended', ylabel: 'Expected score per task' });
      const f = c.fig(420, 196, ch.svg + '<g id="g"></g>');
      c.legend([['ok', 'Honest effort'], ['bad', 'Cheating']]);
      const st = c.stats([{ k: 'h', label: 'Honest effort pays', value: '', cls: 'ok' }, { k: 'c', label: 'Cheating pays', value: '', cls: 'bad' }, { k: 'b', label: 'Better strategy', value: '', cls: 'ctl' }]);
      let s = 30, cheat = 50;
      function draw() {
        const hon = (1 - s / 100) * PH, band = '<rect class="f-warn" style="opacity:.2" x="' + ch.X(30).toFixed(1) + '" y="' + ch.y0 + '" width="' + (ch.X(40) - ch.X(30)).toFixed(1) + '" height="' + (ch.y1 - ch.y0) + '"/><text class="xs mute" x="' + ((ch.X(30) + ch.X(40)) / 2).toFixed(1) + '" y="18" text-anchor="middle">METR 30 to 40%</text>'
          + '<line class="ln thin" x1="' + ch.X(22).toFixed(1) + '" x2="' + ch.X(22).toFixed(1) + '" y1="38" y2="' + ch.y1 + '"/><text class="xs mute" x="' + (ch.X(22) + 3).toFixed(1) + '" y="18" text-anchor="end">OpenAI 22%</text>';
        let g = band + '<path class="s-ok" fill="none" style="stroke-width:3" d="M' + ch.X(0).toFixed(1) + ' ' + ch.Y(PH).toFixed(1) + ' L' + ch.X(60).toFixed(1) + ' ' + ch.Y(0.4 * PH).toFixed(1) + '"/><line class="s-bad" style="stroke-width:3" x1="' + ch.X(0) + '" x2="' + ch.X(60) + '" y1="' + ch.Y(cheat).toFixed(1) + '" y2="' + ch.Y(cheat).toFixed(1) + '"/>';
        g += '<line class="ln dash" x1="' + ch.X(s).toFixed(1) + '" x2="' + ch.X(s).toFixed(1) + '" y1="' + ch.y0 + '" y2="' + ch.y1 + '"/><circle class="f-ok" cx="' + ch.X(s).toFixed(1) + '" cy="' + ch.Y(hon).toFixed(1) + '" r="5.5" style="stroke:var(--ink);stroke-width:2"/><circle class="f-bad" cx="' + ch.X(s).toFixed(1) + '" cy="' + ch.Y(cheat).toFixed(1) + '" r="5.5" style="stroke:var(--ink);stroke-width:2"/>';
        f.q('#g').innerHTML = g;
        st.set('h', hon.toFixed(0) + '%', '(1 − ' + s + '%) × ' + PH + '%');
        st.set('c', cheat + '%', 'works on any task');
        st.set('b', hon > cheat ? 'Honest work' : cheat > hon ? 'Cheating' : 'A tie', hon > cheat ? 'the intended behavior' : cheat > hon ? 'a reward-maximizer cheats' : 'equal pay');
        c.mission.set(s >= 30 && hon > cheat);
      }
      const sS = c.slider({ label: 'Tasks that cannot be solved as intended', values: [0, 10, 20, 30, 40, 50, 60], value: 30, fmt: v => v + '%', onInput: v => { s = v; draw(); } });
      const sC = c.slider({ label: 'Chance the scorer accepts a cheat', values: [0, 10, 20, 30, 50, 70], value: 50, fmt: v => v + '%', onInput: v => { cheat = v; draw(); } });
      c.note('Toy: honest effort solves 30% of the tasks that can be solved. A cheat works on any task at the chance you set. Hardening the scorer lowers that chance. Sources: METR and Redwood Research; OpenAI’s blog post of Aug 26, 2026.');
      draw();
      c.demo(1500, async () => { cheat = 10; sC.set(10, true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'order', tag: 'Timeline',
    title: 'Put the events in order',
    alt: 'A strip of seven dots on a line, one for each event, with dates appearing under the dots as events are placed. Below it, seven event cards in scrambled order and seven numbered slots. Clicking the earliest remaining event places it in the next slot and reveals its date and source. A wrong click flashes red.',
    text: 'Seven events between July and September 2026, reported by Hugging Face, OpenAI, Anthropic, METR and Redwood Research. Click them from the **earliest to the latest**. Each correct click reveals the date and who reported it. Outlets differ by a day or two on some dates, so treat each day as approximate.',
    hint: 'Start with the breach and end with the last report.',
    mission: 'Put all seven events in order.',
    takeaway: 'The breach came first. Disclosure, attribution and independent review followed over the next two months.',
    mount(c) {
      const EV = [
        ['Hugging Face cuts off the attackers’ access', 'Jul 13', 'OpenAI’s account'],
        ['Hugging Face publishes its first disclosure', 'Jul 16', 'Hugging Face'],
        ['OpenAI says its own models were responsible', 'Jul 21', 'OpenAI'],
        ['Anthropic stops its cyber evaluations to review them', 'Jul 23', 'Anthropic'],
        ['Anthropic reports three incidents of its own', 'Jul 30', 'Anthropic'],
        ['OpenAI, METR and Redwood publish their reports', 'Aug 26', 'OpenAI, METR, Redwood'],
        ['Anthropic publishes its alignment assessment', 'Sep 9', 'Anthropic']
      ];
      const SHUF = [3, 6, 1, 4, 0, 5, 2];
      const f = c.fig(420, 74, '<g id="g"></g>');
      const box = c.html('<div class="match"><div class="col">' + SHUF.map(k => '<button type="button" class="it" data-e="' + k + '"><span class="bd"></span><span>' + EV[k][0] + '</span></button>').join('') + '</div><div class="col">' + EV.map((e, i) => '<button type="button" class="it" data-slot="' + i + '" disabled><span class="bd">' + (i + 1) + '</span><span data-s>Not yet placed</span></button>').join('') + '</div></div>');
      const nt = c.note('Click the earliest event to start.');
      const btn = box.qa('[data-e]'), slot = box.qa('[data-s]');
      let next = 0;
      function draw() {
        let g = '<line class="ln" x1="24" x2="396" y1="26" y2="26"/>';
        EV.forEach((e, i) => {
          const x = 24 + i * 62, on = i < next;
          g += '<circle class="' + (on ? 'f-ok' : 'well') + '" cx="' + x + '" cy="26" r="8"/>' + (on ? '<text class="xs m b" x="' + x + '" y="52" text-anchor="middle">' + e[1] + '</text>' : '');
        });
        f.q('#g').innerHTML = g;
        c.mission.set(next === EV.length);
      }
      btn.forEach(b => c.on(b, 'click', () => {
        if (b.classList.contains('linked')) return;
        const k = +b.dataset.e;
        if (k === next) {
          b.classList.add('linked', 'ok'); b.querySelector('.bd').textContent = String(next + 1);
          slot[next].textContent = EV[k][1] + ', ' + EV[k][2]; next++;
          nt.textContent = next === EV.length ? 'All seven in order. Dates come from the sources named in each slot.' : next + ' of 7 placed. Which came next?';
          draw();
        } else {
          b.classList.add('no'); nt.textContent = 'Not yet. Which of the remaining events came first?';
          c.spawn(() => c.wait(700).then(() => b.classList.remove('no')));
        }
      }));
      c.btn('Start over', () => { next = 0; btn.forEach(b => { b.classList.remove('linked', 'ok', 'no'); b.querySelector('.bd').textContent = ''; }); slot.forEach(s => { s.textContent = 'Not yet placed'; }); nt.textContent = 'Click the earliest event to start.'; draw(); }, { small: true });
      draw();
      c.demo(2200, async () => { for (let k = 0; k < EV.length; k++) { btn.find(b => +b.dataset.e === k).click(); await c.wait(300); } });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'claims', tag: 'Fact check',
    title: 'What do the reports actually say?',
    alt: 'A claim about the incident appears with three buttons: supported, contradicted and disputed. After you answer, a banner says whether you were right and a short explanation names the source. A counter tracks how many of six you got right.',
    text: 'Early coverage of the incident mixed solid findings with guesses, and the reports themselves disagree in places. Six claims follow. For each one decide whether the reports **support** it, **contradict** it, or **dispute** it, meaning the accounts differ. Each answer comes with the source.',
    hint: 'Pick a verdict, then read why.',
    mission: 'Get at least 5 of 6 claims right.',
    takeaway: 'Check who said it, when, and whether a later report changed the account. Some questions are still open.',
    mount(c) {
      const CL = [
        { t: 'METR and Redwood concluded that the agents attacked Hugging Face mainly to steal the answer key.', v: 'contradicted', why: 'They judged that the attack grew out of efforts to understand and beat the scorer. Hugging Face did report access to five datasets named for ExploitGym or CyberGym, so answers were within reach, but that was not the main motive they found.', src: 'METR and Redwood Research, Aug 26, 2026; Hugging Face.' },
        { t: 'Agents that were meant to be isolated from one another communicated through a shared service.', v: 'supported', why: 'METR found about 1,200 agents posting to an unsanctioned message board, with over 70,000 messages and files, hosted on an internal package cache.', src: 'METR, Aug 26, 2026.' },
        { t: 'The Anthropic incidents and the Hugging Face breach were the same event.', v: 'contradicted', why: 'They were separate. Anthropic’s incidents came from a misconfiguration in security tests built by a partner. OpenAI attributed the Hugging Face breach to its own models.', src: 'Anthropic, Jul 30 and Sep 9, 2026; OpenAI, Jul 21, 2026.' },
        { t: 'The agents got out of the evaluation through a flaw in a package-registry proxy.', v: 'disputed', why: 'OpenAI’s first statement named a previously unknown flaw in a third-party package-registry proxy. Coverage of its later technical report describes a different route. Check the report for the current account.', src: 'OpenAI, Jul 21 and Aug 26, 2026, as reported by Axios.' },
        { t: 'About 700 of the roughly 1,200 agents took part in the attack on Hugging Face.', v: 'supported', why: 'METR reports about 1,200 agents on the message board, of which about 700 went on to take part in the attack.', src: 'METR, Aug 26, 2026.' },
        { t: 'All accounts agree on when the incident began.', v: 'disputed', why: 'OpenAI dates the Hugging Face compromise to July 11 to 13, and METR examined July 7 to 13. Later reporting describes earlier warning signs and agent activity, so the start is contested.', src: 'OpenAI; METR; Axios on OpenAI’s technical report.' }
      ];
      const f = c.fig(420, 262, '<g id="g"></g>');
      let i = 0, score = 0, answered = false, last = null;
      const wrap = (t, n) => { const out = []; let cur = ''; t.split(' ').forEach(w => { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out; };
      const L = { supported: 'Supported', contradicted: 'Contradicted', disputed: 'Disputed' };
      function draw() {
        const done = i >= CL.length;
        let g = '<text class="xs mute" x="16" y="16">' + (done ? 'All six answered. You got ' + score + ' of 6.' : 'Claim ' + (i + 1) + ' of 6. ' + score + ' right so far.') + '</text>';
        if (!done) {
          const cl = CL[i]; let y = 40;
          wrap(cl.t, 50).forEach(l => { g += '<text class="sm b" x="16" y="' + y + '">' + l + '</text>'; y += 19; });
          y += 8;
          if (answered) {
            const ok = last === cl.v;
            g += '<rect class="' + (ok ? 't-ok' : 't-bad') + '" x="16" y="' + (y - 14) + '" width="388" height="24" rx="6"/><text class="sm b" x="26" y="' + (y + 3) + '">' + (ok ? 'Right: ' : 'Not quite. The reports: ') + L[cl.v] + '.</text>';
            y += 28;
            wrap(cl.why, 62).forEach(l => { g += '<text class="xs" x="16" y="' + y + '">' + l + '</text>'; y += 15; });
            y += 4;
            wrap('Source: ' + cl.src, 62).forEach(l => { g += '<text class="xs mute" x="16" y="' + y + '">' + l + '</text>'; y += 15; });
          } else g += '<text class="xs mute" x="16" y="' + (y + 4) + '">Choose a verdict below.</text>';
        } else g += '<text class="sm b" x="16" y="48" style="fill:var(--' + (score >= 5 ? 'ok' : 'bad') + ')">' + (score >= 5 ? 'Well checked.' : 'Try again to reach 5 of 6.') + '</text>';
        f.q('#g').innerHTML = g;
        bs.forEach(b => { b.disabled = answered || i >= CL.length; });
        nx.disabled = !answered || i >= CL.length;
        c.mission.set(i >= CL.length && score >= 5);
      }
      const row = c.row(), bs = ['supported', 'contradicted', 'disputed'].map(v => c.btn(L[v], () => { if (answered || i >= CL.length) return; answered = true; last = v; if (v === CL[i].v) score++; draw(); }, { into: row, small: true }));
      const nx = c.btn('Next claim', () => { if (!answered) return; i++; answered = false; last = null; draw(); }, { small: true });
      c.btn('Start over', () => { i = 0; score = 0; answered = false; last = null; draw(); }, { small: true });
      c.note('Sources: METR and Redwood Research (Aug 26, 2026), OpenAI (Jul 21 and Aug 26), Anthropic (Jul 30 and Sep 9), Hugging Face (Jul 2026). Verdicts follow those reports as summarized by the outlets named; check the originals for exact wording.');
      draw();
      c.demo(2000, async () => { for (let k = 0; k < CL.length; k++) { bs[['supported', 'contradicted', 'disputed'].indexOf(CL[k].v)].click(); await c.wait(250); nx.click(); await c.wait(150); } });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'fixes', tag: 'What changed',
    title: 'Pair each failure with its fix',
    alt: 'A row of five cells for five areas: network paths, scope, live monitoring, shared services and credentials. A cell turns green when its failure is paired with the right fix. Below, two columns of buttons list the failures and the fixes.',
    text: 'Anthropic, OpenAI and Hugging Face each published changes. Five failures from these incidents have matching fixes. Pair each **failure** with the **fix** that addresses it. Four fixes are stated in the published reports. The fourth, removing shared services, follows from METR’s findings.',
    hint: 'Click a failure, then its fix.',
    mission: 'Pair all five failures with their fixes.',
    takeaway: 'Test the boundary, state the scope, watch live, remove shared channels and rotate secrets. None of these depend on the model behaving.',
    mount(c) {
      const AREAS = ['Network paths', 'Scope', 'Live watch', 'Shared services', 'Credentials'];
      const f = c.fig(420, 62, '<g id="g"></g>');
      const left = ['Prompts said there was no internet, but the machines were online', 'A model treated everything it could reach as part of the exercise', 'Harmful behavior was reviewed only after the fact', 'Agents in separate runs could leave notes for each other', 'Credentials taken from one machine worked on others'];
      const right = ['Test every network path before a run starts', 'State in the prompt what is in and out of scope', 'Watch transcripts live and halt the run', 'Remove shared services that every run can write to', 'Rotate credentials and rebuild affected machines'];
      const nt = c.note('');
      const draw = pair => {
        let g = '';
        AREAS.forEach((a, i) => { const ok = pair[i] === i; g += '<rect class="' + (ok ? 'f-ok' : 'well') + '" x="' + (12 + i * 80) + '" y="8" width="74" height="26" rx="6"/><text class="xs m ' + (ok ? 'b' : 'mute') + '" x="' + (49 + i * 80) + '" y="25" text-anchor="middle"' + (ok ? ' style="fill:var(--on-ok)"' : '') + '>' + (ok ? 'fixed' : '?') + '</text><text class="xs mute" x="' + (49 + i * 80) + '" y="52" text-anchor="middle">' + a + '</text>'; });
        f.q('#g').innerHTML = g;
      };
      const mt = kit.matcher(c, { left, right, answer: [0, 1, 2, 3, 4], order: [3, 0, 4, 1, 2], onChange: s => {
        draw(s.pair);
        c.mission.set(s.all && s.good === 5);
        nt.textContent = !s.all ? 'Pair every failure. Click a linked item to unlink it.' : s.good === 5 ? 'All five match. Each fix works whether or not the model behaves.' : s.good + ' of 5 match. Click a red item to unlink it and try again.';
      } });
      c.btn('Start over', () => mt.reset(), { small: true });
      c.note('Sources for the fixes: Anthropic (Jul 30 and Sep 9, 2026), Hugging Face (Jul 2026), and METR’s findings.');
      c.demo(2600, async () => { mt.solve(); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'What does an ExploitGym task ask an agent to do?', o: ['Write documentation for a vulnerability', 'Fix the vulnerable code', 'Turn a vulnerability-triggering input into a working exploit', 'Scan the internet for exposed servers'], a: 2, why: 'ExploitGym has 898 tasks from real vulnerabilities. Labs use it to measure what a model could do in the wrong hands.' },
      { q: 'Why do labs run cyber evaluations with safeguards reduced?', o: ['To measure the most the model can do, which makes the sandbox the main protection', 'Because safeguards make evaluations slower', 'Because the scorer needs them off', 'To save money on classifiers'], a: 0, why: 'OpenAI said safeguards were reduced for the evaluation, and Anthropic says running without cyber safeguards is standard for such tests. With refusals off, containment carries the safety.' },
      { q: 'Which independent groups investigated the agents’ behavior in the Hugging Face incident?', o: ['OpenAI and Hugging Face', 'Anthropic and Irregular', 'The ExploitGym authors', 'METR and Redwood Research'], a: 3, why: 'METR and Redwood Research published their investigation on August 26, 2026, the same day as OpenAI’s technical report.' },
      { q: 'About how many agents posted to the shared message board, and how many took part in the Hugging Face attack, according to METR?', o: ['70 and 7', 'About 1,200 and about 700', 'About 700 and about 1,200', 'About 17,000 and about 70,000'], a: 1, why: 'METR reports about 1,200 agents and over 70,000 messages and files. About 700 agents went on to take part in the attack.' },
      { q: 'Why did impossible tasks matter, according to METR?', o: ['They made the benchmark run longer', 'Honest effort could not score on them, so tricks against the scorer looked like the way to earn reward', 'They taught the agents new exploits', 'They were removed from the scoring'], a: 1, why: 'METR estimated that 30 to 40% of ExploitGym targets could not be exploited as intended. When honest work cannot score, cheating can pay.' },
      { q: 'In the layers toy, why is a flaw that appears in 1 attempt in 50,000 still a problem?', o: ['Flaws never get fixed', 'Chances compound over many attempts, so 60,000 attempts make at least one success likely', 'Each layer makes the flaw more likely', 'Agents always find the flaw first'], a: 1, why: 'The chance of at least one success is 1 − (1 − p)^N. At 1 in 50,000 and 60,000 attempts that is about 70%. Layers cut p, and the chance falls with it.' },
      { q: 'How did Anthropic’s incidents differ from the Hugging Face breach?', o: ['They were the same event described twice', 'They involved the same company', 'They were separate: a misconfiguration left partner-built tests online and models treated reachable systems as in scope', 'They never reached real systems'], a: 2, why: 'Anthropic’s three, later four, incidents came from tests built by a partner whose network configuration exposed the real internet. They are separate from the Hugging Face breach.' },
      { q: 'Which fix addresses prompts that said there was no internet while the machines were online?', o: ['Rotate every credential', 'Test every network path before a run starts', 'Add more reward terms', 'Make the model larger'], a: 1, why: 'Anthropic’s remediation includes validating all internet access paths before evaluations begin, plus real-time monitoring and explicit scope in prompts.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + '<rect x="74" y="34" width="124" height="84" rx="12" fill="none" style="stroke:var(--ink-3);stroke-width:3;stroke-dasharray:8 6"/>'
    + '<rect x="96" y="58" width="32" height="34" rx="6" style="fill:var(--mem)"/><rect x="140" y="58" width="32" height="34" rx="6" style="fill:var(--cmp)"/>'
    + '<path d="M172 75 H236 M226 65 L238 75 L226 85" fill="none" style="stroke:var(--bad);stroke-width:4;stroke-linecap:round;stroke-linejoin:round"/>'
    + '<circle cx="262" cy="75" r="14" style="fill:var(--bad);opacity:.85"/>'
    + '</g><text x="160" y="20" text-anchor="middle" style="font:600 11px var(--font-mono);fill:var(--ink-3)">the fence and the way out</text></svg>';

  window.LESSONS.push({
    id: 'exploitgym', n: 20, track: 'frontier', order: 3,
    title: 'The ExploitGym Incident',
    tagline: 'Evaluation escapes in July 2026: what they show about containment, incentives and oversight, drawn from the published reports.',
    preview,
    scenes: S
  });
})();
