# LLM Infrastructure, Animated

Four animated lessons that show how an AI answer gets made. You watch each idea move, then change it with a slider or a button. There is no video to sit through and no background knowledge to bring.

Open `index.html` in any modern browser. There is nothing to install or build.

## The lessons

| Lesson | Scenes | What you see |
|---|---|---|
| 1. One Question, 18 Layers | 27 | One keypress travels from the keyboard matrix, through the browser, TLS, packets, BGP routing, fiber and a data center, into a GPU, then down through gates, transistors and quantum tunneling. The answer climbs back up. |
| 2. How an AI Agent Works | 21 | The while loop behind Claude Code: tools, the ten-step turn, the system prompt, the permission gate, hooks, the context window, sub-agents and MCP. |
| 3. Prompt Caching | 18 | Why a repeated prompt should be paid for once: KV cache size, prefix matching, paged memory, radix trees, break-even math, cache tiers and the timing side channel. |
| 4. Why a Token Takes 30 ms | 15 | The memory wall, prefill versus decode, the roofline, the KV cache, TTFT, TPOT and goodput. |

Each scene has the same parts: a moving picture, a short caption, a **Try it** control for most scenes, and a one-line takeaway. Each lesson ends with a short quiz.

## Use it

- **Next and Back** move between scenes. **Auto-play** runs a lesson like a video.
- **Play and pause**, **replay** and a **speed** button (1x, 0.5x, 2x) sit in the bar at the bottom.
- Keyboard: `Left` and `Right` change scene, `Space` pauses, `R` replays.
- Dotted underlines open a one-line definition.
- The scene list (top right) jumps to any scene. Links such as `index.html#lesson-2-5` open lesson 2, scene 5.
- Progress is saved in your browser (`localStorage`, keys start with `llmi:`). The page works without it.
- Light and dark themes follow your system setting. Reduced-motion settings are respected.

## Run it from a folder or a server

```sh
open index.html                  # works directly from disk
python3 -m http.server 8000      # or serve the folder, then visit http://localhost:8000
```

Fonts (Bricolage Grotesque, Atkinson Hyperlegible, JetBrains Mono) load from Google Fonts. If they cannot load, system fonts take over and nothing breaks.

## How it is built

Plain HTML, CSS, JavaScript and SVG. No framework and no build step.

```
index.html          page shell and script order
assets/style.css    design tokens (light and dark), layout, SVG and HTML primitives
assets/engine.js    scene player, animation clock, controls, hub, quiz, glossary popovers
assets/glossary.js  one-sentence definitions used by the dotted underlines
assets/lesson-1.js  one file per lesson: an array of scenes, then a registration call
assets/lesson-2.js
assets/lesson-3.js
assets/lesson-4.js
```

### Scene contract

A lesson registers itself with `window.LESSONS.push({ id, n, title, tagline, preview, scenes })`. Lesson 1 also passes `rail: { names }` to label its depth rail. Each scene is an object:

```js
{
  id: 'tls', layer: 5,                // layer is optional (lesson 1 uses it for the depth rail)
  tag: 'The internet',
  title: 'Two strangers agree on a secret in public',
  alt: 'Text description of the figure for screen readers.',
  text: 'Caption with **bold**, `code` and [[glossary term|shown text]].',
  hint: 'What the reader can try.',    // shows the "Try it" box
  takeaway: 'One sentence to remember.',
  mount(c) { /* draw into c.stage, add controls with c.slider, c.seg, c.btn, then c.play(async () => { ... }) */ }
}
```

The context `c` gives you the pieces a scene needs: `c.fig(w, h, svg)` for an SVG figure, `c.stats`, `c.legend`, `c.slider`, `c.seg`, `c.toggle`, `c.btn`, `c.note`, `c.say`, and the animation helpers `c.wait`, `c.tween`, `c.fx`, `c.along`, `c.draw`, `c.count`, `c.type`. Everything an animation starts is cancelled when the reader leaves the scene. A scene counts as finished when the promise passed to `c.play` ends, and every scene looks complete at rest.

Color has a fixed meaning across all lessons: green is data, blue is memory, orange is compute, violet is control. Good, bad and warning states always carry an icon and a label as well as a color.

### Test hooks

| Parameter | Effect |
|---|---|
| `?speed=14` | Runs the animation clock 14 times faster. Use it for automated tests. |
| `?reduce=1` | Forces reduced motion. |
| `?theme=dark` or `?theme=light` | Forces a theme. |

`window.LLMI.goto(lesson, sceneIndex)` jumps to a scene, `window.LLMI.state()` reports `{ lesson, idx, done, stage }`, and `window.LLMI.errors` collects runtime errors.

### Run the scene tests

`tests/qa.js` opens every scene in headless Chromium, waits for its animation to finish and, with `--fuzz`, clicks every control. It reports console errors, sideways page scroll, controls outside the screen and SVG text clipped by its figure, and exits with code 1 when it finds any. Scenes that wait for a click, such as the guess in lesson 4, only finish with `--fuzz`, or pass `--nodone` to skip that check. It needs [Playwright](https://playwright.dev) with Chromium.

```sh
node tests/qa.js --view=desktop --theme=dark --fuzz
node tests/qa.js --lesson=3 --view=mobile --theme=light --shots   # screenshots land in tests/shots
node tests/qa.js --reduce --fuzz                                  # reduced-motion pass
```

## About the numbers

- Chip figures (H100: 989 TFLOPS dense BF16, 3.35 TB/s, 80 GB; H200: 4.8 TB/s, 141 GB) are published vendor peak specifications. Real workloads reach less.
- The goodput curve, the tokenizer splits, the attention weights, the cache-tier simulation and the timing attack are **toy models**. The pages say so next to each one. They show the shape of the effect, not measured values.
- The Diffie-Hellman exchange uses tiny numbers (p = 23, g = 5) so you can check it by hand. Real TLS uses elliptic curves.
- Tunneling odds use the textbook estimate T = exp(-2 kappa d) for a 3 eV barrier. Real gate stacks use other materials.
- Prices, cache discounts, permission rules, thinking budgets and the auto-compaction threshold change between versions. Check the current documentation before you plan around a number.

## License

MIT. See `LICENSE`.
