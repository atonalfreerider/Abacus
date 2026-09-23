# ABACUS

A browser equation workspace built from the original ABACUS SWF's textures, face-on 3×3 trays and equals mirror. Numbers are physical cards: each occupied cell holds 1, 10 or 100 card faces, so place value is visible as stack depth. Addition carries and borrows card by card, positive and negative cards cancel in zero pairs, multiplication copies cards, and long division deals them into equal groups. In graph mode, a point dragged along a curve shows its coordinates as card stacks, and systems of equations are solved where curves cross. An advanced module sweeps card strips under a curve to build an integral. A tutor shows worked examples and then deals the learner fresh problems. The original SWF remains available at `reference.html` for comparison.

## Run

Node.js 20+ for the app and unit tests (Node 22+ for the headless-Chrome checks); no package installation.

```sh
npm start                 # http://localhost:5173
npm test                  # unit and property tests
npm run test:visual       # deterministic SVG snapshots
npm run test:browser      # real pointer/keyboard/tutor checks in headless Chrome
npm run perf              # frame times of heavy animations in headless Chrome
npm run build && npm run preview
```

Stop development before previewing on the same port, or set PORT. `dist` is a static deployment with relative URLs and precompressed assets. The browser checks find Chrome automatically (set `CHROME=/path/to/chrome` otherwise) and skip if none is installed.

## Using it

**Entering problems.** Type or use the original-style 3×3 counting pad (hover lights cumulative cells; the folded corner on 9 enters a decimal point). Up arrow, the upper triangle or Enter deploys the input; the Equation dialog takes a whole problem. `×` (or `*`) multiplies and `÷` (or `:`) divides; numbers joined by them stay one **operation term** in a dashed frame until worked out. A slash between numbers is a fraction (`3/4`). Parentheses, decimals up to six places and linear algebra in x are supported.

**Dragging.** Cards have weight: the held card follows the pointer on a critically damped spring.
- The equals mirror resists like a membrane. The card's edge stops at the mirror, which bows under the push; push further and the card pops through and flips sign (red ↔ blue). A small step back meets the membrane again rather than flipping back.
- While a lifted card leaves its side lighter, the equals bars tilt into `<` or `>`, as the original SWF did; they level once the card has crossed.
- Like cards on the card's side are outlined; near one the card is attracted, and close enough it snaps on, outlined red for a zero pair (opposite signs cancel) or teal for a combination. Release to combine; hold Shift on release to place it beside instead.
- Elsewhere, the other cards spring apart and a dashed ghost shows where the card will land. The mirror and any merge target stay put, so nothing slides away from the pointer. Releasing without a change springs the card home.
- Tap an operation term (or focus it and press Enter) to work it out. Arrow keys move a focused card across; Shift + arrows rearrange.

**Working out × and ÷.**
- *Multiplication* extends the original's `Multiplication.Duplicator`. The factor with fewer cards becomes a horizontal line of cards; the other is copied once per card. A ten-card copies it one place up, so its cards become ten-stacks, and a tenth-card copies it one place down. The copies are then added into the answer card by card, carrying tens. `23 × 14` shows one copy of 230 and four of 23.
- *Long division* shares the dividend: each place's cards, largest first, are dealt round-robin into equal groups, and leftovers unstack into ten cards of the next place. While the answer terminates, dealing continues into tenths and hundredths (`7 ÷ 4 = 1.75`). Otherwise each leftover card is sliced into equal strips, one per group, giving a mixed number of whole cards plus a sliced card (`7 ÷ 3 = 2⅓`). One group becomes the answer.
- *Dividing by a fraction* first turns the fraction over (`6 ÷ ½` becomes `6 × 2`).
- Tapping a fraction divides it out into a decimal (`3/4 → 0.75`) or a mixed number.
- Visual plans cover divisors up to 12, up to 24 copies and dividends up to six digits. Larger or fractional cases use an exact symbolic transition.

