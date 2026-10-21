# Verification — native MVC build

## Automated

43 Node tests pass. Coverage includes exact rational operations, complete step sequences for linear lessons, fraction and negative solutions, identities/contradictions, zero-operation rejection, overflow, immutable state, transposition, rearrangement, undo/redo, clock seeking, 500 seeded rational transformation cases, and original SWF provenance.

Geometry assertions verify 10/100 physical card counts, exactly 10× depth, down-right projection and comma resets. Render assertions verify k/M/B on card faces and nested outlines. Integer operation groups have mathematically conserved weights on both sides.

The browser test bench exercises 570 structural frames: nineteen scenes × two orientations × three cameras × five timestamps. SVG snapshots detect deterministic output changes in CI. Thirty-eight browser-rasterized PNG baselines cover mid-animation frames and inscription scenes in portrait and landscape. PNG comparisons use a small color tolerance; changes still require human review rather than automatically updating baselines.

## Browser interaction and visual review

Tested in Chromium through the Codex browser:

- Desktop drag +3 across x+3=7, sign reversal, then cancellation to x=4.
- Rearrange 2 to the front of x+3+2=9 without changing its sign or solution.
- Portrait drag across the horizontal mirror; rotate to landscape while preserving the model.
- Responsive views at 390×844 and 844×390.
- 10 versus 100 stack depth and direction; camera presets and both scene orientations.
- Division of 3x=12 by 3 through the real UI.
- PNG review of carry/borrow, cancellation, fractions, operation groups, inscriptions and crossing/rearrangement. Review found early result labels and overlapping moving cards; transition timing and paths were corrected before baselining.

## Limits

Mathematical scope is exact single-variable linear algebra within the documented numeric limits. No test suite establishes universal mathematical perfection. Nonlinear expressions are rejected.

The native view is a reconstruction using extracted original textures; it is not byte-identical SWF playback. Camera choices vary orthographic depth. Grouping animations are detailed for positive integer factors up to 12, with symbolic transitions for other rational factors. Raster comparisons cover equation SVGs; whole-page layout and actual drag behavior currently receive manual browser verification rather than CI pointer replay. Browser font rasterization can differ across platforms.

The original SWF and its previously instrumented build remain as historical references. Their provenance tests are separate from tests of the active native application.

## Unit animation and drag revision

Re-read the original AVM2 methods `Addition.MergeNoms`, `Addition.Carry10`, `Addition.Borrow10`, `Nomial.Stack`, `Nomial.Box`, `Nomial.NewNomial`, `PolyNom.CheckCross`, and `PolyNom.mouseUpHandler`. Borrow recursively searches the previous nonzero digit, decrements it, invokes Stack in instant mode and then Box in tween mode. Carry sends ten actual units into the receiver's depth stack. This informed the new in-tray singleton animation rather than the previous floating overlay.

The active view now uses cached SVG stack definitions and individual weighted tokens. Tests cover every phase of 109 signed addition/subtraction cases, including multi-zero borrowing, negative results and comma boundaries. Tests verify that the ten sub-stack depth ranges exactly cover the next 10/100 stack. Comma boundaries use a continuous depth compression and face inscription crossfade.

Browser verification: dragged +3 across the mirror from approximately (504,245) to (940,390). Scrubbing the release animation to frame zero put the card at (940.155,389.931), with negative sign and red texture, rather than returning to its pickup point. Preview tests also exercise repeated crossings and both orientations without changing committed arithmetic.

The singleton rewrite supports integer and terminating-decimal addition/subtraction. Explicit non-decimal fractions retain their rational transition. Original SWF typography and exact frame timing remain separate fidelity work.

## Parallel timeline, input and decimal revision

Re-inspected `Addition.MergeNoms`: its digit loop uses TimelineMax.insertMultiple, not sequential appends. The native planner now creates all transfers before normalization and schedules them at time zero. Independent carries run concurrently; only operations consuming an earlier operation's output depend on its completion. Tests assert simultaneous transfer starts, independent carry starts and exact signed conservation across 101 samples of each selected parallel sequence.

Re-inspected `Operator.NewOp` and `Shapes.NewFillTriangle`: the group marker uses a filled left-pointing triangle, while the decimal marker uses a translucent fill with dotted marks. `Constant.InsertNomial` resets local magnitude when division reaches 0.001, placing the next group comma after tenths and hundredths. That spacing is reflected in both settled and animated trays.

Browser checks exercised direct typing of 0.123456, keypad entry of 0.9+0.1=1, and a real collision drop of the 0.1 term onto 0.9. The merge began immediately and reached 1. Numeric text and trays retain decimal notation. The spread camera visibly shows the 100 stack continuing underneath the adjacent zero tray. The parallel 555+555 scene shows unit motion in all three places together. Regression scenes now include decimal carrying, borrowing, comma boundaries and tray translucency.

