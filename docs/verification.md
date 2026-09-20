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
