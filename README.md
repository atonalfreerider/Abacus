# Abacus · Equation Lab

A browser-native version of the supplied ABACUS educational game. It uses the blue, red, green, paper, and shading textures extracted from the original SWF. No Flash player, server, account, or runtime packages are required by the new app.

## Run

Requires Node.js 20 or later. There are no packages to install.

```sh
node tools/serve.mjs
```

Open <http://localhost:5173>. `npm run dev` also works wherever npm is installed.

```sh
node --test tests/*.test.js
node tools/build.mjs
node tools/serve.mjs dist
```

The production output is `dist/`. All URLs are relative, so it can be hosted at a domain root or a subdirectory. Serve through HTTP, not `file://`, because the application uses JavaScript modules.

## Play

- Type an equation such as `3x + 2 = 14`, `x/2 + 1/3 = 5/6`, or `2(x + 3) = 18`.
- Drag a term across the equals sign to change its sign. This is shorthand for adding the opposite term to both sides.
- Drag opposing terms together on the same side, or choose **Combine like terms**. Partial cancellation leaves the exact remainder.
- Add, subtract, multiply, or divide both sides by any supported nonzero rational factor. Multiplication by zero is rejected because it destroys equivalence.
- Isolate one positive `x` opposite one constant to complete a lesson. Either side is allowed; an empty side is zero.
- Use the `x` preview to check the numerical balance. Its value affects the seesaw only, not the equation. On solving, the preview uses the solution.
- Eight guided problems cover transposition, negatives, equal groups, variables on both sides, fractions, distribution, and fractional solutions. Progress stays in this browser's local storage.
- Open **Number workshop** for step-by-step carry, borrow, multiplication, and division demonstrations. Each has replay, stepping, speed controls, and reduced-motion support.
- In **Place value**, enter a number such as `1,234,567`, select a digit, and spread its cards. Each occupied cell uses 0 / 1 / 10 support cards for local magnitudes 1 / 10 / 100. That pattern resets at commas. Every card face bears its group inscription (`k`, `M`, `B`, `T`) and progressively heavier nested outlines.
- Keyboard: Tab to a term, Enter/Space to select it, then Left/Right to move it. Ctrl/Cmd+Z undoes a move. Tap-to-move works alongside dragging on touch screens.

## Project layout

| File | Purpose |
| --- | --- |
| `src/engine.js` | Exact rational arithmetic, safe expression parser, linear-equation transformations, lessons |
| `src/main.js` | UI, pointer and keyboard controls, history, progress, operation animations |
| `src/blocks.js` | Original textured nine-cell trays, fraction tiles, isometric units |
| `src/arithmetic.js` | Four narrated, step-by-step regrouping and equal-group demonstrations |
| `src/styles.css` | Responsive layout, original-texture block surfaces, motion |
| `tools/extract_swf.py` | Reproducible bitmap extraction from the supplied SWF; requires Pillow |
| `tests/engine.test.js` | Arithmetic, parser, lesson answers, and solution-preservation checks |
| `docs/original-reference.md` | What was observed in the original SWF and how it maps to this version |

## Hosting and loading

Build with `node tools/build.mjs` and upload `dist/` to a static host (Cloudflare Pages, Netlify, GitHub Pages, or an object-store/CDN). No database, paid services, or server process are needed in production. The supplied GitHub Pages workflow is manually triggered, so committing code does not automatically publish it.

The app uses native ES modules and browser-cached bitmap textures. It serves the original embedded JPEG bytes for the color and paper textures, avoiding recompression and PNG bloat. Unused extracted images remain in the repository for future visual development but are excluded from the production build. No external fonts, analytics, or CDN scripts are loaded by the modern game.

Use short caching for `index.html`, and normal revalidation for the versioned source assets. A static `_headers` file is included for hosts that support that format. For large future graphing modules, load them with dynamic `import()` when their view opens. The math engine is independent of the UI so additional renderers can share the same transformations.

## Current scope

This first version supports **linear equations in one variable, x**. Products of variables, variable denominators, powers, graphing, and multivariable equations are intentionally rejected with an explanatory error. Fractions are exact and reduced, with BigInt intermediate arithmetic; reduced numerators and denominators are bounded at 1,000,000,000. Decimal input supports six decimal places.

The workshop demonstrates `9 + 1`, `10 − 1`, `3 × 4`, and `12 ÷ 3`; it is an instructional animation set, not yet a general animation compiler for arbitrary expressions. The equation lab performs general supported arithmetic, with term-level operation feedback. Advanced graphing and more detailed animation can be developed from the next drawings.

Original artwork remains the supplied author's material. No license to redistribute third-party or original SWF assets is implied by this repository.
