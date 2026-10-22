# LLM Infrastructure, Animated

Twenty animated lessons on how an AI answer gets made, from a keypress to a frontier-lab incident. You watch each idea move, then change it with a slider, a switch or a click. Most scenes carry a short **mission**. Finish it and you earn a star.

Open `index.html` in any modern browser. There is nothing to install or build.

## The lessons

The hub groups the lessons into six tracks. Counts include the quiz that ends every lesson.

| Track | Lesson | Scenes | Missions | What you do |
|---|---|---|---|---|
| Start here | 1. One Question, 18 Layers | 27 | 0 | Follow one keypress from the keyboard matrix, through TLS, BGP and fiber, into a GPU, then down to gates, transistors and tunneling. |
| Agents and caching | 2. How an AI Agent Works | 21 | 0 | The loop behind Claude Code: tools, the permission gate, hooks, the context window, sub-agents and MCP. |
| | 3. Prompt Caching | 18 | 0 | KV cache size, prefix matching, paged memory, break-even math and the timing side channel. |
| Inference engineering | 4. Why a Token Takes 30 ms | 15 | 0 | The memory wall, prefill versus decode, the roofline, TTFT, TPOT and goodput. |
| | 8. Inside the GPU | 12 | 11 | Streaming multiprocessors, warps, the memory ladder, tensor cores and chip links. |
| | 9. FlashAttention and Fused Kernels | 9 | 8 | Tiling, online softmax and fusion. |
| | 10. Quantization | 11 | 10 | Fewer bits per number: outliers, SmoothQuant, GPTQ, AWQ, rotations, KV quantization, MXFP4 and NVFP4. |
| | 11. Splitting a Model Across GPUs | 9 | 8 | Tensor, pipeline, expert and data parallelism for serving. |
| | 12. Mixture of Experts | 7 | 6 | Total versus active parameters, expert coverage, load balancing and all-to-all cost. |
| | 13. Serving at Scale | 7 | 6 | Continuous batching, chunked prefill, split pools, queues, routing and cost per million tokens. |
| | 14. Faster Decoding and Long Context | 7 | 6 | Speculative decoding, KV growth, attention cost, sparse and windowed attention. |
| | 15. One Request Through a 72-GPU Rack | 6 | 5 | The path from gateway to first token and why the rack interconnect matters. |
| Images and video | 5. Images: How Models See and Draw | 26 | 13 | Patches, CLIP, diffusion and latent diffusion. |
| | 6. Video: How Models Watch and Make Clips | 17 | 14 | Tubelets, divided attention, 3D VAEs, space-time transformers and flow matching. |
| Training | 7. Training a 2-Trillion-Parameter Model | 18 | 16 | Memory, compute and the splits that let thousands of GPUs train one model. |
| | 16. Scaling Laws | 7 | 6 | Power-law fits, compute-optimal size, over-training and data repetition. |
| | 17. Reinforcement Learning for Code | 7 | 6 | Unit-test rewards, group-relative advantages, reward hacking, pass@k and long tasks. |
| Frontier and safety | 18. Loop Transformers | 8 | 7 | Reusing the same layers to think longer, Huginn's layout, adaptive depth, stability and the decode-time bill. |
| | 19. Alignment | 7 | 6 | Training signals as proxies, a toy reward model, overoptimization, specification gaming, context and monitors. |
| | 20. The ExploitGym Incident | 8 | 7 | Containment, shared agent channels, scorer incentives, a timeline and a fact check, all tied to the published reports. |

That is 247 scenes and 135 missions in all.

Each scene has a moving picture, a short caption, a **Try it** control for most scenes, and a one-line takeaway.

## Use it

