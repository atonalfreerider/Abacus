# ABACUS

The original ABACUS equation space runs in a modern browser through a pinned, self-hosted Ruffle runtime. This fidelity version replaces the earlier redesigned prototype: the original face-on cards, paper, type, equals mirror, number pad, dragging, and animation code are used directly.

## Run

Node.js 20 or later; no package installation is required.

```sh
node tools/serve.mjs
```

Open http://localhost:5173. The unmodified comparison is at http://localhost:5173/reference.html.

```sh
node --test tests/*.test.js
node tools/build.mjs
node tools/serve.mjs dist
```

Stop the development server before running the production preview on the same port. All URLs are relative for hosting under a project subdirectory.

## Equation space and director

The original equation surface occupies the full browser window. Two small controls sit in the unused header area:

- **Type equation** sends input to the original keypad handler. Examples: `x+3=7`, `x-4=5`, `9+1`, `10-1`, `1000+1000`, `0.9+0.1`. It validates input before clearing the current equation.
- **Director** offers demonstrations followed by hands-on practice. Watch runs the original sign/merge/stack routines. Try it restores that step and prompts the learner to drag the original cards. Feedback checks the actual SWF display-list state, including signs and equation sides. Next allows progression after a demonstration or a successful attempt.

No separate balance beam, isometric renderer, lesson sidebar, or number workshop is included in the runtime. The original SWF includes its own small rotation/mirror effects; those have not been rewritten. The earlier requested k/M inscriptions and nested border additions are not applied to this fidelity baseline. They remain future, explicit extensions to the original card faces.

## What is preserved

`public/ABACUS.swf` is the exact supplied file. `public/abacus-director.swf` adds an ExternalInterface bridge and one initialization hook. Of 637 original methods, 635 are byte-identical. Two retain their complete original instruction prefix and receive appended hooks: initialization registers director callbacks, and SwitchSign flattens an erroneously nested sign container. The latter fixes blue positive cards being treated as negative after crossing. Drawing, bitmap, font, and timeline tags are byte-identical. The provenance hashes and automated audit make this reproducible.

Regenerate the director SWF with `node tools/swf-bridge.mjs`. An optional first argument selects another source path. The script is specific to this ABACUS file and is not a general SWF compiler.

The local stack pattern uses 0, 1, and 10 support cards at local magnitudes 1, 10, and 100. It repeats in each comma group. These are individual card faces under occupied cells, not decorative depth under a whole tray. See `docs/original-reference.md` for bytecode evidence.

## Known limits of the supplied SWF

This is a preserved runtime, not a completed rewrite of every originally proposed feature. Browser playback depends on Ruffle compatibility; byte-identical source does not prove identical rendering in every browser or on every device.

- Division and the Solve button have empty input branches. Fraction bars, parentheses, and powers are not enabled by the typed-input wrapper. Decimal fractions work.
- The original multiplication routine was exercised but did not finish `3*4` correctly in the tested runtime. Multiplication input remains visible through the original UI, but it is not presented as a completed director lesson.
- `999+1` lost the outgoing carry in the tested original arithmetic path. The director uses verified basic carries and a thousands-group addition instead. Arbitrary arithmetic in free play inherits original defects.
- Very fast crossing drags may miss the original 100 ms crossing poll. Ordinary input uses the original handlers unchanged.
- The canvas equation space retains the original accessibility and small-screen limitations. Dialogs and director controls are keyboard accessible, but a full accessible equation editor and phone layout are not finished.
- Advanced graphing, general division/fraction animations, and magnitude inscriptions still need implementation against this reference. The first prototype's native arithmetic experiments remain in source history and some unshipped modules; they do not drive this UI.

## Static hosting and loading

`dist/` contains everything needed by a static host: no backend, account, database, analytics, external font service, or runtime CDN dependency. The checked-in Ruffle version is 0.6.0, downloaded from the official npm package and verified against its package integrity hash. License notices are bundled.

The build retains two WASM variants for runtime compatibility; a browser selects one. Each variant is about 14 MB raw or 4 MB Brotli. The SWF is about 0.55 MB. The build produces `.br` and `.gz` sidecars, and the preview server negotiates them with the correct `application/wasm` MIME type for streaming compilation. Production hosting must enable Brotli/gzip or explicitly serve the sidecars with `Content-Encoding` and `Vary: Accept-Encoding`; copying sidecars alone does not configure every host. `_headers` provides caching and CSP for hosts that support that format. GitHub Pages uses its own header/compression behavior.

The CSP permits self-hosted WebAssembly and restricts network requests to this origin. Ruffle's `allowNetworking: all` is needed for ExternalInterface; the CSP supplies the browser network restriction. The reference player disables script/network access.

A manually triggered GitHub Pages workflow is included. No remote repository or public deployment has been created.

## Main files

- `src/main.js`, `src/lessons.js`: compact director, input wrapper, and state-based feedback.
- `tools/swf-bridge.mjs`: reproducible AVM2 bridge instrumentation.
- `tools/swf-audit.mjs`, `tests/faithfulness.test.js`: independent tag/method comparison.
- `public/ABACUS.swf`, `public/swf-provenance.json`: original reference and hashes.
- `public/vendor/ruffle/`: pinned browser runtime and licenses.
- `docs/verification.md`: actual checks and remaining limits.

Original artwork remains the supplied author's material. Ruffle's MIT/Apache license notices apply to the bundled runtime; this repository does not assert ownership of the original artwork.
