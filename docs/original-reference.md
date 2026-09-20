# Original SWF inspection and fidelity contract

Source: C:\Users\johnb\Downloads\ABACUS.swf, 568,989 bytes, compressed SWF v15.
SHA-256: c2749b7d0d685ea82c6b812de82ef469ec57843e037be16b2c8c278111e0b781.

The file was inspected as data and played locally. No content was uploaded. The current application runs that same SWF through a local Ruffle 0.6.0 runtime, adding a small director bridge. `reference.html` runs the unmodified file for comparison.

## Direct observations

The workspace has a paper background, rounded equation region, a dotted equals mirror, and a bottom keypad. Faces look straight at the viewer. Large original Garamond numerals overlay textured 3x3 trays. Constants are blue/red; unknown variables pulse through green cells, then show their constant value when isolated. The SWF owns layout, fonts, textures, pointer behavior, and animation timing. No replacement tray geometry or physical seesaw is drawn by the web wrapper.

Keyboard/keypad input, term dragging, sign crossing, 9+1 carrying, 10-1 borrowing, decimal carrying, and red/blue cancellation were exercised. The director invokes the same original routines and reads their results.

## Targeted bytecode findings

- `Constant.InsertNomial` multiplies local magnitude by 10. At 1000 it inserts a comma and resets the local magnitude to 1. Decimal input divides the magnitude by 10, with the corresponding reset at 0.001.
- `Nomial.NewNomial` creates zero support faces at local magnitude 1, one at 10 (z=30), and ten at 100 (z=30..300). This repeats under each occupied unit cell.
- `Nomial.Box` fills the nine positions of the 3x3 and places an overflow tenth unit in the center.
- `Nomial.Stack` sends ten individual faces to the receiver with depth `(10-unitIndex)*magnitude*3`.
- `Addition.Carry10` invokes Stack, clears the source digit, and increments its left neighbor. Borrow routines reverse the grouping.
- `Update.Resettle` detects overlapping like terms, orders their absolute coefficients, and calls `Addition.Adder(larger,smaller,"1Step")`; its completion callback resettles the equation. The director uses this same ordering and callback.
- `PolyNom.CheckCross` polls during dragging at 100 ms intervals and invokes the sign logic. Quick automated drags can miss that interval.
- `Update.UpdateVariables` recursively schedules opacity animations while variables are unsolved. The director excludes these background pulses from its busy count, leaving them running.
- `InputHandler.InputFunction` has empty `/` and `enter` branches. The Solve control routes to the empty enter branch.
- `Solver.PEMDAS` calls `Multiplication.Multiplier` in expand mode, but the tested 3*4 path did not complete a correct product. A 999+1 carry also failed in testing. These are documented, not advertised as working lesson paths.

## Instrumentation boundary

The bridge appends callbacks for input, reset, speed, state, sign movement, term combination, and the existing solver step. Two existing bodies receive appended instructions before returning: `ABMain.ABMainInit` registers callbacks, and `Operator.SwitchSign` flattens the extra OpContainer created by NewOp. The original sign artwork and recoloring run first, then the actual sign glyph is restored to the display-list level expected by GetSign. This repairs negative-to-positive and repeated crossings without introducing a new animation. Of 637 original methods, 635 are byte-identical; the other two retain their original instruction prefixes. All non-ABC tags, including fonts and drawings, are byte-identical.

The director is an addition to the header. It does not replace the original equation renderer. Original assets are also extracted into `public/textures/` for future work, but the faithful runtime reads its assets directly from the SWF.

The requested k/M/B inscriptions and heavier nested outlines are intentionally absent from this fidelity baseline, following the subsequent request for the original interface without design changes. They can be implemented later as a precisely scoped addition to the original faces.

The supplied file has incomplete behaviors; preserving it does not make those behaviors complete. Browser fidelity beyond the tested Chromium runtime still requires visual and interaction checks on the target browsers.
