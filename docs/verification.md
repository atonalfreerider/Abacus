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

The Machine was built by four engineers on four branches (design section 7) and merged as `feature/machine` in the contract's order, A → C → B → D. An adversarial review of each branch was answered on four fix branches, `fix/machine-core` (A), `fix/machine-picture` (C), `fix/machine-e` (B) and `fix/machine-mode` (D), which were merged into `feature/machine` in that order, with the changes each fixer left for another owner applied on top (below). Numbers are from the reference machine (Intel i7-6700K, 4 cores and 8 threads, Node 22, headless Chrome 155), which other jobs shared; the load average is given with each timing, and a wall-clock failure was re-run alone before it was counted.

**On the assembled branch:**

| Suite | Result |
|---|---|
| `npm test` | 222 tests: 221 pass, 1 `todo` (the base-e cross-check that design 6.11 keeps as a report); 18.7 s at load average 5 |
| `node --test tests/machine-*.test.js` | 128 tests: 127 pass, 1 `todo`; 17.1 s together at load 5 (budget 30 s); `machine-plan.test.js` alone 11.2 s (its own budget 20 s) |
| `npm run test:visual` | all 720 decimal SVG snapshots unchanged |
| `npm run test:visual:machine` | all 3784 machine snapshots match: 2224 in `tests/machine-baselines.json`, 1560 base e in `tests/machine-e-baselines.json` |
| `npm run test:browser` | 41 of 41: the 22 existing checks and all 19 machine entries, none pending |
| `node tools/perf.mjs` | every scene ok; every machine scene holds a 16.7 ms median in both styles (table below) |
| `node tools/build.mjs`, `--app` | both build; `--app` needs `node_modules/@capacitor/core`, so it was run with the main checkout's `node_modules` linked in for the build |

**Played to the end** in headless Chrome (1280×800) on the assembled branch, Output read from the mode and the digit line from the plan's last scene: `[16,7]` with × gives `[112]` in base 2 (`1110000₂`) and in balanced ternary (`11011 bal₃`), with AUTO on (one Enter) and with AUTO off (16 Enters, one beat each); and the design's base-e examples: 16 + 7 → `[23]`, `1010.011…ₑ`; 16 × 7 → `[112]`, `20010.001…ₑ`; MEASURE 3, 7, 16, 30 and 112 → `10.020…ₑ`, `21.111…ₑ`, `201.011…ₑ`, `1102.110…ₑ`, `20010.001…ₑ`; MEASURE e² + 2 → `102ₑ`; 1 + e → `11ₑ`; (e + 1)² → `121ₑ`; (e + 1)³ → `2111.002…ₑ`; (e² + 2) − 2 → `100ₑ`; ×e² on 3 → `1002.001…ₑ`; ×e³ on 2 → `2000ₑ`; MEASURE 2e + 2 (22ₑ) → `100.000…ₑ` (the 2 of `100.0002…ₑ` is below the floor, in the dust). No page errors.

**Cross-owner changes applied at assembly**, each from a fixer's report:
- A (`ops/shift.js`, `plan.js`, `tree.js`), from B: `powerValue` spells e^k with the base's `power()`, so a ×eᵏ count past −6..12 no longer reaches FANOUT without a value; `tooTall` refuses such a count before planning, still with the exact answer (`[3,13]` → `[3e¹³]`); `explain()` keeps ×eᵏ's own domain message (a k may be negative; only a k that is not whole fails).
- C (`render.js`), from B: a light's fill readout lives in its tower's note, which used to stand beside the falling light until u 0.9. When a light glides along a path, its note now fades over [0, 0.1], and the next rest's readout shows from 0.9 (3.3: shown only while the light is at rest). Tested.
- D (`machine-app.js`), from B: a `tooBig` with no answer (a shift or power past any tower) shows its own message instead of "here is the exact answer" over an empty Output; `active()` treats 0 < t < 1e−9 and a NaN t as the opening, where it read `beats[-1]` and threw (seen once in `#machine-status`).
- Unowned (`tools/browser.mjs`), from D: removing Chrome's profile retries, since Chrome may still be writing it (ENOTEMPTY crashed one run).
- `tests/machine-e-baselines.json` came from both the picture fixer (new camera, old fixtures) and the base-e fixer (new fixtures, old camera). It was re-recorded on the assembly after the 188 changed frames (the fill notes and their fade in `e-add-16-7`, `e-mul-16-7`, `e-sub-7-16` and `e-measure-112-level`) were reviewed as PNGs in sketchpad landscape and cyber portrait; the other 3596 machine frames did not change, including the ternary division scenes after the core fixer's JUDGE scan change.
- The picture fixer asked for the HUD to be passed to the camera as `inset.hud`, which keeps only the movers out from under it. The mode fixer instead insets the framed area by the HUD (`inset.top` or `inset.left`, whichever costs the smaller share), so nothing is ever drawn under it; with that, `inset.hud` would change nothing, and it is not passed. Both fixers' other half, counting the palette only where it overlaps the stage horizontally, is in.
- `src/mvc/app.js`: the core fixer suggested stripping grouping commas before parsing; the mode fixer's Watch builds the expression from the operands' exact values instead, which covers `1,024 × 3` (check 12).