**Graph mode** (header: Graph) plots up to three equations in x and y:
- `y =` a polynomial in x up to degree 4, such as `y = x^2 - 2x - 3` or `y = (x+2)(x-1)(x-3)/2`;
- linear equations such as `2x + 3y = 12`;
- vertical lines such as `x = 3`;
- one-variable equations, graphed as both sides (`x^2 = 4` becomes `y = x²` and `y = 4`).

Drag the point along a curve. Its coordinates stand as cards: a column of y cards rises from the x axis to the point, and a row of x cards runs from the y axis to it. Cards are blue when positive and red when negative, cut exactly at fractions, and every ten are outlined as a group. The point moves on a spring, steps in friendly fractions (arrow keys also step it), and settles into detents at roots, the y-intercept, turning points and crossings. These are exact where rational and marked ≈ otherwise. Each equation is checked by substituting the point. At a system's crossing every equation holds; parallel and identical lines are explained. **From the cards** graphs both sides of the card-space equation; their crossing is its solution. Pan by dragging the background, and zoom with the wheel or a pinch.

**Area (advanced).** Tick *Area*, choose [a, b], a strip width Δx and where each strip takes its height, then **Sweep**. The point moves across and stacks a column of card strips at each step. Every column then slides beside b and becomes whole cards (same area), and red cancels blue. The resulting stack is marked against the exact integral, computed from the antiderivative. **Thinner strips** halves Δx, and the sum approaches the integral.

**Tutor.** Choose a lesson (moving cards, zero pairs, equal groups, x on both sides, fractions, products, multiplying by copying, two-digit lines, decimal copies, long division, remainders as decimals or fractions, dividing by a fraction, carrying, borrowing, and three graph lessons: solve a system by graphing, where a parabola meets zero, graph both sides). The tutor plays a worked example step by step, or with Play all, narrating each step, then deals a new problem of the same shape. Hint highlights the card to move and draws a guide arrow; Show me performs the step; feedback says whether a move helped, was a balanced detour, or solved it. Solve and Combine use the same step planner.

**View** offers horizontal, vertical and automatic layouts, front/depth/spread stack cameras, and zoom. Animations can be paused, scrubbed and finished; undo/redo restore exact states.

## Architecture and mathematics

- `src/engine.js`: exact reduced rationals (BigInt intermediates), the parser, operation terms (`expr` chains with the sign on the first operand), `evaluateStep`, and solution classification.
- `src/mvc/model.js`: immutable equations and validated commands (move, reorder, combine, evaluate, operate, simplify) with undo/redo. Every command is checked to preserve the equation residual (or apply its explicit nonzero factor). `nextStep` is the planner: products first, zero pairs before same-sign pairs, x gathered where its coefficient stays positive, then scaled to one x.
- `src/mvc/controller.js`: commands, animation lifecycle, drop interpretation; emits `commit` events.
- `src/mvc/view.js`: SVG projection of model state and deterministic transition frames; it cannot change mathematical state. `surface.js` keeps a persistent SVG so textures stay decoded and frames replace only the scene body; `raster.js` rasterizes each 1/10/100-card stack once (the vector drawing remains the reference and fallback).
- `src/mvc/units.js`: signed singleton ledger for addition, subtraction and repeated addition, scheduled on one timeline. Transfers, carries, borrows and cancellations conserve exact weight, and pairs cancel in reading order.
- `src/mvc/operations.js` and `operation-view.js`: card plans and frames for multiplication (copies over a line of cards) and long division (dealing, unstacking, slicing).
- `src/mvc/physics.js` and `drag.js`: drag physics (spring, membrane, magnets, reflow, balance tilt) and the DOM glue that writes transforms each frame.
- `src/mvc/tutor.js`: lessons, problem generators, narration and feedback. `app.js` wires input, dialogs and the tutor bar.
- `src/graph/polynomial.js`: exact polynomial parsing in x and y, roots (rational root theorem, then bracketed numeric roots), intersections, Riemann sums and exact integrals. `graph-view.js` renders deterministic SVG; `graph-app.js` handles the tracer, detents, pan/zoom, substitution checks and the area sweep.

