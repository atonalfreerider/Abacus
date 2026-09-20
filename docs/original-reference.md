# Original ABACUS inspection

Source: `C:\Users\johnb\Downloads\ABACUS.swf` (568,989 bytes, compressed SWF version 15).

The source was inspected as data, and played locally through Ruffle in a separate, development-only page. The SWF was not uploaded to an external service. Ruffle is used for reference inspection only; it is not part of the new app or production build. API reference: https://ruffle.rs/js-docs/master/index.html.

## Direct UI observations

- Paper-textured background with a large equation workspace and a bottom input dock.
- Blue bitmap fills indicate positive constants. The original `RED300` and `GREEN300` images provide the negative and variable palette.
- Constants show a nine-cell (3 × 3) digit tray, filling left to right, top to bottom. The numeral overlays its cells.
- `x` appears as a large glyph over a pale green nine-cell tray, becoming saturated green in a solved state.
- An equals sign divides the two sides along a dotted vertical guide.
- The bottom dock exposes arithmetic operators, back, clear, x/y, solve, powers, parentheses, and a nine-cell number control.
- Keyboard input was used to build `x + 3 = 7`; both the interior constant and its sign were dragged to inspect the interaction. In the emulator, the observed move could retain a positive sign, so the new app follows the user's explicit sign-flip requirement instead of copying that observed behavior.

## Embedded script inspection

The ActionScript 3 ABC constant pool was inspected; this is a symbol inventory, not a claim of full source decompilation. The application classes include:

- `absrc:ABCalc`, `Buttons`, `InputHandler`, `Solver`, `Operator`, `Update`, `PolyNom`, `Constant`, `Nomial`, `Addition`, and `Multiplication`.
- Drag and sign-related method symbols: `SelectTerm`, `initDragger`, `CheckCross`, `mouseUpHandler`, `ZeroCollect`, `SwitchSign`, and `ChangeEqualState`.
- Regrouping and depth symbols: `Carry10`, `Borrow10`, `Check10`, `Stack`, `Expand`, `Contract`, `Collapse`, and `ChangePerspective`.
- Multiplication-related symbols: `Multiplier`, `Base10Factor`, and `Duplicator`.
- GreenSock TweenLite/TimelineMax animation classes are embedded in the SWF.

These names alone do not establish exact runtime behavior. A subsequent targeted ABC bytecode disassembly verified the following implementation details:

- `Constant.InsertNomial` multiplies the leftmost local magnitude by ten. When that reaches 1000, it inserts a comma and resets the magnitude to 1. On the fractional side it divides by ten, inserting a comma and resetting at 0.001.
- `Nomial.NewNomial` creates zero support cards at magnitude 1, one at magnitude 10 (z = 30), and ten at magnitude 100 (z = 30, 60, …, 300). This structure is repeated under each unit cell, rather than being decorative depth under the whole tray.
- `Nomial.Box` arranges nine units in a 3 × 3 grid and puts the tenth, overflow unit at the center.
- `Nomial.Stack` animates all ten units toward the receiving position, using `(10 − unitIndex) × magnitude × 3` for depth.
- `Addition.Carry10` detects a value of ten, invokes `Nomial.Stack`, clears the source digit, and increments the digit to the left.

The new place-value renderer follows the verified 0/1/10 support-card cycle and comma reset. The k/M/B/T inscriptions and increasingly heavy nested borders on every face are additions explicitly requested by the user.

## Extracted assets

`public/textures/manifest.json` records every embedded bitmap, symbol name, original dimensions, and SWF tag. Important symbols:

| Symbol | SWF character ID | Usage |
| --- | --- | --- |
| GREEN300 | 2 | Variable faces |
| RED300 | 23 | Negative unit faces |
| BLUE300 | 25 | Positive unit faces |
| Paper1 | 24 | Tray surface |
| Shade5White | 10 | Fraction remainder surface |
| Shade4Trans100 | 14 | Depth shading |

No original bytecode is used in the modern game. The modern math engine is independently implemented and tested.