**Contract notes** (6.6), from the core fixer: the oracle's MOD returns `{value}`; `tooBig` can come from the oracle and the registry's `evaluate` (a computed shift count no tower could hold, which 6.10 requires) and from `evaluateTree`, which can also give `arity`; the registry's `evaluate` takes an optional `{limits}`; `PlanBuilder.valueOf` throws for base e, whose towers have no BigInt value (its planners read `Tower.value`). Base e's `evaluate` gives the exact answer at any size: the caps of 6.10 are checked while planning, which then returns `tooBig` with that answer; only a power of e past e^±300 is refused outright, with no answer, like binary's shifts past 4096.

**Beat clock** (`tests/machine-clock.test.js`, 10 tests, under 0.1 s). Beat lengths (a level-pace carry is half a beat), read-along gaps (capped at 6 s), AUTO playing a whole run at the exact beat ends however frames fall, sixteen Enters with AUTO off reaching OUTPUT one beat each, Enter mid-beat finishing that beat without skipping, a second Enter mid-run continuing the run, speed applied from the next beat, pause, back and seek, and a frame stamped before the click that started a beat (`requestAnimationFrame` passes the frame's start time, which can precede the click; the clock briefly ran backwards). The review found two more, now fixed and tested: with Read along on, the gap after a level-pace carry beat subtracted dur² · sp instead of the beat's own length, so at 1 s beats each carry beat's gap was 0.25 s too long and the clock disagreed with `schedule()`; and Step after a seek to k + 0.4 rounded back to k and replayed beat k, where design 4.2 finishes the beat. The clock now starts every beat when `schedule()` says, at every speed.

**Browser checks** (`npm run test:browser`; `ONLY=machine` runs only these). The 13 checks of design 6.9 are 16 entries (base e, touch scrolling and the two phone sizes are separate), and three more cover the mode review's fixes. None reports as pending: the modules are merged, so a missing one fails. On the assembled branch all 19 pass:

| | Result |
|---|---|
| 1 Header open, × under IO, `[16,7]` focused and selected; Enter with AUTO on gives `[112]` | pass |
| 2 AUTO off: 16 Enters in Input play beats 0–15 with the 12 golden captions; Enter mid-run finishes the beat; ← goes back one beat | pass |
| 3 `[`, `a`, `t`, `]` typed in Input fire no shortcut; `>>` is refused with its message | pass |
| 4 Ternary `[5,−4]` → `[−20]`; base e lazy-loads `e-base.js` and plays MEASURE 3 | pass |
| 5 Tap-to-attach, drag-to-attach, a sideways touch swipe scrolls the palette without a drag, an edit after OUTPUT rewinds with every block back | pass |
| 6 Phones 390×844 and 844×390: stage focused, palette reachable, nothing drawn under the HUD at the opening, every moving bulb on screen and ≥ 18 px | pass |
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

Check 6 places each moving bulb by the layout (`place`, the 6.3 position rule, eased) and maps it through the stage's own transform. It needs every moving bulb on stage in all 3 sampled frames of each `[16,7]` beat, and in 2 of 5 for `[1048575, 1]`. On the first merge it failed at both sizes, for two reasons. The mode's `inset()` counted the palette as covering the stage whenever the two overlapped vertically, so in the phone landscape rail, where the palette sits beside the stage, the camera framed every beat into the top 94 to 120 px of a 322 px stage. And the merged camera glided from the previous beat's framing and did not frame a returning tower (390×844: `[16,7]` beat 9 started a bulb 14 px past the right edge; none of `[1048575, 1]`'s returning 21 bulbs was on stage). The mode fixer's inset and the picture fixer's rebuilt camera, which ends each beat on a keyframe that frames what moved, then the next beat's movers, the block and the frame, fix both; each alone does not. The camera frames below the HUD through `view.inset`, and on phones the HUD is a single line (22 px of a 322 px landscape stage, 35 px of a 503 px portrait stage).

**Performance** (`npm run perf`, 1280×800, the heaviest beat of each scene played at 1 s per beat, load average 5):