- **Next and Back** move between scenes. **Auto-play** plays a lesson from start to finish.
- **Play and pause**, **replay** and a **speed** button (1x, 0.5x, 2x) sit in the bar at the bottom.
- Keyboard: `Left` and `Right` change scene, `Space` pauses, `R` replays.
- Dotted underlines open a one-line definition. The glossary has about 140 terms.
- The scene list (top right) jumps to any scene. Links such as `index.html#lesson-2-5` open lesson 2, scene 5.
- **Missions** start unmet. A star counts only when you earn it with your own click, drag or key press, never from an automatic demo.
- Progress and stars are saved in your browser (`localStorage`, keys start with `llmi:`). The page works without it.
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
index.html           page shell and script order
assets/style.css     design tokens (light and dark), layout, SVG and HTML primitives
assets/engine.js     scene player, animation clock, controls, missions and stars, hub, quiz, glossary popovers
assets/kit.js        shared drawing helpers: seeded random numbers, charts, bars, the click-to-pair matcher
assets/glossary.js   one-sentence definitions used by the dotted underlines
assets/lesson-N.js   one file per lesson (1 to 20): an array of scenes, then a registration call
tests/qa.js          scene test runner
tests/missions.js    mission checker
```

### Scene contract

A lesson registers itself with `window.LESSONS.push({ id, n, track, order, title, tagline, preview, scenes })`. The `track` is one of `start`, `agents`, `inference`, `vision`, `training` or `frontier`. Lesson 1 also passes `rail: { names }` to label its depth rail. Each scene is an object:

```js
{
  id: 'tls', layer: 5,                 // layer is optional (lesson 1 uses it for the depth rail)
  tag: 'The internet',
  title: 'Two strangers agree on a secret in public',
  alt: 'Text description of the figure for screen readers.',
  text: 'Caption with **bold**, `code` and [[glossary term|shown text]].',
  hint: 'What the reader can try.',     // shows the "Try it" box
  mission: 'A goal that starts unmet.', // shows the mission box and the star
  takeaway: 'One sentence to remember.',
  mount(c) { /* draw into c.stage, add controls with c.slider, c.seg, c.toggle, c.btn, then c.play(...) or c.demo(...) */ }
}
```

A quiz scene replaces `mount` with `quiz: [{ q, o: [options], a: index, why }]`.

The context `c` gives each scene what it needs: `c.fig(w, h, svg)` for an SVG figure, `c.stats`, `c.legend`, `c.slider`, `c.seg`, `c.toggle`, `c.btn`, `c.note`, `c.html`, `c.mission.set(bool)`, and the animation helpers `c.wait`, `c.tween`, `c.fx`, `c.along`, `c.draw`, `c.count`, `c.type`. Everything an animation starts is cancelled when the reader leaves the scene.

Mission rules the tests enforce:

- A mission starts unmet at rest.
- Stars come only from trusted gestures. Code that runs from `c.play` or `c.demo` cannot award one.
- Some solution must exist, and `tests/missions.js` finds it by brute force or with a custom solver.

Color has a fixed meaning across all lessons: green is data, blue is memory, orange is compute, violet is control. Good, bad and warning states always carry an icon or a label as well as a color.

### Test hooks

| Parameter | Effect |
|---|---|
| `?speed=14` | Runs the animation clock 14 times faster. Use it for automated tests. |
| `?reduce=1` | Forces reduced motion. |
| `?theme=dark` or `?theme=light` | Forces a theme. |

`window.LLMI.goto(lesson, sceneIndex)` jumps to a scene, `window.LLMI.state()` reports `{ lesson, idx, done, stage }`, and `window.LLMI.errors` collects runtime errors.

### Run the tests

Both scripts need [Playwright](https://playwright.dev) with Chromium. With no `--lesson` they test every registered lesson.

`tests/qa.js` opens every scene in headless Chromium, waits for its animation to finish and, with `--fuzz`, clicks every control. It reports console errors, sideways page scroll, controls outside the screen, SVG text clipped by its figure and SVG text that overlaps other text. It exits with code 1 when it finds any. Scenes that wait for a click only finish with `--fuzz`, or pass `--nodone` to skip that check.

```sh
node tests/qa.js --view=desktop --theme=dark --fuzz
node tests/qa.js --lesson=17 --view=mobile --theme=light --shots   # screenshots land in tests/shots
node tests/qa.js --reduce --fuzz                                   # reduced-motion pass
```

`tests/missions.js` checks every mission: it must start unmet, some combination of controls must meet it, and a real click must earn the star.

```sh
node tests/missions.js
node tests/missions.js --lesson=18,19 --scene=2,3
```

## About the numbers

Every lesson separates three kinds of number, and the pages label the difference.

- **Published figures.** Chip specifications (for example H100: 989 TFLOPS dense BF16, 3.35 TB/s HBM, 80 GB, 50 MB L2) are vendor peak values. Real workloads reach less. Model facts such as DeepSeek-V3's 671B total and 37B active parameters, Huginn's 2-layer prelude, 4-layer core and 2-layer coda (hidden size 5,280, about 0.4B parameters per layer, from the released config), and ExploitGym's 898 tasks come from the papers and reports that state them.
- **Fitted or approximate values.** The scaling-law constants in lesson 16 are the published Chinchilla fit and are approximate. The loss, memory and time estimates are round-number models of the effect, not measurements.
- **Toy models.** The goodput curve, the tokenizer splits, the attention weights, the cache-tier simulation, the timing attack, the bandit policy in lesson 17, the loop dynamics in lesson 18, the reward model, overoptimization curve and cleaning-robot reward in lesson 19, and the layers, message-board and scorer toys in lesson 20 are **toy models**. The page says so next to each one. They show the shape of an effect, not a measured value.

Other notes:

- The Diffie-Hellman exchange uses tiny numbers (p = 23, g = 5) so you can check it by hand. Real TLS uses elliptic curves.
- Tunneling odds use the textbook estimate T = exp(-2 kappa d) for a 3 eV barrier.
- Prices, cache discounts, permission rules, thinking budgets and the auto-compaction threshold change between versions. Check the current documentation before you plan around a number.
- Lessons 6 to 20 were written from the topic list of the second batch of video scripts, standard references and the public sources below, because the original script text was not available while building them. If you have the scripts, compare the wording and the order of ideas.

### Sources for lessons 17 to 20

Lessons 17 to 20 cover work and events after 2025. Check the originals before you rely on an exact figure or date.

- Lesson 17: DeepSeek-R1 (arXiv 2501.12948) for rule-based rewards. Yue et al., "Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?" (arXiv 2504.13837, NeurIPS 2025) for pass@k. That result is one study, and other work reports that longer RL can expand what a model solves.
- Lesson 18: Geiping et al. (arXiv 2502.05171) for Huginn. Saunshi et al. (arXiv 2502.17416). Mixture-of-Recursions (arXiv 2507.10524). Ouro, "Scaling Latent Reasoning via Looped Language Models" (arXiv 2510.25741). Parcae (arXiv 2604.12946). STARS (arXiv 2605.26733). Continuous depth batching for looped models (arXiv 2608.09444).
- Lesson 19: Gao, Schulman and Hilton, "Scaling Laws for Reward Model Overoptimization" (ICML 2023, arXiv 2210.10760). Singhal et al., "A Long Way to Go: Investigating Length Correlations in RLHF" (arXiv 2310.03716). Anthropic, "An alignment assessment of recent cybersecurity incidents" (Sep 9, 2026).
- Lesson 20: the ExploitGym paper (arXiv 2605.11086). Anthropic, "Investigating three incidents in our cybersecurity evaluations" (Jul 30, 2026) and the alignment assessment above. OpenAI, "The Hugging Face incident and the road ahead" and its technical report (Aug 26, 2026). METR and Redwood Research's investigation (Aug 26, 2026). Hugging Face's July 2026 disclosure and technical timeline.

Anthropic's pages were read directly. OpenAI's, METR's and Hugging Face's pages could not be opened while building, so lesson 20 uses their statements as summarized by search results and news coverage (TechCrunch, Axios, Fortune and others). Reports differ on some dates, counts and the exact path out of the sandbox, and lesson 20 marks those points as disputed. It describes the incidents at a conceptual level and gives no exploit details.

## License

MIT. See `LICENSE`.
