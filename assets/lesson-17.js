/* Lesson 17: Reinforcement learning for code. */
(function () {
  'use strict';
  const { fmt, kit } = window.LLMI;
  const S = [];
  const pct = v => v > 0 && v < 0.0001 ? '<0.01%' : (v * 100).toFixed(v < 0.01 ? 2 : v < 0.1 ? 1 : 0) + '%';
  const info = (p, G) => 1 - Math.pow(p, G) - Math.pow(1 - p, G);

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'loop', tag: 'The loop',
    title: 'One round of RL on a coding problem',
    alt: 'A problem card at the top and a row of eight solution cards. In four steps the reader samples eight solutions, runs the unit tests, which marks each card green for pass or red for fail, computes each solution’s advantage against the group average, and updates the model, which raises the chance that a sample passes. A bar shows that chance before and after.',
    text: 'RL for code is a loop. Pick a problem. Sample a **group** of solutions. Run each against **unit tests** in a sandbox: pass or fail is the [[verifiable reward]]. Score every solution against the group’s average to get its [[advantage]]: above average is positive, below is negative. Then nudge the model toward the positive ones. This group-relative idea is [[grpo|GRPO]], the method behind DeepSeek-R1.',
    hint: 'Press the button four times, once for each step.',
    mission: 'Run one full round: sample, test, score and update.',
    takeaway: 'The reward is only pass or fail. Comparing each sample with its own group turns that into a learning signal.',
    mount(c) {
      const OUT = [0, 1, 0, 0, 1, 0, 1, 0], MEAN = 0.375, SD = Math.sqrt(MEAN * (1 - MEAN)), ADV = OUT.map(v => (v - MEAN) / SD);
      const LAB = ['Sample 8 solutions', 'Run the unit tests', 'Compute the advantages', 'Update the model', 'Start over'], STEPS = ['1 Sample', '2 Test', '3 Score', '4 Update'];
      const f = c.fig(420, 214, '<g id="g"></g>');
      let stage = 0, btn = null;
      function draw() {
        let g = '<rect class="box" x="16" y="12" width="388" height="40" rx="8"/><text class="xs b" x="28" y="29">Problem: is_palindrome(s), ignoring case and punctuation</text><text class="xs mute" x="28" y="45">Checked by 12 unit tests in a sandbox</text>';
        STEPS.forEach((s, i) => { g += `<text class="xs ${i + 1 === stage ? 'b' : 'mute'}" x="${16 + i * 98}" y="74">${s}</text>${i + 1 === stage ? `<rect class="f-ctl" x="${16 + i * 98}" y="78" width="70" height="3" rx="1.5"/>` : ''}`; });
        for (let i = 0; i < 8; i++) {
          const x = 16 + i * 48.6, on = stage >= 1, res = stage >= 2, cl = res ? (OUT[i] ? 't-ok' : 't-bad') : on ? 'box' : 'well';
          g += `<rect class="${cl}" x="${x.toFixed(1)}" y="92" width="44" height="52" rx="7" style="${on ? '' : 'stroke-dasharray:4 4'}"/>`;
          if (on) g += `<text class="xs b" x="${(x + 22).toFixed(1)}" y="110" text-anchor="middle">s${i + 1}</text><text class="xs mute" x="${(x + 22).toFixed(1)}" y="124" text-anchor="middle">{ }</text>`;
          if (res) g += `<text class="xs b" x="${(x + 22).toFixed(1)}" y="138" text-anchor="middle">${OUT[i] ? 'pass' : 'fail'}</text>`;
          if (stage >= 3) g += `<text class="xs m b" x="${(x + 22).toFixed(1)}" y="160" text-anchor="middle" style="fill:var(${OUT[i] ? '--ok' : '--bad'})">${ADV[i] > 0 ? '+' : '−'}${Math.abs(ADV[i]).toFixed(2)}</text>`;
        }
        g += stage >= 3 ? '<text class="xs mute" x="16" y="176">Advantage = (reward − group mean 0.375) ÷ spread 0.48.</text>' : '';
        g += kit.bar(16, 200, 388, 10, stage >= 4 ? 0.46 : 0.375, 'f-data', stage >= 4 ? 'Chance a sample passes, after the update' : 'Chance a sample passes, now', stage >= 4 ? '46%' : '37.5%');
        f.q('#g').innerHTML = g;
        c.mission.set(stage >= 4);
        if (btn) btn.textContent = LAB[stage];
      }
      btn = c.btn(LAB[0], () => { stage = (stage + 1) % 5; draw(); }, { small: false });
      c.note('Toy numbers: 3 of 8 samples pass. The size of the update is illustrative, one small step of the policy gradient.');
      draw();
      c.demo(1800, async () => { for (let i = 0; i < 4; i++) { stage = i + 1; draw(); await c.wait(900); } });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'signal', tag: 'The loop',
    title: 'If every sample passes, or every sample fails, nothing is learned',
    alt: 'A chart of the share of groups that carry a learning signal against the pass rate of the problem, for the chosen group size. The curve is zero at 0% and 100%, and peaks near 50%. A marker shows the chosen pass rate. A slider sets the pass rate and a selector sets the group size. Counters show the share of informative groups, the expected passes per group and the share of wasted groups.',
    text: 'When all samples in a group get the same reward, every advantage is **zero** and the group teaches nothing. A group is informative unless all G samples pass or all fail, which happens with chance **p^G + (1 − p)^G**. Problems that are too easy or too hard waste samples. Larger groups waste less at the extremes, at a higher cost per problem.',
    hint: 'Slide the pass rate toward each extreme, then change the group size.',
    mission: 'Keep at least 95% of groups informative.',
    takeaway: 'RL learns best on problems the model solves about half the time. Curating difficulty is part of the recipe.',
    mount(c) {
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 0, xmax: 1, ymin: 0, ymax: 1, xt: [0, 0.25, 0.5, 0.75, 1], xf: v => Math.round(v * 100) + '%', yt: [0, 0.5, 1], yf: v => Math.round(v * 100) + '%', xlabel: 'Chance one sample passes', ylabel: 'Groups with a signal' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      const st = c.stats([{ k: 'i', label: 'Groups that teach', value: '', cls: 'ok' }, { k: 'e', label: 'Passes per group', value: '', cls: 'data' }, { k: 'w', label: 'Wasted groups', value: '', cls: 'bad' }]);
      let p = 0.05, G = 8;
      function draw() {
        const pts = Array.from({ length: 101 }, (_, i) => [ch.X(i / 100), ch.Y(info(i / 100, G))]), v = info(p, G);
        f.q('#g').innerHTML = `<path class="s-ok s3" fill="none" d="${kit.path(pts)}"/><line class="ln dash" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(0.95).toFixed(1)}" y2="${ch.Y(0.95).toFixed(1)}"/><text class="xs mute" x="${ch.x1}" y="${(ch.Y(0.95) - 4).toFixed(1)}" text-anchor="end">95%</text><circle cx="${ch.X(p).toFixed(1)}" cy="${ch.Y(v).toFixed(1)}" r="5.5" class="f-cmp" style="stroke:var(--ink);stroke-width:2"/>`;
        st.set('i', pct(v), 'of groups have mixed results'); st.set('e', (G * p).toFixed(G * p < 10 ? 1 : 0), 'out of ' + G + ' samples'); st.set('w', pct(1 - v), 'all pass or all fail');
        c.mission.set(v >= 0.95);
      }
      const sl = c.slider({ label: 'Chance one sample passes', values: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99], value: 0.05, fmt: v => Math.round(v * 100) + '%', onInput: v => { p = v; draw(); } });
      c.seg({ label: 'Group size G', options: [['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['64', '64']], value: '8', onChange: v => { G = +v; draw(); } });
      draw();
      c.demo(1500, async () => { p = 0.5; sl.set(0.5, true); draw(); });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'train', tag: 'Training',
    title: 'Tune a tiny policy: step size, group size and the baseline',
    alt: 'A chart of the chance that a sample passes against training steps, with six training runs drawn as lines. Lines that reach 70% by step 60 are green and the others are red. Controls set the learning rate, the group size and whether advantages are normalized within the group. Counters show how many of the six runs reach 70% by step 60, the median chance at step 60 and the median at step 100.',
    text: 'The toy policy picks one of six solution strategies. Their pass rates are **5%, 10%, 20%, 30%, 50% and 80%**. After each group of attempts the policy shifts toward strategies with positive advantage. A **small step** learns too slowly. A **huge step with a tiny group** can lock onto a mediocre strategy before the best one shows up. **Normalizing advantages** inside the group makes the push independent of the reward scale.',
    hint: 'Try each learning rate, then change the group size.',
    mission: 'Make all six runs reach 70% by step 60.',
    takeaway: 'Learning rate and group size trade speed against reliability. Group normalization steadies the update.',
    mount(c) {
      const P = [0.05, 0.1, 0.2, 0.3, 0.5, 0.8], STEPS = 100;
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 0, xmax: STEPS, ymin: 0, ymax: 1, xt: [0, 20, 40, 60, 80, 100], yt: [0, 0.25, 0.5, 0.75, 1], yf: v => Math.round(v * 100) + '%', xlabel: 'Training step', ylabel: 'Chance a sample passes' });
      const f = c.fig(420, 188, ch.svg + `<line class="ln dash" x1="${ch.x0}" x2="${ch.x1}" y1="${ch.Y(0.7).toFixed(1)}" y2="${ch.Y(0.7).toFixed(1)}"/><line class="ln dash" x1="${ch.X(60).toFixed(1)}" x2="${ch.X(60).toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><g id="g"></g>`);
      c.legend([['ok', 'Reaches 70% by step 60'], ['bad', 'Does not']]);
      const st = c.stats([{ k: 'a', label: 'Runs at 70% by step 60', value: '', cls: 'ok' }, { k: 'm', label: 'Median at step 60', value: '', cls: 'data' }, { k: 'f', label: 'Median at step 100', value: '', cls: 'cmp' }]);
      let lr = 0.05, G = 4, norm = true;
      function run(seed) {
        const r = kit.rng(seed), th = new Array(6).fill(0), out = [];
        const soft = () => { const m = Math.max(...th), e = th.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
        for (let t = 0; t <= STEPS; t++) {
          const pi = soft(); out.push(pi.reduce((a, p, i) => a + p * P[i], 0)); if (t === STEPS) break;
          const acts = [], rw = [];
          for (let g = 0; g < G; g++) { const u = r(); let cu = 0, a = 5; for (let i = 0; i < 6; i++) { cu += pi[i]; if (u < cu) { a = i; break; } } acts.push(a); rw.push(r() < P[a] ? 1 : 0); }
          const mean = rw.reduce((a, b) => a + b, 0) / G, sd = Math.sqrt(rw.reduce((a, b) => a + (b - mean) ** 2, 0) / G), adv = rw.map(v => norm ? (sd < 1e-9 ? 0 : (v - mean) / (sd + 1e-6)) : v);
          for (let j = 0; j < 6; j++) { let gr = 0; for (let g = 0; g < G; g++) gr += adv[g] * ((acts[g] === j ? 1 : 0) - pi[j]); th[j] += lr * gr / G; }
        }
        return out;
      }
      const med = a => { const s = a.slice().sort((x, y) => x - y); return (s[2] + s[3]) / 2; };
      function draw() {
        const runs = [1, 2, 3, 4, 5, 6].map(run), ok = runs.map(h => h.findIndex(v => v >= 0.7) >= 0 && h.findIndex(v => v >= 0.7) <= 60);
        f.q('#g').innerHTML = runs.map((h, i) => `<path class="${ok[i] ? 's-ok' : 's-bad'} s2" fill="none" d="${kit.path(h.map((v, t) => [ch.X(t), ch.Y(v)]))}" style="opacity:.8"/>`).join('');
        const k = ok.filter(Boolean).length;
        st.set('a', k + ' of 6', 'by step 60'); st.set('m', pct(med(runs.map(h => h[60]))), 'start: 32.5%'); st.set('f', pct(med(runs.map(h => h[100]))), 'best strategy: 80%');
        c.mission.set(k === 6);
      }
      c.slider({ label: 'Learning rate', values: [0.05, 0.1, 0.3, 1, 3], value: 0.05, fmt: v => v, onInput: v => { lr = v; draw(); } });
      c.seg({ label: 'Group size G', options: [['2', '2'], ['4', '4'], ['16', '16']], value: '4', onChange: v => { G = +v; draw(); } });
      const sA = c.seg({ label: 'Advantage', options: [['norm', 'Normalized in the group'], ['raw', 'Raw reward']], value: 'norm', onChange: v => { norm = v === 'norm'; draw(); } });
      c.note('Toy: a softmax policy over six strategies, trained by policy gradient. Six runs use six fixed random seeds. Real code models have billions of parameters but the same logic applies.');
      draw();
      c.demo(1500, async () => { lr = 1; draw(); });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'tests', tag: 'The reward',
    title: 'Weak tests reward wrong answers',
    alt: 'A grid of 100 squares standing for 100 wrong solutions. Squares that pass the tests and are rewarded by mistake are red and the rest are gray. Controls set the number of tests, how likely a bug is to slip past one test, and whether the model can see the tests. Counters show how many wrong solutions earn the reward, how many escape all the tests and the number of tests.',
    text: 'The reward is only as good as the tests. A wrong solution that slips past every test is **rewarded**, and RL makes more like it. If a bug escapes one test with chance **q**, it passes **n** tests with chance **q^n**. And if the model **sees the tests**, it can hard-code their answers. That is [[reward hacking]]. Many hidden tests close both holes.',
    hint: 'Add tests, then hide them from the model.',
    mission: 'Keep wrong answers that earn the reward under 1%.',
    takeaway: 'Rewarding wrong answers teaches wrong answers. Strong, hidden tests protect the signal.',
    mount(c) {
      const f = c.fig(420, 196, '<g id="g"></g>');
      const st = c.stats([{ k: 'w', label: 'Wrong answers rewarded', value: '', cls: 'bad' }, { k: 'e', label: 'Escape all tests', value: '', cls: 'cmp' }, { k: 'n', label: 'Tests', value: '', cls: 'mem' }]);
      let n = 3, q = 0.7, vis = true;
      function draw() {
        const hack = vis ? 0.05 : 0, esc = Math.pow(q, n), fp = hack + (1 - hack) * esc, k = fp < 0.01 ? 0 : Math.round(fp * 100);
        let g = '<text class="b sm" x="16" y="16">100 wrong solutions. Red: rewarded anyway.</text>';
        for (let i = 0; i < 100; i++) g += `<rect class="${i < k ? 'f-bad' : 'well'}" x="${(16 + (i % 10) * 17).toFixed(1)}" y="${(26 + Math.floor(i / 10) * 17).toFixed(1)}" width="14" height="14" rx="3"/>`;
        g += `<text class="lg b" x="212" y="52">${fp < 0.01 ? 'Under 1' : k} of 100</text><text class="xs" x="212" y="72">wrong answers earn the reward</text><text class="xs mute" x="212" y="100">${vis ? 'Tests visible: 5% hard-code.' : 'Held out: nothing to copy.'}</text><text class="xs mute" x="212" y="118">Per test, a bug escapes ${Math.round(q * 100)}%.</text><text class="xs b" x="212" y="140">${q}^${n} = ${pct(esc)}</text>`;
        f.q('#g').innerHTML = g;
        st.set('w', pct(fp), vis ? 'with 5% hard-coders' : 'tests held out'); st.set('e', pct(esc), q + '^' + n); st.set('n', String(n), 'unit tests');
        c.mission.set(fp < 0.01);
      }
      c.slider({ label: 'Number of tests', values: [1, 2, 3, 5, 8, 13, 20, 30, 45, 60], value: 3, fmt: v => v, onInput: v => { n = v; draw(); } });
      c.seg({ label: 'Chance a bug slips past one test', options: [['0.5', '50%'], ['0.7', '70%'], ['0.9', '90%']], value: '0.7', onChange: v => { q = +v; draw(); } });
      const sV = c.seg({ label: 'The model can see the tests', options: [['vis', 'Yes, in the prompt'], ['hid', 'No, held out']], value: 'vis', onChange: v => { vis = v === 'vis'; draw(); } });
      c.note('Toy: tests are independent, and 5% of wrong attempts hard-code visible test answers. Real tests overlap, so the true escape rate falls more slowly with n.');
      draw();
      c.demo(1500, async () => { vis = false; sV.set('hid'); draw(); });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'passk', tag: 'What RL changes',
    title: 'RL can raise pass@1 and still lose at pass@256',
    alt: 'A chart of the share of problems solved against the number of samples per problem, on a log axis from 1 to 256, with one curve for a base model and one for the same model after RL. A marker shows the chosen number of samples. A selector chooses whether RL sharpens the model or expands what it can solve. In the sharpening case, the RL curve starts higher and the base curve overtakes it near 8 samples. Counters show both pass rates and their gap.',
    text: '[[pass@k]] is the share of problems solved when you may sample **k** times. For a problem the model solves with chance p, it is **1 − (1 − p)^k**. RL raises **pass@1** by making good solutions more likely. Whether it also solves problems the base model **never** could is debated. Yue and colleagues found in 2025 that the base model catches up and passes the RL model at large k. Other work argues longer RL can expand the limit.',
    hint: 'Raise k and compare the curves, then switch the RL effect.',
    mission: 'Find a k where the base model beats the RL model.',
    takeaway: 'RL mostly sharpens what the model can already do. Sampling many times shows what is still possible.',
    mount(c) {
      const N = 200, base = Array.from({ length: N }, (_, j) => Math.pow((j + 0.5) / N, 2.2)), sig = x => 1 / (1 + Math.exp(-x));
      const sharp = base.map(p => { const w = sig((p - 0.15) / 0.04), d = -1.5 + 3.5 * w; return sig(Math.log(p / (1 - p)) + d); }), expand = base.map(p => 1 - Math.pow(1 - p, 1.8));
      const pk = (ps, k) => ps.reduce((a, p) => a + 1 - Math.pow(1 - p, k), 0) / ps.length;
      const ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 1, xmax: 256, ymin: 0, ymax: 1, xlog: true, xt: [1, 4, 16, 64, 256], yt: [0, 0.25, 0.5, 0.75, 1], yf: v => Math.round(v * 100) + '%', xlabel: 'Samples per problem, k', ylabel: 'Problems solved' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      c.legend([['mem', 'Base model'], ['cmp', 'After RL']]);
      const st = c.stats([{ k: 'b', label: 'Base model', value: '', cls: 'mem' }, { k: 'r', label: 'After RL', value: '', cls: 'cmp' }, { k: 'd', label: 'RL minus base', value: '', cls: 'ctl' }]);
      let k = 1, eff = 'sharp';
      function draw() {
        const rl = eff === 'sharp' ? sharp : expand, ks = Array.from({ length: 61 }, (_, i) => Math.pow(256, i / 60)), line = ps => kit.path(ks.map(x => [ch.X(x), ch.Y(pk(ps, x))]));
        const b = pk(base, k), r = pk(rl, k), x = ch.X(k);
        f.q('#g').innerHTML = `<path class="s-mem s3" fill="none" d="${line(base)}"/><path class="s-cmp s3" fill="none" d="${line(rl)}"/><line class="ln dash" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(b).toFixed(1)}" r="5" class="f-mem" style="stroke:var(--ink);stroke-width:2"/><circle cx="${x.toFixed(1)}" cy="${ch.Y(r).toFixed(1)}" r="5" class="f-cmp" style="stroke:var(--ink);stroke-width:2"/>`;
        st.set('b', pct(b), 'pass@' + k); st.set('r', pct(r), 'pass@' + k); st.set('d', (r - b >= 0 ? '+' : '−') + Math.abs((r - b) * 100).toFixed(0) + ' points', r < b ? 'the base model is ahead' : 'RL is ahead');
        c.mission.set(eff === 'sharp' && b > r);
      }
      const sl = c.slider({ label: 'Samples per problem k', values: [1, 2, 4, 8, 16, 32, 64, 128, 256], value: 1, fmt: v => v, onInput: v => { k = v; draw(); } });
      c.seg({ label: 'What RL did', options: [['sharp', 'Sharpened the model'], ['expand', 'Expanded the model']], value: 'sharp', onChange: v => { eff = v; draw(); } });
      c.note('Toy: 200 problems whose success chances are skewed low. Sharpening pushes mid-difficulty problems up and hard ones down. Expansion lifts every problem. Real results depend on the model, data and training length.');
      draw();
      c.demo(1500, async () => { k = 64; sl.set(64, true); draw(); });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'horizon', tag: 'Longer tasks',
    title: 'Long tasks make passing samples rare',
    alt: 'A chart of the chance that a multi-step coding task succeeds against the number of steps, on a log axis, with one curve for each per-step reliability from 80% to 99%. The chosen reliability is drawn bold and a marker shows the chosen number of steps. Controls set the per-step reliability and the number of steps. Counters show the success chance of the whole task, the expected passes in a group of 16 and the share of groups that teach.',
    text: 'An agentic coding task, such as fixing a bug in a repository, takes **many steps**: read files, edit, run tests, edit again. The reward arrives only at the end. If each step goes right with chance **r**, the whole task succeeds with chance **r^T**. At 90% per step, a 30-step task succeeds **4%** of the time, so most groups of 16 hold **no pass** and teach nothing. Shorter tasks, a stronger starting model and partial credit for sub-goals all help.',
    hint: 'Set 30 steps, then raise the per-step reliability.',
    mission: 'At 30 steps, keep at least 90% of groups of 16 informative.',
    takeaway: 'Sparse end-of-task rewards starve learning. Per-step reliability compounds, so small gains matter a lot.',
    mount(c) {
      const RS = [0.8, 0.9, 0.95, 0.98, 0.99], ch = kit.chart({ x: 52, y: 26, w: 336, h: 118, xmin: 1, xmax: 100, ymin: 0, ymax: 1, xlog: true, xt: [1, 3, 10, 30, 100], yt: [0, 0.25, 0.5, 0.75, 1], yf: v => Math.round(v * 100) + '%', xlabel: 'Steps in the task, T', ylabel: 'Task success' });
      const f = c.fig(420, 188, ch.svg + '<g id="g"></g>');
      const st = c.stats([{ k: 's', label: 'Task success', value: '', cls: 'ok' }, { k: 'p', label: 'Passes in a group of 16', value: '', cls: 'data' }, { k: 'i', label: 'Groups that teach', value: '', cls: 'cmp' }]);
      let r = 0.9, T = 10;
      function draw() {
        const ts = Array.from({ length: 61 }, (_, i) => Math.pow(100, i / 60)), s = Math.pow(r, T);
        f.q('#g').innerHTML = RS.map(q => `<path class="${q === r ? 's-ok s3' : 'ink-s s2'}" fill="none" d="${kit.path(ts.map(t => [ch.X(t), ch.Y(Math.pow(q, t))]))}" style="opacity:${q === r ? 1 : 0.3}"/>`).join('') + `<line class="ln dash" x1="${ch.X(T).toFixed(1)}" x2="${ch.X(T).toFixed(1)}" y1="${ch.y0}" y2="${ch.y1}"/><circle cx="${ch.X(T).toFixed(1)}" cy="${ch.Y(s).toFixed(1)}" r="5.5" class="f-ok" style="stroke:var(--ink);stroke-width:2"/>`;
        st.set('s', pct(s), r + '^' + T); st.set('p', (16 * s).toFixed(16 * s < 10 ? 1 : 0), 'of 16 samples'); st.set('i', pct(info(s, 16)), 'groups with mixed results');
        c.mission.set(T === 30 && info(s, 16) >= 0.9);
      }
      c.seg({ label: 'Reliability of each step', options: RS.map(v => [String(v), Math.round(v * 100) + '%']), value: '0.9', onChange: v => { r = +v; draw(); } });
      const sT = c.slider({ label: 'Steps in the task, T', values: [1, 3, 5, 10, 20, 30, 50, 100], value: 10, fmt: v => v, onInput: v => { T = v; draw(); } });
      c.note('Toy: steps are independent and the reward is 1 only if every step is right. Real agents recover from some mistakes, which softens the curve.');
      draw();
      c.demo(1500, async () => { T = 30; sT.set(30, true); draw(); });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Eight questions. Each one has a short explanation, right or wrong.',
    quiz: [
      { q: 'What is the reward in RL with verifiable rewards for code?', o: ['Whether the unit tests pass', 'A human rating of style', 'The length of the code', 'The model’s own confidence'], a: 0, why: 'A program can check the answer, so no human or learned judge is needed. Pass is 1 and fail is 0.' },
      { q: 'In GRPO, what is a sample’s advantage?', o: ['The learning rate', 'How much its reward beats the group average, in units of the group’s spread', 'The number of tests it passes', 'The KL penalty'], a: 1, why: 'The advantage is (reward − group mean) ÷ group standard deviation. No separate value model is needed.' },
      { q: 'All 8 samples for a problem pass. What is the learning signal for that group?', o: ['The largest possible', 'Negative', 'Zero, because every advantage is 0', 'It doubles'], a: 2, why: 'With identical rewards the group mean equals each reward, so every advantage is zero. The group teaches nothing.' },
      { q: 'With groups of 8, which pass rate gives the most informative groups?', o: ['About 0%', 'About 99%', 'About 100%', 'About 50%'], a: 3, why: 'At 50%, the chance that all 8 agree is 2 ÷ 256, under 1%. At the extremes almost every group agrees.' },
      { q: 'Why do few tests invite reward hacking?', o: ['Wrong or hard-coded solutions can pass them and are rewarded', 'The model cannot read them', 'Tests make training slower', 'Passing needs more tokens'], a: 0, why: 'Whatever passes the check earns the reward, so the policy learns to pass the check. Strong, hidden tests narrow the gap.' },
      { q: 'What does pass@k measure?', o: ['The average length of k solutions', 'The chance that at least one of k samples passes', 'The number of tests in a suite', 'The share of tokens that compile'], a: 1, why: 'For a problem solved with chance p per sample, pass@k is 1 − (1 − p)^k, averaged over problems.' },
      { q: 'A 30-step agentic task has 90% reliability per step. About what share of attempts succeed?', o: ['About 90%', 'About 40%', 'About 4%', 'About 0.04%'], a: 2, why: '0.9 to the power 30 is about 0.042. Most groups of 16 would contain no pass.' },
      { q: 'Why did DeepSeek-R1 use rule-based rewards instead of a learned reward model for its reasoning RL?', o: ['Rules are more accurate for style', 'A learned reward model needs no data', 'Rules train faster on CPUs', 'A learned reward model can be exploited by the policy'], a: 3, why: 'The report says a neural reward model can suffer reward hacking in large-scale RL. Checkable rules are harder to game.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g>'
    + [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${30 + i * 32}" y="40" width="26" height="34" rx="5" style="fill:var(--${[0, 1, 0, 0, 1, 0, 1, 0][i] ? 'ok' : 'bad'});opacity:.9"/>`).join('')
    + [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<text x="${43 + i * 32}" y="100" text-anchor="middle" style="font:600 10px var(--font-mono);fill:var(--ink-2)">${[0, 1, 0, 0, 1, 0, 1, 0][i] ? '+1.3' : '-0.8'}</text>`).join('')
    + '</g><text x="30" y="22" style="font:600 11px var(--font-mono);fill:var(--ink-3)">pass, fail, advantage</text></svg>';

  window.LESSONS.push({
    id: 'rlcode', n: 17, track: 'training', order: 3,
    title: 'Reinforcement Learning for Code',
    tagline: 'Rewards from unit tests, group-relative advantages, and where the learning signal runs out.',
    preview,
    scenes: S
  });
})();