## Operations, drag physics and tutor revision (2026-09)

Automated: 61 Node tests, 720 SVG snapshots and 10 headless-Chrome interaction checks pass (`npm test`, `npm run test:visual`, `npm run test:browser`).

- **CI determinism.** Decimal snapshots had hashed `10**-5` as `0.00009999999999999999` in some V8 builds, so a clean checkout failed CI. Exact place-value text and rounded inner geometry fixed it.
- **Performance.** Every frame used to replace the whole SVG: texture patterns were recreated, which blanked the textures for a frame, and up to 100 pattern-filled faces were repainted per stack. Measured in headless Chrome, `999+1` ran at about 10 fps and a six-digit subtraction at about 3 fps. With the persistent surface and rasterized stacks, every benchmark scene holds a 16.7 ms median. The heaviest spread-camera cases (`99 × 99`: 18 copies of 100-card stacks; `999999 ÷ 7`) reach 33 ms at p95.
- **Operations.** 150 random products conserve value through every ledger phase, and no place piles past 20 cards. Every division plan deals equal shares, and every card is dealt, unstacked or sliced. Frames render without NaN in both layouts and cameras.
- **Physics.** Unit tests cover the membrane (resistance, pop-through, clearance, hysteresis), zero-pair versus combination snapping, reflow and the spring home. Browser checks drive real pointer drags horizontally and vertically, including inside the membrane, onto a like card, into open space and into a gap.
- **Tutor.** Every lesson's example and 200 generated problems per lesson solve with the planner, each step with narration. The browser check plays an example to the end, then verifies a new problem and the hint highlight and arrow.
- **Review found and fixed:** a same-side drop onto an unlike term raised an error instead of rearranging; `nextStep` in expression mode moved terms onto the hidden right side; `0 × 5` vanished at parse time; the drag preview negated only a product's value, not its first operand; sign text for products with a negative later factor printed as subtraction.

Limits: visual multiplication and division have size limits (see README), beyond which exact symbolic transitions are used. Browser checks run in Chromium only. Pixel baselines remain local.

## Graph mode and review fixes (2026-09)

Automated: 71 Node tests, 720 SVG snapshots and 15 headless-Chrome checks pass.

- **Graph core.** Tests cover parsing and its error messages, exact rational roots (200 random products of linear factors), approximate irrational roots, vertices, systems (unique, parallel, same line), graphing both sides, strip sums that converge to the exact integral, and render sanity for tracer stacks and the area sweep.
- **Browser.** The point dragged along y = x² − 2x − 3 settles on the root (3, 0), where the y column vanishes. The two-line system shows the crossing (3, 2) with both equations checked. The area sweep on [0, 4] with Δx = ½ sums to exactly −8.5 against the exact −20/3. A graph lesson is completed by dragging, and graph-mode dragging stays within the frame budget.
- **Review fixes.** An independent review confirmed nine defects plus a crash already on main; all are fixed with tests.

## Machine mode (2026-10)

The Machine is built by four engineers on four branches (design section 7). This section records the mode's own checks (engineer D, `feature/machine-mode`) and what they showed on a pre-merge integration: D's branch with the A, B and C working trees of 2026-10-21 assembled side by side. Numbers are from the reference machine (Intel i7-6700K, 8 threads, headless Chrome). Re-run them after the merge (A → C → B → D) and replace them.

**Unchanged.** `npm test` passes and `npm run test:visual` reports all 720 decimal SVG snapshots unchanged. The 22 existing headless-Chrome checks still pass with the sixth header button.

**Beat clock** (`tests/machine-clock.test.js`, 8 tests, under 0.1 s). Beat lengths (a level-pace carry is half a beat), read-along gaps (capped at 6 s), AUTO playing a whole run at the exact beat ends however frames fall, sixteen Enters with AUTO off reaching OUTPUT one beat each, Enter mid-beat finishing that beat without skipping, a second Enter mid-run continuing the run, speed applied from the next beat, pause, back and seek landing on boundaries, and a frame stamped before the click that started a beat. That last case was a real bug found in the browser: `requestAnimationFrame` passes the frame's start time, which can precede the click, and the clock briefly ran backwards.

**Browser checks** (`npm run test:browser`; `ONLY=machine` runs only these). The 13 checks of design 6.9 are 16 entries: base e, touch scrolling and the two phone sizes are separate. Without the core and picture modules they report as pending, and the run still passes. On the integration:

| | Result |
|---|---|
| 1 Header open, × under IO, `[16,7]` focused and selected; Enter with AUTO on gives `[112]` | pass |
| 2 AUTO off: 16 Enters in Input play beats 0–15 with the 12 golden captions; Enter mid-run finishes the beat; ← goes back one beat | pass |
| 3 `[`, `a`, `t`, `]` typed in Input fire no shortcut; `>>` is refused with its message | pass |
| 4 Ternary `[5,−4]` → `[−20]`; base e lazy-loads `e-base.js` and plays MEASURE 3 | pass |
| 5 Tap-to-attach, drag-to-attach, a sideways touch swipe scrolls the palette without a drag, an edit after OUTPUT rewinds with every block back | pass |
| 6 Phones 390×844 and 844×390: stage focused, palette reachable, every moving bulb on screen and ≥ 18 px | **fail**, at u = .1 only (below) |
| 7 Header at 360×740: no wrap, no overflow, both styles | pass |
| 8 Reduced motion: 1.5 s beats, Read along on, the same beats, `[112]` | pass |
| 9 Style switched mid-run; digit glyphs drawn in `machine.glyph`, light on the cyber stage | pass |
| 10 Leaving returns keys to the equation space; a lesson, the equation dialog and Android back close the machine | pass |
| 11 `9/(3−3)`: the DIV block outlined in `machine.error`, the zero divisor named, Output `[—]` | pass |
| 12 Tapping `16 × 7` in base 2 offers Watch in the machine, which opens it preloaded; To the cards refuses (2³² − 1)² with its reason, and takes `[112]` to the cards | pass |
| 13 The outline is skipped by Tab while its sheet is closed (it is `inert`) and reachable when Parts is open | pass |

Check 6 places each moving bulb by the layout (`place`, the 6.3 position rule, eased) and maps it through the stage's own transform. Every failure is at u = .1, while `cameraAt` glides from one beat's framing to the next: at 390×844 one bulb of the `16 × 1` shift starts 20 px past the right edge; at 844×390, with the camera at its minimum scale, the tops of the 7-level towers start up to 60 px above the stage in the split, shift and return beats. By u = .5 every bulb is on stage. The phone layouts were changed to help: during a run the portrait stage grows from 502 to 614 px, and in landscape the bar, sentence and caption moved into the right rail, so the stage grows from 246 to 322 px tall. The rest belongs to the camera (C).

**Performance** (`npm run perf`, 1280×800, the heaviest beat of each scene played at 1 s per beat):

| Scene | Beat | Sketchpad median / p95 | Cyber median / p95 |
|---|---|---|---|
| (2³² − 1)², widest ADD (64 levels, 1489 bulbs in the scene) | 98 collide | 33.3 / 49.9 ms | 33.3 / 33.4 ms |
| ((3²⁰ − 1)/2)², widest ADD | 62 collide | 16.7 / 16.7 ms | 16.7 / 16.8 ms |
| (2⁶³ − 1) ÷ 3 | 3 prep | 16.7 / 16.8 ms | 16.7 / 16.8 ms |
| base-e UNFOLD of 600 | 3 unfold | 16.7 / 16.7 ms | 16.7 / 16.7 ms |

The 64-level ADD misses the 16.7 ms median. Profiled in the page, `renderMachine` itself takes 22 ms per frame there (its camera 0.3 ms); the mode's own share is about 2 ms, because it patches each frame into the previous one rather than replacing it. Replacing 1500 `<use>` bulbs had cost 66 ms against 13 ms for parse-and-patch.

**Size.** Design 6.11 allows the Machine 120 KB raw in `dist-app`. The integrated `src/machine` is 295 KB raw without `scenes.js`, which `npm run app:build` leaves out (only the test bench uses it): 241 KB before base e loads, 92 KB Brotli, 103 KB gzip. The mode's own files are 55 KB (`machine-app.js` 49 KB, `clock.js` 6 KB). The budget cannot hold the module set the design specifies. App start is unaffected: the Machine loads only when opened, makes no network requests and adds no dependencies.

**Time budget.** On the integration, all `tests/machine-*.test.js` together took 28.8 s, close to the 30 s budget, with A's tests still in progress (2 of 107 failing at the time).

**Not covered here.** The guided lessons (phase 5) are not built. Android back and `abacus://open/machine` are exercised through the handlers app.js exposes under `&automation`, not in a native shell. The = sign hidden after a spring-home drag (also user-reported) now has a browser check. Copies no longer run out of order or share a cell (all a ≤ 99, b ≤ 19 checked), and slash parsing is consistent (`x ÷ 1/2` = 2x). Animations that fail to plan fall back without breaking the app.
