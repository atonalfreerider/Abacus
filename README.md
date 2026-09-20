# ABACUS

A browser equation workspace using the original SWF textures, face-on 3×3 trays, and equals mirror. The active application uses native model/view/controller modules. The original SWF remains available at `reference.html` for comparison.

## Run

Node.js 20+; no package installation required.

```sh
npm start
npm test
npm run test:visual
npm run build
npm run preview
```

Development defaults to http://localhost:5173. Stop development before previewing on the same port, or set PORT. `dist` is a static deployment with relative URLs and precompressed assets. The optional SWF reference includes self-hosted Ruffle; the main app does not download its runtime. No remote repository or public deployment is configured.

## Interaction

Type an expression or use the original-style row-major 3×3 counting pad. The pad highlights cumulative cells under a large hover numeral; the folded corner on 9 enters a decimal point. Up arrow, the upper triangle, or Enter deploys the staged input into the workspace. Backspace edits it, and clear starts a fresh expression. The Equation dialog remains available for pasting a complete problem. Drag terms across the mirror to transpose them; drop like terms together to combine or cancel. A collision across the mirror transposes and combines in one command and one animation. Drop between terms to rearrange, or hold Shift when dropping to avoid combining. Keyboard arrows transpose a focused term; Shift + arrows rearrange. Multiply/divide applies a nonzero rational factor to both sides. Undo/redo restores exact mathematical states. Drag previews flip sign on each mirror crossing without changing the model; release commits once and animates from the pointer release coordinates.

View offers horizontal/vertical/automatic layouts and front/depth/spread stack views. These preserve face-on cards and change depth projection, rather than orbiting a 3D scene. Automatic layout responds to portrait screens. Animation controls pause, seek, resume, and finish independently of the committed model.

Director runs preloaded problems one step at a time; Try it restores the previous step for practice.

Each occupied cell has 1, 10, or 100 physical card faces, with uniform spacing down-right. The cycle resets at comma boundaries. Cached 10/100 stack drawings are shared by resting and moving units; carry packs ten units into the identical depth ranges, and borrow reverses that geometry inside the digit trays. Comma crossings compress the old depth group into the next inscribed face. Each face in successive groups receives k, M, B (and higher group marks) with progressively thicker nested outlines.

## Architecture and mathematics

- `src/engine.js`: exact reduced rational arithmetic, parsing, linear expressions and solution classification. BigInt intermediates prevent floating-point rounding.
- `src/mvc/model.js`: immutable equations, validated commands, undo/redo and step planning. Every transformation checks preservation of the equation residual or the explicit nonzero scaling factor.
- `src/mvc/controller.js`: commands, animation lifecycle, drop interpretation and view options.
- `src/mvc/view.js`: SVG projection of model state and a deterministic transition frame. It cannot modify mathematical state.
- `src/mvc/units.js`: signed singleton ledger and dependency scheduler for integer and terminating-decimal addition/subtraction. Independent transfers and digit operations run concurrently; dependent regrouping follows on the same timeline. Each transfer, carry, borrow and cancellation conserves exact weight.
- `src/mvc/animation.js`: carry/borrow events, cancellation, operation groups and a seekable clock.
- `src/mvc/app.js`: browser input and lesson director.

Supported scope: one-variable linear algebra in x, parentheses/distribution, fractions, decimals up to six decimal places, variables on both sides, identities and contradictions. Stored rational components must fit safe integers; overflow is rejected. Nonlinear terms and variable denominators are rejected. Zero multiply/divide is rejected because it does not preserve the solution set.

This is not a universal symbolic algebra system or a claim of perfect SWF animation fidelity. The original JPEG textures are reused; native typography and reconstructed animation paths differ. Small positive integer multiplication/division factors (up to 12) receive repeated-group animations. Other rational factors use exact model results with symbolic operation transitions. Solved variable trays visualize up to nine green units; larger answers remain fully represented on the constant side.

## Animation regression infrastructure

Open `tests.html` on the local server. Select a scene, layout, camera and frame, or run all geometry assertions. Nineteen scenes cover crossing, rearrangement, cancellation, carry, comma carry, borrow, fractions, multiplication, division and inscriptions.

- `npm test`: exact arithmetic, invariants, stack geometry, clock behavior and retained SWF provenance checks.
- `npm run test:visual`: 570 deterministic SVG snapshots against reviewed hashes. Outputs are in `artifacts/visual`.
- Test bench **Compare pixels**: compares 38 rasterized scene PNGs across both orientations and all camera presets. Per-channel tolerance is 8; more than 0.1% changed pixels fails. Development saves actual PNGs to `artifacts/visual/pixels`.
- **Record pixel baselines** writes PNGs to `public/pixel-baselines` through the loopback development server. These images stay local and are Git-ignored; do not commit pixel baselines. A fresh checkout must record local baselines before pixel comparison. Production cannot record baselines.
- `npm run test:visual:update` intentionally updates structural hashes after visual review.

CI runs unit and SVG snapshot checks and saves the SVG artifacts. Raster comparison currently runs through the browser test bench, not headless CI. Baseline PNGs capture the equation SVG, not application chrome; manual responsive and pointer tests complement them. See `docs/verification.md` for performed checks and limits.

## Decimal and original input/display conventions

Decimal input retains decimal notation and entered trailing zeros instead of becoming a numerator/denominator display. Explicit slash fractions remain fractions. Exact reduced rationals are still the mathematical representation. Terminating decimals use scaled integer units for carry/borrow; rational components must remain within the documented safe-integer bound.

Whole-number group commas are triangles. The decimal boundary uses the original triangle-and-dotted-mark convention. Following the SWF's magnitude reset, a group comma follows tenths and hundredths (before thousandths), repeating before millionths and further groups. Within a decimal unit's full-size face, the textured inner area shrinks by ten for each smaller place.

Tray background fill is 16% opaque, so a stack passing behind an adjacent tray remains visible. Numerals use a consistent face-on font, centered anchors and a central baseline. The new keypad includes 0, decimal point, arithmetic operators, x, parentheses, equals and backspace.

Cancellation pairs receive fixed targets before playback. Incoming units travel directly to the receiving card in top-left, left-to-right grid order, then fade while coincident. Borrowed units use the same target mapping.

## Double-click on Windows

Double-click **Start Abacus.cmd** in this folder. It starts a local server and opens your default browser; repeated launches reuse that server. No build or npm install is needed. Double-click **Stop Abacus.cmd** to stop it after closing the browser. The launcher serves the current source, so edits appear on refresh. It finds the existing Node runtime on this computer, or a standard Node.js installation. The folder can be moved; launch paths are relative. Temporary server state and logs stay in the Git-ignored `.runtime` directory.