| Scene | Beat | Sketchpad median / p95 | Cyber median / p95 |
|---|---|---|---|
| (2³² − 1)², widest ADD (64 levels, 1489 bulbs in the scene) | 98 collide | 16.7 / 16.7 ms | 16.7 / 16.8 ms |
| ((3²⁰ − 1)/2)², widest ADD (571 bulbs) | 62 collide | 16.7 / 16.7 ms | 16.7 / 33.3 ms |
| (2⁶³ − 1) ÷ 3 | 3 prep | 16.7 / 16.7 ms | 16.7 / 16.8 ms |
| base-e UNFOLD of 600 | 3 unfold | 16.7 / 16.7 ms | 16.7 / 16.8 ms |

All within 6.9's 16.7 ms median and 34 ms p95. On the first merge the 64-level ADD took 33.3 ms (median): `renderMachine` alone took 26 to 30 ms a frame there. The picture fixer's layout now replays plans through `scene.js`, indexes bulbs by tower once per scene and culls off-camera bulbs before building them: that frame is drawn in about 5 ms in Node, and laying out (2³² − 1)² takes about 0.2 s instead of 3.1 s (34 s for its 1649-beat level-pace plan before, during which the page waited). The mode's own share of that frame is 1.3 ms (median of 60 frames): frames are patched into the previous one tag by tag, and only the start tags that changed are parsed; the resulting DOM was checked against a full parse at every frame of whole runs in both styles.

**Size.** Design 6.11 allows the Machine 120 KB raw in `dist-app`. `node tools/build.mjs --app` puts 334 878 bytes in `dist-app/src/machine` (23 files, without `scenes.js`, which only the test bench uses): 118 KB gzip -9 and 104 KB Brotli (quality 11). Before base e loads it is 277 KB raw (97 KB gzip, 86 KB Brotli); base e adds 58 KB. The assembly grew it by 25 KB over the first merge, mostly the rebuilt camera in `layout.js` (29 → 42 KB). Without comments and indentation the files would still be about 262 KB, so neither trimming nor a comment-stripping build step reaches 120 KB raw; the budget cannot hold the module set the design specifies, and the design owner has to restate it (for example as a compressed size, or with the lazily loaded mode exempt). The app packages zip their assets, so the download grows by about the gzip figure. App start is unaffected: the Machine loads only when opened, makes no network requests and adds no dependencies. (KB here are 1000 bytes.)

**Coverage of 6.9's cross-engine row.** By default every pair with |a|, |b| ≤ 20 runs the whole `planMachine` and is checked against both the cards (`unitPlanMany`) and the ADD planner's digits, and the |a|, |b| ≤ 200 square is checked through the ADD planner on the lattice (7a + b) ≡ 0 mod 11, in both bases. `MACHINE_FULL_SQUARE=1 node --test tests/machine-crossengine.test.js` checks all 2 × 401² = 321 602 pairs (all pass; 10.5 s at load 6). Running the full square by default would cost about as much CPU as all of `machine-plan.test.js` and push the machine files past their 30 s.

**Time budget.** `machine-plan.test.js` checks about 48 900 plans (43 091 exhaustive, 5 000 near the limits, 808 nested machines and the reviews' trees) on a pool of min(4, CPUs) worker threads. Its 20 s is the reference machine's; with fewer CPUs it asserts 20 s × 4/workers. The 50 ms per plan is the faster of two plans, re-timed best of three on the main thread when a worker reports a slow one, so scheduling noise does not fail it and the planner is not given more time. The 20 s is fragile under load from other jobs whenever the file shares the machine with the other test files, as in `npm test` and in the machine files' joint run, which run every file at once: on this assembly at load 7 to 16 the plan file took 20.9 to 22.3 s there (failing its 20 s) while passing alone in 11.2 to 14.7 s; at load 5, `npm test` passed with the file at 17.2 s. A faster pool does not help: seven workers instead of four took the same 21 s in the joint run, because the files together keep all 8 threads busy. `machine-render.test.js` asserts the same 20 s for itself (about 4 s alone). `machine-golden.test.js` has 21 tests.

**Not covered here.** The guided lessons (phase 5) are not built. Android back and `abacus://open/machine` are exercised through the handlers app.js exposes under `&automation`, not in a native shell. Design 4.3's "Tab to a socket on the stage" is not possible: the stage SVG is `aria-hidden`, so its socket targets are not focusable; keyboard users attach blocks through Parts, the accessible path of design 4.9. Two of 3.3's fill readouts are not written: at the start of an UNFOLD whose light arrived at FANOUT (MEASURE of a typed value) and at the end of a together-pace UNFOLD. The normative fixture `e-measure-3.json` (6.5) fixes FANOUT's set and the UNFOLD's tower patch without a note, so writing them needs 6.5 changed first (FANOUT writing the note for measure lights, the UNFOLD clearing it) and the fixture regenerated.
