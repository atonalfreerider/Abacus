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
- **Review fixes.** An independent review confirmed nine defects plus a crash already on main; all are fixed with tests. The = sign hidden after a spring-home drag (also user-reported) now has a browser check. Copies no longer run out of order or share a cell (all a ≤ 99, b ≤ 19 checked), and slash parsing is consistent (`x ÷ 1/2` = 2x). Animations that fail to plan fall back without breaking the app.

## Machine mode (2026-10)

The Machine was built by four engineers on four branches (design section 7) and merged as `feature/machine` in the contract's order, A → C → B → D. This section records the mode's own checks (engineer D) on that merge, with the fixes from the mode's review (`fix/machine-mode`). Numbers are from the reference machine (Intel i7-6700K, 8 threads, Node 22, headless Chrome 155), measured while other jobs shared the CPU (load average 8 to 30); a timing failure was re-run alone before it was counted.

**Unchanged.** `npm test` runs 205 tests (one `todo`: the base-e cross-check that design 6.11 keeps as a report) and `npm run test:visual` reports all 720 decimal SVG snapshots unchanged. The 22 existing headless-Chrome checks still pass with the sixth header button.

**Beat clock** (`tests/machine-clock.test.js`, 10 tests, under 0.1 s). Beat lengths (a level-pace carry is half a beat), read-along gaps (capped at 6 s), AUTO playing a whole run at the exact beat ends however frames fall, sixteen Enters with AUTO off reaching OUTPUT one beat each, Enter mid-beat finishing that beat without skipping, a second Enter mid-run continuing the run, speed applied from the next beat, pause, back and seek, and a frame stamped before the click that started a beat (`requestAnimationFrame` passes the frame's start time, which can precede the click; the clock briefly ran backwards). The review found two more, now fixed and tested: with Read along on, the gap after a level-pace carry beat subtracted dur² · sp instead of the beat's own length, so at 1 s beats each carry beat's gap was 0.25 s too long and the clock disagreed with `schedule()`; and Step after a seek to k + 0.4 rounded back to k and replayed beat k, where design 4.2 finishes the beat. The clock now starts every beat when `schedule()` says, at every speed.

**Browser checks** (`npm run test:browser`; `ONLY=machine` runs only these). The 13 checks of design 6.9 are 16 entries (base e, touch scrolling and the two phone sizes are separate), and three more cover the review's fixes. None reports as pending any more: the modules are merged, so a missing one fails. On the merge with the review fixes, 17 of the 19 entries pass:

| | Result |
|---|---|
| 1 Header open, × under IO, `[16,7]` focused and selected; Enter with AUTO on gives `[112]` | pass |
| 2 AUTO off: 16 Enters in Input play beats 0–15 with the 12 golden captions; Enter mid-run finishes the beat; ← goes back one beat | pass |
| 3 `[`, `a`, `t`, `]` typed in Input fire no shortcut; `>>` is refused with its message | pass |
| 4 Ternary `[5,−4]` → `[−20]`; base e lazy-loads `e-base.js` and plays MEASURE 3 | pass |
| 5 Tap-to-attach, drag-to-attach, a sideways touch swipe scrolls the palette without a drag, an edit after OUTPUT rewinds with every block back | pass |
| 6 Phones 390×844 and 844×390: stage focused, palette reachable, nothing drawn under the HUD at the opening, every moving bulb on screen and ≥ 18 px | **fail** at both sizes (below) |
| 7 Header at 360×740: no wrap, no overflow, both styles | pass |
| 8 Reduced motion: 1.5 s beats, Read along on, the same beats, `[112]`; the Reduced motion option keeps a speed the user chose and is remembered over the system setting | pass |
| 9 Style switched mid-run; digit glyphs drawn in `machine.glyph`, light on the cyber stage | pass |
| 10 Leaving returns keys to the equation space; a lesson, the equation dialog and Android back close the machine | pass |
| 11 `9/(3−3)`: the DIV block outlined in `machine.error`, the zero divisor named, Output `[—]` | pass |
| 12 Tapping `16 × 7` in base 2 offers Watch in the machine, which opens it preloaded; so do `1,024 × 3` and `−(4 + 3) × 7`; To the cards refuses (2³² − 1)² with its reason, and takes `[112]` to the cards | pass |
| 13 The outline is skipped by Tab while its sheet is closed (it is `inert`) and reachable when Parts is open; Esc in the sheet closes the sheet, not the mode | pass |
| 14 `?machine=(5+3)*7` keeps its `+`; `__machine.load({mbase, machine})` switches to ternary and to base e | pass |
| 15 At 720×500: → on the base radios moves to ±3 and plays nothing, → on the Steps tab selects Parts, Tab reaches the visible outline, → on the stage still plays | pass |
| 16 A 441-beat run (65535² in level pace) asks first; Play at 4× plays it at 0.5 s a beat and keeps the chosen 2 s for the next machine | pass |

Check 6 places each moving bulb by the layout (`place`, the 6.3 position rule, eased) and maps it through the stage's own transform. It needs every moving bulb on stage in all 3 sampled frames of each `[16,7]` beat, and in 2 of 5 for `[1048575, 1]`. At 390×844, `[16,7]` fails beat 9 (the `16 × 1` shift): bulb b6 starts 14 px past the stage's right edge at u = .1. `[1048575, 1]` fails its return (beat 4): none of the 21 bulbs of the returning tower is on stage in any of the 5 frames. At 844×390, every `[16,7]` beat from 3 to 15 fails. The split, shift, collide and output beats start up to 77 px above the stage at u = .1. The return beats (5, 8, 10, 12 and 14) keep the returning tower above the stage for the whole beat, so none of its bulbs is on stage in any sampled frame; the review's probe found the same at every u, u = 1 included. `[1048575, 1]` fails its return beat the same way. An earlier version of this record said every failure was at u = .1 and that every bulb was on stage by u = .5; that was wrong for the return beats. Both causes are in `cameraAt` (`layout.js`, owned by C): the beat framing does not include the returning tower, and the camera glides from the previous beat's framing. On the mode's side the phone stages were enlarged (the portrait stage grows from 502 to 614 px during a run; in landscape the bar, sentence and caption sit in the right rail), and the camera now frames below the HUD through `view.inset`, with the HUD a single line on phones (22 px of a 322 px landscape stage, 35 px of a 503 px portrait stage).

**Performance** (`npm run perf`, 1280×800, the heaviest beat of each scene played at 1 s per beat):

| Scene | Beat | Sketchpad median / p95 | Cyber median / p95 |
|---|---|---|---|
| (2³² − 1)², widest ADD (64 levels, 1489 bulbs in the scene) | 98 collide | 33.4 / 50.1 ms | 33.4 / 50.0 ms |
| ((3²⁰ − 1)/2)², widest ADD | 62 collide | 16.7 / 33.3 ms | 16.7 / 33.4 ms |
| (2⁶³ − 1) ÷ 3 | 3 prep | 16.7 / 16.8 ms | 16.7 / 16.8 ms |
| base-e UNFOLD of 600 | 3 unfold | 16.7 / 16.8 ms | 16.7 / 33.4 ms |

The 64-level ADD misses the 16.7 ms median and the 34 ms p95. `renderMachine` itself takes 22 to 26 ms per frame there in the page and 29.8 ms in Node (owned by C); its camera takes 0.3 ms, and the mode's own share is about 2 ms, because it patches each frame into the previous one rather than replacing it (replacing 1500 `<use>` bulbs had cost 66 ms against 13 ms for parse-and-patch). Building the layout is slow too: in Node `layoutPlan` takes 3.0 s (merge, light load) to 4.3 s (shared load) for the 161-beat (2³² − 1)² plan and 34 s (shared load) for its 1649-beat level-pace plan, and the page waits that long when such a machine is loaded (also C's). The p95 of 33.3 ms on the lighter scenes is one dropped frame under the shared load; the existing equation scenes showed the same.

