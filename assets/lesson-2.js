/* Lesson 2: How an AI agent works */
(function () {
  'use strict';
  const { fmt, esc } = window.LLMI;
  const S = [];

  /* 1 ---------------------------------------------------------------- */
  S.push({
    id: 'loop', tag: 'The core',
    title: 'An agent is a while loop',
    alt: 'Pseudo-code of the agent loop beside a diagram. The model produces tool calls, tools run, results are added to the messages, and the loop repeats until the model replies with no tool calls.',
    text: 'Claude Code ships multi-file refactors and debugs race conditions with dozens of [[tool call|tool calls]] and hundreds of decisions. Its core is one loop: **call the model, run its tool calls, feed the results back**. It stops when the model asks for no more tools.',
    takeaway: 'Everything else in this lesson is a layer around that one loop.',
    mount(c) {
      const code = ['messages = [user_request]', 'while True:', '    reply = model(messages)', '    if not reply.tool_calls:', '        break                    # stop signal', '    results = run(reply.tool_calls)', '    messages += [reply, results]', 'show(reply.text)'];
      const box = c.html(`<pre class="codeblk">${code.map((l, i) => `<span class="cl" data-l="${i}">${esc(l) || ' '}</span>`).join('')}</pre>`);
      const f = c.fig(420, 176, `
        <rect class="t-data" x="20" y="104" width="108" height="42" rx="10"/><text class="b sm" x="74" y="130" text-anchor="middle">Messages</text>
        <rect class="t-ctl" x="156" y="12" width="108" height="42" rx="10"/><text class="b sm" x="210" y="38" text-anchor="middle">Model</text>
        <rect class="t-cmp" x="292" y="104" width="108" height="42" rx="10"/><text class="b sm" x="346" y="130" text-anchor="middle">Tools</text>
        <rect class="t-ok" x="320" y="12" width="80" height="42" rx="10"/><text class="b sm" x="360" y="38" text-anchor="middle">Done</text>
        <path class="ln s2 s-ink" d="M62 102 L162 52" marker-end="url(#ah-ink)"/>
        <path class="ln s2" d="M258 52 L340 102" marker-end="url(#ah-ink)"/><text class="xs mute" x="318" y="72">tool calls</text>
        <path class="ln s2" d="M290 126 H132" marker-end="url(#ah-ink)"/><text class="xs mute" x="211" y="144" text-anchor="middle">results</text>
        <path class="ln s2" d="M266 33 H318" marker-end="url(#ah-ink)"/><text class="xs mute" x="292" y="26" text-anchor="middle">none</text>
        <text id="turn" class="m b sm" x="210" y="96" text-anchor="middle">turn 0</text>
        <circle id="dot" class="f-data" cx="74" cy="125" r="8" stroke="var(--stage)" stroke-width="2"/>`);
      const lines = box.qa('.cl'), dot = f.q('#dot');
      const hl = (...ix) => lines.forEach((l, i) => l.classList.toggle('on', ix.indexOf(i) >= 0));
      const P = { msg: [74, 125], model: [210, 33], tools: [346, 125], done: [360, 33] };
      const go = (k, ms) => c.fx(dot, { x: P[k][0] - 74, y: P[k][1] - 125 }, ms || 420, c.ease.io);
      c.play(async () => {
        for (let t = 1; t <= 3; t++) {
          f.q('#turn').textContent = 'turn ' + t;
          hl(2); await go('model'); hl(5); await go('tools'); hl(6); await go('msg'); await c.wait(150);
        }
        f.q('#turn').textContent = 'turn 4';
        hl(2); await go('model'); hl(3, 4); await c.wait(400); await go('done'); hl(7); await c.fx(dot, { o: 0 }, 300);
      });
    }
  });

  /* 2 ---------------------------------------------------------------- */
  S.push({
    id: 'chat-vs-agent', tag: 'The core',
    title: 'A chatbot answers once. An agent keeps going.',
    alt: 'Two rows of steps for the task make the failing test pass. The chatbot makes one model call and answers. The agent alternates model calls and tool calls until the tests pass.',
    text: 'A chatbot takes one message and returns one response. An **[[agent]]** acts: it reads a file, runs a command, edits code, and looks at the result. Based on what it sees, it decides what to do next. It stops when a reply contains **zero tool calls**.',
    takeaway: 'The stop signal is simple: a response with no tool calls.',
    mount(c) {
      const node = (t, k) => `<span class="nd ${k}">${t}</span><span class="ar">›</span>`;
      const CB = [['You', 'you'], ['Model', 'model'], ['Answer', 'ans']];
      const AG = [['You', 'you'], ['Model', 'model'], ['Read file', 'tool'], ['Model', 'model'], ['Run tests', 'tool'], ['Model', 'model'], ['Edit code', 'tool'], ['Model', 'model'], ['Run tests', 'tool'], ['Model', 'model'], ['Answer', 'ans']];
      const h = c.html(`<p class="kicker" style="margin:0 0 10px">Task: make the failing test pass</p>
        <div class="lane"><p class="kicker">Chatbot: one arrow in, one arrow out</p><div class="chain" id="cb">${CB.map(n => node(n[0], n[1])).join('').replace(/<span class="ar">›<\/span>$/, '')}</div></div>
        <div class="lane"><p class="kicker">Agent: act, observe, decide, repeat</p><div class="chain" id="ag">${AG.map(n => node(n[0], n[1])).join('').replace(/<span class="ar">›<\/span>$/, '')}</div></div>`);
      const st = c.stats([{ k: 'a', label: 'Chatbot', value: '1 model call', sub: '0 actions on your machine', cls: 'ctl' }, { k: 'b', label: 'Agent', value: '5 model calls', sub: '4 actions, each observed', cls: 'cmp' }]);
      c.play(async () => {
        for (const n of h.qa('#cb .nd')) { n.classList.add('on'); await c.wait(380); }
        await c.wait(300);
        for (const n of h.qa('#ag .nd')) { n.classList.add('on'); await c.wait(330); }
      });
    }
  });

  /* 3 ---------------------------------------------------------------- */
  S.push({
    id: 'gather-act-verify', tag: 'The core',
    title: 'Gather, act, verify, repeat',
    alt: 'A cycle of three phases. Gather context, take action, verify. If verification fails the loop returns to gathering. If it passes, the reply has no tool calls and the agent stops.',
    text: 'Each lap has three phases. **Gather** context: read files, search code. **Act**: edit the code. **Verify**: run the tests and check the output. If verification fails, the loop goes back to gathering. If it passes, the model replies without tool calls and the agent is done.',
    hint: 'Choose whether the tests pass, then run a lap.',
    takeaway: 'A failed check sends the agent back around. Only a pass ends the loop.',
    mount(c) {
      const stt = { pass: false, busy: false };
      const f = c.fig(420, 340, `
        <rect id="rg" class="t-mem" x="130" y="16" width="160" height="64" rx="12"/><text class="b" x="210" y="44" text-anchor="middle">1. Gather</text><text class="sm" x="210" y="64" text-anchor="middle">read files, search code</text>
        <rect id="ra" class="t-cmp" x="250" y="200" width="156" height="64" rx="12"/><text class="b" x="328" y="228" text-anchor="middle">2. Act</text><text class="sm" x="328" y="248" text-anchor="middle">edit code, run tools</text>
        <rect id="rv" class="t-data" x="14" y="200" width="156" height="64" rx="12"/><text class="b" x="92" y="228" text-anchor="middle">3. Verify</text><text class="sm" x="92" y="248" text-anchor="middle">run tests, read output</text>
        <path class="ln s2" d="M262 82 L318 198" marker-end="url(#ah-ink)"/>
        <path class="ln s2" d="M248 232 H174" marker-end="url(#ah-ink)"/>
        <path class="ln s2 s-bad" d="M78 198 L156 82" marker-end="url(#ah-bad)"/><text class="xs b" x="20" y="126">fails:</text><text class="xs b" x="20" y="141">loop back</text>
        <path class="ln s2 s-ok" d="M92 266 V296" marker-end="url(#ah-ok)"/>
        <rect id="rd" class="t-ok" x="14" y="298" width="236" height="34" rx="9"/><text class="b sm" x="132" y="320" text-anchor="middle">Done: reply has zero tool calls</text>
        <circle id="dot" class="f-data" cx="210" cy="48" r="8" stroke="var(--stage)" stroke-width="2"/>`);
      const P = { g: [210, 48], a: [328, 232], v: [92, 232], d: [92, 315] };
      const dot = f.q('#dot'), mv = k => c.fx(dot, { x: P[k][0] - 210, y: P[k][1] - 48 }, 520, c.ease.io);
      const light = id => ['#rg', '#ra', '#rv', '#rd'].forEach(r => f.q(r).style.strokeWidth = r === id ? 3.5 : 1.6);
      const st = c.stats([{ k: 'l', label: 'Laps', value: '0' }, { k: 'r', label: 'Last check', value: '–' }]);
      let laps = 0;
      async function lap() {
        if (stt.busy) return; stt.busy = true;
        laps++; st.set('l', laps); c.place(dot, { o: 1 });
        light('#rg'); await mv('g'); await c.wait(220);
        light('#ra'); await mv('a'); await c.wait(220);
        light('#rv'); await mv('v'); await c.wait(220);
        if (stt.pass) { st.set('r', 'Pass'); st.cls('r', 'ok'); light('#rd'); await mv('d'); await c.fx(dot, { o: 0 }, 300); c.say('Tests pass. The reply has no tool calls, so the loop stops.'); }
        else { st.set('r', 'Fail'); st.cls('r', 'bad'); c.say('Tests fail. The failure goes back in as context and the loop starts another lap.'); await c.wait(400); light('#rg'); await mv('g'); }
        stt.busy = false;
      }
      c.seg({ label: 'Do the tests pass?', options: [[0, 'Fail'], [1, 'Pass']], value: 0, onChange: v => { stt.pass = !!+v; } });
      c.btn('Run a lap', () => lap(), { kind: 'pri', small: true });
      light('#rg');
      c.play(async () => { await lap(); stt.pass = true; await lap(); stt.pass = false; });
    }
  });

  /* 4 ---------------------------------------------------------------- */
  S.push({
    id: 'five-turns', tag: 'A real task',
    title: 'Five API calls to fix a real bug',
    alt: 'Five turns of an agent fixing a failing test. Turns one and two gather context, turn three edits, turn four verifies, turn five replies with no tool calls and stops.',
    text: 'Here is a failing test, start to finish. Turns 1 and 2 **gather**. Turn 3 **acts**. Turn 4 **verifies**. In turn 5 the model replies with no tool calls, and that is the stop signal. Five round trips to the model fixed the bug.',
    hint: 'Switch on the code change to see exactly what turn 3 edits.',
    takeaway: 'The agent chose each next step from what the last result showed. Nobody scripted it.',
    mount(c) {
      const T = [
        { ph: 'Gather', n: 2, say: 'I’ll read the failing test and the code it covers.', tools: ['Read auth.test.ts', 'Read auth.ts'], res: 'auth.test.ts (48 lines), auth.ts (112 lines)' },
        { ph: 'Gather', n: 1, say: 'Let me run the tests to see the exact failure.', tools: ['Bash: npm test'], res: 'FAIL  expired tokens are rejected: expected false, got true' },
        { ph: 'Act', n: 1, say: 'The expiry check compares seconds with milliseconds. Fixing it.', tools: ['Edit auth.ts'], res: 'auth.ts edited (1 change)', diff: true },
        { ph: 'Verify', n: 1, say: 'Running the tests again.', tools: ['Bash: npm test'], res: 'PASS  12 tests' },
        { ph: 'Done', n: 0, say: 'Fixed. The expiry check mixed seconds and milliseconds. All 12 tests pass.', tools: [], res: '' }
      ];
      const h = c.html(`<div class="turns">${T.map((t, i) => `<div class="tcard" style="opacity:.2"><div class="th"><b>Turn ${i + 1}</b><span class="ph ${t.ph}">${t.ph}</span><span class="tc">${t.n ? t.n + (t.n === 1 ? ' tool call' : ' tool calls') : '0 tool calls: stop'}</span></div><p class="say">${t.say}</p>${t.tools.length ? `<div class="tl">${t.tools.map(x => `<span>${x}</span>`).join('')}</div><div class="rs">${t.res}</div>` : ''}${t.diff ? `<pre class="codeblk diff" hidden><span class="cl del">- if (token.exp &lt; Date.now())</span><span class="cl add">+ if (token.exp * 1000 &lt; Date.now())</span></pre>` : ''}</div>`).join('')}</div>`);
      const st = c.stats([{ k: 'a', label: 'Model round trips', value: '5', cls: 'ctl' }, { k: 'b', label: 'Tool calls', value: '5', cls: 'cmp' }, { k: 'c', label: 'Human steps', value: '0' }]);
      const diff = h.q('.diff');
      c.toggle({ label: 'Show the code change in turn 3', value: false, onChange: v => { diff.hidden = !v; } });
      c.play(async () => { for (const card of h.qa('.tcard')) { await c.fx(card, { o: 1 }, 380); await c.wait(750); } });
    }
  });

  /* 5 ---------------------------------------------------------------- */
  S.push({
    id: 'ten-steps', tag: 'Inside a turn',
    title: 'Ten steps fire every turn. One does the work.',
    alt: 'A list of ten steps in one turn: context assembly, the API call, tokens flowing back, tool call extraction, a permission check, pre-tool hooks, the tool run, result capture, post-tool hooks and the loop decision. Only step seven runs the tool.',
    text: 'Each turn runs the same ten steps. Only **step 7** executes anything. The other nine assemble the request, check safety or control what happens next. The pipeline is built for control as much as for speed.',
    takeaway: 'One execution step, nine steps of assembly, safety and control.',
    mount(c) {
      const STEPS = [
        ['Context assembly', 'The conversation, system prompt and tool list are packed into one payload.', 'assemble', 'Assemble'],
        ['API call with streaming', 'The payload goes to the model and tokens start streaming back.', 'model', 'Model'],
        ['Tokens flow back', 'The reply arrives piece by piece.', 'model', 'Model'],
        ['Tool calls extracted', 'Any tool_use blocks are pulled out of the reply.', 'model', 'Model'],
        ['Permission check', 'Is this tool call allowed? Rules decide.', 'safety', 'Safety'],
        ['Pre-tool-use hooks', 'Your scripts run first and can block the call.', 'safety', 'Safety'],
        ['Tool runs', 'The only step that touches your machine.', 'run', 'Execute'],
        ['Result captured', 'Output, errors and exit codes are collected.', 'control', 'Control'],
        ['Post-tool-use hooks', 'Your scripts run again, for example to format or log.', 'control', 'Control'],
        ['Loop decision', 'Tool calls present: back to step 1. None: show the reply.', 'control', 'Control']
      ];
      const h = c.html(`<div class="stps">${STEPS.map((s, i) => `<div class="stp ${s[2]}"><span class="n">${i + 1}</span><span><b>${s[0]}</b><small>${s[1]}</small></span><span class="g">${s[3]}</span></div>`).join('')}</div>`);
      const rows = h.qa('.stp');
      c.play(async () => {
        for (let i = 0; i < rows.length; i++) { rows.forEach(r => r.classList.remove('now')); rows[i].classList.add('now', 'seen'); await c.wait(i === 6 ? 900 : 520); }
        rows.forEach(r => r.classList.remove('now')); rows[6].classList.add('now');
      });
    }
  });

  /* 6 ---------------------------------------------------------------- */
  S.push({
    id: 'thinking', tag: 'Inside a turn',
    title: 'The model thinks between every action',
    alt: 'A sequence of blocks: thinking, tool use, tool result, thinking, tool use, tool result, reply. Thinking blocks sit between tool actions. A slider sets the thinking budget and shows the most it can cost per turn.',
    text: 'Extended thinking is on by default. The model alternates **thought, action, observation** until the task is done, with thinking blocks sitting between tool calls. Thinking costs tokens, so it has a **budget**: up to about 32,000 tokens per turn. Words like “think harder” raise it.',
    hint: 'Move the thinking budget and read the worst-case cost of a turn.',
    takeaway: 'More thinking helps on hard problems and costs more tokens. A budget is a cap, not a target.',
    mount(c) {
      const B = [['thinking', 'THINKING', 'The test fails on expiry. Check how exp is compared.'], ['use', 'TOOL USE', 'Read auth.ts'], ['res', 'RESULT', 'exp is in seconds. Date.now() is in milliseconds.'], ['thinking', 'THINKING', 'That mismatch explains it. Multiply exp by 1000.'], ['use', 'TOOL USE', 'Edit auth.ts'], ['res', 'RESULT', 'edited, 1 change'], ['reply', 'REPLY', 'Fixed the expiry check.']];
      const h = c.html(`<div class="react">${B.map(b => `<div class="rb ${b[0]}" style="opacity:.15"><span class="rl">${b[1]}</span><span class="rt">${b[2]}</span></div>`).join('')}</div>`);
      const st = c.stats([{ k: 'b', label: 'Most thinking per turn', value: '', cls: 'ctl' }, { k: 'c', label: 'Worst-case cost per turn', value: '', cls: 'cmp', sub: 'at $15 per million output tokens' }, { k: 't', label: 'Over a 20-turn task', value: '' }]);
      function upd(v) { const per = v * 15 / 1e6; st.set('b', fmt.n(v) + ' tokens'); st.set('c', fmt.usd(per)); st.set('t', fmt.usd(per * 20), 'if every turn used the full budget'); }
      c.slider({ label: 'Thinking budget (tokens)', values: [0, 2000, 8000, 16000, 32000], value: 32000, fmt: v => v ? fmt.n(v) : 'off', onInput: upd });
      c.note('The $15 price is an example. In verbose mode (Ctrl+O) thoughts appear as gray italic text.');
      upd(32000);
      c.play(async () => { for (const r of h.qa('.rb')) { await c.fx(r, { o: 1 }, 320); await c.wait(520); } });
    }
  });

  /* 7 ---------------------------------------------------------------- */
  S.push({
    id: 'system-prompt', tag: 'What the model sees',
    title: 'The system prompt has eight layers',
    alt: 'Eight stacked layers that make up the system prompt: core identity, behavioral rules, tool definitions, CLAUDE.md, auto memory, skill descriptions, MCP tools and dynamic context. They are rebuilt and sent on every API call.',
    text: 'The system prompt is not a paragraph. It is thousands of tokens assembled from **eight layers**, then rebuilt and sent with **every** API call. Some layers are fixed. Others come from your project and from what is connected right now.',
    hint: 'Click a layer to see an example of what it holds.',
    takeaway: 'You steer the agent mostly through layers 4 to 8. Layers 1 to 3 ship with the tool.',
    mount(c) {
      const L = [
        ['Core identity', '~270 tokens', 'You are Claude Code, an AI coding assistant working in the user’s terminal.'],
        ['Behavioral rules', 'hard limits', 'Never force push. Use Read, not cat. Use Edit, not sed.'],
        ['Tool definitions', 'JSON schemas', '{ "name": "Edit", "input_schema": { "file_path", "old_string", "new_string" } }'],
        ['CLAUDE.md', 'your team’s context', 'Use bun, not npm. Run the tests before every commit.'],
        ['Auto memory', 'notes it saved', 'The test database runs on port 5433.'],
        ['Skill descriptions', 'what each skill is for', 'pdf: read, fill and sign PDF forms.'],
        ['MCP tools', 'connected servers', 'github.create_issue, slack.post_message'],
        ['Dynamic context', 'facts about now', 'Today’s date, working directory, git status.']
      ];
      const h = c.html(`<div class="layers">${L.map((l, i) => `<button type="button" class="lay" style="opacity:.15" data-i="${i}"><span class="n">${i + 1}</span><span><b>${l[0]}</b><small>${l[1]}</small><em class="ex">${esc(l[2])}</em></span></button>`).join('')}</div><p class="payload" style="opacity:.2">All eight are rebuilt and sent with every API call: about 2,000 to 10,000 tokens.</p>`);
      const rows = h.qa('.lay');
      rows.forEach(r => c.on(r, 'click', () => { const open = r.classList.contains('open'); rows.forEach(x => x.classList.remove('open')); if (!open) r.classList.add('open'); }));
      c.play(async () => { for (const r of rows) { await c.fx(r, { o: 1 }, 260); await c.wait(240); } await c.fx(h.q('.payload'), { o: 1 }, 400); rows[3].classList.add('open'); });
    }
  });

  /* 8 ---------------------------------------------------------------- */
  S.push({
    id: 'claude-md', tag: 'What the model sees',
    title: 'Five CLAUDE.md layers compose into one',
    alt: 'Five layers of instructions: enterprise policy, project conventions, scoped rules, personal preferences and project-local overrides. Switching a layer on adds its rule to the combined instructions the agent reads.',
    text: 'One agent serves a whole organization through five layers of CLAUDE.md: company policy, project conventions, scoped rules, personal preferences and local overrides. They are all **composed into a single system prompt**. The agent knows your company, your team and you.',
    hint: 'Switch layers on and off and watch the combined instructions change.',
    takeaway: 'Put each rule at the broadest layer that is true for it. Narrow layers add detail.',
    mount(c) {
      const L = [
        ['Enterprise policy', 'Set by your company. Applies to everyone.', 'Use TypeScript strict mode.'],
        ['Project conventions', 'In the repo, version controlled, shared by the team.', 'Use bun, not npm.'],
        ['Scoped rules', 'Apply only to files that match a path.', 'In src/api/**, validate input with zod.'],
        ['Personal preferences', 'Yours, across every project.', 'Explain changes in plain language.'],
        ['Project-local overrides', 'Yours, this project only, not committed.', 'My test database is on port 5433.']
      ];
      const on = L.map(() => true);
      const h = c.html(`<div class="mdl">${L.map((l, i) => `<div class="mrow on" data-i="${i}"><button type="button" class="sw" role="switch" aria-checked="true" aria-label="${l[0]}"><i></i></button><span><b>${l[0]}</b><small>${l[1]}</small></span></div>`).join('')}</div><p class="kicker" style="margin:12px 0 6px">What the agent reads</p><pre class="codeblk" id="out"></pre>`);
      function render() {
        const lines = L.map((l, i) => on[i] ? `<span class="cm"># ${l[0]}</span>\n${esc(l[2])}` : null).filter(Boolean);
        h.q('#out').innerHTML = lines.length ? lines.join('\n') : '<span class="cm"># no instructions loaded</span>';
        h.qa('.mrow').forEach((r, i) => { r.classList.toggle('on', on[i]); r.querySelector('.sw').setAttribute('aria-checked', String(on[i])); });
      }
      h.qa('.mrow .sw').forEach((b, i) => c.on(b, 'click', () => { on[i] = !on[i]; render(); }));
      render();
      c.demo(2000, async () => { for (const i of [4, 3, 2]) { on[i] = false; render(); await c.wait(900); } for (const i of [2, 3, 4]) { on[i] = true; render(); await c.wait(500); } });
    }
  });

  /* 9 ---------------------------------------------------------------- */
  S.push({
    id: 'edit-tool', tag: 'Tools',
    title: 'Dedicated tools beat raw shell commands',
    alt: 'A short file shown with the text the Edit tool would search for marked. If the text matches more than once the edit fails. If it matches exactly once the edit succeeds and the change is shown.',
    text: 'Claude Code has dedicated tools instead of one raw shell. The **Edit** tool takes exactly three parameters: a file path, the old string and the new string. If the old string is **not unique**, the edit fails by design. You see exactly what changes, and nothing is edited by accident.',
    hint: 'Pick the text the agent searches for. Only a unique match goes through.',
    takeaway: 'An ambiguous edit fails instead of guessing. That is why the system prompt says: use Edit, not sed.',
    mount(c) {
      const FILE = ['function total(items) {', '  let sum = 0;', '  for (const i of items) sum += i.price;', '  return sum;', '}', 'function count(items) {', '  let n = 0;', '  for (const i of items) n += 1;', '  return n;', '}'].join('\n');
      const NEW = 'sum += i.price * i.qty;';
      const OPT = ['for (const i of items)', 'sum', 'sum += i.price;'];
      const h = c.html(`<div class="params"><div><span class="k">file_path</span><code>cart.js</code></div><div><span class="k">old_string</span><code id="po">choose one</code></div><div><span class="k">new_string</span><code>${esc(NEW)}</code></div></div><pre class="codeblk" id="code"></pre><div id="res" class="editres"></div>`);
      const cnt = (s, t) => t.split(s).length - 1;
      function show(i) {
        const s = OPT[i], n = cnt(s, FILE);
        h.q('#po').textContent = s;
        if (n === 1) {
          const out = FILE.replace(s, NEW).split('\n'), old = FILE.split('\n');
          h.q('#code').innerHTML = old.map((l, k) => out[k] !== l ? `<span class="cl del">- ${esc(l)}</span><span class="cl add">+ ${esc(out[k])}</span>` : `<span class="cl">  ${esc(l)}</span>`).join('');
          h.q('#res').className = 'editres ok'; h.q('#res').innerHTML = '<b>Edit applied.</b> The old string matched exactly once.';
        } else {
          h.q('#code').innerHTML = FILE.split(s).map(esc).join(`<mark>${esc(s)}</mark>`).split('\n').map(l => `<span class="cl">  ${l}</span>`).join('');
          h.q('#res').className = 'editres bad'; h.q('#res').innerHTML = `<b>Edit refused.</b> The old string was found ${n} times. Add more surrounding text so it matches once.`;
        }
      }
      const sg = c.seg({ label: 'Text to replace (old_string)', options: OPT.map((s, i) => [i, s]), value: 0, onChange: v => show(+v) });
      show(0);
      c.demo(2200, async () => { sg.set(1); show(1); await c.wait(1700); sg.set(2); show(2); });
    }
  });

  /* 10 --------------------------------------------------------------- */
  S.push({
    id: 'tool-contract', tag: 'Tools',
    title: 'The model asks. Your machine acts.',
    alt: 'The model sits above and the runtime on your machine below. Tool definitions travel up, a tool_use request travels down, the runtime performs the action, and a tool_result travels back up.',
    text: 'A text-only model edits your files through a four-step contract. **Define**: tool schemas ship in every request. **Decide**: the model returns a tool_use block, a declaration of intent. **Execute**: the runtime on your machine performs it. **Feedback**: the result returns as a message.',
    takeaway: 'The model never touches your file system. Every action goes through the runtime, so every action can be checked.',
    mount(c) {
      const card = (id, x, y, l1, l2, cls) => `<g id="${id}" transform="translate(${x} ${y})" style="opacity:0"><rect class="${cls}" width="176" height="46" rx="9"/><text class="m xs b" x="10" y="19">${l1}</text><text class="m xs" x="10" y="35">${l2}</text></g>`;
      const f = c.fig(420, 340, `
        <rect class="t-ctl" x="20" y="12" width="380" height="58" rx="14"/><text class="b" x="36" y="37">Model</text><text class="sm" x="36" y="57">in the cloud: writes text and tool_use blocks</text>
        <rect id="rt" class="t-cmp" x="20" y="270" width="380" height="58" rx="14"/><text class="b" x="36" y="295">Runtime on your machine</text><text class="sm" x="36" y="315">checks the request, then does the work</text>
        <g id="fs" transform="translate(326 280)"><rect class="box" width="64" height="38" rx="8"/><text class="m xs b" x="32" y="23" text-anchor="middle">auth.ts</text></g>
        <path class="ln thin" d="M116 262 V80" marker-end="url(#ah-ink)" style="opacity:.45"/><path class="ln thin" d="M304 80 V262" marker-end="url(#ah-ink)" style="opacity:.45"/>
        <text class="xs mute" x="124" y="170">up</text><text class="xs mute" x="312" y="170">down</text>
        ${card('c1', 28, 190, 'tools: [Read, Edit, Bash]', 'JSON schemas, every call', 'box')}
        ${card('c2', 216, 100, 'tool_use', '{"name":"Read",...}', 't-ctl')}
        ${card('c3', 28, 190, 'tool_result', '"function total(..."', 't-data')}`);
      const h = c.html(`<div class="chain" style="margin-top:6px;justify-content:center">${['1 Define', '2 Decide', '3 Execute', '4 Feedback'].map((s, i) => `<span class="nd ${i === 2 ? 'tool' : 'model'}">${s}</span>${i < 3 ? '<span class="ar">›</span>' : ''}`).join('')}</div>`);
      const chips = h.qa('.nd'), lit = i => chips.forEach((n, k) => n.classList.toggle('on', k <= i));
      const q = id => f.q(id);
      c.play(async () => {
        lit(0); c.say('**1 Define.** Tool schemas are sent with every request.');
        q('#c1').style.opacity = 1; await c.fx(q('#c1'), { y: 100 }, 800); await c.wait(450);
        lit(1); q('#c1').style.opacity = 0.3; c.say('**2 Decide.** The model returns a tool_use block. That is a request, not an action.');
        q('#c2').style.opacity = 1; await c.fx(q('#c2'), { y: 190 }, 900); await c.wait(400);
        lit(2); c.say('**3 Execute.** The runtime on your machine opens the file. The model is not involved.');
        for (let k = 0; k < 2; k++) { q('#rt').style.strokeWidth = 4; q('#fs').style.opacity = 0.35; await c.wait(260); q('#rt').style.strokeWidth = ''; q('#fs').style.opacity = 1; await c.wait(260); }
        lit(3); q('#c1').style.opacity = 0; q('#c2').style.opacity = 0.35; c.say('**4 Feedback.** The result goes back as a message, and the loop continues.');
        q('#c3').style.opacity = 1; await c.fx(q('#c3'), { y: 100 }, 900);
      });
    }
  });

  /* 11 --------------------------------------------------------------- */
  S.push({
    id: 'permission-gate', tag: 'Safety',
    title: 'Every tool call passes a six-stage gate',
    alt: 'A tool call moves through six stages: hooks, deny rules, allow rules, ask rules, the permission mode and a final callback. The first stage that decides ends the check. Deny comes first.',
    text: 'Safety is a gate every tool call must pass, in six stages: **[[hook|hooks]]**, **deny** rules, **allow** rules, **ask** rules, the **permission mode**, then a final callback. The first stage that decides wins, and because deny is checked early, **denial always takes priority**.',
    hint: 'Pick a tool call and a mode. Watch which stage decides.',
    takeaway: 'Deny first, first match wins. A deny rule beats an allow rule for the same call.',
    mount(c) {
      const RULES = { hook: ['Edit(.env*)'], deny: ['Bash(git push --force*)', 'Bash(curl*)'], allow: ['Read(*)', 'Bash(npm test*)'], ask: ['Edit(*)'] };
      const glob = (pat, call) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(call);
      const CALLS = ['Read(src/app.ts)', 'Bash(npm test)', 'Bash(git push --force)', 'Edit(src/app.ts)', 'Edit(.env)', 'Bash(ls)'];
      const NAMES = ['Pre-tool-use hooks', 'Deny rules', 'Allow rules', 'Ask rules', 'Permission mode', 'canUseTool callback'];
      const SUB = ['Your scripts get first say', 'Explicit block list', 'Pre-approved patterns', 'Conditional approval', 'default, acceptEdits, plan, dontAsk, bypass', 'Programmatic final say'];
      const stt = { call: CALLS[0], mode: 'default', run: 0 };
      function evaluate(call, mode) {
        const kind = call.indexOf('Read') === 0 ? 'read' : call.indexOf('Edit') === 0 ? 'edit' : 'shell';
        const out = []; let verdict = null;
        const stage = (i, fn) => { if (verdict) { out[i] = { st: 'skip', note: 'not reached' }; return; } const r = fn(); out[i] = r; if (r.v) verdict = r.v; };
        const find = list => list.find(p => glob(p, call));
        stage(0, () => find(RULES.hook) ? { st: 'hit', v: 'deny', note: 'hook exits with code 2 and blocks the call' } : { st: 'pass', note: 'no hook objected' });
        stage(1, () => { const p = find(RULES.deny); return p ? { st: 'hit', v: 'deny', note: 'matches deny rule ' + p } : { st: 'pass', note: 'no deny rule matches' }; });
        stage(2, () => { const p = find(RULES.allow); return p ? { st: 'hit', v: 'allow', note: 'matches allow rule ' + p } : { st: 'pass', note: 'no allow rule matches' }; });
        stage(3, () => { const p = find(RULES.ask); return p ? { st: 'hit', v: 'ask', note: 'matches ask rule ' + p } : { st: 'pass', note: 'no ask rule matches' }; });
        stage(4, () => {
          if (mode === 'bypass') return { st: 'hit', v: 'allow', note: 'bypass mode approves everything' };
          if (kind === 'read') return { st: 'hit', v: 'allow', note: mode + ' mode: reads need no prompt' };
          if (mode === 'plan') return { st: 'hit', v: 'deny', note: 'plan mode is read-only' };
          if (mode === 'dontAsk') return { st: 'hit', v: 'deny', note: 'dontAsk auto-denies anything that would prompt' };
          if (mode === 'acceptEdits' && kind === 'edit') return { st: 'hit', v: 'allow', note: 'acceptEdits auto-approves file changes' };
          return { st: 'pass', note: mode + ' mode would prompt for this' };
        });
        stage(5, () => ({ st: 'hit', v: 'ask', note: 'callback asks you in the terminal' }));
        return { out, verdict };
      }
      const h = c.html(`<div class="callbar"><span class="k">Tool call</span><code id="ct"></code></div><ol class="stages">${NAMES.map((n, i) => `<li class="gst" data-s="skip"><span class="n">${i + 1}</span><span><b>${n}</b><small>${SUB[i]}</small></span><span class="gres"></span></li>`).join('')}</ol><div id="vd" class="verdict" data-v=""></div>
        <div class="ruleset"><b>Rules in force</b><span><i>hook</i> block ${RULES.hook.map(r => `<code>${r}</code>`).join(' ')}</span><span><i>deny</i> ${RULES.deny.map(r => `<code>${r}</code>`).join(' ')}</span><span><i>allow</i> ${RULES.allow.map(r => `<code>${r}</code>`).join(' ')}</span><span><i>ask</i> ${RULES.ask.map(r => `<code>${r}</code>`).join(' ')}</span></div>`);
      const ICON = { ok: '✓', bad: '×', ask: '!' };
      async function go() {
        const id = ++stt.run, { out, verdict } = evaluate(stt.call, stt.mode), rows = h.qa('.gst');
        h.q('#ct').textContent = stt.call; h.q('#vd').dataset.v = ''; h.q('#vd').textContent = '';
        rows.forEach(r => { r.dataset.s = 'wait'; r.querySelector('.gres').textContent = ''; });
        for (let i = 0; i < 6; i++) {
          await c.wait(i === 0 ? 150 : 300); if (id !== stt.run) return;
          const o = out[i], r = rows[i];
          r.dataset.s = o.st === 'hit' ? 'hit-' + o.v : o.st;
          r.querySelector('.gres').textContent = (o.st === 'hit' ? (o.v === 'allow' ? ICON.ok : o.v === 'deny' ? ICON.bad : ICON.ask) + ' ' : '') + o.note;
        }
        const vd = h.q('#vd'); vd.dataset.v = verdict;
        vd.textContent = verdict === 'allow' ? '✓ Allowed: the tool runs' : verdict === 'deny' ? '× Denied: the model is told why' : '! Ask: you approve or refuse';
      }
      c.seg({ label: 'Tool call', options: CALLS.map(x => [x, x]), value: CALLS[0], onChange: v => { stt.call = v; go(); } });
      c.seg({ label: 'Permission mode', options: [['default', 'default'], ['acceptEdits', 'acceptEdits'], ['plan', 'plan'], ['dontAsk', 'dontAsk'], ['bypass', 'bypass']], value: 'default', onChange: v => { stt.mode = v; go(); } });
      c.note('Illustrative rules, matched with simple wildcards. Real rule syntax and evaluation order can differ between Claude Code versions.');
      c.play(async () => { for (const k of [CALLS[0], CALLS[2], CALLS[4]]) { stt.call = k; go(); await c.wait(2400); } stt.call = CALLS[3]; go(); });
    }
  });

  /* 12 --------------------------------------------------------------- */
  S.push({
    id: 'modes', tag: 'Safety',
    title: 'Five permission modes tune the friction',
    alt: 'A table of five permission modes and what each does for reading files, editing files and running shell commands.',
    text: 'Five modes let you choose how much to be asked. **Default** asks before edits and shell commands. **Accept edits** approves file changes. **Plan** is read-only: the agent can look but not touch. **Don’t ask** denies anything that would prompt. **Bypass** removes every prompt and belongs in containers only.',
    hint: 'Select a mode, or press Shift+Tab in Claude Code to cycle through them.',
    takeaway: 'Start strict and loosen on purpose. Bypass is for throwaway environments.',
    mount(c) {
      const M = [
        ['default', 'Default', 'Asks before edits and shell commands.', ['ok', 'ask', 'ask']],
        ['acceptEdits', 'Accept edits', 'Approves file changes automatically.', ['ok', 'ok', 'ask']],
        ['plan', 'Plan', 'Read-only. The agent can look but not touch.', ['ok', 'no', 'no']],
        ['dontAsk', 'Don’t ask', 'Auto-denies anything that would normally prompt.', ['ok', 'no*', 'no*']],
        ['bypass', 'Bypass', 'No prompts at all. For containers only.', ['ok', 'ok', 'ok']]
      ];
      const CH = { ok: ['ok', '✓', 'Allowed'], ask: ['warn', '!', 'Asks you'], no: ['bad', '×', 'Blocked'], 'no*': ['bad', '×', 'Blocked*'] };
      const cell = k => { const [cls, ic, lab] = CH[k]; return `<span class="pill ${cls}"><i>${ic}</i>${lab}</span>`; };
      const h = c.html(`<table class="tbl modes"><thead><tr><th>Mode</th><th>Read files</th><th>Edit files</th><th>Run commands</th></tr></thead><tbody>${M.map(m => `<tr data-m="${m[0]}"><td><b>${m[1]}</b></td>${m[3].map(k => `<td>${cell(k)}</td>`).join('')}</tr>`).join('')}</tbody></table><p id="d" class="modedesc"></p><p class="legend" style="justify-content:flex-start;margin-top:8px">* blocked unless an allow rule already covers it</p>`);
      const rows = h.qa('tbody tr');
      function pickMode(k) { rows.forEach(r => r.classList.toggle('sel', r.dataset.m === k)); const m = M.find(x => x[0] === k); h.q('#d').innerHTML = `<b>${m[1]}.</b> ${m[2]}${k === 'bypass' ? ' <span class="pill bad"><i>!</i>Use only in a container</span>' : ''}`; }
      const sg = c.seg({ label: 'Mode', options: M.map(m => [m[0], m[1]]), value: 'default', onChange: pickMode });
      rows.forEach(r => c.on(r, 'click', () => { sg.set(r.dataset.m); pickMode(r.dataset.m); }));
      pickMode('default');
      c.demo(1800, async () => { for (const m of M.slice(1)) { await c.wait(1200); sg.set(m[0]); pickMode(m[0]); } });
    }
  });

  /* 13 --------------------------------------------------------------- */
  S.push({
    id: 'sandbox', tag: 'Safety',
    title: 'The operating system enforces the boundary',
    alt: 'A tool process inside a dashed sandbox boundary. Writes to the project folder pass. Reads of secret keys and writes to system files are blocked by the operating system. Network requests pass only to allowlisted sites.',
    text: 'Rules ask the agent to behave. A **sandbox** makes it unable to misbehave. On macOS, Seatbelt restricts file access and routes network traffic through a controlled proxy. On Linux, bubblewrap isolates the process and seccomp filters dangerous system calls. That cuts permission prompts by **84%** without giving up safety.',
    hint: 'Try each action and see whether the operating system lets it through.',
    takeaway: 'Inside the boundary the agent can work freely. Outside it, the operating system says no.',
    mount(c) {
      const T = {
        write: { y: 70, lab: './src/app.ts', disp: './project', ok: true, msg: 'Allowed. The project folder is inside the sandbox.', ex: [170, 70] },
        key: { y: 130, lab: '~/.ssh/id_rsa', disp: '~/.ssh keys', ok: false, msg: 'Denied by the operating system. Secrets sit outside the boundary.' },
        etc: { y: 190, lab: '/etc/hosts', disp: '/etc files', ok: false, msg: 'Denied by the operating system. System files are read-only to the sandbox.' },
        npm: { y: 250, lab: 'registry.npmjs.org', disp: 'npm registry', ok: true, msg: 'Allowed. The proxy allowlist includes this host.' },
        evil: { y: 310, lab: 'unknown-site.example', disp: 'unknown site', ok: false, msg: 'Denied by the proxy. This host is not on the allowlist.' }
      };
      const f = c.fig(420, 344, `
        <rect class="none-f s-ctl" x="12" y="10" width="274" height="324" rx="16" style="stroke-width:2;stroke-dasharray:7 5"/><text class="xs b" x="24" y="28">OS sandbox: Seatbelt or bubblewrap</text>
        <rect class="t-cmp" x="26" y="150" width="92" height="60" rx="10"/><text class="b sm" x="72" y="176" text-anchor="middle">Tool</text><text class="b sm" x="72" y="194" text-anchor="middle">process</text>
        <rect class="t-ok" x="160" y="48" width="112" height="44" rx="9"/><text class="m xs b" x="216" y="74" text-anchor="middle">./ project</text>
        ${Object.keys(T).filter(k => k !== 'write').map(k => `<rect id="t_${k}" class="box" x="304" y="${T[k].y - 20}" width="106" height="40" rx="9"/><text class="m xs b" x="357" y="${T[k].y + 4}" text-anchor="middle">${T[k].disp}</text>`).join('')}
        <text class="xs mute" x="304" y="${T.npm.y - 28}">network, via proxy</text>
        <circle id="dot" class="f-data" cx="72" cy="180" r="7" stroke="var(--stage)" stroke-width="2" style="opacity:0"/>
        <text id="verdict" class="b sm" x="148" y="338" text-anchor="middle" style="opacity:0"></text>`);
      const dot = f.q('#dot');
      const st = c.stats([{ k: 'a', label: 'Fewer permission prompts', value: '84%', cls: 'ok', sub: 'with sandboxing on' }, { k: 'b', label: 'Enforced by', value: 'the OS', sub: 'not by the model' }]);
      let busy = false;
      async function act(k) {
        if (busy) return; busy = true; const t = T[k];
        f.q('#verdict').style.opacity = 0;
        c.place(dot, { x: 0, y: 0, o: 1 });
        ['#t_key', '#t_etc', '#t_npm', '#t_evil'].forEach(s => f.q(s).setAttribute('class', 'box'));
        const tx = k === 'write' ? 216 - 72 : 304 - 72 - 4, ty = (k === 'write' ? 70 : t.y) - 180;
        const wallX = 286 - 72;
        if (t.ok) { await c.fx(dot, { x: tx, y: ty }, 800, c.ease.io); if (k !== 'write') f.q('#t_' + k).setAttribute('class', 't-ok'); }
        else { await c.fx(dot, { x: wallX - 10, y: ty * 0.9 }, 700, c.ease.io); f.q('#t_' + k).setAttribute('class', 't-bad'); await c.fx(dot, { s: 1.8 }, 140); await c.fx(dot, { s: 1 }, 140); }
        await c.fx(dot, { o: 0 }, 260);
        c.say((t.ok ? '**Allowed.** ' : '**Denied.** ') + t.msg.replace(/^(Allowed|Denied)[^.]*\.\s?/, ''));
        busy = false;
      }
      c.btn('Write ./src/app.ts', () => act('write'), { small: true });
      c.btn('Read ~/.ssh/id_rsa', () => act('key'), { small: true });
      c.btn('Write /etc/hosts', () => act('etc'), { small: true });
      c.btn('Fetch registry.npmjs.org', () => act('npm'), { small: true });
      c.btn('Fetch unknown-site.example', () => act('evil'), { small: true });
      c.play(async () => { for (const k of ['write', 'key', 'npm', 'evil']) { await act(k); await c.wait(500); } });
    }
  });

  /* 14 --------------------------------------------------------------- */
  S.push({
    id: 'hooks', tag: 'Safety',
    title: 'Hooks run every time, not most of the time',
    alt: 'A hook script receives JSON on standard input. Exit code zero lets the tool call proceed. Exit code two blocks it and sends the error message back to the model.',
    text: 'An instruction in CLAUDE.md is followed most of the time. A **hook** is a script that runs at a fixed point, every time. It reads JSON on standard input. **Exit 0 proceeds. Exit 2 blocks** and sends your error message back to the model. If you need it 100% of the time, not 95%, use a hook.',
    hint: 'Run four commands through the hook and read what comes out.',
    takeaway: 'Use instructions for preferences and hooks for rules that must never be broken.',
    mount(c) {
      const CMDS = ['ls', 'npm test', 'rm -rf build/', 'git push --force'];
      const code = ['cmd=$(jq -r \'.tool_input.command\')', 'if echo "$cmd" | grep -qE \'rm -rf|--force\'; then', '  echo "Blocked: destructive command" >&2', '  exit 2', 'fi', 'exit 0'];
      const h = c.html(`<p class="kicker" style="margin:0 0 4px">JSON on standard input</p><pre class="codeblk" id="in"></pre><p class="kicker" style="margin:10px 0 4px">PreToolUse hook for Bash</p><pre class="codeblk">${code.map((l, i) => `<span class="cl" data-l="${i}">${esc(l)}</span>`).join('')}</pre><div id="out" class="hookout" data-v=""></div>
        <div class="nextchips" style="margin-top:12px"><span class="chip">command hook: runs a shell command</span><span class="chip">prompt hook: a small model answers yes or no</span><span class="chip">agent hook: a sub-agent decides over several turns</span></div>`);
      const lines = h.qa('.cl'), hl = (...ix) => lines.forEach((l, i) => l.classList.toggle('on', ix.indexOf(i) >= 0));
      let run = 0;
      async function test(cmd) {
        const id = ++run, bad = /rm -rf|--force/.test(cmd);
        h.q('#in').textContent = JSON.stringify({ tool_name: 'Bash', tool_input: { command: cmd } }, null, 1).replace(/\n\s*/g, ' ');
        h.q('#out').dataset.v = ''; h.q('#out').textContent = '';
        hl(0); await c.wait(450); if (id !== run) return; hl(1); await c.wait(500); if (id !== run) return;
        if (bad) { hl(2); await c.wait(450); hl(3); await c.wait(300); if (id !== run) return; h.q('#out').dataset.v = 'block'; h.q('#out').innerHTML = '<b>Exit 2: blocked.</b> The model reads: “Blocked: destructive command” and tries another way.'; }
        else { hl(5); await c.wait(300); if (id !== run) return; h.q('#out').dataset.v = 'go'; h.q('#out').innerHTML = '<b>Exit 0: proceed.</b> The command runs.'; }
      }
      const sg = c.seg({ label: 'Command the agent wants to run', options: CMDS.map(x => [x, x]), value: CMDS[0], onChange: test });
      c.note('Over 20 hook events exist across four categories: session, conversation, tool and sub-agent. Hooks are set up in settings.json with a matcher such as Bash.');
      test(CMDS[0]);
      c.play(async () => { for (const k of CMDS.slice(1)) { await c.wait(2200); sg.set(k); test(k); } await c.wait(1800); });
    }
  });

  /* 15 --------------------------------------------------------------- */
  S.push({
    id: 'interrupt', tag: 'Control',
    title: 'Steer the agent without stopping it',
    alt: 'Two lanes. The top lane shows five turns of the agent. The bottom lane is a buffer for your keystrokes. A message typed mid-turn waits, then joins the next turn without a restart.',
    text: 'The agent is mid-loop and heading the wrong way. You do not have to wait. Claude Code keeps **two buffers**: one carries the active model and tool exchange, the other catches your keystrokes. Your message is injected at the **next loop iteration**. No restart, no lost context.',
    hint: 'Press Type a correction during a run and watch where it joins.',
    takeaway: 'You can correct a running agent at any moment. It picks up your note on the next iteration.',
    mount(c) {
      const BX = i => 20 + i * 76;
      let blocks = '';
      for (let i = 0; i < 5; i++) blocks += `<rect id="b${i}" class="box" x="${BX(i)}" y="44" width="68" height="40" rx="9"/><text class="b sm" x="${BX(i) + 34}" y="69" text-anchor="middle">Turn ${i + 1}</text><g id="n${i}" style="opacity:0"><rect class="t-data" x="${BX(i)}" y="92" width="68" height="20" rx="6"/><text class="xs b" x="${BX(i) + 34}" y="106" text-anchor="middle">+ your note</text></g>`;
      const f = c.fig(420, 236, `
        <text class="b sm" x="20" y="28">Active exchange: model and tools</text>${blocks}
        <text class="b sm" x="20" y="152">Your keyboard buffer</text>
        <rect class="well" x="20" y="162" width="380" height="46" rx="10"/><text id="empty" class="xs mute" x="34" y="190">empty</text>
        <g id="msg" transform="translate(30 170)" style="opacity:0"><rect class="t-data" width="176" height="30" rx="8"/><text class="m xs b" x="10" y="19">“use bun, not npm”</text></g>`);
      const st = c.stats([{ k: 's', label: 'Status', value: 'idle' }]);
      let id = 0, pending = false, curTurn = -1, running = false;
      async function send() {
        if (!running || pending) return; pending = true;
        f.q('#empty').style.opacity = 0; c.place(f.q('#msg'), { x: 30, y: 170, o: 1 });
        st.set('s', 'queued', 'waits for the next iteration');
      }
      async function run(auto) {
        const my = ++id; running = true; pending = false;
        for (let i = 0; i < 5; i++) { f.q('#b' + i).setAttribute('class', 'box'); f.q('#n' + i).style.opacity = 0; }
        c.place(f.q('#msg'), { o: 0 }); f.q('#empty').style.opacity = 1; st.set('s', 'running', '');
        for (let i = 0; i < 5; i++) {
          if (my !== id) return;
          curTurn = i; f.q('#b' + i).setAttribute('class', 't-ctl');
          if (pending && i > 0) {
            await c.fx(f.q('#msg'), { x: BX(i), y: 92, o: 1 }, 600); c.place(f.q('#msg'), { o: 0 }); f.q('#n' + i).style.opacity = 1; f.q('#empty').style.opacity = 1; pending = false; st.set('s', 'injected', 'turn ' + (i + 1) + ' now sees your note');
          }
          for (let k = 0; k < 14; k++) { await c.wait(100); if (my !== id) return; if (auto && i === 1 && k === 5 && !pending) { pending = true; f.q('#empty').style.opacity = 0; c.place(f.q('#msg'), { x: 30, y: 170, o: 1 }); st.set('s', 'queued', 'waits for the next iteration'); } }
          f.q('#b' + i).setAttribute('class', 't-ok');
        }
        running = false; st.set('s', 'done', '');
      }
      c.btn('Type a correction', () => send(), { kind: 'pri', small: true });
      c.btn('Run again', () => run(false), { small: true });
      c.play(() => run(true));
    }
  });

  /* 16 --------------------------------------------------------------- */
  S.push({
    id: 'context', tag: 'Limits',
    title: 'The context window holds everything the agent can see',
    alt: 'A bar for the 200,000 token context window filling with a system prompt, messages and tool results. At 65% auto-compaction clears old tool output and summarizes the conversation, which frees space but loses detail.',
    text: 'The [[context window]] holds the full system prompt, every message and every tool result, up to **200,000 tokens**. That sounds generous and fills fast: a 25-turn debugging session easily reaches 50,000 to 100,000. At a threshold near **65%** (it varies by version), [[compaction|auto-compaction]] clears old tool output and summarizes the conversation. Space comes back. Detail does not.',
    hint: 'Add turns until the bar crosses the 65% mark. Then try Compact now and Clear.',
    takeaway: 'Compaction recovers space and loses detail. Clearing between tasks keeps the window clean.',
    mount(c) {
      const WIN = 200000, X0 = 20, W = 380, TH = 0.65, BY = 66, BH = 40;
      let segs = [{ k: 'sys', t: 10000 }], compactions = 0;
      const addTurn = () => segs.push({ k: 'msg', t: 1500 }, { k: 'tool', t: c.rint(7000, 22000) });
      for (let i = 0; i < 3; i++) addTurn();
      const f = c.fig(420, 186, `
        <text class="b sm" x="20" y="22">Context window: 200,000 tokens</text>
        <rect class="well" x="${X0}" y="${BY}" width="${W}" height="${BH}" rx="8"/><g id="segs"></g>
        <path class="ln s-bad" d="M${X0 + W * TH} ${BY - 10} V${BY + BH + 6}" style="stroke-width:2.5"/><text class="xs b" x="${X0 + W * TH}" y="${BY - 16}" text-anchor="middle">auto-compact at 65%</text>
        ${[0, 50, 100, 150, 200].map(v => `<text class="m xs mute" x="${X0 + W * v / 200}" y="${BY + BH + 24}" text-anchor="middle">${v}K</text>`).join('')}
        <text id="used" class="m b md" x="20" y="${BY + BH + 56}"></text>`);
      c.legend([['ctl', 'System prompt'], ['data', 'Messages'], ['cmp', 'Tool results'], ['mem', 'Summary']]);
      const st = c.stats([{ k: 'u', label: 'Used', value: '', cls: 'mem' }, { k: 'p', label: 'Share of the window', value: '' }, { k: 'n', label: 'Compactions', value: '0' }]);
      const lost = c.html('<div class="lostbox" hidden><b>What compaction loses</b><ul><li>Exact error messages</li><li>The nuance of early instructions</li><li>The reasoning behind early decisions</li></ul></div>');
      const CL = { sys: 'f-ctl', msg: 'f-data', tool: 'f-cmp', sum: 'f-mem' };
      const total = () => segs.reduce((a, g) => a + g.t, 0);
      function render() {
        let x = X0, s = '';
        segs.forEach(g => { const w = W * g.t / WIN; s += `<rect class="${CL[g.k]}" x="${x}" y="${BY}" width="${Math.max(0.6, w - 1)}" height="${BH}" rx="2" style="opacity:${g.dim ? 0.18 : 1}"/>`; x += w; });
        f.q('#segs').innerHTML = s;
        const u = total(); f.q('#used').textContent = fmt.n(u) + ' tokens (' + Math.round(u / WIN * 100) + '%)';
        st.set('u', fmt.n(u)); st.set('p', Math.round(u / WIN * 100) + '%', u / WIN >= TH ? 'past the compaction mark' : ''); st.set('n', compactions); st.cls('p', u / WIN >= TH ? 'bad' : '');
      }
      async function compact(auto) {
        const before = total(), tools = segs.map((g, i) => g.k === 'tool' ? i : -1).filter(i => i >= 0), msgs = segs.map((g, i) => g.k === 'msg' ? i : -1).filter(i => i >= 0);
        const keep = new Set([0, tools[tools.length - 1], msgs[msgs.length - 1], msgs[msgs.length - 2]]);
        segs.forEach((g, i) => { if (g.k !== 'sys' && !keep.has(i)) g.dim = true; }); render(); await c.wait(650);
        const kept = segs.filter((g, i) => keep.has(i) && g.k !== 'sys');
        segs = [segs[0], { k: 'sum', t: 6000 }].concat(kept.map(g => ({ k: g.k, t: g.t })));
        compactions++; render(); lost.el.querySelector('.lostbox').hidden = false;
        c.say((auto ? '**Auto-compaction fired.** ' : '**Compacted.** ') + 'Freed ' + fmt.n(before - total()) + ' tokens. Old tool output is cleared and the conversation is summarized.');
      }
      async function add(n) { for (let i = 0; i < n; i++) { addTurn(); render(); await c.wait(160); if (total() / WIN >= TH) { await c.wait(250); await compact(true); return; } } }
      c.btn('Add a turn', () => add(1), { kind: 'pri', small: true });
      c.btn('Add 5 turns', () => add(5), { small: true });
      c.btn('Compact now', () => compact(false), { small: true });
      c.btn('Clear (/clear)', () => { segs = [segs[0]]; render(); c.say('**Cleared.** Everything but the system prompt is gone. Use this between unrelated tasks.'); }, { small: true });
      render();
      c.play(async () => { await c.wait(500); await add(12); });
    }
  });

  /* 17 --------------------------------------------------------------- */
  S.push({
    id: 'cost', tag: 'Limits',
    title: 'Every turn resends everything, so cost grows with the square',
    alt: 'A column chart of tokens sent on each turn. Every column is taller than the one before because the whole conversation is resent. The total area, which is the bill, grows with the square of the number of turns.',
    text: 'The API keeps no memory, so every turn resends the **entire conversation**. Turn 1 sends 5,000 tokens. Turn 20 sends about 24,000. You pay for the area under the bars. That area grows with the **square** of the turn count, so 20 turns cost about three times as much as 10.',
    hint: 'Change the number of turns and how fast each turn adds tokens.',
    takeaway: 'Long sessions get expensive faster than they get longer. Prompt caching and fresh sessions both help.',
    mount(c) {
      const stt = { n: 20, a: 1000 }, B = 5000, P = 3, PX0 = 44, PX1 = 396, PY0 = 22, PY1 = 214;
      const f = c.fig(420, 262, `<g id="grid"></g><g id="bars"></g><text class="sm mute" x="${PX0}" y="14">Tokens sent on each turn</text><text class="sm mute" x="${(PX0 + PX1) / 2}" y="${PY1 + 38}" text-anchor="middle">Turn</text>`);
      const st = c.stats([{ k: 't', label: 'Tokens sent in total', value: '', cls: 'mem' }, { k: 'a', label: 'Cost without caching', value: '', cls: 'cmp', sub: '$3 per million input tokens' }, { k: 'b', label: 'Cost with caching', value: '', cls: 'ok', sub: 'hits at 10%, writes at 125%' }, { k: 'r', label: 'Twice the turns costs', value: '' }]);
      function draw() {
        const N = stt.n, A = stt.a, C = n => B + (n - 1) * A, ymax = Math.ceil(C(N) / 5000) * 5000;
        const ys = v => PY1 - v / ymax * (PY1 - PY0), bw = (PX1 - PX0) / N;
        let g = '', s = '', tot = 0;
        [0, ymax / 2, ymax].forEach(v => { g += `<line class="grid" x1="${PX0}" x2="${PX1}" y1="${ys(v)}" y2="${ys(v)}"/><text class="m xs mute" x="${PX0 - 6}" y="${ys(v) + 4}" text-anchor="end">${fmt.n(v / 1000)}K</text>`; });
        [1, Math.ceil(N / 2), N].forEach(n => { g += `<text class="m xs mute" x="${PX0 + (n - 0.5) * bw}" y="${PY1 + 18}" text-anchor="middle">${n}</text>`; });
        for (let n = 1; n <= N; n++) { tot += C(n); s += `<rect class="${n === N ? 'f-cmp' : 'f-mem'}" x="${PX0 + (n - 1) * bw + 1}" y="${ys(C(n))}" width="${Math.max(1, bw - 2)}" height="${PY1 - ys(C(n))}" rx="${Math.min(3, bw / 3)}"/>`; }
        f.q('#grid').innerHTML = g; f.q('#bars').innerHTML = s;
        let cached = 1.25 * P * B / 1e6; for (let n = 2; n <= N; n++) cached += 0.1 * P * C(n - 1) / 1e6 + 1.25 * P * A / 1e6;
        const sum = k => { let t = 0; for (let n = 1; n <= k; n++) t += C(n); return t; };
        st.set('t', fmt.si(tot, 2)); st.set('a', fmt.usd(tot * P / 1e6)); st.set('b', fmt.usd(cached), Math.round((1 - cached / (tot * P / 1e6)) * 100) + '% cheaper');
        const h2 = Math.floor(N / 2); st.set('r', h2 > 0 ? (tot / sum(h2)).toFixed(1) + '×' : '–', h2 + ' turns vs ' + N + ' turns');
      }
      c.slider({ label: 'Turns in the session', min: 5, max: 50, step: 1, value: 20, fmt: v => v, onInput: v => { stt.n = v; draw(); } });
      c.slider({ label: 'Tokens added each turn', values: [500, 1000, 2000, 3000], value: 1000, fmt: v => fmt.n(v), onInput: v => { stt.a = v; draw(); } });
      c.note('Starts at 5,000 tokens for the system prompt and the first message. The $3 price is an example.');
      draw();
      c.play(async () => { const sl = c.ctrl.querySelector('input'); for (const n of [5, 10, 20, 40, 20]) { stt.n = n; sl.value = n; sl.dispatchEvent(new Event('input')); await c.wait(750); } });
    }
  });

  /* 18 --------------------------------------------------------------- */
  S.push({
    id: 'subagents', tag: 'Scaling out',
    title: 'Sub-agents do the noisy work in their own window',
    alt: 'A main context bar and sub-agent bars. A search run in the main agent adds 80,000 tokens to the main context. The same search in a sub-agent fills only its own fresh context and returns a 500 token summary.',
    text: 'Big searches would swamp the main window. So the main agent spawns **[[sub-agent|sub-agents]]**, each with a fresh context window of its own. A search through thousands of files happens there. Only a short summary comes back. Several sub-agents can run in parallel, and the main conversation stays clean.',
    hint: 'Run the search in the main agent, then in sub-agents, and compare the main context.',
    takeaway: 'Delegate verbose work. Only the summary has to live in the main context.',
    mount(c) {
      const WIN = 200000, X0 = 20, W = 380, stt = { mode: 'sub', main: 20000, summaries: 0, searches: 0 };
      const lanes = [0, 1, 2].map(i => `<text id="ln${i}" class="xs mute" x="20" y="${150 + i * 50}" style="opacity:0">Sub-agent ${i + 1}: its own 200K window</text><rect class="well" x="${X0}" y="${156 + i * 50}" width="${W}" height="16" rx="5" style="opacity:.5"/><rect id="sb${i}" class="f-cmp" x="${X0}" y="${156 + i * 50}" width="0" height="16" rx="5"/>`).join('');
      const f = c.fig(420, 318, `
        <text class="b sm" x="20" y="22">Main agent context</text>
        <rect class="well" x="${X0}" y="32" width="${W}" height="30" rx="7"/><rect id="mb" class="f-ctl" x="${X0}" y="32" width="${W * 20000 / WIN}" height="30" rx="7"/><rect id="ms" class="f-ok" x="0" y="32" width="0" height="30" rx="3"/>
        <text id="mt" class="m xs b" x="400" y="82" text-anchor="end">20,000 of 200,000</text>
        <text id="full" class="xs b" x="20" y="82" style="opacity:0">window full: compaction needed</text>
        <line class="grid" x1="20" x2="400" y1="102" y2="102"/>
        <text class="b sm" x="20" y="124">Sub-agents (each starts empty and is discarded after)</text>${lanes}`);
      const st = c.stats([{ k: 'm', label: 'Main context used', value: '20,000', cls: 'ctl' }, { k: 'v', label: 'Verbose tokens kept out of main', value: '0', cls: 'ok' }]);
      function paintMain() {
        const used = stt.main, w = Math.min(W, W * used / WIN);
        f.q('#mb').setAttribute('width', Math.min(W * 20000 / WIN + 0, w)); 
        f.q('#mb').setAttribute('width', w);
        f.q('#mt').textContent = fmt.n(Math.round(used)) + ' of 200,000';
        f.q('#full').style.opacity = used > WIN ? 1 : 0;
        st.set('m', fmt.n(Math.round(used))); st.cls('m', used > WIN ? 'bad' : 'ctl');
      }
      async function search(n) {
        const idx = Array.from({ length: n }, (_, i) => i);
        stt.searches += n;
        if (stt.mode === 'main') {
          const a = stt.main; stt.main += 80000 * n;
          await c.tween(900, p => { stt.cur = a + (stt.main - a) * p; f.q('#mb').setAttribute('width', Math.min(W, W * (a + (stt.main - a) * p) / WIN)); f.q('#mt').textContent = fmt.n(Math.round(a + (stt.main - a) * p)) + ' of 200,000'; });
          paintMain(); c.say('**In the main agent:** ' + n + ' search' + (n > 1 ? 'es' : '') + ' added ' + fmt.n(80000 * n) + ' tokens to the main context.');
        } else {
          await Promise.all(idx.map(async i => { f.q('#ln' + i).style.opacity = 1; await c.tween(1100, p => f.q('#sb' + i).setAttribute('width', W * 80000 / WIN * p * 2.5 > W ? W : W * 80000 / WIN * p * 2.5)); }));
          await c.wait(250);
          await Promise.all(idx.map(i => c.tween(450, p => f.q('#sb' + i).setAttribute('width', (W * 80000 / WIN * 2.5 > W ? W : W * 80000 / WIN * 2.5) * (1 - p)))));
          idx.forEach(i => f.q('#ln' + i).style.opacity = 0);
          const before = stt.main; stt.main += 500 * n; stt.summaries += n; stt.verbose = (stt.verbose || 0) + 80000 * n;
          paintMain(); st.set('v', fmt.n(stt.verbose));
          c.say('**In sub-agents:** ' + n + ' fresh window' + (n > 1 ? 's' : '') + ' did the searching, then ' + (n > 1 ? 'were' : 'was') + ' discarded. Main context grew by only ' + fmt.n(500 * n) + ' tokens.');
        }
      }
      c.seg({ label: 'Where does the search run?', options: [['main', 'In the main agent'], ['sub', 'In sub-agents']], value: 'sub', onChange: v => { stt.mode = v; } });
      c.btn('Search 2,000 files', () => search(1), { kind: 'pri', small: true });
      c.btn('Run 3 searches in parallel', () => search(3), { small: true });
      c.btn('Reset', () => { stt.main = 20000; stt.verbose = 0; st.set('v', '0'); paintMain(); c.say(''); }, { small: true });
      c.note('Each search reads about 80,000 tokens of files. Built-in sub-agents include a fast explorer on a cheaper model, a read-only planner and a general-purpose agent with full tools.');
      paintMain();
      c.play(async () => { stt.mode = 'main'; await search(1); await c.wait(500); stt.main = 20000; paintMain(); stt.mode = 'sub'; await search(3); });
    }
  });

  /* 19 --------------------------------------------------------------- */
  S.push({
    id: 'mcp', tag: 'Scaling out',
    title: 'MCP turns N times M integrations into N plus M',
    alt: 'Apps on the left and tools on the right. Without a shared standard every app needs its own connection to every tool, N times M lines. With MCP every app and every tool connects once to the standard, N plus M lines.',
    text: 'Without a shared standard, every app needs a custom connection to every tool: **N × M** integrations. The Model Context Protocol, or [[mcp|MCP]], is an open standard that cuts this to **N + M**. Each app implements the client side once. Each tool implements the server side once.',
    hint: 'Add apps and tools, then switch between custom integrations and MCP.',
    takeaway: 'With 6 apps and 6 tools, custom integrations mean 36 connections. MCP means 12.',
    mount(c) {
      const stt = { n: 4, m: 4, mode: 'custom' }, AX = 24, TX = 310;
      const f = c.fig(420, 300, `<g id="lines"></g><g id="hub" style="opacity:0"><rect class="t-ctl" x="186" y="20" width="48" height="236" rx="12"/><text class="b sm" x="210" y="142" text-anchor="middle" transform="rotate(-90 210 142)">MCP</text></g><g id="apps"></g><g id="tools"></g><text class="b sm" x="24" y="288">Apps (MCP hosts)</text><text class="b sm" x="396" y="288" text-anchor="end">Tools (MCP servers)</text>`);
      const st = c.stats([{ k: 'a', label: 'Custom integrations (N × M)', value: '', cls: 'cmp' }, { k: 'b', label: 'With MCP (N + M)', value: '', cls: 'ok' }]);
      function draw() {
        const { n, m, mode } = stt, ay = i => 24 + (i + 0.5) * (232 / n), ty = j => 24 + (j + 0.5) * (232 / m);
        let l = '', a = '', t = '';
        if (mode === 'custom') { for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) l += `<path class="ln thin s-cmp" d="M${AX + 78} ${ay(i)} L${TX} ${ty(j)}" style="opacity:.7"/>`; }
        else { for (let i = 0; i < n; i++) l += `<path class="ln thin s-ok" d="M${AX + 78} ${ay(i)} L186 ${ay(i)}" style="opacity:.9"/>`; for (let j = 0; j < m; j++) l += `<path class="ln thin s-ok" d="M234 ${ty(j)} L${TX} ${ty(j)}" style="opacity:.9"/>`; }
        const hh = Math.min(26, 232 / n - 6), th = Math.min(26, 232 / m - 6);
        for (let i = 0; i < n; i++) a += `<rect class="t-ctl" x="${AX}" y="${ay(i) - hh / 2}" width="78" height="${hh}" rx="6"/><text class="xs b" x="${AX + 39}" y="${ay(i) + 4}" text-anchor="middle">App ${i + 1}</text>`;
        for (let j = 0; j < m; j++) t += `<rect class="t-cmp" x="${TX}" y="${ty(j) - th / 2}" width="86" height="${th}" rx="6"/><text class="xs b" x="${TX + 43}" y="${ty(j) + 4}" text-anchor="middle">Tool ${j + 1}</text>`;
        f.q('#lines').innerHTML = l; f.q('#apps').innerHTML = a; f.q('#tools').innerHTML = t; f.q('#hub').style.opacity = mode === 'mcp' ? 1 : 0;
        st.set('a', n * m, 'each one written and maintained'); st.set('b', n + m, 'each one written once'); st.cls('a', mode === 'custom' ? 'cmp' : ''); st.cls('b', mode === 'mcp' ? 'ok' : '');
      }
      const sg = c.seg({ label: 'How apps connect to tools', options: [['custom', 'Custom integrations'], ['mcp', 'MCP']], value: 'custom', onChange: v => { stt.mode = v; draw(); } });
      c.slider({ label: 'Apps (N)', min: 1, max: 8, step: 1, value: 4, fmt: v => v, onInput: v => { stt.n = v; draw(); } });
      c.slider({ label: 'Tools (M)', min: 1, max: 8, step: 1, value: 4, fmt: v => v, onInput: v => { stt.m = v; draw(); } });
      c.html(`<table class="tbl" style="margin-top:12px"><tbody><tr><th>Three tiers</th><td>The <b>host</b> (Claude Code) manages permissions and holds clients. Each <b>client</b> keeps a one-to-one session with a <b>server</b>. Servers expose the tools.</td></tr><tr><th>Wire format</th><td>JSON-RPC 2.0 over standard input and output, or over HTTP.</td></tr><tr><th>Three primitives</th><td><b>Tools</b>: functions the model controls. <b>Resources</b>: data the app controls. <b>Prompts</b>: templates the user controls.</td></tr><tr><th>Limits</th><td>When tool descriptions pass 10% of the context window, Claude Code defers loading them with tool search. Each server’s output is capped at 25,000 tokens.</td></tr></tbody></table>`);
      draw();
      c.play(async () => { await c.wait(900); stt.mode = 'mcp'; sg.set('mcp'); draw(); });
    }
  });

  /* 20 --------------------------------------------------------------- */
  S.push({
    id: 'architecture', tag: 'Recap',
    title: 'Six layers, one loop',
    alt: 'Six stacked layers from the messages API at the bottom to the user interface at the top, each linking to the scenes that explain it.',
    text: 'The whole system is six layers around one loop. Click a layer to see what it holds and jump back to the scenes behind it. It has no competing agents and no orchestration framework. It has **one while loop, eight prompt layers, nine tool categories, a four-step tool contract and a ten-step pipeline**.',
    hint: 'Click a layer to see what it holds and jump to its scenes.',
    takeaway: 'When the control flow is the model thinking, every improvement to the model improves the agent for free.',
    mount(c) {
      const L = [
        ['User interface', 'Terminal, IDE, desktop and web. Streams output and asks for permission.', ['interrupt']],
        ['Permission layer', 'Allow, deny or ask. Gates every tool call.', ['permission-gate', 'modes', 'sandbox', 'hooks']],
        ['Agentic loop', 'Gather, act, verify, repeat until a reply has no tool calls.', ['loop', 'gather-act-verify', 'five-turns', 'ten-steps']],
        ['Tool system', 'Nine categories of built-in tools, plus MCP, skills and sub-agents.', ['edit-tool', 'tool-contract', 'subagents', 'mcp']],
        ['Context management', 'System prompt assembly, history, auto-compaction and memory.', ['system-prompt', 'claude-md', 'context', 'cost']],
        ['Claude’s messages API', 'Tool use, streaming and extended thinking.', ['thinking']]
      ];
      const lesson = c.player.lesson;
      const idx = id => lesson.scenes.findIndex(s => s.id === id), title = id => (lesson.scenes[idx(id)] || {}).title;
      const h = c.html(`<div class="arch">${L.map((l, i) => `<button type="button" class="alayer" data-i="${i}" style="opacity:.2"><span class="n">${6 - i}</span><span><b>${l[0]}</b><small>${l[1]}</small></span></button>`).join('')}</div><div id="jumps" class="jumps"></div>`);
      const rows = h.qa('.alayer');
      function pick(i) { rows.forEach((r, k) => r.classList.toggle('open', k === i)); h.q('#jumps').innerHTML = L[i][2].map(id => `<button type="button" class="chip jump" data-id="${id}">${title(id)}</button>`).join(''); h.qa('.jump').forEach(b => c.on(b, 'click', () => c.player.go(idx(b.dataset.id)))); }
      rows.forEach((r, i) => c.on(r, 'click', () => pick(i)));
      c.play(async () => { for (let i = 5; i >= 0; i--) { await c.fx(rows[i], { o: 1 }, 260); await c.wait(220); } pick(2); });
    }
  });

  /* 21 --------------------------------------------------------------- */
  S.push({
    id: 'quiz', tag: 'Check yourself',
    title: 'Check what stuck',
    text: 'Seven questions. Each has a short explanation, right or wrong.',
    quiz: [
      { q: 'What ends the agent loop?', o: ['A fixed number of turns', 'A reply that contains zero tool calls', 'The user pressing Enter', 'The first successful test run'], a: 1, why: 'The model decides it is done by replying without asking for any tool. No tool calls is the stop signal.' },
      { q: 'Which of the ten steps in a turn actually runs the tool?', o: ['Step 1, context assembly', 'Step 5, permission check', 'Step 7, tool runs', 'Step 10, loop decision'], a: 2, why: 'Steps 1 to 6 prepare and check the call. Step 7 executes it. Steps 8 to 10 capture the result and decide what is next.' },
      { q: 'The Edit tool refuses when old_string appears twice. Why?', o: ['It is a bug', 'By design: an ambiguous edit could change the wrong place', 'The file is too large', 'The model is not allowed to edit'], a: 1, why: 'Failing is safer than guessing. The model adds more context so the match is unique, and you see exactly what changed.' },
      { q: 'A deny rule and an allow rule both match a tool call. What happens?', o: ['The allow rule wins', 'The newest rule wins', 'The call is denied', 'You are asked each time'], a: 2, why: 'The gate is deny-first: deny rules are checked before allow rules, and the first match wins.' },
      { q: 'Why use a hook instead of an instruction in CLAUDE.md?', o: ['Hooks are shorter', 'A hook runs every time. An instruction may be skipped', 'Hooks use less context', 'Instructions are not supported'], a: 1, why: 'Instructions are followed most of the time. A hook is code that runs at a fixed point, so a rule that must always hold belongs in a hook.' },
      { q: 'How do sub-agents protect the main context window?', o: ['They compress the main window', 'They run the verbose work in their own window and return a summary', 'They use a larger window', 'They skip tool calls'], a: 1, why: 'The noisy reading happens in a fresh context that is discarded afterward. Only a short summary joins the main conversation.' },
      { q: 'With 6 apps and 6 tools, how many connections does MCP need?', o: ['36', '12', '6', '2'], a: 1, why: 'Each app implements the client side once and each tool the server side once: 6 + 6 = 12, instead of 6 × 6 = 36.' }
    ]
  });

  const preview = '<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice"><g style="fill:none;stroke-width:2"><circle cx="160" cy="75" r="38" style="stroke:var(--line)"/></g><g class="orbit"><circle cx="160" cy="37" r="9" style="fill:var(--data)"/></g><rect x="108" y="58" width="104" height="34" rx="10" style="fill:var(--ctl-soft);stroke:var(--ctl);stroke-width:1.5"/><text x="160" y="80" text-anchor="middle" style="font:700 12px var(--font-mono);fill:var(--ink)">while True</text></svg>';
  window.LESSONS.push({
    id: 'agent', n: 2, track: 'agents', order: 1,
    title: 'How an AI Agent Works',
    tagline: 'The while loop, the tools, the permissions and the context window behind Claude Code.',
    preview,
    scenes: S
  });
})();
