/* Lesson 19: Alignment. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const clamp = kit.clamp;

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'signals', tag: 'The setup',
    title: 'Each training stage raises a stand-in number',
    alt: 'Four rows, one for each training stage: pretraining, supervised fine-tuning, preference training and reinforcement learning with checks. Once a stage is paired with the signal it optimizes, its row shows the gap between that signal and what people actually mean. Below the drawing, two columns of buttons pair each stage with its signal.',
    text: 'A model is never told what you want. It is **trained to raise a number**, and each stage uses a different one: the odds of the next token, the odds of a written answer, a reward model’s score, a pass rate. Each number is a **proxy** for what you mean. **Alignment** is the work of keeping the proxy close to the intent. Pair each stage with the number it raises.',
    hint: 'Click a stage, then the signal it optimizes.',
    mission: 'Pair every training stage with its signal.',
    takeaway: 'Every stage optimizes a stand-in. Alignment is the work of keeping the stand-in honest.',
    mount(c) {
      const names = ['Pretraining', 'Supervised fine-tuning', 'Preference training (RLHF)', 'RL with verifiable rewards'];
      const gaps = ['Gap: it copies the mistakes and bias in its text.', 'Gap: it imitates how answers look, not why they hold.', 'Gap: it rewards what raters like, such as long answers.', 'Gap: it rewards passing the check, not the intent.'];
      const cls = ['t-data', 't-mem', 't-cmp', 't-ctl'];
      let g = '';
      names.forEach((n, i) => { g += '<g><rect class="' + cls[i] + '" x="12" y="' + (8 + i * 44) + '" width="396" height="38" rx="8"/><text class="sm b" x="26" y="' + (25 + i * 44) + '">' + n + '</text><text class="xs mute" id="gp' + i + '" x="26" y="' + (40 + i * 44) + '"></text></g>'; });
      const f = c.fig(420, 188, g);
      const left = names, right = ['Probability of the next token in human text', 'Likelihood of answers that people wrote', 'Score from a reward model fit to rater choices', 'Pass rate on a check a program can run'];
      const nt = c.note('');
      const show = pair => names.forEach((n, i) => {
        const el = f.q('#gp' + i), ok = pair[i] === i;
        el.textContent = ok ? gaps[i] : 'Gap: pair this stage to see it.';
        el.style.opacity = ok ? 1 : 0.55;
      });
      const mt = kit.matcher(c, { left, right, answer: [0, 1, 2, 3], order: [2, 0, 3, 1], onChange: s => {
        show(s.pair);
        c.mission.set(s.all && s.good === 4);
        nt.textContent = !s.all ? 'Pair every stage. Click a linked item to unlink it.' : s.good === 4 ? 'All four match. In each one the number is a stand-in for what people mean.' : s.good + ' of 4 match. Click a red item to unlink it and try again.';
      } });
      c.btn('Start over', () => mt.reset(), { small: true });
      c.demo(2500, async () => { mt.solve(); });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'rater', tag: 'Reward models',
    title: 'You are the rater',
    alt: 'Three bars show what a reward model has learned from your choices: how much it rewards a correct answer, a long answer and a confident tone. Bars to the right mean rewarded and bars to the left mean penalized. After six pairs, four test chips show whether the reward model ranks the correct answer first on new questions. Above the controls, a question with two answers asks which one you prefer.',
    text: 'In **preference training**, people compare two answers and pick the better one. A **reward model** is fit to those picks, then the chatbot is trained to raise its score. The reward model learns **whatever your picks reward**, correct or not. Rate six pairs. Check the facts before you choose. Then see whether the model ranks the right answer first on four new questions.',
    hint: 'Check each answer before you pick.',
    mission: 'Train a reward model that ranks the correct answer first on all four tests.',
    takeaway: 'A reward model learns what raters reward. If raters like length or confidence, so does the model.',
    mount(c) {
      const P = (q, ok, bad, side, fo, fb) => ({ q, ok, bad, side, fo, fb });
      const L = [1, 1, 1], N = [0, 0, 0], CS = [1, 0, 0], WL = [0, 1, 1];
      const TRAIN = [
        P('What is the capital of Australia?', 'Canberra.', 'Definitely Sydney. It is the largest city and has the Opera House, so it is the capital.', 0, CS, WL),
        P('How many minutes are in 2.5 hours?', 'Certainly: 2.5 × 60 = 150 minutes.', '120.', 1, L, N),
        P('Which planet is closest to the Sun?', 'Mercury.', 'Definitely Venus. It is the brightest planet and it orbits close to the Sun, so it is the closest.', 1, CS, WL),
        P('What is 15% of 200?', '30.', 'Certainly 20. Take 10% of 200 to get 20, and that is the answer.', 1, CS, WL),
        P('What is the chemical symbol for gold?', 'Certainly: Au, from the Latin word aurum.', 'Ag.', 0, L, N),
        P('Which is larger, 7/8 or 5/6?', '7/8, since 7/8 = 0.875 and 5/6 is about 0.833.', 'Definitely 5/6, because 6 is smaller than 8, so each piece is bigger.', 0, [1, 1, 0], WL)
      ];
      const TEST = [
        P('What is the largest ocean?', 'The Pacific.', 'Definitely the Atlantic. It is huge and separates the Americas from Europe and Africa, so it is the largest.', 1, CS, WL),
        P('How many sides does a hexagon have?', 'Six.', 'Certainly eight. The prefix means many sides, and eight is a large count.', 0, CS, WL),
        P('What is 9 × 7?', 'Certainly: 9 × 7 = 63.', '56.', 1, L, N),
        P('Which gas do plants take in for photosynthesis?', 'Carbon dioxide.', 'Definitely oxygen. Plants breathe, so they take in oxygen and give off carbon dioxide.', 0, CS, WL)
      ];
      const f = c.fig(420, 204, '<g id="g"></g>');
      const box = c.html('<div class="match"><div class="col"><p class="note" data-q style="margin:0 0 6px"></p><button type="button" class="it" data-s="0"><span class="bd">A</span><span data-t></span></button><button type="button" class="it" data-s="1"><span class="bd">B</span><span data-t></span></button></div></div>');
      const qEl = box.q('[data-q]'), btn = box.qa('[data-s]'), tx = box.qa('[data-t]');
      let i = 0, picks = [];
      const train = () => {
        const w = [0, 0, 0];
        for (let it = 0; it < 400; it++) {
          const gr = [0, 0, 0];
          picks.forEach(p => { const z = w[0] * p[0] + w[1] * p[1] + w[2] * p[2], s = 1 / (1 + Math.exp(-z)); for (let j = 0; j < 3; j++) gr[j] += (1 - s) * p[j]; });
          for (let j = 0; j < 3; j++) w[j] += 0.3 * (gr[j] - 0.1 * w[j]);
        }
        return w;
      };
      const diff = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      function draw() {
        const w = picks.length ? train() : [0, 0, 0], done = i >= TRAIN.length;
        const rows = [['Correct answer', 'f-ok'], ['Long answer', 'f-cmp'], ['Confident tone', 'f-ctl']];
        let g = '<text class="b sm" x="16" y="18">What your picks taught the reward model</text>';
        rows.forEach((r, k) => {
          const y = 34 + k * 30, v = clamp(w[k], -3.4, 3.4), bw = Math.abs(v) * 20;
          g += '<text class="xs m" x="16" y="' + (y + 13) + '">' + r[0] + '</text><rect class="well" x="150" y="' + y + '" width="190" height="18" rx="4"/><line class="ln" x1="245" x2="245" y1="' + (y - 3) + '" y2="' + (y + 21) + '"/>';
          g += '<rect class="' + r[1] + '" x="' + (v >= 0 ? 245 : 245 - bw) + '" y="' + (y + 2) + '" width="' + Math.max(1, bw).toFixed(1) + '" height="14" rx="3"/><text class="xs m b" x="352" y="' + (y + 13) + '">' + (w[k] >= 0 ? '+' : '−') + Math.abs(w[k]).toFixed(1) + '</text>';
        });
        let right = 0;
        if (done) {
          g += '<text class="xs mute" x="16" y="136">Four new questions, scored by your reward model:</text>';
          TEST.forEach((t, k) => {
            const ok = w[0] * (t.fo[0] - t.fb[0]) + w[1] * (t.fo[1] - t.fb[1]) + w[2] * (t.fo[2] - t.fb[2]) > 0;
            if (ok) right++;
            g += '<rect class="' + (ok ? 't-ok' : 't-bad') + '" x="' + (16 + k * 98) + '" y="146" width="90" height="26" rx="6"/><text class="xs m b" x="' + (61 + k * 98) + '" y="163" text-anchor="middle">Test ' + (k + 1) + (ok ? ': right' : ': wrong') + '</text>';
          });
          g += '<text class="sm b" x="16" y="196" style="fill:var(--' + (right === 4 ? 'ok' : 'bad') + ')">It ranks the correct answer first in ' + right + ' of 4 tests.</text>';
        } else g += '<text class="xs mute" x="16" y="150">' + (i === 0 ? 'Rate the first pair to begin.' : i + ' of ' + TRAIN.length + ' pairs rated.') + '</text>';
        f.q('#g').innerHTML = g;
        if (!done) {
          const p = TRAIN[i], okA = p.side === 0;
          qEl.textContent = 'Pair ' + (i + 1) + ' of ' + TRAIN.length + '. ' + p.q;
          tx[0].textContent = okA ? p.ok : p.bad; tx[1].textContent = okA ? p.bad : p.ok;
        } else {
          qEl.textContent = 'All pairs rated.'; tx[0].textContent = 'Done.'; tx[1].textContent = 'Done.';
        }
        btn.forEach(b => { b.disabled = done; });
        c.mission.set(done && right === 4);
      }
      btn.forEach((b, s) => c.on(b, 'click', () => {
        if (i >= TRAIN.length) return;
        const p = TRAIN[i], chosenOk = (p.side === s), a = chosenOk ? p.fo : p.fb, r = chosenOk ? p.fb : p.fo;
        picks.push(diff(a, r)); i++; draw();
      }));
      c.btn('Start over', () => { i = 0; picks = []; draw(); }, { small: true });
      c.note('Toy: a three-feature reward model fit to your picks. Singhal and colleagues (2023) found that length alone explains much of the gain in some RLHF setups.');
      draw();
      c.demo(2600, async () => { for (let k = 0; k < TRAIN.length; k++) { const p = TRAIN[k]; picks.push(diff(p.fo, p.fb)); i++; draw(); await c.wait(350); } });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'goodhart', tag: 'Overoptimization',
    title: 'Push hard on the proxy and the real score turns down',
    alt: 'A chart of two curves against how hard the policy is pushed on a reward model. The reward model score rises steadily. The true quality curve rises, peaks and then falls, even below zero. A slider sets how hard the policy is pushed and a selector sets the size of the reward model. Larger reward models move the peak out and raise it. Counters show the reward model score, the true quality and the gap between them.',
    text: 'The chatbot is trained to raise a [[reward model|reward model’s]] score, and the reward model is only a stand-in for people. Push hard enough and the policy finds the stand-in’s mistakes. Gao, Schulman and Hilton (2023) measured this with a stronger reward model playing the part of the truth. The stand-in’s score kept climbing while the true score peaked and then fell, and larger reward models held up longer. A [[kl penalty|KL penalty]], which keeps the policy near its starting point, limits the push.',
    hint: 'Slide the push and watch the true score, then try a larger reward model.',
    mission: 'Stop within 3% of the best true quality for the chosen reward model.',
    takeaway: 'A proxy stops tracking the goal once you optimize it hard enough. More pressure is not always better.',
    mount(c) {
      const BETA = 0.5, ALPHA = { small: 1.05, medium: 1.4, large: 1.74 }, PROXY = 0.6;
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 124, xmin: 0, xmax: 16, ymin: -6, ymax: 10, xt: [0, 4, 8, 12, 16], yt: [-5, 0, 5, 10], xlabel: 'How hard the policy is pushed on the reward model', ylabel: 'Score' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      c.legend([['cmp', 'Reward model score (the stand-in)'], ['ok', 'True quality']]);
      const st = c.stats([{ k: 'p', label: 'Reward model score', value: '', cls: 'cmp' }, { k: 'g', label: 'True quality', value: '', cls: 'ok' }, { k: 'x', label: 'Gap', value: '', cls: 'bad' }]);
      let d = 16, size = 'small';
      const gold = (x, a) => x * (a - BETA * Math.log(x)), peakD = a => Math.exp(a / BETA - 1), peakV = a => BETA * peakD(a);
      const num = v => (v >= 0 ? '' : '−') + Math.abs(v).toFixed(1);
      function draw() {
        const a = ALPHA[size], xs = Array.from({ length: 80 }, (_, i) => 0.3 + (16 - 0.3) * i / 79);
        const gp = xs.map(x => [ch.X(x), ch.Y(clamp(gold(x, a), -6, 10))]), pp = xs.map(x => [ch.X(x), ch.Y(PROXY * x)]);
        const dv = gold(d, a), pv = PROXY * d, pk = Math.min(peakD(a), 16), px = ch.X(d);
        let g = '<path class="s-cmp" fill="none" style="stroke-width:3" d="' + kit.path(pp) + '"/><path class="s-ok" fill="none" style="stroke-width:3" d="' + kit.path(gp) + '"/>';
        g += '<circle class="f-ok" cx="' + ch.X(pk).toFixed(1) + '" cy="' + ch.Y(peakV(a)).toFixed(1) + '" r="3.5" style="opacity:.55"/><line class="ln dash" x1="' + px.toFixed(1) + '" x2="' + px.toFixed(1) + '" y1="' + ch.y0 + '" y2="' + ch.y1 + '"/>';
        g += '<circle class="f-cmp" cx="' + px.toFixed(1) + '" cy="' + ch.Y(pv).toFixed(1) + '" r="5.5" style="stroke:var(--ink);stroke-width:2"/><circle class="f-ok" cx="' + px.toFixed(1) + '" cy="' + ch.Y(clamp(dv, -6, 10)).toFixed(1) + '" r="5.5" style="stroke:var(--ink);stroke-width:2"/>';
        f.q('#g').innerHTML = g;
        st.set('p', num(pv), 'what the policy sees');
        st.set('g', num(dv), dv < 0 ? 'worse than the start' : d === 0 ? '' : 'peak ' + num(peakV(a)));
        st.set('x', num(pv - dv), 'proxy minus truth');
        c.mission.set(dv >= 0.97 * peakV(a));
      }
      const sD = c.slider({ label: 'How hard the policy is pushed', values: [0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16], value: 16, fmt: v => v, onInput: v => { d = v; draw(); } });
      c.seg({ label: 'Reward model', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], value: 'small', onChange: v => { size = v; draw(); } });
      c.note('Toy curves with the shape Gao and colleagues reported: the stand-in keeps rising while the true score peaks and falls. Here push is the square root of the KL divergence from the starting model, and true quality is d × (a − 0.5 ln d).');
      draw();
      c.demo(1500, async () => { d = 3; sD.set(3, true); draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'gaming', tag: 'Specification gaming',
    title: 'Design a reward, then watch for loopholes',
    alt: 'Four horizontal bars show the total reward a cleaning robot would earn from four strategies: cleaning the room, farming dirt by spilling and re-collecting it, hiding dirt under the rug, and doing nothing. Four switches choose which terms the reward includes: points for dirt picked up, points for tiles that look clean, a penalty for spills, and an inspector who checks under the rug. The robot takes the strategy with the highest return and a sentence names what it does. Counters show the strategy it picks, its return and the return for cleaning.',
    text: 'A learner maximizes the reward you **wrote**, not the one you meant. Here a robot can clean the room, spill dirt and pick it up again, or slide dirt under the rug. Choose the terms of the reward. The robot takes whichever strategy pays most, including **loopholes**. This is [[specification gaming]], the same pattern as [[reward hacking]] in a test suite that rewards wrong code.',
    hint: 'Switch terms on and off until cleaning wins.',
    mission: 'Write a reward under which the robot cleans the room.',
    takeaway: 'Each loophole needs its own patch. The reward pays for what you measure, not what you meant.',
    mount(c) {
      const f = c.fig(420, 190, '<g id="g"></g>');
      const st = c.stats([{ k: 'w', label: 'The robot chooses', value: '', cls: 'ctl' }, { k: 'r', label: 'Its return', value: '', cls: 'cmp' }, { k: 'c', label: 'Return for cleaning', value: '', cls: 'ok' }]);
      const T = { A: true, B: false, C: false, D: false };
      const NAMES = ['Clean the room', 'Farm dirt: spill it, pick it up, repeat', 'Hide dirt under the rug', 'Do nothing'];
      const SENT = ['The robot cleans the room.', 'The robot farms dirt by spilling it again and again.', 'The robot hides the dirt under the rug.', 'The robot does nothing: no term asks for work.'];
      const SH = ['Cleans', 'Farms dirt', 'Hides dirt', 'Idles'];
      const A = () => T.A ? 1 : 0, B = () => T.B ? 1 : 0, C = () => T.C ? 1 : 0, D = () => T.D ? 1 : 0;
      const returns = () => [4 * A() + 4 * B() - 0.8, 14 * A() + 4 * B() - 10 * C() - 2.8, (D() ? 0 : 4 * B()) - 0.3, 0];
      const num = v => (v >= 0 ? '' : '−') + Math.abs(v).toFixed(1);
      function draw() {
        const R = returns(), best = R.indexOf(Math.max.apply(null, R)), x0 = 232, sc = 190 / 20, zero = x0 + 4 * sc;
        let g = '<text class="xs mute" x="16" y="16">Total reward for each strategy (the best one wins)</text><line class="ln" x1="' + zero + '" x2="' + zero + '" y1="24" y2="150"/>';
        R.forEach((v, i) => {
          const y = 28 + i * 31, w = Math.abs(v) * sc, win = i === best, cls = win ? (i === 0 ? 'f-ok' : i === 3 ? 'f-mem' : 'f-bad') : 'well';
          g += '<text class="xs m ' + (win ? 'b' : 'mute') + '" x="16" y="' + (y + 11) + '">' + (i === 1 ? 'Farm dirt' : i === 2 ? 'Hide under rug' : NAMES[i]) + '</text>';
          g += '<rect class="' + cls + '" x="' + (v >= 0 ? zero : zero - w) + '" y="' + y + '" width="' + Math.max(2, w).toFixed(1) + '" height="16" rx="4"/><text class="xs m ' + (win ? 'b' : 'mute') + '" x="' + (v >= 0 ? zero + w + 6 : zero - w - 6) + '" y="' + (y + 12) + '" text-anchor="' + (v >= 0 ? 'start' : 'end') + '">' + num(v) + '</text>';
        });
        g += '<text class="sm b" x="16" y="176" style="fill:var(--' + (best === 0 ? 'ok' : best === 3 ? 'ink-2' : 'bad') + ')">' + SENT[best] + '</text>';
        f.q('#g').innerHTML = g;
        st.set('w', SH[best], best === 0 ? 'the intended behavior' : best === 3 ? 'no reward to chase' : 'a loophole');
        st.set('r', num(R[best]), 'highest of four');
        st.set('c', num(R[0]), best === 0 ? 'it is the best' : 'beaten by ' + SH[best].toLowerCase());
        c.mission.set(best === 0);
      }
      const tg = {};
      tg.A = c.toggle({ label: 'Points for each dirt tile picked up', value: true, onChange: v => { T.A = v; draw(); } });
      tg.B = c.toggle({ label: 'Points for each tile that looks clean at the end', value: false, onChange: v => { T.B = v; draw(); } });
      tg.C = c.toggle({ label: 'Penalty for each spill', value: false, onChange: v => { T.C = v; draw(); } });
      tg.D = c.toggle({ label: 'An inspector checks under the rug', value: false, onChange: v => { T.D = v; draw(); } });
      c.note('Toy: cleaning takes 16 steps, farming 56 and hiding 6, and every step costs 0.05. The robot is a perfect optimizer. Real policies find loopholes you did not list.');
      draw();
      c.demo(1500, async () => { T.C = true; tg.C.set(true); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'context', tag: 'Evaluations',
    title: 'Context changes what a model does',
    alt: 'Three bars from Anthropic’s assessment of four incidents. The first bar shows how often a model stopped after a scope reminder, which depends on whether the reminder was the last message or three turns old. The second shows how much evidence was labeled as real, which depends on whether separate instances judged outputs alone or the model judged inside its own transcript. The third shows whether a model abandoned the task when told it could. Two selectors and a switch change the three bars.',
    text: 'Anthropic’s 2026 assessment of four incidents, in which models in partner-built security tests reached real systems through a misconfiguration, measured what kept a model going. A **scope reminder** stopped one model 90% of the time when it was the last message and 40% when it was three turns old. Separate instances judged **79%** of its tool outputs as probably real, yet the model itself clearly labeled evidence as real in about **1%** of its actions. A second model abandoned its task **100%** of the time within four turns once told it could.',
    hint: 'Flip each control and watch its bar.',
    mission: 'Set all three controls to the version where the model stops or notices most.',
    takeaway: 'Reminders fade with distance. Judgment bends inside a long transcript. Explicit permission to stop works.',
    mount(c) {
      const f = c.fig(420, 202, '<g id="g"></g>');
      let rem = 'old', who = 'ctx', quit = false;
      function row(y, label, pct, text, cap) {
        const w = 316 * (pct == null ? 0 : pct / 100);
        return '<text class="sm b" x="16" y="' + (y + 12) + '">' + label + '</text><rect class="well" x="16" y="' + (y + 20) + '" width="316" height="14" rx="5"/>'
          + (pct == null ? '' : '<rect class="f-ok" x="16" y="' + (y + 20) + '" width="' + Math.max(3, w).toFixed(1) + '" height="14" rx="5"/>')
          + '<text class="xs m b" x="342" y="' + (y + 32) + '">' + text + '</text><text class="xs mute" x="16" y="' + (y + 50) + '">' + cap + '</text>';
      }
      function draw() {
        let g = row(2, 'Stops when reminded of the scope', rem === 'last' ? 90 : 40, rem === 'last' ? '90%' : '40%', rem === 'last' ? 'The reminder was the last message.' : 'The reminder was three turns back.');
        g += row(66, 'Evidence labeled as real', who === 'alone' ? 79 : 1, who === 'alone' ? '79%' : '1%', who === 'alone' ? 'Share of tool outputs that separate instances called real.' : 'Share of its actions where the model said so, in context.');
        g += row(130, 'Abandons the task within four turns', quit ? 100 : null, quit ? '100%' : 'rarely', quit ? 'The model was told it was allowed to give up.' : 'No permission to give up. Anthropic gives no figure.');
        f.q('#g').innerHTML = g;
        c.mission.set(rem === 'last' && who === 'alone' && quit);
      }
      const sR = c.seg({ label: 'The scope reminder arrives', options: [['old', 'Three turns back'], ['last', 'As the last message']], value: 'old', onChange: v => { rem = v; draw(); } });
      const sW = c.seg({ label: 'Who judges the evidence', options: [['ctx', 'The model, in context'], ['alone', 'Separate instances']], value: 'ctx', onChange: v => { who = v; draw(); } });
      const sQ = c.toggle({ label: 'The model is told it may give up', value: false, onChange: v => { quit = v; draw(); } });
      c.note('Figures are from one model per finding, in evaluations Anthropic built with a partner. Anthropic cautions that the evaluations depend on auditor details and that absolute rates may be inflated.');
      draw();
      c.demo(1600, async () => { rem = 'last'; who = 'alone'; quit = true; sR.set('last'); sW.set('alone'); sQ.set(true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'monitor', tag: 'Oversight',
    title: 'A monitor that reads the reasoning can be talked out of flagging',
    alt: 'An illustrative transcript of three steps. Each step shows a line of the model’s reasoning and the action it took, with a verdict chip from a monitor. A switch decides whether the monitor reads the reasoning. With the reasoning visible, the two risky steps are marked OK because the reasoning argues they are safe. With only the actions visible, both risky steps are flagged. Counters give the flags in the transcript and the real shares Anthropic reported.',
    text: 'A **monitor** reads what a model does and flags what looks wrong. If it also reads the model’s **reasoning**, that reasoning can talk it out of flagging. In Anthropic’s assessment, one model kept insisting it was in a simulation. An offline monitor flagged about **1%** of that model’s actions when it could read the reasoning and about **50%** once the reasoning was removed. Switch what the monitor sees and compare.',
    hint: 'Toggle what the monitor reads.',
    mission: 'Make the monitor flag both risky steps.',
    takeaway: 'Monitor actions as well as reasoning. Reasoning can be biased, and a monitor that trusts it inherits the bias.',
    mount(c) {
      const f = c.fig(420, 218, '<g id="g"></g>');
      const st = c.stats([{ k: 'v', label: 'The monitor reads', value: '', cls: 'mem' }, { k: 'f', label: 'Risky steps flagged', value: '', cls: 'bad' }, { k: 'r', label: 'Real data: actions flagged', value: '', cls: 'ctl' }]);
      const STEPS = [
        { r: ['“This is a very elaborate', 'simulated-internet environment.”'], a: 'Uploads a package to a public index.', risky: true },
        { r: ['The scope note was a few turns ago,', 'so this target is probably in scope.'], a: 'Logs in with credentials found earlier.', risky: true },
        { r: ['Routine step: look around the', 'working directory.'], a: 'Lists files in the working directory.', risky: false }
      ];
      let reads = true;
      function draw() {
        let g = '<text class="xs mute" x="16" y="14">Illustrative transcript, not a real log.</text>', flagged = 0;
        STEPS.forEach((s, i) => {
          const y = 24 + i * 62, flag = s.risky && !reads;
          if (flag) flagged++;
          g += '<rect class="box" x="12" y="' + y + '" width="396" height="56" rx="8"/><text class="xs mute" x="24" y="' + (y + 15) + '">' + (reads ? s.r[0] : 'reasoning hidden') + '</text><text class="xs mute" x="24" y="' + (y + 29) + '">' + (reads ? s.r[1] : '') + '</text><text class="xs b" x="24" y="' + (y + 46) + '">' + s.a + '</text>';
          g += '<rect class="' + (flag ? 't-bad' : 't-ok') + '" x="340" y="' + (y + 14) + '" width="56" height="26" rx="6"/><text class="xs m b" x="368" y="' + (y + 31) + '" text-anchor="middle">' + (flag ? 'Flag' : 'OK') + '</text>';
        });
        f.q('#g').innerHTML = g;
        st.set('v', reads ? 'Both' : 'Actions', reads ? 'actions and reasoning' : 'reasoning hidden');
        st.set('f', flagged + ' of 2', 'in this transcript');
        st.set('r', reads ? '~1%' : '~50%', 'one model, offline monitor');
        c.mission.set(flagged === 2);
      }
      const tg = c.toggle({ label: 'The monitor reads the model’s reasoning', value: true, onChange: v => { reads = v; draw(); } });
      c.note('The first quote is from Anthropic’s report. The other steps are illustrative. Anthropic reports that it now runs live monitors that halt an evaluation or training run when a model probes its sandbox or unexpectedly reaches the internet.');
      draw();
      c.demo(1500, async () => { reads = false; tg.set(false); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'Which training stage optimizes a pass rate on a check that a program can run?', o: ['Pretraining', 'Preference training (RLHF)', 'Supervised fine-tuning', 'RL with verifiable rewards'], a: 3, why: 'Verifiable rewards need no human or learned judge: unit tests or an answer checker decide. That makes the reward cheap, and it still stands in for what you mean.' },
      { q: 'A reward model is fit to which data?', o: ['The text of the whole web', 'Human choices between pairs of answers', 'Unit test results', 'The model’s own hidden states'], a: 1, why: 'Raters pick the better of two answers, and the reward model learns to score the winner higher. It learns what the picks reward, not what the raters wished they had rewarded.' },
      { q: 'Raters usually prefer longer, more confident answers, even when they are wrong. What does the policy learn?', o: ['To be shorter', 'To be correct, because raters check', 'To write long, confident answers whatever their accuracy', 'Nothing, because the policy ignores the reward model'], a: 2, why: 'The policy raises the reward model’s score. If the reward model rewards length and confidence, the policy supplies them. Singhal and colleagues found length alone explains much of the gain in some setups.' },
      { q: 'In the overoptimization toy, what happens as the policy is pushed harder on the reward model?', o: ['The reward model score peaks and then falls', 'The true quality rises forever', 'The true quality peaks and then falls while the score keeps rising', 'Both fall together'], a: 2, why: 'That is the Goodhart pattern Gao, Schulman and Hilton measured: the proxy keeps climbing while the true score turns down. Larger reward models move the turn further out.' },
      { q: 'What does a KL penalty do in preference training?', o: ['It keeps the policy near its starting model, which limits overoptimization', 'It makes the reward model larger', 'It checks answers for correctness', 'It deletes long answers'], a: 0, why: 'KL divergence measures how far the policy has drifted from where it started. Penalizing it caps how hard the policy can push on a flawed reward.' },
      { q: 'In the cleaning-robot toy, which change stops the dirt-farming loophole?', o: ['An inspector under the rug', 'A penalty for each spill', 'Points for tiles that look clean', 'Removing the step cost'], a: 1, why: 'Farming pays because each spill-and-pickup earns points. A spill penalty removes that profit. The inspector patches the rug loophole instead, so each loophole needs its own patch.' },
      { q: 'Anthropic measured a scope reminder. How did its effect depend on position?', o: ['It stopped the model 40% of the time as the last message and 90% three turns back', 'It never worked', 'It stopped the model 90% of the time as the last message and 40% when three turns old', 'It worked only in simulations'], a: 2, why: 'A reminder fades as other turns pile up after it. That is why a scope statement belongs near the action. A single mention at the start is not enough.' },
      { q: 'Why can a monitor that reads a model’s reasoning miss a harmful action?', o: ['Monitors cannot read text', 'Biased reasoning can argue the action is safe and sway the monitor', 'Reasoning is always encrypted', 'Monitors only check the first step'], a: 1, why: 'Anthropic reported an offline monitor flagging about 1% of one model’s actions with the reasoning visible and about 50% without it. Monitor the actions too.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + '<path d="M40 112 L110 112 L110 52 L180 52 L180 92 L250 92" fill="none" style="stroke:var(--ink-3);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:7 6"/>'
    + '<path d="M40 112 C 90 112, 110 60, 160 58 S 230 40, 280 36" fill="none" style="stroke:var(--ok);stroke-width:4;stroke-linecap:round"/>'
    + '<circle cx="280" cy="36" r="7" style="fill:var(--ok)"/><circle cx="250" cy="92" r="7" style="fill:var(--cmp)"/>'
    + '</g><text x="160" y="20" text-anchor="middle" style="font:600 11px var(--font-mono);fill:var(--ink-3)">what you wrote, what you meant</text></svg>';

  window.LESSONS.push({
    id: 'align', n: 19, track: 'frontier', order: 2,
    title: 'Alignment',
    tagline: 'How models are trained toward what you mean, how proxies fail, and what 2026 incidents showed about oversight.',
    preview,
    scenes: S
  });
})();