Supported scope: one-variable linear equations and expressions in x, with parentheses/distribution, fractions, decimals, variables on both sides, identities and contradictions. Rational components must fit safe integers; overflow is rejected, as are nonlinear terms, variable denominators and multiplying or dividing both sides by zero. This is not a universal computer algebra system. The original JPEG textures are reused; typography and animation paths are reconstructions, not SWF playback. Solved variable trays show up to nine green units; larger answers remain fully represented on the constant side.

## Tests and regression infrastructure

- `npm test`: exact arithmetic, parser and operation chains, planner termination and residual preservation, 150 random products and every division plan checked for conservation, drag physics (membrane, hysteresis, snapping, reflow), 200 generated problems per tutor lesson (graph lessons: an exact goal point each), polynomial parsing, 200 random root sets recovered exactly, systems, strip sums converging to exact integrals, stack geometry, clock behaviour, and SWF provenance, including a full AVM2 decode of the original.
- `npm run test:visual`: 720 deterministic SVG snapshots (24 scenes × 2 layouts × 3 cameras × 5 timestamps) against reviewed hashes; outputs go to `artifacts/visual`. `npm run test:visual:update` records new hashes after visual review.
- `npm run test:browser`: headless Chrome with DevTools pointer and key events. It drags through the mirror onto a like card, releases inside the membrane, drops in open space and in gaps, taps a product, runs Solve through long division, uses the keyboard and the vertical layout, and runs the tutor flow. In graph mode it drags the point into a root's detent, solves a system, runs the area sweep and completes a graph lesson. It also checks p90 frame time while dragging in both modes.
- `npm run perf`: median/p95 frame times for heavy scenes, failing above `FRAME_BUDGET_MS` (34 ms by default). Scenes hold a 16.7 ms median; the heaviest spread-camera products and divisions reach 33 ms at p95.
- The test bench (`tests.html`) scrubs any scene, layout, camera and frame, runs geometry assertions and compares local pixel baselines. Pixel baselines are Git-ignored and recorded per machine.

CI runs unit, snapshot, browser and frame-time checks (the last two with a 50 ms budget for shared runners) and builds `dist`. See `docs/verification.md` for performed checks and limits.

## The original SWF

`public/ABACUS.swf` is the untouched original and `reference.html` plays it through self-hosted Ruffle. `npm run swf:disasm -- absrc::Multiplication` prints the original AVM2 bytecode for any class or method (`--list` names them all). `docs/original-reference.md` records what the original does and does not implement.

## Decimal and original input/display conventions

Known numbers are blue (positive) or red (negative), coefficients included; only the unknown x's tray is green, and a dot between a coefficient and x marks the multiplication. Decimal input keeps decimal notation and entered trailing zeros; explicit slash fractions stay fractions; values are exact reduced rationals either way. Terminating decimals use scaled integer units for carry and borrow.

Whole-number group commas are triangles; the decimal boundary uses the original triangle and dotted mark. Following the SWF's magnitude reset, a group comma follows tenths and hundredths (before thousandths) and repeats before millionths. A decimal unit's textured inner area shrinks by ten for each smaller place. Faces carry k, M, B (and higher) inscriptions with progressively thicker nested outlines. Tray fill is 16% opaque, so a stack passing behind an adjacent tray stays visible.

## Double-click on Windows

Double-click **Start Abacus.cmd**. It starts a local server and opens your default browser; repeated launches reuse that server. Double-click **Stop Abacus.cmd** to stop it. It finds an existing Node runtime or a standard Node.js installation. Temporary state and logs stay in the Git-ignored `.runtime` directory.

## Run on Ubuntu

Double-click **Start Abacus.desktop**, or run `./Start\ Abacus.sh`. Repeated launches reuse the server; `./Stop\ Abacus.sh` stops it. Node.js 20 or newer is required.
