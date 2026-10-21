# PRIME.swf: specification for an LED-bulb re-implementation

PRIME.swf (118,158 bytes, SHA-256 7c08da6f009c67564c06f6cfcfaa78a2d840e358b5f6ed667800694ac18f9848) is in `public/PRIME.swf`; `public/prime-reference.html` plays it unmodified in the vendored Ruffle (type `[16,7]` in Input, drag MULT from the bar onto the function, press Enter). The bytecode was read with `npm run swf:disasm -- --swf public/PRIME.swf prsrc::Multiplication` (and the other `prsrc::` classes). Running it confirmed the addition defect in §3.3: `[7,5]` through ADD shows 24.

Source: disassembled AVM2 bytecode of PRIME.swf (classes `PRIME` and `prsrc::*`). The facts below were checked against five per-class reports, the adversarial checks on those reports, and spot checks of `Multiplication.MULT`, `Addition.ADD`, `Var.Add/Collide/Raise/NonRaise/FinishRise/Mult/Pop/IsMultipleOfTwo/Get2ndHighestBit/GetFrom/GetTopClear` and `Bit.*`.

**Correction to the brief.** The tween library is **GreenSock v12 (TweenMax / TimelineMax / TimelineLite)**, not caurina Tweener. `TweenLite.static` sets `version = 12`, `defaultEase = new Ease(null,null,1,1)` and `defaultOverwrite = "auto"`. No call in any `prsrc` class passes `ease`, `delay` or `transition`, so every tween uses the default ease. `Ease.getRatio` with type 1 and power 1 computes `1-(1-t)^2`, which is quadratic ease-out (CSS approximation: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`). Every timeline tween is added with `TimelineLite.insert(tween)`, whose position defaults to 0. Within one operation all tweens therefore start together, and steps are chained only through `onComplete` callbacks.

Units: x/y in stage pixels, z in Flash 3D units (negative = toward the viewer), time in seconds. `sp` is the per-object tween duration (default 1 s).

---

## 1. What PRIME is and how it is used

PRIME is a Flash Pro CS6 movie (created 2012-10-23, modified 2013-05-30). The stage is 1024x768 at 60 fps with `NO_SCALE` and `TOP_LEFT`, and its background colour #000000 is covered by a paper texture. It is a **function machine**: a node-and-wire expression tree whose operator blocks evaluate binary numbers drawn as stacks of discs (bits).

**Stage layers** (`PRIME.NewPRIME`, called only from the constructor):
1. `Background`: full-page `PAPER` texture plus a top-left HUD at alpha 0.5. The HUD shows the title "PRIME / FUNCTION" at text scale 0.3, then the THEME, AUTO and SPEED rows at scale 0.1.
2. `IO`: the root of the tree. It contains:
   - a downward triangle glyph `DrawTri(80)` (apex at (0,80)) with a r30 hole;
   - an **Input** pill at (-129.9, -75) and an **Output** pill at (+129.9, -75), each joined to IO's centre by a wire;
   - the root socket (`Anchor`) at (0,0);
   - a blurred horizon line from x=-1000 to 1000 at y=80 (1 px, alpha 0.5, `BlurFilter(3,3,10)`).
3. `FunctBar`: a palette along the bottom edge holding live instances of **ADD** (`Addition`), **MULT** (`Multiplication`), **COMP** (`Comparative`) and **TRIG** (`Trig`). There is no division block.

**Blocks** (`Funct` subclasses). Geometry is H=70, W=140. Two operand sockets (`Anchor`, an invisible r3 circle at alpha 0) sit at x = ±70. Each block hangs from a parent socket by a `Link` wire:
- a 2 px line in `inL`;
- a hub of r20 at the block end;
- two r7 beads at the socket end. Child 2 is the moving bead.

A child block is placed by `IO.Comb` at x=0, y = parent.H/2 + child.H/2 + 30. That is 100 px below a 70-px block and 155 px below IO (H=180). If it overlaps another block (`CheckCombCollision`), it moves down another 100 px and checks again.

**Building a machine** (`FunctBar`):
- **Hover.** Rolling over the bar raises it: y tweens to `stageHeight - 0.3*h` over 0.5 s. Rolling out lowers it to `stageHeight + 0.2*h` over 0.5 s. Hovering a block scrolls the bar over 1 s so that block is centred.
- **Drag (`New`).** Pressing a block creates a fresh copy under the cursor inside a drag sprite. The sprite also holds an invisible r200 search circle.
- **Preview (`Ping`).** On each mouse move, the open sockets whose bounds overlap the circle are found. The nearest one (Euclidean distance, starting threshold 500) gets an instant preview wire.
- **Drop (`Dump`).** On release the block is inserted at index 1 of that socket. `Comb` snaps it into place and the camera tweens to it over 1 s. A drop with no socket in range discards the block.

**Input and output.**
- **Typing.** You type decimal numbers into Input as `[5,11]`. `TextIO.Get` always skips the first and last character and splits on "," or " ", passing each token through `Number()`. So `[5, 3]` becomes [5,0,3] and `[]` becomes [0].
- **Reset.** Every key press in Input runs `IO.ResetAllFuncts`: results are removed, `solved` flags are cleared and both beads snap back.
- **Result.** The result appears in Output as `[n]` (`IO.GiveAnswer`).
- **Input count.** The number of inputs must equal the root block's socket count (two for ADD and MULT). A single number with a block attached throws when `IO.Solve` casts the root socket's last child to `Arr`.

**Running** (`IO.Solve(true)`, a state machine driven by the Input bead position and the root `Anchor.raised` flag):
1. **Input bead.** The Input bead slides from the pill to IO's centre (1 s). Then `MakeArrFromText` builds the numbers.
2. **Delivery.** The `Arr` of numbers slides to the root block (1 s) while the block's wire bead slides down to the block hub (`Link.Descend`).
3. **Fan-out (`Funct.GiveVars`).** Each number moves to its socket.
4. **Evaluation (`Funct.Solve`).** Evaluation is depth-first, left socket first. A block whose sockets all hold numbers runs `SpecialSolve`, which is `ADD` or `MULT`.
5. **Return (`Funct.Return`).** The result rides up the wire into the parent socket and the block is deleted (`AutoR` then `KillFunct`). Blocks are consumed: after one run the tree is gone.
6. **Output.** When the root socket holds only a number, `IO.Return` slides the Output bead to the Output pill (1 s) and writes `[n]`.

**Controls** (`PRIME.KeyHandler`, KEY_DOWN on the stage):

| Key | Effect |
|---|---|
| Enter (13), Right (39), Down (40) | `IO.Solve(true)`: one step |
| A (65) | Toggles `PRIME.auto` (default true). The HUD LED is not redrawn. |
| [ (219) | `sp -= 0.5`, only if `sp >= 1` (floor 0.5) |
| ] (221) | `sp += 0.5` (no cap) |
| T (84) | `IO.CenterIO(true)`: recentre the camera on IO |
| P (80) | Toggles the perspective centre following the mouse (`FollowP`) |

- **AUTO.** When on, `onComplete` callbacks (`GiveVars`, `AutoR`, `LittleDelay`, `SolveAgain`) call `IO.Solve` again, so the whole evaluation plays out by itself. When off, each key press advances one step. Some `onComplete`s are not gated by `auto`, so one press can run a compound step. The HUD shows AUTO as a single **Bit LED**, lit when auto is on; clicking it runs `Background.ToggleAuto`.
- **SPEED.** `PRIME.sp` is copied into each `Funct`, `Link`, `Var`, `Arr` and `Bit` when that object is constructed. A speed change therefore only affects objects created afterwards. IO, the TextIOs and their links are built once, so their tweens always last 1 s. Camera moves (`CenterOn`, `CenterIO`) always use a literal 1 s. The HUD SPEED readout is a constant `Var.Set("101")`. Because the first character is read as the sign, it shows two discs (lit, then unlit, LSB on the left), and it is not bound to `sp`.
- **THEME.** SKETCH (pencil on paper) is the default and is the only theme ever rendered. TRON (black and white) is defined in `PRIME.SetTheme`, but `Background.ToggleTheme` only changes the theme string and never re-applies it.
- **Keys while typing.** Key events from the Input field bubble up to the stage, so typing `[`, `]`, `a`, `t` or `p` in Input also fires those shortcuts. Enter first resets (`UpdateBox`) and then solves.

---

## 2. The bit language

### 2.1 One bit (`prsrc::Bit`)
- **Base disc (child 0, OFF):** two stacked discs of radius 30 make up a bit. The base has a 3 px black (`outL` = 0x000000) stroke and a `Shade1` bitmap fill, and is always visible.
- **Overlay disc (child 1, ON):** the same r30 disc with the same 3 px stroke and a `Shade3` fill. Its alpha is 0 when off and 1 when on.
- **State is the overlay's alpha.** `Bit.Set(on, animate, tl)` sets `ON` and, when animating, inserts `TweenMax.fromTo(overlay, sp, {alpha: current}, {alpha: int(ON)})`. It then always writes the final alpha directly.
- **Removal is a whole-disc fade.** `Bit.FadeOn(false, animate, tl)` tweens the whole bit's alpha to 0 over `sp`. When the timeline completes, `Var.DeleteBits` removes every child with alpha 0 and refreshes the label.
- `rising:Boolean` marks a pending carry during addition.
- `Bit.Flip` is broken: both branches turn the bit off, and nothing calls it.
- **Newly built bits start with overlay alpha 0.** Bits built inside an animated `Add` or `Mult` therefore light up (0 → 1 over `sp`) while they fly in.

**Colours.**

| Theme | OFF base | ON overlay | Outline | Font |
|---|---|---|---|---|
| SKETCH | `SHADE1`: 100x100 JPEG, faint diagonal pencil hatch on white, average #F4F4F4 | `SHADE3`: 150x150 JPEG, dense crosshatch, average #B1B1B1 | #000000 | Adobe Garamond Pro |
| TRON (unreachable) | #000000 | #FFFFFF | #000000 | Franklin Gothic Medium Cond |

In SKETCH, ON is the darker, pencilled-in disc. TRON is the LED-like mapping (lit = white). Fills have no matrix, so textures tile from each disc's origin.

**Sockets** are r30 holes cut by an even-odd second `drawCircle(0,0,30)` inside a glyph's fill (`Shapes.DrawArr`, `Comparative` rings, the IO triangle), so a bit fits a socket exactly.

### 2.2 One number (`prsrc::Var`)
- **Children.** Children `0..n-2` are bits and child `n-1` is the label sprite. **Child 0 is the LSB** (`Var.Set` inserts each digit with `addChildAt(bit, 0)`). `Var.Get` reads from MSB to LSB.
- **Place value is depth, not x.** All bits share x = y = 0. `Var.Pop(expand, animate)` puts bit i at **z = -i·S**, with S = 50 when expanded (always during solving) and S = 3 when collapsed (a thick coin). S is negated for a `DecimalParent` (fraction scaffolding, unused).
- **Label.** The label sits at z = -(n-2)·S - 0.5·S, half a slot beyond the MSB.
- **Orientation.** The LSB is at the socket plane (z = 0) and the MSB is nearest the viewer.
- **Perspective.** `PRIME.Resize` sets `projectionCenter = (stageWidth, 2·stageHeight)` and `fieldOfView = 10`. At 1024 px width the focal length is about 5850, so each 50-unit slot should scale up about 0.9% and drift a few to about 10 px up and left. An expanded number should therefore look like a fanned, slightly diagonal stack of overlapping coins. This is an estimate (see §8).
- **Draw order is child-index order.** Flash does not depth-sort, so when two discs coincide the higher index is drawn on top.
- **Label pill** (`Var.UpdateTop`):
  - text: the decimal value, prefixed with "-" when `Pos` is false; hidden when the text is "0";
  - type: `Text` at size 127 scaled 0.3 (about 38 px), colour `outL`;
  - pill: `drawRoundRect(-w/2-10, -0.375h, w+20, 0.75h, 0.75h, 0.75h)` with a `Shade1` fill, a 1 px `outL` stroke and alpha 0.85.
- **Sign is sign-magnitude.** `Pos` comes from the leading '+' of the string. There is no sign disc; the sign appears only as a '-' on the label. `Add` and `Mult` strip the other operand's sign, and output prints negatives as 0.
- **Zero has no discs at all.** `IO.SetString(0)` gives "+.", producing an empty column with its label hidden.
- **Flat alternative (`Var.Spread`).** Bits sit in a row at x = prev.x + prev.width + 10 (about a 73 px pitch), LSB on the left, label hidden. Only the HUD uses it.
- **Number entry.** `IO.SetString(n)` = sign + `DecimalToBinary(|n|)` + "." (5 gives "+101.").
- **Conversion bug.** `Var.BinaryToDecimal` / `IO.BinaryToDecimal` parse the bit string as a base-10 Number and truncate with `int()` at each step. This is wrong for many values of 257 and above (257 shows "256"), and on the `Arr` output path `int()` overflows from 1024. A port must use real integer conversion.

### 2.3 A list of numbers (`prsrc::Arr`)
`Var`s are stacked along z, 50 apart (`Arr.Pop`). Its "[k/n]" pill is built (`Arr.UpdateTop`) but never made visible.

---

## 3. Addition

### 3.1 Algorithm (`Addition.ADD` → `Var.Add` → `Var.Collide` → `NonRaise` / `Raise` / `FinishRise`)
1. **Choose the receiver.** A = left socket's last child, B = right socket's last child. Compare `int(BinaryToDecimal(Number(Get())))`. If A > B, A receives and the start offset is (anchor1.x - anchor0.x, 0) = (+140, 0). Otherwise (ties included) B receives with offset (-140, 0). The other operand is the donor, and `donor.visible = false` is set immediately.
2. **`receiver.Add(donor.Get(), offset, animate)`.** The donor's sign is stripped. One `TimelineMax({onComplete: DeleteBits})` holds every tween of the addition.
3. **Walk levels LSB → MSB** (`Collide`). For each donor digit k, from the string's last character to its first:
   - **Build.** Create a new incoming Bit, `Set(digit, animate, tl)` (overlay 0 → digit), at (offset.x, offset.y).
   - **Match depth.** Set `incoming.z = target.z` immediately, so it starts already at its level and moves only horizontally.
   - **Check for a carry.** `prev` = the child just below the target. If `prev.rising`, call `Raise`; otherwise call `NonRaise`.
   - **Slide.** Insert `TweenMax.to(incoming, sp, {x:0, y:0})`.
   - **Advance.** The next target is `getChildAt(returnedIndex + 1)`. There is no bounds check: the receiver must have at least as many bits as the donor.
4. After the last donor digit, if the target is still `rising`, call `FinishRise(target)`.

**Per-level rules.** "Target" is the receiver's disc at this level, "in" is the incoming disc, and "carry" is the rising disc from the level below.

| Case | Code | What stays at this level | Carry out |
|---|---|---|---|
| no carry, in 0 | `NonRaise`: in inserted at idx (below target), `in.FadeOn(false)` | target (0 or 1) | none |
| no carry, in 1, target 0 | in inserted at idx+1 (above), `target.FadeOn(false)` | in (lit) | none |
| no carry, in 1, target 1 | in inserted at idx (below), `in.Set(false)` (goes dark), `target.rising = true` | in (dark 0) | **target** (lit) |
| carry, in 1, target 0 | `Raise`: in `Set(false)` + `FadeOn(false)` (vanishes); `target.Set(true)`; `carry.Set(false)`; `target.rising = true` | carry (now dark 0) | **target** (now lit) |
| carry, in 1, target 1 | in vanishes; `target.rising = true` | carry (lit 1) | **target** |
| carry, in 0, target 1 | `target.rising = true`; `carry.Set(false)` | carry (dark 0) | **target** |
| carry, in 0, target 0 | `target.FadeOn(false)` | carry (lit 1) | none |

In every `Raise` case the carry first climbs to this level: `TweenMax.to(carry, sp, {z: target.z})`, a 50-unit rise, and then `carry.rising = false`.

**The carry is a physical disc.** When two 1s meet, the **resident** lit disc becomes the carry and climbs one level, and the **incoming** disc stays behind as the dark 0. In the 1+1 case the incoming disc is inserted *below* the target in draw order, so the dark 0 is hidden until its lit partner rises away.

**`FinishRise(p)`** handles a carry left over after the donor's digits run out. `next` = the bit above p, if there is one.
- If `next` exists, tween `p.z → next.z`.
  - If `next` is ON: `p.Set(false)` (p becomes the dark 0 at that level) and recurse with `FinishRise(next)`.
  - If `next` is OFF: `next.FadeOn(false)` and p stays lit there.
- **Fall-through.** This branch runs both after an OFF `next` and when there is no `next`. It tweens p to z - 50 (a new MSB level when carrying out of the top) and the label to z - 75, i.e. 25 beyond it. The column grows by one level and the label climbs with it.

**Worked example: 6 + 3.** The receiver is 110 and the donor is "11".
- **L0:** target 0, in 1 → the target fades and in stays lit.
- **L1:** target 1, in 1 → in goes dark and stays; the target rises.
- **`FinishRise`:** the target climbs to L2, where the resident is 1. The target goes dark, and the old L2 disc rises to the new level L3, with the label moving to L3 + 25.
- **Result:** 1001 = 9.

### 3.2 Animation sequence (one beat of `sp`, default 1 s, quadratic ease-out, no delays)

| t | What happens |
|---|---|
| 0 (instant) | The donor is hidden. Incoming clone discs appear at ±140 px from the receiver, each already at its target level's z. Insert indices and final alphas are written. |
| 0 → sp | All incoming discs slide horizontally to x = y = 0. Incoming 1-discs light up (overlay 0 → 1). |
| 0 → sp | Discarded discs fade out (whole alpha 1 → 0): absorbed incoming 0s, resident 0s replaced by an incoming 1, and incoming 1s consumed by a carry. |
| 0 → sp | Each carry disc climbs exactly one level (z by 50). Overlays that change state crossfade. A carry out of the top climbs to a new level, and the label climbs with it. |
| 0 → sp | Second timeline, `ADD`'s own `TimelineMax({onComplete: Return})`: the receiver slides to the node centre (x → -anchor.x = ±70), and `Addition.FadeOut` fades glyph children 1–3 (both pins and the plus) from their current alpha to 0. The receiver's slide (±70) and the clones' slide (∓140 relative to the receiver) meet at the node centre. |
| sp | `Var.DeleteBits` removes discs at alpha 0 and `UpdateTop` rewrites the decimal label. Bits are **not** re-laid out. `Funct.Return(true)` starts the return beat (§4.5). |

The whole carry ripple is computed at build time and shown **in parallel**: every level resolves in the same second, not one after another.

### 3.3 Defects in the original (confirmed by simulating the bytecode; do not port)
- **`Raise` with an incoming 0 never fades that disc.** It stays as an extra OFF child.
  - Example: 7+5 reads back as 11000 (label 24). Of the 3969 sums with both operands in 1..63, 1534 give a wrong `Get()` or label.
  - In the carry + in 0 + target 0 case, the stray opaque dark disc is drawn above the lit carry and hides it. For example 9+5 shows 1100, and 870 of those 3969 sums display wrong.
  - Fix: `in.FadeOn(false)` in both in-0 branches. With that fix, all 3969 sums are correct.
- **Label left inside the stack.** When `FinishRise` absorbs the carry into a mid-stack 0, it still falls through and moves the label to that level's z - 25, inside the stack (522 of the 3969 sums). For example, in 40+15 the label ends up between L4 and L5. Fix: return after absorbing, or re-`Pop` after `DeleteBits`.
- **Conflicting overlay tweens.** In 1+1 the incoming disc gets two `fromTo` tweens on its overlay at t=0 (0 → 1, then 1 → 0). What is visible depends on GSAP's `auto` overwrite (see §8).
- **Signs and zero.** Signs are ignored. Two empty (zero) operands throw a TypeError in `Collide`.

---

## 4. Multiplication split into additions and reassembled

### 4.1 The rule (`Multiplication.MULT`)
A = left socket's last child (the multiplicand; only A is ever shifted). B = right socket's last child (the multiplier; only B is decomposed). `returnVar = A`.

- **Leaf case: `B.IsMultipleOfTwo()` is true.** The name is misleading: the method returns false if any bit below the MSB is ON, so it is really an "is a power of two" test. It also returns true for a 0- or 1-bit Var. In this case B = 2^k with k = len(B) - 1, and A is shifted left k places by `Var.Mult` (§4.3).
- **Split case.** B has two or more set bits:
  - j = `B.Get2ndHighestBit()`: the highest ON index below the MSB, scanning from n-3 down.
  - R = `B.GetFrom(j)`: sign + bits j..0, MSB first. It reads overlay alpha == 1 rather than `ON`.
  - T = `B.GetTopClear()`: sign + "1" + (n-2) zeros, i.e. 2^k.
  - The node M(A,B) is rewritten **in place** as `Addition( M(A,T), M'(copy of A, R) )`.

**One split per step.** R is split again when its own turn comes, so B is peeled from the top bit down:

A × B = A×2^k1 + (A×2^k2 + (… + A×2^kp)), with k1 > k2 > … > kp the set bits of B.

Example: B = 1011 becomes `Add(A×1000, Add(A×10, A×1))`, tracing as `Get2ndHighestBit` = 1, `GetFrom(1)` = "11", `GetTopClear` = "1000", then "11" splits into "10" + "1". There are popcount(B) leaf shifts (an odd B always produces an `A×1` leaf), popcount(B) - 1 splits and popcount(B) - 1 additions. Operands are not swapped to minimise work.

**Ring marker.** `Multiplication` child 7 is an r5 outline circle (no fill) at (70, 35 + ring.height, about 46), under B's socket. `MULT` sets its z instantly, with no tween:
- first to the z of B's MSB;
- then, in a split, to the z of B's bit j (-j·50);
- or, in the leaf case, to 0.

It appears to be a pointer to the split level (an inference).

### 4.2 Split beat: what moves where (`MULT`, split branch, in code order)
Let N be the new `Addition` and P the old position of M in its parent socket.

**Instant changes at t=0:**
1. If animating: `tl = TimelineMax({onComplete: SolveAgain, onCompleteParams:[p1]})`.
2. j = `Get2ndHighestBit()`; ring z ← z of `B.child[j]`.
3. N is created at M's x,y and inserted at **index 1 of M's parent socket**. `Link(N.child0).Descend(false)` (sets that socket's `raised = false`) and `N.MakeLink(p1, tl)`, so N's wire to the parent socket **grows** (below). N's glyph appears instantly at full alpha:
   - left pin: `DrawArr(70,70,true)` rotated -90 at x=-70;
   - right pin: rotated +90 at x=+70, with the tips meeting at the centre;
   - plus: `Plus(H/6, H/12)` = arms reaching 11.67 px from the centre, bars 5.83 px thick, solid `outL`.
4. **M moves** into N's left socket. `IO.Comb(M)` puts it at socket-local (0, 100), i.e. N + (-70, 100), with +100 steps on collision. `M.MakeLink(p1, tl)` redraws and **grows** M's wire to N's left socket.
5. **M' is created.** Left socket: a new `Var` set to `A.Get()` (a copy of A at 50 spacing, built instantly). Right socket: a new `Var` set to R (instant). M' goes into N's right socket. `Link.Descend(false)` and `IO.Comb(M')` place it at N + (70, 100), and its wire is drawn **instantly**.
6. **B is rewritten in place** to T: `B.Set(GetTopClear(), true, false)`. B is rebuilt at once as a lit top disc over dark discs, so the bits that formed R go dark in B and reappear as R in M'.

**Tweened over 0 → sp** (all inserted at t=0, quadratic ease-out, `sp` of the object being tweened):
- `TweenMax.from(M, sp, {x: -leftSocket.x = 70, y: 0})`: M slides from N's centre (P) down-left to N + (-70, 100).
- `TweenMax.from(M', sp, {x: -rightSocket.x = -70, y: 0})`: M' slides from N's centre down-right to N + (70, 100).
- N's wire and M's wire grow: `TweenMax.from(line, sp, {width:0, height:0})` with beads `from {x:0, y:0}` sliding out to the socket end.
- The camera (`IO.CenterOn` from `Funct.Solve`) eases over 1 s so the active node sits 50 px below the stage centre. A root-level node recentres IO instead (`CenterIO`).

**At t = sp:** `SolveAgain(true)` calls `IO.Solve(true)` if `PRIME.auto`. The depth-first descent reaches M(A,T) first.

Visually, the × node turns into a + node in the same place, and two × nodes drop out of its centre into its two sockets.

### 4.3 Shift beat, the leaf (`MULT` leaf branch + `Var.Mult(B.Get(), Point(140,0), true)`)
`MULT` always passes a literal `true` here, so the shift always animates. Let len = len(B) and k = len - 1. A sits in M's left socket (x = -70) and B in the right socket (x = +70).

**Instant changes at t=0:**
1. Ring z ← 0. `tl = TimelineMax({onComplete: Return, onCompleteParams:[p1]})` (created even when not animating).
2. Inside `Var.Mult`, which has its own `TimelineMax({onComplete: DeleteBits})`: B's sign is stripped. For each digit r = 0..len-1 (MSB first):
   - a new Bit with `Set(digit, true, tl)` (overlay 0 → digit);
   - x,y = (140, 0) relative to A, which is exactly B's place;
   - **z = (r - (len-1))·50**, so digit i sits at -i·50, the same levels as B's own discs;
   - `addChildAt(bit, 0)`.
   The clones become A's children 0..len-1, under A's old LSB.
3. `B.visible = false`, so the clones replace B where it stood.

**Tweened over 0 → sp:**
- Every clone: `TweenMax.to(clone, sp, {x:0, y:0})`. B's column slides horizontally into A's column.
- The **leading-1 clone** (index len-1, level k): `TweenMax.fromTo(lead, sp, {alpha: lead.alpha}, {alpha: 0})`, then `lead.alpha = 0`. It dissolves as multiplication by 1. Its overlay also tweens 0 → 1 at the same time, so it only glows faintly while it fades.
- **Every original child of A from index len up, label included:** `TweenMax.to(c, sp, {z: c.z + lead.z})` with lead.z = -k·50. **A's whole column and its label rise k levels.** A's LSB lands exactly on level k, where the leading 1 dissolves. The k dark zero clones fill levels 0..k-1. The result is A << k = A·2^k.
- `MULT`: `TweenMax.to(A, sp, {x: -leftSocket.x = 70})`. A slides from the left socket to M's centre. The clones' slide (-140 relative to A) and A's slide (+70) **meet at M's centre**.
- `Multiplication.FadeOut`: `TweenMax.to(child, sp, {alpha:0})` for glyph children 1–4 and the ring (child 7):
  - right pin `DrawArr(70,70,true)` at x=70, rotation 90;
  - centre dot: r5, solid `outL` (the multiplication operator);
  - left tray: semicircle cap, straight sides to 30, r30 hole, rotation -90, x=-70;
  - tilted flap: `DrawArr(70,40,false)`, rotation -90, x=-40, `rotationX` -30.

**At t = sp:** `DeleteBits` removes the faded leading 1 and refreshes A's label, and `Funct.Return(true)` starts.

Special cases:
- **A×1** (len = 1): one lit clone flies in onto A's LSB level and dissolves. A does not rise.
- **A×1000:** three dark discs slide in under A, A rises three levels, and the 1 dissolves at A's new LSB level.

### 4.4 Reassembly
Reassembly is ordinary ADD beats (§3) on the `Addition` nodes the splits created. Operands arrive as results returned from below. The larger value receives the smaller one's discs, so a partial product with a higher top bit usually receives.

### 4.5 Return beat (`Funct.Return(true)` → `AutoR`)
**Instant at t=0:** `returnVar` is re-parented into the node's **parent socket** at the node's x,y (no jump), and `solved = true`.

**Tweened over 0 → sp:**
- `TweenMax.to(result, sp, {x:0, y:0})`: the result rides up into the socket.
- `Link.Ascend` sets the socket's `raised = true`. The hub (r20) and the bead tween to the socket point, and the line tweens to `{width:0, height:0}` at the socket, so the wire reels in. `IO.CenterOn` pans the camera to the parent node (1 s).

**At t = sp:** `AutoR` runs `KillFunct(this)`. The node's glyph is already at alpha 0, and the node is removed. If `auto` is on, `IO.Solve(true)` runs.

### 4.6 Full schedule: 5 × 11 (`[5,11]` into one MULT; AUTO on; sp = 1)
Before beat 1:
- the Input bead slides to IO's centre (1 s);
- `MakeArrFromText` builds an `Arr` whose two Vars spread 50 apart (`Arr.Pop`, sp), then `LittleDelay` → `Solve`;
- the Arr slides to the block and the bead descends (1 s);
- `GiveVars` moves Var i to socket i. Each starts at the block centre and tweens x, y, z → 0 over sp while `Pop(true)` re-spreads its bits from 3 to 50.

| Beat | Action | Result |
|---|---|---|
| 1 | Split M(101, 1011) → Add₁( M(101,1000), M(101,11) ) | |
| 2 | Shift M(101,1000): three dark discs in, column up 3, the 1 dissolves | 101000 (40) |
| 3 | Return 40 into Add₁'s left socket; M removed | |
| 4 | Split M(101,11) → Add₂( M(101,10), M(101,1) ) | |
| 5 | Shift M(101,10) | 1010 (10) |
| 6 | Return 10 | |
| 7 | Shift M(101,1): one lit disc in, it dissolves | 101 (5) |
| 8 | Return 5 | |
| 9 | ADD₂: 1010 receives "101"; no carries | 1111 (15) |
| 10 | Return 15 into Add₁'s right socket | |
| 11 | ADD₁: 101000 receives "1111". L0–L2: 0+1. L3: 1+1, the resident rises to L4 (a 0, absorbed). The label is misplaced (§3.3). | 110111 (55) |
| 12 | Return 55 into IO's root socket | |

After beat 12, `IO.Return`: the Output bead slides to the Output pill (1 s) and the pill shows `[55]`.

In general there are **5·popcount(B) - 3 beats** of `sp` between delivery and output: (p-1) splits, 2p for the leaves (shift + return), and 2(p-1) for the additions (add + return). Camera pans of 1 s run alongside every beat.

### 4.7 Limits of the original
- A or B equal to zero, leading zeros in B, and signs are not handled. A zero B throws a RangeError at `getChildAt(numChildren-2)`.
- The split assumes B's MSB is 1.
- `MULT` ignores its own `animate` flag for the shift.
- With `animate = false`, no `SolveAgain` or `Return` is scheduled.

---

## 5. Comparison, division, trig and other operations
- **Division ("/"): none.** No division block or code exists. "/" appears only in the HUD title "PRIME / FUNCTION" and in the never-shown `Arr` label "[k/n]".
- **Subtraction and negatives: none.** The sign is only a label prefix. `Add` and `Mult` strip the other operand's sign, and output prints negatives as 0 (`IO.ConvertArrToText` overwrites the "-", and `BinaryToDecimal` returns 0 for negative input).
- **COMP (`Comparative`): a static drawing with no logic.** It does not override `SpecialSolve`, so the inherited one only does `trace("solve")`.
  - Drawing:
    - a diamond: `DrawRect(49.5, 49.5)`, 2 px stroke, Paper fill, rotated 45°;
    - Paper rings (annulus r30–r35) at x = ±70;
    - chevrons in 3 px strokes reading "> … <";
    - an "=" (two 10 px bars at y = ±3.5) that is mostly hidden by an r5 Paper disc drawn on top;
    - three 100 px wire stems hanging from the diamond's left, right and bottom vertices to sockets at (-35,100), (35,100) and (0,135), plus sockets at (±70, 0).
  - `GiveVars` fills sockets in child order, so the stems fill before the rings.
  - `Funct.Solve` throws a RangeError unless all five sockets are filled. Even then nothing returns, so the chain stalls.
- **TRIG (`Trig`): a static drawing with no sockets and no logic.**
  - Drawing:
    - a Paper-filled right triangle (120,0), (-120,0), (-60,-103.9), inscribed in an r120 semicircle, on the y=60 baseline;
    - `Alpha` = 1/6 (30°);
    - angle arcs of r48 at the right vertex;
    - an r240 arc;
    - a "+1" Var on a 60 px stem below.
  - Feeding it numbers throws a TypeError in `GiveVars`.
- **Animations of the machine itself** (all quadratic ease-out, no delays):

| Animation | Method | Tween | Duration |
|---|---|---|---|
| Input bead to IO | `Link.TextIOAscend` | bead (r7): pill (0,0) → IO centre | 1 s (IO built once) |
| Numbers appear | `Var.Set`, `Var.Pop`, `Arr.Pop` | bits to z = -3i (collapsed), then -50i; Vars in the Arr to z = -50i | sp |
| Delivery to the root block | `IO.Solve`, `Link.Descend` | Arr → block x,y; block's bead → hub | 1 s / sp |
| Fan-out to sockets | `Funct.GiveVars` | each Var from the block centre → its socket, x,y,z → 0, with bits expanding 3 → 50 | sp |
| Return up a wire | `Funct.Return`, `Link.Ascend` | result → (0,0) in the parent socket; hub, bead and line collapse into the socket | sp |
| Output bead | `Link.TextIODescend` + `IO.GiveAnswer` | bead IO centre → Output pill, then text `[n]` (instant) | 1 s |
| Camera | `IO.CenterOn` / `CenterIO` | IO pans so the node sits 50 px below the stage centre, or IO sits at (W/2, H/2 - about 121) | 1 s fixed |
| Palette | `FunctBar.Pop` / `Collapse` / `MoveTo` | bar y up/down; bar x scrolls to centre the hovered block | 0.5 / 0.5 / 1 s |
| Perspective follow | `PRIME.FollowP` | `projectionCenter` = mouse position, fov 10, instant | none |

---

## 6. Visual vocabulary and timing constants

| Item | Value | Source |
|---|---|---|
| Tween engine / ease | GreenSock v12; quadratic ease-out `1-(1-t)^2`; overwrite "auto"; no delays; all tweens inserted at t=0 | `TweenLite.static`, `Ease.getRatio`, `TimelineLite.insert` |
| Beat duration `sp` | 1 s default; `[` -0.5 (min 0.5), `]` +0.5; copied per object at construction | `PRIME.static`, `KeyHandler` |
| Fixed durations | camera 1 s; IO and TextIO beads 1 s; palette pop/collapse 0.5 s; palette scroll 1 s | `CenterOn`, `CenterIO`, `FunctBar` |
| Bit | two r30 discs, 3 px `outL` stroke; OFF base `Shade1`, ON overlay `Shade3`, alpha 0/1 | `Bit` constructor |
| Bit states | on/off = overlay alpha crossfade over sp; removal = whole-disc alpha → 0, then `DeleteBits` | `Bit.Set`, `Bit.FadeOn` |
| Level spacing | 50 (expanded / solving), 3 (collapsed); Arr 50 / 0 | `Var.Pop`, `Arr.Pop` |
| Label | 0.5 level beyond the MSB; carry-out moves it to new MSB z - 25 | `Pop`, `FinishRise` |
| Label pill | text 127 pt × 0.3; round rect w+20 by 0.75h, radius 0.75h, `Shade1` fill, 1 px stroke, alpha 0.85; hidden when "0" | `Var.UpdateTop` |
| Flat row pitch | prev.width + 10 (about 73 px), LSB on the left | `Var.Spread` |
| Perspective | projectionCenter (stageW, 2·stageH), fieldOfView 10 | `PRIME.Resize` |
| Block | H=70, W=140, sockets at x=±70; IO H=180 (W stays 140) | `Funct`, `IO` |
| Socket | r30 even-odd hole (fits a bit) | `Shapes.DrawArr` |
| Pin glyph | `DrawArr(70,70,true)`: semicircle cap, sides, tip of height 24.75, r30 hole | `Shapes` |
| Add glyph | two pins (rotation ±90 at x=±70) with tips meeting at the centre; `Plus(11.67, 5.83)` | `Addition` |
| Mult glyph | right pin; left flat tray; flap `DrawArr(70,40,false)` at x=-40 with `rotationX` -30; centre dot r5 solid; ring r5 outline at (70, about 46) | `Multiplication` |
| Child placement | parent.H/2 + child.H/2 + 30 (100 below a block, 155 below IO); +100 per collision | `IO.Comb`, `CheckCombCollision` |
| Operand fly-in | ±140 (socket to socket), meeting at the node centre (±70 each) | `ADD`, `MULT` |
| Wire | line 2 px `inL`; hub r20 with paperback fill and 2 px stroke; beads r7 | `Link` |
| Wire grow / reel | `from {width:0, height:0}` (+ beads from (0,0)) / `to {width:0, height:0}` at the socket | `DrawLink`, `Ascend` |
| Camera target | active node 50 px below the stage centre | `IO.CenterOn` |
| Drag | search circle r200; nearest socket below threshold 500 | `FunctBar.New`, `Ping` |
| Palette rest / raised y | stageH + 0.2h / stageH - 0.3h; labels scale 0.2, alpha 0.9, bottom edge 35 px above centre | `FunctBar` |
| IO layout | pills at (∓129.9, -75); triangle r80 with apex down; r30 hole; horizon at y=80 | `IO` constructor |
| I/O pill | round rect w+50 by h, radius h, Paper fill, 1 px stroke; captions scale 0.15 at alpha 0.5 | `TextIO.Update` |
| SKETCH textures | PAPER 300x300 (avg #F9EFDF); SHADE1 100x100 (#F4F4F4); SHADE3 150x150 (#B1B1B1); SHADE1T 100x100 dark hatch (#414141, alpha about 0.25–0.32) used for the palette backing | `SetTheme` |
| Lines | `outL` = `inL` = #000000 in SKETCH; TRON `inL` = #FFFFFF | `SetTheme` |
| HUD | alpha 0.5; title scale 0.3; labels 0.1; AUTO LED = Bit at scale 0.15 | `Background.UpdateText` |

---

## 7. Reusable concepts

Each concept below is taken from PRIME.
1. **Place value is a position along one axis.** Digit i sits at level i, with the LSB at the base and the MSB furthest out. A number is a column of bulbs. Moving a whole column one level is multiplying or dividing by the base.
2. **Two kinds of motion.** Operands move toward each other perpendicular to the place-value axis: incoming bulbs are born already at their level (`incoming.z = target.z`) and slide straight across. Motion along the axis is reserved for changes in value: carries and shifts.
3. **Shift = slide the column k levels and fill the gap with dark bulbs that physically arrive** from the multiplier, which are the k trailing zeros of 2^k (`Var.Mult`).
4. **The multiplier's leading 1 is the identity.** It travels to exactly where the multiplicand's LSB lands and dissolves there.
5. **Split = rewrite the node in place.** The × node becomes a + node at the same spot, and two × children drop out of its centre into its sockets. Peel the top digit off the multiplier: B = top + rest, then recurse on the rest (`MULT`).
6. **Partial product = a copy of the multiplicand paired with one power of the base.** The pairing is gated by a nonzero multiplier digit: only lit multiplier bulbs spawn a partial product, and dark digits spawn nothing.
7. **Reassemble = depth-first evaluation, left first.** Each result rides up its wire into the parent socket, and the spent node disappears (`Return`, `KillFunct`).
8. **Addition = collision.** The smaller operand's bulbs fly into the larger operand's column, and every level is resolved by a local survivor rule. One disc stays as the result, and the other vanishes or becomes the carry.
9. **The carry is a physical bulb, not a new one.** When a lit pair meets, the incoming partner stays as the dark result and the resident climbs one level. A carry past the top grows the column, and the label climbs with it.
10. **Discards fade, and the cleanup happens at the end of the beat.** Removal and the label refresh happen only on completion (`DeleteBits`, then `UpdateTop`).
11. **One beat per step.** All motion of a step plays in parallel for one `sp` with ease-out. Steps chain through completion callbacks. AUTO chains them automatically; manual mode advances one step per key. The AUTO switch is itself an LED.
12. **Value label.** A decimal pill floats just beyond the MSB, and the sign lives on the label (sign-magnitude).
13. **Fraction scaffolding: digits after the point stack in the opposite direction** (`Var.Pop` negates the spacing for a `DecimalParent`). This was planned in PRIME but never finished.
14. **Sockets are bulb-sized holes,** and data travels between nodes as a bead along a wire.

**Applying them.** The following are proposals, not things PRIME does.
- **Shifts.** Left shift is concept 3 as is. Right shift is the mirror: the bottom k bulbs fade and the column descends k levels.
- **NOT.** Crossfade every bulb's overlay in place (a correct `Flip`). Do not copy PRIME's `Flip`.
- **AND / OR / XOR.** Use the collision of concept 8 with different survivor rules and no carry:
  - AND: lit only if both are lit; otherwise the survivor goes dark and the partner fades.
  - OR: lit if either is lit.
  - XOR: a lit pair annihilates, i.e. addition whose "rising" bulb fades instead of climbing.
- **Subtraction.** Use the collision, but a lit incoming bulb annihilates a lit resident (both fade). A borrow is the inverse of concept 9: a lit bulb one level up descends and becomes a pair at this level.
- **Division.** Use the inverse of split/reassemble. For k from the top down: slide a shifted copy of the divisor (concept 3) against the remainder. If it fits, subtract it (collision) and light quotient bulb k. Comparison is a collision that stops at the highest level that differs.
- **Balanced ternary** (dark = 0, lit = +1, red = -1). The base is 3, so one shift level is ×3.
  - Collisions: opposite colours annihilate. Two of the same colour (±2 = ∓1 + carry ±1) leave the partner at this level flipped to the opposite colour, and the resident rises as a carry of the same colour.
  - Sign is intrinsic, so no sign-magnitude label is needed.
  - Split B at its highest nonzero trit: B = ±3^k + R.
  - A red leading trit is "the identity, negated": the multiplicand column flips colour as the trit dissolves. A partial product for a red digit is a colour-swapped copy.
- **Base e.** Shift is ×e, so multiplying by e^k is a pure slide, and the column height of e^x is x. Multiplying powers of e is stacking heights: concept 5's "multiplication becomes addition" made literal, as ln(ab) = ln a + ln b.
  - Integers can be written as greedy base-e expansions with digits {0,1,2} (floor(e) = 2), for example bulbs that are dark, half-lit or full. Concept 13 places the fractional digits on the far side of the point.
  - e is the base with the best radix economy, and 3 is the integer base closest to it, which links base 2, balanced ternary and base e.

---

## 8. Open questions that only running the movie could settle
1. **Perspective.** How do 50-unit z stacks actually look under `projectionCenter` (stageW, 2·stageH) with fov 10? The estimate is a fanned coin stack drifting about 10 px up and left and scaling about 0.9% per level, with the MSB largest and nearest. Which direction does it read, and do the discs overlap heavily?
2. **Overwrite outcome.** Under GSAP v12 `overwrite: "auto"`, which of two same-time tweens on one property survives?
   - In 1+1, the incoming disc's overlay gets 0 → 1 and then 1 → 0. Does it arrive lit and darken, or never light?
   - In carry cases a target gets `Set(true)` and then `Set(false)`.
   - `Pop(false,true)` is followed immediately by `Pop(true,…)` on the same z.
   - Several `CenterOn` tweens are created in one frame.
3. **`fromTo` immediate render.** The `fromTo` tweens render their start values immediately, and the code writes the final alpha straight afterwards. Is there a one-frame flash of the final state?
4. **Raise defect on screen.** Is the stray dark disc that covers a lit carry actually visible, e.g. 9+5 showing 1100? Does the misplaced label after `FinishRise` (e.g. inside the stack in 40+15) show?
5. **Glyph rendering.** Do the even-odd holes (sockets, the IO triangle's r30 "eye") render as holes, and what shows through them? Is the Plus a clean solid shape?
6. **Multiplication glyph.** What does the tilted flap (`rotationX` -30) plus the flat left tray read as? Is the ring marker (child 7) visibly a pointer to the split level, and why is it on the A×2^k child rather than on the remainder?
7. **Clones lighting in flight.** Clones of lit digits start unlit (overlay 0) while the hidden source was lit. Is the darken-then-relight during flight noticeable, and was it intended?
8. **Mixed speeds.** After `[`/`]`, objects built earlier keep their old `sp`. How do mixed-speed beats look, e.g. a `Var.Mult` timeline finishing after `Return` has re-parented the Var?
9. **Double click.** Does double-click-to-solve (`Funct.ClickSolve`) ever fire, given that `doubleClickEnabled` is set on the block but the listener is on its `Link`?
10. **Empty timelines.** Does an empty `TimelineMax` (non-animated paths) ever fire its `onComplete`? This affects `GiveVars` with animate = false.
11. **Single number with a block.** Does a single-number input with a block attached throw at the `Arr` cast in `IO.Solve`, and does pressing Enter before typing throw a RangeError?
12. **Textures on screen.** How do the SKETCH textures look in place? ON (`SHADE3`, dense dark crosshatch) is darker than OFF (`SHADE1`, faint hatch), the inverse of an LED, while TRON (never reachable) is LED-like.
