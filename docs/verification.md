# Verification — faithful SWF browser build

## Automated

`node --test tests/*.test.js`: 21 passing tests.

Eight tests cover the shipping director/input and SWF provenance: malformed and unsupported input, lesson inputs, completion state, original file hash, all non-ABC tags, original method bodies, and patched output hash. Thirteen retained native-prototype arithmetic/place-value tests also pass, but those modules are not shipped and are not evidence that the SWF supports their features.

The independent SWF audit verifies that every bitmap, font, shape, timeline, frame geometry, and rate tag is identical. Of 637 original methods, 635 are byte-identical. ABMainInit and SwitchSign preserve their instruction prefixes and have only the documented appended hooks. The entire original file remains unmodified alongside the instrumented one.

`node tools/build.mjs`: successful static build. Ruffle, SWFs, scripts, licenses, and a plain reference page are bundled. No CDN is used at runtime. The build excludes the first prototype UI and extracted texture experiments.

## Browser interaction (Chromium / Codex in-app browser)

The original SWF was played and its AVM2 bytecode inspected. The production build was also loaded through the local server with its production CSP and Brotli responses.

Verified:

- Original paper background, face-on textured trays, large original type, dotted equals mirror, full equation workspace, and bottom keypad.
- Director 9+1 demonstration reaches 10.
- Try it resets the exact step; a real pointer drag of 1 onto 9 reaches 10 and activates Finish.
- Director 10-1 uses the original borrow/cancellation and reaches 9.
- Director 0.9+0.1 reaches 1.
- Director 1000+1000 reaches 2000.
- Director x+3=7 moves +3 across, then cancels 7-3 to produce x=4 and four saturated green cells.
- Unsolved variable opacity pulses remain active without blocking the director.

The repaired negative crossing also completed x-4=5 -> x=5+4 -> x=9. A real pointer crossing in practice produced x=-3+7 and was accepted in either term order. The input dialog rejected 1/2 without changing the equation and successfully loaded x+3=7. A complete hands-on x+3=7 lesson reached x=4 through actual pointer crossings and cancellation, and the director enabled Finish. Final production logs contained no ERROR, error, or warning entries. A HEAD request to the selected WASM returned 200, application/wasm, Content-Encoding: br, Content-Length: 4011866, and the production CSP.

## Known failures and limits

- The original 999+1 path lost the outgoing carry; not included as a working lesson.
- Original 3*4 expansion did not produce 12; not included as a working lesson.
- Division and enter/Solve have empty source input branches.
- Fast drags can miss the original 100 ms crossing poll. Crossing uses the term anchor, not the visible face center; dropping too near the mirror can flip a sign even when the face appears to stay on one side. This original geometric behavior is preserved.
- Exact cross-browser pixels, touch phones, screen-reader equation editing, and long-session performance have not been certified.
- No cloud deployment or remote repository has been created. The GitHub Pages workflow is prepared but not run.