**Size.** Design 6.11 allows the Machine 120 KB raw in `dist-app`. `node tools/build.mjs --app` puts 307 924 bytes (301 KB) in `dist-app/src/machine`: 23 files, without `scenes.js`, which only the test bench uses. That is 108 KB gzip -9 and 96 KB Brotli (quality 11). Before base e loads it is 254 KB raw (88 KB gzip, 78 KB Brotli). The mode's own files are 61 KB (`machine-app.js` 55 KB, `clock.js` 7 KB); the core and picture alone are 247 KB, so the budget cannot hold the module set the design specifies, and the design owner has to set a new one. The app packages zip their assets, so the download grows by about the gzip figure. App start is unaffected: the Machine loads only when opened, makes no network requests and adds no dependencies.

**Time budget.** All `tests/machine-*.test.js` together (111 tests) took 17.3 s on the merge under light load, under the 30 s budget, with `machine-plan.test.js` at 11.7 s alone (its own budget is 20 s). Re-run here while video recording and other test runs shared the CPU (load average 16 to 25), the same run took 27.6 to 43.9 s, and A's wall-clock assertions failed in it (a plan in 76.7 ms against 50 ms, and the 20 s file budget); `machine-plan.test.js` then passed alone in 17.3 s. These are contention, not regressions: the review's fixes add two clock tests that take under a millisecond.

**Not covered here.** The guided lessons (phase 5) are not built. Android back and `abacus://open/machine` are exercised through the handlers app.js exposes under `&automation`, not in a native shell. Design 4.3's "Tab to a socket on the stage" is not possible: the stage SVG is `aria-hidden`, so its socket targets are not focusable; keyboard users attach blocks through Parts, the accessible path of design 4.9.
