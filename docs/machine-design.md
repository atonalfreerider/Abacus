# Machine: PRIME's function machine rebuilt in LED bulbs (final design, revision 2)

Status: final design, revision 2, 2026-10-21. Branch family `feature/machine-*`.

This design starts from the faithful design, which the judges preferred. It adds the strongest ideas from the engineer and learner designs, fixes every error the three judges found, and settles where they disagreed. Revision 2 fixes every issue from the second review; the changelog at the end lists them. Sources:
- `docs/prime-reference.md`, cited as **§n**.
- The current code:
  - `src/mvc/view.js`: `bulb`, `socket`, `bulbNumeral`, `BULB = 37`;
  - `bases.js`, `units.js`, `theme.js`, `app.js`, `drag.js`;
  - `src/numbers/numbers-app.js`;
  - `tools/video/studio.mjs`. Its caption-only path (`record({path})`, `ctx.caption`, an audio-less mux, an `.srt` that is always written) is already on main through merge 266f0f2.

**The user's requirement, met literally.** Hang a MULT block under the triangle, enter `[16,7]` and press **Enter**. The multiplication animation then plays as it does in PRIME:

MULT(16,7) → ADD(64, MULT(16,3)) → MULT(16,3) → ADD(32,16) → 48 rises → ADD(64,48) → 112 rises → Output `[112]`.

With AUTO on, one Enter plays the whole run. With AUTO off, each Enter plays the next beat, so 16 Enters reach Output `[112]`. Either way, focus can stay in the Input field (4.2).

**What was checked by running code.** A prototype planner built to this contract checked the worked examples in sections 2 and 6:
- It ran the binary and ternary `[16,7]`, `[5,11]` and `[5,−4]` plans and reproduced the traces and JSON below.
- Revision 2 re-validated every fixture in section 6 by replaying its diffs and checking, at every beat, that each tower's bulbs equal its value (Σ s·base^level) and that levels are dense with no leading darks. Pending towers were exempt from the density check (I3).
- The survivor tables in 2.2 were generated from the reference `survivor()`.
- The base-e digits, logarithms and eased crossing times were recomputed at 80-digit precision.

---

## 0. Decisions at a glance

1. **New mode: Machine.** A header button sits between Numbers and Tutor. The code lives in `src/machine/` and is lazy-loaded like Numbers. The mode is PRIME's function machine:
   - Input pill → IO triangle → blocks hung on wires → Output pill;
   - PRIME's HUD: title, AUTO bulb, SPEED;
   - a palette bar (PRIME's FunctBar);
   - Enter to step, AUTO, speed, and a camera that follows the active node.
2. **It opens in PRIME's demo state.** Base 2, a × block under IO, and `[16,7]` in the Input.
   - AUTO is remembered and defaults to on.
   - On a fine pointer the Input has focus with its text selected. On touch the stage has focus, so no soft keyboard rises.
   - **One Enter rule** (4.2). Enter rebuilds and plays from beat 0 only when something changed, no run has started, or the run is over. Otherwise it is Step.
   - With MULT hung and `[16,7]`, the run is INPUT, DELIVER, FANOUT, the 12 beats PRIME shows (5·popcount(7) − 3), then OUTPUT `[112]`.
3. **A number in the machine is a tower.** It has one bare bulb per level, with the units bulb in the socket, so place value is height. There are no trays and no rods.
   - Rows stay where they are: the equation space, the Input and Output text, and the video title cards.
   - Carries climb, shifts rise, borrows descend, and base-e lights fall.
4. **One beat per step.** Every motion in a beat starts at u = 0 and uses PRIME's quadratic ease-out `1 − (1 − u)²`.
   - A beat lasts `sp` seconds (1 s by default); carry beats in level pace last `sp/2`.
   - Beats are **half-open**: the frame at integer time t = i is the end of beat i − 1.
   - **Carries: together** (PRIME's one-beat ripple) is the default. **One level at a time** is an option; the tutorials and lessons use it.
5. **One survivor rule decides every carrying collision:** ADD, SUB, XOR and SUM. AND, OR, MIN, MAX and CONS have their own tables (2.8).
   - It keeps PRIME's carry identity: the resident bulb climbs, and the incoming bulb stays as the dark 0.
   - A climbing carry is **always lit in flight**: a dark resident lights as it rises.
   - It fixes the defects documented in §3.3.
   - Per level, what stays is XOR (SUM in ternary) and what climbs is AND (CONS, the consensus, in ternary).
6. **Binary.**
   - Arithmetic is sign-magnitude: blue positive, red negative, as on the cards.
   - Logic is exact infinite two's complement, drawn with a **sign lamp**: one bulb above the top that stands for every level above, forever. It lights **red** because its worth is −2^L, so a bulb's colour always shows the sign of what it is worth.
   - Converting between the two forms is shown as FLIP then ADD ONE. Which sockets convert is listed in 2.8.
   - Every gate result equals BigInt `& | ^ ~`, with no register width to choose. SHR truncates like ÷, so the expression field refuses `>>`.
7. **Balanced ternary is signed natively.**
   - NOT is negation (a colour swap), AND is min, OR is max.
   - The XOR analog is **SUM**: tritwise addition mod 3 with the carry thrown away. It pairs with **CONS**: a + b = SUM + 3·CONS, just as a + b = XOR + 2·AND.
8. **Division.**
   - Binary truncates: r takes the dividend's sign, exactly BigInt `/` and `%`.
   - Balanced ternary rounds to nearest with **ties toward zero**: |r| ≤ |b|/2, and at a tie r takes the dividend's sign.
   - The trit decision is made visible as TRY/JUDGE.
   - DIV and MOD at the root output `[q, r]`.
   - Domain errors, including divisors computed inside the tree, are caught before planning and shown on the offending block.
9. **Base e is exact where it can be and honest where it cannot.**
   - Values are exact elements of Q[e, 1/e]. Digits 0..2 are certified greedy; the endless tail is **dust**.
   - **FOLD** merges a tower into one light at height ln x. **UNFOLD** lets that light fall; each time it comes to rest, it is at ln of what is left to place.
   - ×e^k is a shift; × of whole numbers is a SLIDE by ln b.
   - A carry is a fold that lands exactly in bases 2 and 3. In base e, no whole number of bulbs ever lands on a level.
10. **Engineering.**
    - Plans are pure, BigInt-exact data: scenes at beat boundaries stored as diffs, plus a closed set of motion overrides. The overrides include an in-flight colour, `via`.
    - Every display string lives in the plan.
    - A **base registry** decouples the binary/ternary core from base e.
    - The renderer is a pure function `(plan, t, layout, palette, view) → SVG`.
    - The layout is a normative pure function of the plan.
    - Tests prove every operation over ranges, check eight invariants at every beat, and stay under 30 s.
    - The 720 decimal snapshot hashes stay byte-identical.
11. **Ten silent, captioned explainer videos** in landscape and portrait. They extend the caption-only studio path already on main with a silent flag, key and typing helpers, machine helpers that hold each beat until its caption has been read, and an app recording mode.
12. **Four engineers can build in parallel.** Their file sets do not overlap and meet only at the frozen contracts in section 6, the base registry among them. The merge order A → C → B → D works because no file imports one that merges later (section 7).

---

## 1. Visual language

### 1.1 Units

Machine units are PRIME's units × 1.25. A bulb of radius 37 (view.js `BULB`) then sits in its socket the way PRIME's r30 disc sat in its r30 hole.

| Item | PRIME | Machine |
|---|---|---|
| Block W × H | 140 × 70 | 176 × 88 |
| Operand sockets | x = ±70 | x = ±88 (base e: ±150, because base-e towers are wider), hole r38 |
| Bit | r30 disc | bulb r37, drawn with `bulb()` / `socket()` geometry |
| Level pitch | 50 along z (overlapping coins) | **84 along screen y**: 2R + 10, upright |
| Collapsed (coin) pitch | 3 | 6 |
| Level-pace lanes | none | x ±84 beside a tower: incoming bulbs wait on the donor's side, pending carries on the other |
| Quotient register | none | right of the right socket, x ≥ 264 (6.3b) |
| Wire, hub, bead | 2 px straight, r20, r7 | 2.5 elbow (down, across in the row gap, down), r25, r9 |
| Label | 0.5 level beyond the MSB | 42 above the top bulb |
| Base-e level | none | bulbs at scale .8; socket centres x = −34 and +34; the sliver centred at +102 and clipped to 0.718 of a socket |
| Camera | active node 50 px below centre | 62 units below centre |

The level pitch is the one deliberate change of scale. PRIME's columns stood toward the viewer, so depth cost no screen space. On a flat screen, bulbs must not overlap if their states are to be read.

### 1.2 A number

**Binary and balanced ternary.** Bulb i sits at level i, at `y = socketY − 84·i`. Dark bulbs are physical, as PRIME's dark discs were: a carry's partner stays behind as the dark 0.

At a beat boundary a level holds exactly one bulb. There are two exceptions:
- a **pending** tower in level pace, whose unresolved levels also hold waiting bulbs in the lanes (2.2);
- **owed** bulbs between a COLLIDE and its last BORROW (2.3).

| Base | Lit | Dark | Other |
|---|---|---|---|
| Binary | `bulb.blue` = +2^k (a positive number); `bulb.red` = −2^k (a bit of a negative number, sign-magnitude) | `socket()`, value 0 | sign lamp (logic only) |
| Balanced ternary | blue = +3^k, red = −3^k | 0 | none |
| Base e | 1 or 2 lit bulbs in the level's two sockets | empty sockets (sockets are furniture, not bulbs) | sliver; dust (an amber haze under level −3); the light (one bulb with an amber halo on a height rail) |

**One state formula for every base.** A bulb has a state s ∈ {−1, 0, 1}, and a tower's value is **Σ s·base^level** over all its bulbs, lanes included. This covers:
- binary negatives, whose lit bits are stored as −1;
- the sign lamp: a lit lamp has s = −1 at level L and is worth −2^L;
- base-e digits, with the dust added.

Value conservation is therefore one test for everything.

- **Shape cue for colour.** Red bulbs carry a short bar across the core, and so does the lit (red) lamp. A base-e digit 2 is two countable bulbs. Colour is never the only cue.
- **Zero** is one dark bulb at level 0, labelled "0". PRIME drew nothing, which looked like a missing input.
- **Normal form** holds at the end of every node's work:
  - no dark bulbs above the top lit bulb (zero is its single dark bulb);
  - binary sign-magnitude towers use a single colour.
  - **Exemptions**, all of them temporary:
    - owed bulbs (`o: 1`), between a COLLIDE and its last BORROW;
    - pending towers in level pace, until their last `carry` beat;
    - the quotient register at `node.Q`, until its RETURN, where its leading darks fade.
- **Coin.** A number in the Input or Output list, or riding a wire, collapses to a coin: levels 6 units apart, labelled on top (PRIME `Pop(false)`). It expands into a tower when it lands in a socket (PRIME `GiveVars`). A base-e light rides as an amber coin.
- **Sign lamp (binary logic only).** A bulb one level above the top, with two ghost bulbs above it (scale .7 and .5, opacity .45 and .2) that read "and so on, forever".
  - Dark lamp: every level above is 0.
  - Lit lamp: red, and every level above is 1, which together is worth −2^L.
  - Example: NOT 5 is `010` under a red lamp at level 3: 2 − 8 = −6.
  - **Lamp normal form:** the top bit differs from the lamp, unless the tower is the single level 0. Examples: 0 = `0` under a dark lamp at L1; −1 = `1` under a lit lamp at L1; −2 = `0` under a lit lamp at L1; −4 = `00` under a lit lamp at L2.
- **Base-e tower.** The socket is the radix point. Negative levels hang below it, separated by a dotted radix line, down to the floor at level −3 (the three places the equation space shows).
  - Below the floor is **dust**: an exact non-zero remainder, drawn as an amber haze with "…".
  - **Pile:** an un-normalised tower. A third bulb at a level sits over the sliver and overhangs it by 0.282, with the overhang tinted amber. A 4th or later bulb perches above at scale .7. More than 6 bulbs at one level show a count badge (×12).
  - A value below e⁻³ (1/30, or 1/10⁶) has no digit above the floor. It is drawn as empty sockets from level 0 down to −3 over the dust, and its rail, when folded, extends down to ⌊ln x⌋ (3.8).

### 1.3 Labels and place values

All label text comes from the plan (`Tower.text`, `approx`, `digits`, `reading`, `note`; 6.2). The renderer never formats a value.

- **Value pill**, 42 above the top bulb (PRIME `UpdateTop`).
  - Line 1, `text`: the exact decimal value with U+2212 for the minus sign. Garamond in sketchpad, monospace in cyber. Alpha .85.
    - Base e shows the exact symbolic value (`e² + 2`).
    - A pending level-pace tower shows the sum it is resolving (`13 + 9`).
  - Line 2, `approx`, in base e when the value is not an integer: `≈ 9.389`.
  - Light towers show `reading`: `ln 112 ≈ 4.7185`.
  - Timing: the text switches at u ≥ 0.9 of each beat and the pill is always placed on top. This fixes PRIME's label left inside the stack.
  - Placement: centred on its tower, but an `.L` pill's right edge never passes x = −14 and an `.R` pill's left edge never passes x = +14 (relative to the node). Long pills shift outward, so sibling pills never overlap (6.3b).
  - **Legibility at small scales** (`view.minFont`, which the mode sets to 10 px; the recording leaves it unset): wherever the camera draws small, as on a phone at its smallest scale, a pill's 27-unit text draws at 6.6 px and the INPUT/OUTPUT captions at 3.4 px. A label whose text would draw under minFont (a caption under 0.8 of it) grows about its foot (centred, or from a corner; an IO pill also from its top or middle, a caption from its inner end) up to that size, into free space only: never over a bulb where it starts or ends the beat, a block, IO, a static tower's furniture, another label (2 px apart, the active node's pills placed first) or the edge of the framed area. The layout's sizes are untouched, so 6.3b's guarantee holds for what is drawn; where the layout leaves no room (the Input pill under the input coins at the opening) the label keeps its size, and its values are read in the coins' own pills, the sentence line and Output.
- **Digits (D).**
  - Place values (`2⁰ 2¹ …`, `3ᵏ`, `eᵏ`, opacity .55) form one column left of the active node's leftmost tower.
  - The digit glyph sits right of each column bulb; T is a barred 1. Lane bulbs have no glyphs.
  - The digit line (`digits`): `1110000₂`, `11011 bal₃`, `20010.001…ₑ`; lamp towers read `…1010₂`.
  - Glyphs are drawn by `render.js` in `machine.glyph` (1.7), never with `bulbNumeral`, whose fill is hard-coded `#050504`.
- **Tower note.** A short tag beside the pill: `×2³`, `q`, `r 3`.

### 1.4 Columns or rows, and flat

- **Machine: always columns.** The motion grammar needs a vertical place axis.
- **Rows** stay in the equation space, the Input and Output text, and the title cards.
- Moving between the modes is a mode switch, with no cross-mode rotation in v1 (4.6).
- **Flat, not perspective.** PRIME's fov-10 perspective (about 0.9% per level) and its perspective-follow are dropped.

### 1.5 Furniture

- **IO.** A downward triangle with an r38 eye.
  - Input pill at (−162, −94) and Output pill at (+162, −94), each wired to the centre.
  - A blurred horizon line at y = 100.
- **HUD** (DOM overlay, top left, alpha .5):
  - the title `PRIME / FUNCTION` (the user's own movie);
  - BASE (2, ±3 or e);
  - **AUTO**: one bulb, lit when on. Clicking it toggles AUTO and redraws, which PRIME's did not.
  - **SPEED**: six bulbs, the lit count showing the beat length, plus the seconds. PRIME's readout was the constant `101`.
- **Palette** along the bottom. Hover raises it on pointer devices; it is always raised on touch.

**Block glyphs** (PRIME's pin-and-tray vocabulary):

| Block | Glyph |
|---|---|
| ADD | two pins whose tips meet, plus (§1) |
| SUB | ADD's pins with a minus; in NEGATE the minus turns 90° into a plus and the block becomes ADD in place |
| MULT | PRIME's right pin, left tray, tilted flap and centre dot; a ring marker at the split level |
| DIV, MOD | two pins and ÷ (MOD adds "r"); the quotient register stands beside the right socket |
| COMP | PRIME's diamond with `> = <` chevrons; the bars tilt into <, = or > |
| SHL, SHR | a pin with an up or down arrow, `×bᵏ` / `÷bᵏ` |
| AND OR XOR NOT | pins with ∧ ∨ ⊕ ¬ (NOT has one centred socket) |
| MIN MAX SUM CONS NEG | ∧ ∨ ⊕₃ ≡ −, with small-caps names under them |
| ×eᵏ, MEASURE, LN | an arrow pin; a ruler with ≈; a ruler with "ln" |

TRIG is not ported: in PRIME it had no sockets and no logic (§5).

### 1.6 Motion grammar (PRIME's rules, kept)

1. **Operands meet across the place axis.** Incoming bulbs are born at their own level and slide straight across (§3.1, `incoming.z = target.z`).
2. **Motion along the axis always means a change of value:**
   - **climb** = a carry, exactly one level, and a climbing carry is lit (`via`);
   - **rise** = a left shift by k;
   - **descend** = a borrow or a right shift;
   - **fall** = base-e UNFOLD.
3. **Discards fade.** Removal, trimming and the label switch happen at the end of the beat. Partners of a cancellation stay fully visible until the burst at u 0.6.
4. **One beat per step.** All motion starts at u = 0 with quadratic ease-out, and the camera glides over the same beat.
5. **A split rewrites a node in place.** Results ride up wires, and spent blocks vanish (§4.2, §4.5).

**PRIME defects fixed, each pinned by a named regression test:**
- An incoming 0 always fades, so 7 + 5 = 12 (PRIME shows 24) and 9 + 5 = 14.
- The label always ends on top (40 + 15).
- Clones are born in their real state, so there is no darken-then-relight.
- A speed change applies to everything from the **next beat**.
- The camera lasts as long as the beat.
- BigInt conversion: 257 and 1024 read correctly.
- `[5, 3]` parses as [5,3], not [5,0,3].
- Shortcuts do not fire while typing.
- Zero operands and arity mismatches give a message instead of throwing.

### 1.7 Colours in both styles

`theme.js`'s `copy()` walks a style's keys into `ink`, so every new key must exist in both styles. A parity test asserts this.

| Token | Sketchpad | Cyber | Use |
|---|---|---|---|
| `bulb.amber` | `{body:'#d99a1e',core:'#fff3d6',glow:'#ffb21e'}` | `{body:'#ffb21e',core:'#fff4dc',glow:'#ffcf5a'}` | base-e light, ring, scan |
| `machine.wire` | `#191a16` | `#145566` | wires, block outlines |
| `machine.wireActive` | `#2f5d6b` | `#36e6ff` | the active path and beads |
| `machine.hub` | `#25241e` | `#36e6ff` | hubs |
| `machine.block` | `#f6f0de` | `#061118` | block faces |
| `machine.blockEdge` | `#25241e` | `#36e6ff` | block edges |
| `machine.glyph` | `#25241e` | `#c9f8ff` | block glyphs, **digit glyphs and the T bar**, place values |
| `machine.label` / `labelFill` | `#14251d` / `#efe6cc` | `#c9f8ff` / `#0b1a22` | pills |
| `machine.rail` | `#6d6655` | `#2f6475` | base-e height rail |
| `machine.scan` | `#9a5b10` (= `curves[1]`) | `#ffb21e` | ring, scan bar, overhang, verdict mark |
| `machine.dust` | `#d99a1e` | `#ffb21e` | dust haze |
| `machine.error` | `#b3261e` | `#ff3d8b` | the outline of a block that has a domain error |

- Bulbs keep `ink.bulb.{blue,red,off}`, so red is always negative and blue positive.
- Green stays reserved for x and is never used.
- **Cyber digits.** Digit glyphs use `machine.glyph`, so they are light on the cyber stage. No CSS override of `.numeral` is needed, because the machine never emits `bulbNumeral`.
- **Cyber performance.** `cyber.css` gives every `.bulb` a `filter: drop-shadow`. The rule `[data-style=cyber] #machine-stage .bulb{filter:none}` turns it off inside the stage; the halo circles `bulb()` already draws carry the glow.

---

## 2. Operations in binary and balanced ternary

### 2.0 Beat vocabulary

| Beat kind | What moves | Used by |
|---|---|---|
| `input` | the Input bead slides to the IO centre; the numbers appear as coins | every run |
| `deliver` | the coins ride down the wire to the root block | every run |
| `fanout` | each number rides to its open socket (depth-first, left first) and expands | every run |
| `split` | a × node turns into + in place; two × nodes slide out of its centre into its sockets | MULT |
| `shift` | the multiplier's bulbs slide into A's column; A rises k levels; the leading bulb dissolves | MULT leaf, SHL, ×eᵏ |
| `zero` | a zero operand absorbs the other: its bulbs slide down into the zero bulb and fade | MULT with A = 0 or B = 0 |
| `drop` | A's bottom k bulbs slide out into the remainder; A descends k | SHR |
| `collide` | the donor's bulbs fly across at their levels; every level resolves by the survivor rule (level pace: the donor waits in a lane and only L0 resolves) | ADD, SUB, DIV |
| `carry` | one level's resolution (*Carries: one level at a time*), half a beat long | ADD in level pace |
| `borrow` | a lit bulb descends to an owed level, lighting the levels it passes, and pays the debt | binary SUB |
| `negate` | every lit bulb swaps colour (a bottom-up wave, 0.04 beat per level, capped at 0.4) | SUB, ternary NEG, a red multiplier |
| `compare` | the towers face each other; a scan bar runs down; a verdict appears (a one-bulb tower for COMP, a transient mark inside DIV) | COMP, binary DIV rounds |
| `gate` | a collision in which nothing climbs | logic |
| `flip`, `addone` | the two beats of COMPLEMENT; `flip` alone is NOT | binary logic and lamp conversions |
| `prep`, `descend` | the trial divisor rises K levels / descends one | DIV |
| `try`, `judge`, `clear` | a ghost trial collision / keep or discard / R = 0 ends early | ternary DIV |
| `pile`, `legal`, `fold`, `unfold`, `slide`, `meet`, `race`, `read` | base e (section 3) | base e |
| `return` | the result rides up the wire into the parent socket; the wire reels in; the node vanishes, and anything left at the node fades | every node |
| `output` | the root result rides to the Output pill as a coin; the pill shows `[n]` | every run |

**Inputs, receivers, results.**
- Inputs fill the open sockets depth-first, left first. PRIME required exactly the root's socket count.
- Receiver of ADD, SUB and DIV collisions: the operand with the larger magnitude; ties go to the right operand (PRIME §3.1). In balanced ternary, a larger magnitude implies at least as many levels.
- Receiver for gates: the taller tower; ties go right.
- **DIV and MOD results.**
  - Not the root: DIV returns Q and MOD returns R. In the RETURN beat the other tower takes its note (`r 3` or `q 7`) and fades where it stands while the result rides up.
  - At the root: both ride up and Output shows **`[q, r]` for both blocks**, for example `[7, 3]`, with the pill's second line `q 7 · r 3`.

### 2.1 The survivor rule (carrying collisions: ADD, SUB, XOR, SUM)

At level k there are the resident R, the incoming I and possibly an arriving carry C, any of which may be absent. A real carry is never 0. Let s = r + i + c and write s = d + base·c′, where:
- binary: c′ = trunc(s/2), so s = ±2 → (0, ±1) and ±3 → (±1, ±1);
- ternary: c′ = round(s/3), so −3 → (0, −1), −2 → (1, −1), −1 → (−1, 0), 0 → (0, 0), 1 → (1, 0), 2 → (−1, 1), 3 → (0, 1).

1. **c′ ≠ 0:** R climbs one level as the carry, **in state c′ while it climbs**. If R was dark it lights as it rises (`via`, 6.3), so a carry is never seen dark in flight. The survivor (C if present, otherwise I) takes state d and stays. Any remaining bulb fades.
2. **c′ = 0:** the first of R, C, I (in that order) that already shows d stays. If none does, R switches to d (or C when R is absent). The rest fade.
3. **Above the receiver's top** (R absent, so I is absent too): the arriving carry stays and becomes a new level. The column grows and the label climbs (PRIME `FinishRise`).
4. **Burst:** if the level's lit inputs include both signs, the renderer draws `cancel-burst` at the level. Bulbs that fade in a burst fade over [0.6, 1], so both partners are seen meeting. In ternary, every carry that fades does so in a burst (table below).

XOR and SUM run the same rule with no incoming carries: the climber rises half a level and evaporates (2.8). AND, OR, MIN, MAX and CONS do not carry; their survivors are listed in 2.8.

**Half-adder reading.** With no carry in, what stays is r ⊕ i: XOR in binary, SUM (the balanced sum mod 3) in ternary. What climbs is AND(r, i) in binary and CONS(r, i) in ternary (r if r = i, else 0). The captions of tutorials V5 and V8 say so.

### 2.2 Addition

**Binary, same colour.** The table is for blue; red mirrors it. ∅ means absent, – means no carry.

| r | i | c | d | c′ | What you see |
|---|---|---|---|---|---|
| 0 | 0 | – | 0 | 0 | R stays dark; I fades |
| 0 | 1 | – | 1 | 0 | I stays lit; R fades |
| 1 | 0 | – | 1 | 0 | R stays; I fades |
| 1 | 1 | – | 0 | 1 | R climbs (the carry); I stays and goes dark |
| 0 | 0 | 1 | 1 | 0 | C stays lit; R and I fade (PRIME kept I) |
| 0 | 1 | 1 | 0 | 1 | R lights blue and climbs; C goes dark and stays; I fades |
| 1 | 0 | 1 | 0 | 1 | R climbs; C goes dark and stays; I fades (PRIME kept I) |
| 1 | 1 | 1 | 1 | 1 | R climbs; C stays lit; I fades |
| 0 | ∅ | – | 0 | 0 | R stays |
| 1 | ∅ | – | 1 | 0 | R stays |
| 0 | ∅ | 1 | 1 | 0 | C stays lit; R fades |
| 1 | ∅ | 1 | 0 | 1 | R climbs; C goes dark and stays |
| ∅ | ∅ | 1 | 1 | 0 | C stays: a new level (rule 3) |

**Balanced ternary.** This table is generated from `survivor()`; T = −1 (red), 1 = blue, 0 = dark.

| r | i | c | s | d | c′ | What you see |
|---|---|---|---|---|---|---|
| T | T | – | −2 | 1 | T | R climbs red; I turns blue and stays |
| T | T | T | −3 | 0 | T | R climbs red; C goes dark and stays; I fades |
| T | T | 1 | −1 | T | 0 | R stays; C and I fade (burst) |
| T | 0 | – | −1 | T | 0 | R stays; I fades |
| T | 0 | T | −2 | 1 | T | R climbs red; C turns blue and stays; I fades |
| T | 0 | 1 | 0 | 0 | 0 | I stays; R and C fade (burst) |
| T | 1 | – | 0 | 0 | 0 | R goes dark and stays; I fades (burst) |
| T | 1 | T | −1 | T | 0 | R stays; C and I fade (burst) |
| T | 1 | 1 | 1 | 1 | 0 | C stays; R and I fade (burst) |
| 0 | T | – | −1 | T | 0 | I stays; R fades |
| 0 | T | T | −2 | 1 | T | R lights red and climbs; C turns blue and stays; I fades |
| 0 | T | 1 | 0 | 0 | 0 | R stays; C and I fade (burst) |
| 0 | 0 | – | 0 | 0 | 0 | R stays; I fades |
| 0 | 0 | T | −1 | T | 0 | C stays; R and I fade |
| 0 | 0 | 1 | 1 | 1 | 0 | C stays; R and I fade |
| 0 | 1 | – | 1 | 1 | 0 | I stays; R fades |
| 0 | 1 | T | 0 | 0 | 0 | R stays; C and I fade (burst) |
| 0 | 1 | 1 | 2 | T | 1 | R lights blue and climbs; C turns red and stays; I fades |
| 1 | T | – | 0 | 0 | 0 | R goes dark and stays; I fades (burst) |
| 1 | T | T | −1 | T | 0 | C stays; R and I fade (burst) |
| 1 | T | 1 | 1 | 1 | 0 | R stays; C and I fade (burst) |
| 1 | 0 | – | 1 | 1 | 0 | R stays; I fades |
| 1 | 0 | T | 0 | 0 | 0 | I stays; R and C fade (burst) |
| 1 | 0 | 1 | 2 | T | 1 | R climbs blue; C turns red and stays; I fades |
| 1 | 1 | – | 2 | T | 1 | R climbs blue; I turns red and stays |
| 1 | 1 | T | 1 | 1 | 0 | R stays; C and I fade (burst) |
| 1 | 1 | 1 | 3 | 0 | 1 | R climbs blue; C goes dark and stays; I fades |

**Ternary rows with the donor shorter** (I absent):

| r | i | c | s | d | c′ | What you see |
|---|---|---|---|---|---|---|
| T | ∅ | T | −2 | 1 | T | R climbs red; C turns blue and stays |
| T | ∅ | 1 | 0 | 0 | 0 | R goes dark and stays; C fades (burst) |
| 0 | ∅ | T | −1 | T | 0 | C stays; R fades |
| 0 | ∅ | 1 | 1 | 1 | 0 | C stays; R fades |
| 1 | ∅ | T | 0 | 0 | 0 | R goes dark and stays; C fades (burst) |
| 1 | ∅ | 1 | 2 | T | 1 | R climbs blue; C turns red and stays |
| ∅ | ∅ | T or 1 | ±1 | c | 0 | C stays: a new level |

With no carry and I absent, R stays.

**COLLIDE timeline** (defaults of the renderer's motion rules, 6.3):

| u | Event |
|---|---|
| 0 → 1 | each tower slides 88 to the node centre (the donor moves 176 relative to the receiver, as in PRIME §3.2); the glyph fades; climbers rise 84 |
| 0 → 0.3 | a dark climber lights to its carry state (`via`) |
| 0.3 → 1 | plain discards fade |
| 0.6 → 1 | burst partners fade as the burst plays; survivors and arrived carries crossfade to their final state, so 1 + 1 is seen as two lit bulbs meeting before one darkens |
| 0.9 | the label text switches; leading dark bulbs trim |

**Examples:**
- **13 + 9 = 10110 (22).**
  - L0: 1 + 1, so R climbs.
  - L1: the carry stays; R and I fade.
  - L2: R stays.
  - L3: 1 + 1 climbs into a new L4.
- **13 + 3 = 10000 (16).** Golden; it pins the in-flight colour.
  - L0: 1 + 1, so R0 climbs lit.
  - L1: the dark R1 meets I and the carry (s = 2), so R1 lights and climbs, and the carry stays dark.
  - L2 and L3: each resident climbs while the arriving carry stays dark.
  - L4: the last carry stays.
  - The carry chain is lit all the way up.
- **6 + 3 (§3.1) = 1001:** the carry lands on a lit bulb; that bulb climbs on and the carry stays dark.
- **7 + 1 = 1000:** every lit bulb climbs one level at once.
- **Ternary 5 + 7 (1TT + 1T1) = 110 (12):**
  - L0 bursts.
  - L1: (T, T) climbs red.
  - L2: the red carry and the incoming blue burst; R stays.
- **Ternary 10 + (−5) (101 + T11) = 1TT (5).** Golden.
  - L0: (1, 1), so R climbs blue and I turns red.
  - L1: the dark R lights blue and climbs; the carry turns red and stays.
  - L2: R stays, while the lit carry and the red I cancel in a burst.
- **Ternary 4 + 4 = 10T** in one beat.

**Carries option.** `#machine-pace` offers *together* (the default, PRIME) or *one level at a time*. Level pace applies to same-colour binary ADD and to every ternary ADD (and SUB after its NEGATE). Opposite-colour binary collisions have no carries, so they play as in together pace.

- **The level-pace `collide` beat** (dur 1):
  - The receiver slides to the node centre and becomes **pending**: `pending: true`, and its pill shows the sum (`13 + 9`).
  - The donor's bulbs fly to the **incoming lane** on the donor's side, at x ±84 beside their own levels, and wait there.
  - Level 0 resolves at once. A climber rises into the **carry lane** on the other side, at level 1, and waits there.
- **Then one `carry` beat** (dur 0.5) for each level ≥ 1 that holds a waiting bulb, bottom up:
  - the waiting incoming bulb and carry slide into the column;
  - the level resolves by the survivor rule (waiting bulbs that fade slide in as they fade);
  - a climber rises into the carry lane one level up.
- **The last carry beat** clears `pending`; the pill switches to the value.
- At every boundary inside the run, each unresolved level shows up to three bulbs side by side: carry lane, column, incoming lane. That reads cleanly, and the tower's value (all bulbs) is still the exact sum.
- Tutorial V2 and every lesson use level pace. The goldens 13 + 9 (binary) and 4 + 4 (ternary) are given in 6.5b.

### 2.3 Negation and subtraction

- **NEGATE** (both bases): every lit bulb swaps colour (s → −s).
  - Ternary: exact negation, which is also Kleene NOT.
  - Binary: flips a sign-magnitude tower's sign.
- **SUB block:** NEGATE the right operand while the block's minus turns into a plus (the node's op becomes `add`), then ADD.
- **Binary, opposite colours.** The larger magnitude receives, so the answer takes its colour; equal magnitudes annihilate to zero.
  1. **COLLIDE (annihilate):**
     - (σ, −σ): burst; R goes dark; I fades.
     - (0, −σ): I stays in its own colour as an **owed** bulb (`o: 1`).
     - (σ, 0) and (0, 0): R stays.
  2. **One BORROW beat per owed bulb, highest owed bulb first.** The donor j is the nearest receiver-coloured bulb above the owed level k.
     - u 0 → 0.8: the donor descends to k, and each dark level it passes lights in the receiver's colour as it passes. A dark bulb fades in at j, unless j was the top, in which case the tower shrinks.
     - u 0.8 → 1: the donor "splits into a pair" (a burst): one half pays the owed bulb, which fades, and the donor stays lit at k.
     - Ledger: 2^j = 2^(j−1) + … + 2^(k+1) + 2·2^k.
  - **A donor always exists.** The receiver is larger, and processing the highest owed bulb first leaves only dark levels between k and j. This was checked for every 0 ≤ i < r < 2000; the most borrow beats in one subtraction is 10.
  - **12 − 5:** red 101 meets blue 1100.
    - L0 is owed, and L2 bursts.
    - The donor at L3 descends, lighting L2 and L1, and pays L0. The tower shrinks.
    - Result **111** = 7.
  - **5 − 12:** the receiver is red 12, so the answer is red 111 = −7.
- **Ternary.** SUB is NEGATE then ADD. It never borrows, because carries can be red.
  - 5 − 7 = 1TT + T1T → T1 (−2).
  - 8 − 5 = 10T + T11 → **10** (3), in one collision.

### 2.4 Multiplication (PRIME §4, extended)

MULT(A, B): A is the multiplicand and the only operand that is shifted; B is the multiplier and the only operand that is decomposed. Operands are never swapped.

- **Zero** (A = 0 or B = 0): one ZERO beat, then RETURN.
  - The zero operand's single dark bulb moves to the node centre. The other operand's bulbs slide down into it and fade.
  - Captions: "Nothing to multiply: 0 × 9 = 0." / "16 × 0: no lit bulbs to shift. 0."
  - Nothing ever rises, so no tower of leading darks appears.
- **Leaf** (B has exactly one non-zero digit, B = t·b^k): one SHIFT beat.
  - B's bulbs slide into A's column at their levels while A slides to the node centre; they meet there.
  - A's bulbs rise k levels, and B's k dark bulbs fill levels 0..k−1.
  - B's leading bulb travels to level k and dissolves where A's LSB lands (×1).
  - If t = −1, every lit bulb of A swaps colour as the red lead dissolves ("the identity, negated").
  - For k = 0, one bulb lands on A's L0 and dissolves; A does not rise.
- **Split** (B has two or more non-zero digits). Let k be B's top non-zero level, T = t_k·b^k and R = B − T.
  - The node turns from × into + in place.
  - Two new × nodes slide out of its centre into its sockets while their wires grow.
  - A and B (now rewritten to T) ride to the left child.
  - A copy A′ peels off A and rides to the right child.
  - B's lit bulbs below k travel to the right child as R, and dark bulbs fade in behind them in B, so the "rest" visibly leaves B.
  - The ring marker sits beside B at R's top level, where PRIME put it.
  - In ternary, R may be negative: 7 = 1T1 → 9 + (−2).
- **Beat count** between FANOUT and OUTPUT: **5·nz(B) − 3**, where nz counts non-zero digits.
  - With p = nz(B), the breakdown is p − 1 splits, p shifts, p − 1 adds and 2p − 1 returns.
  - It is **2** when A = 0 or B = 0.
  - In level pace, each add adds its carry beats.

**Binary `[16,7]`.** This is the golden trace and what the user observed in PRIME. Beats 0–2 are INPUT, DELIVER and FANOUT, and beat 15 is OUTPUT.

| Beat | Kind | Caption (normative) | Tower |
|---|---|---|---|
| 3 | split | 7 = 4 + 3, so 16 × 7 = 16 × 4 + 16 × 3. | |
| 4 | shift | 16 × 4: 2 dark bulbs slide under 16; it rises 2 levels. 64. | 1000000 |
| 5 | return | 64 rides up. | |
| 6 | split | 3 = 2 + 1, so 16 × 3 = 16 × 2 + 16 × 1. | |
| 7 | shift | 16 × 2: 1 dark bulb slides under 16; it rises 1 level. 32. | 100000 |
| 8 | return | 32 rides up. | |
| 9 | shift | 16 × 1: the 1 dissolves; 16 stays put. | 10000 |
| 10 | return | 16 rides up. | |
| 11 | collide | 32 + 16: nothing carries. 48. | 110000 |
| 12 | return | 48 rides up. | |
| 13 | collide | 64 + 48: nothing carries. 112. | 1110000 |
| 14 | return | 112 rides up into the triangle. | |
| 15 | output | Output [112]. | |

**Balanced ternary `[16,7]`** (16 = 1TT1, 7 = 1T1):

| Beat | Kind | Caption | Tower |
|---|---|---|---|
| 3 | split | 7 = 9 + (−2), so 16 × 7 = 16 × 9 + 16 × (−2). | |
| 4 | shift | 16 × 9: 2 dark bulbs slide under 16; it rises 2 levels. 144. | 1TT100 |
| 6 | split | −2 = −3 + 1, so 16 × (−2) = 16 × (−3) + 16 × 1. | |
| 7 | shift | 16 × (−3): 1 dark bulb slides under 16; it rises 1 level and every colour swaps. −48. | T11T0 |
| 9 | shift | 16 × 1: the 1 dissolves; 16 stays put. | 1TT1 |
| 11 | collide | −48 + 16: 2 carries climb. −32. | TT11 |
| 13 | collide | 144 + (−32): 2 carries climb. 112. | 11011 |
| 15 | output | Output [112]. | |

Returns fill the remaining beats: 5, 8, 10, 12 and 14. Two details of the collisions:
- **Beat 11.** L1 (T, T) climbs red. At L2 the red carry stays while R and I burst. L3 (1, 1) climbs blue. At L4 the blue carry meets red R and both go out.
- **Beat 13.** Two red carries climb, and the top level cancels.

**Other goldens:**
- PRIME's `[5,11]` (§4.6, worked as JSON in 6.4), now ending with the label on top.
- `[5,−4]` in ternary (6.5).
- `[7,16]` is a single SHIFT. Tutorial V1 uses it to show that operand order matters to the machine.
- `0 × 9` in both bases (6.5b), `9 × 0`, and `0 × 0`.

### 2.5 Shifts

- **SHL `[a, k]`.** The count k arrives as a coin. At FANOUT it expands into the tower b^k (one lit bulb at level k over k darks, note `×2³`), and then the leaf SHIFT plays.
- **SHR `[a, k]`.** FANOUT as above, then one DROP beat:
  - If A has fewer than k levels, dark bulbs fade in to pad it to k levels.
  - A's bottom k bulbs slide 176 into the right socket and become the remainder tower; b^k's bulbs fade.
  - A and its label descend 84·k. If nothing is left, A becomes one dark bulb (q = 0).
- **Binary** (sign-magnitude):
  - q = trunc(a/2^k) and r = a − q·2^k, the fallen bulbs keeping A's colour. This is exactly BigInt `a / 2n**k` and `a % 2n**k`.
  - Examples: `[45,2]` → 1011 r 01; `[5,4]` → q 0, r 101; **`[−13,2]` → q −3, r −1**.
- **Ternary:**
  - q = round(a/3^k). There is never a tie, because 3^k is odd, and r ∈ [−(3^k−1)/2, (3^k−1)/2]. The bottom k trits of a balanced-ternary number are exactly its balanced remainder mod 3^k.
  - Examples: `[19,1]` → 1T0 (6) r 1; `[20,1]` → 1T1 (7) r T; `[5,4]` → q 0, r 5.
- **SHR(a, k) = DIV(a, b^k)** in each base's convention (tested).
- **Which representation, and `>>`.**
  - A lamp-form operand entering SHL or SHR is converted to sign-magnitude first (2.8).
  - Two's-complement `>>` floors (−13 >> 2 = −4), while SHR truncates like ÷ (−3 r −1). The expression field therefore **refuses `>>`**: "In the machine a right shift truncates toward zero like ÷: write shr(−13, 2)."
  - `<<` is accepted, because a left shift is multiplication in every representation. In ternary it means ×3^k.
- **The count k must be a whole number ≥ 0.** A negative typed count is refused at Enter. A negative computed count is a domain error (2.6), with no direction swapping. The upper bounds come from the tower limit (6.10).

### 2.6 Division with remainder

**Domain errors first.** `planMachine` evaluates the whole tree exactly before planning (6.6). Any of the following returns `{ok:false, reason, node}` with no plan:
- a zero divisor at DIV or MOD, whether typed or computed (`9/(3−3)`, or a SUB block feeding DIV's right socket);
- LN of a value ≤ 0;
- a negative shift count.

The app outlines the offending block in `machine.error` and pulses it. The status names the cause, for example "Nothing fits into zero: the ÷ block's divisor is 3 − 3 = 0", and Output shows `[—]`. A zero **dividend** is fine: `(3−3)%2` → `[0, 0]`.

**Binary (truncating).**
1. **PREP.** A trial divisor D = |B| climbs K = max(0, len|A| − len|B|) levels in the right socket, with darks sliding under it as in SHIFT. The quotient register Q of K + 1 dark bulbs is born at `node.Q`.
2. **Rounds k = K … 0:**
   - **COMPARE in magnitude mode** (2.7) D with R: colours are ignored, and a red R is scanned as its mirror. The verdict is a transient mark, not a tower.
   - If D fits, COLLIDE a copy of D in the colour opposite to R (D itself stays), then the BORROW beats. Quotient bulb k lights blue if A and B have the same colour, red otherwise.
   - DESCEND (D drops one level and its bottom dark fades), except after k = 0.
   - Equal lengths with |A| < |B| give a single round that does not fit: q = 0, r = a.
3. **RETURN.** Q's leading darks fade as it rides up (I3 applies from here). R keeps A's colour. At the root, both towers ride up.

The result satisfies a = q·b + r with |r| < |b| and sign(r) = sign(a), which is BigInt `/` and `%`.

`[45,6]` takes 16 beats including RETURN:
- PREP: K = 3.
- k = 3: 48 does not fit.
- k = 2: 24 fits; 1 borrow → 21.
- k = 1: 12 fits; 1 borrow → 9.
- k = 0: 6 fits; 2 borrows → 3.
- Q = 0111, which RETURN trims to 111. Output `[7, 3]`, labelled `q 7 · r 3`.

**Balanced ternary (nearest, ties toward zero).**
1. **PREP:** K is the smallest K ≥ 0 with 2|A| ≤ 3^(K+1)·|B|. The trial divisor D = |B| (B with its colours swapped when B < 0) climbs K levels, and Q is born with K + 1 dark bulbs.
2. **Rounds k = K … 0:**
   - **CLEAR:** if R = 0, one beat ends the remaining rounds ("nothing left to share").
   - **TRY:** let t = sign(R)·sign(B), so t·B = sign(R)·|B|. A ghost copy of R (opacity .55) peels off to the node centre and collides there with a copy of **−t·B·3^k**: a copy of D·3^k whose sign is opposite to R's (its colours swapped when R > 0). This is the same wording as binary's "copy of D in the colour opposite to R". The ghost lands as **G = R − t·B·3^k**.
   - **JUDGE:** a scan compares |G| with |R|; a tower with a red top is flipped for the scan only.
     - Keep G if |G| < |R|. On a tie (|G| = |R|, so G = −R), keep whichever has A's sign.
     - Keep: R fades, the ghost solidifies and moves into R's socket, and quotient trit k lights in t's colour.
     - Discard: the ghost fades.
   - DESCEND, except after k = 0.
3. **RETURN Q** (leading darks fade), as in binary.

The result is q = sign(a)·sign(b)·⌊(2|a| + |b| − 1)/(2|b|)⌋ and r = a − b·q. So |r| ≤ |b|/2, and at a tie r takes a's sign.
- The rule was simulated against this closed form for every a ∈ [−2000, 2000], b ∈ [−60, 60]\{0}, with zero failures.
- Every quotient fits in K + 1 trits.
- The convention is odd-symmetric: DIV(−a, b) = −DIV(a, b).
- The help text says: "Ternary MOD is the balanced remainder: |r| ≤ |b|/2, and a tie takes the dividend's sign. So 19 mod 5 = −1 and 14 mod 4 = 2."

**Why try-and-keep.** In base 3, each trit decision is "is R more than half of D·3^k?", which one scan cannot show. Trying the collision and keeping whichever remainder is nearer zero is the same decision, made visible. It is also why the remainder is balanced.

**Examples:**
- 19 ÷ 5 → `[4, −1]`.
- 17 ÷ 5 → `[3, 2]`.
- 14 ÷ 4 → `[3, 2]`: in the last round 2 and −2 are equally near zero, and the tie keeps the dividend's sign.
- 100 ÷ 7 → 1TTT (14) r 2, by way of the remainders 100 → −89 → −26 → −5 → 2.
- 15 ÷ 4: binary gives 3 r 3, ternary gives 4 r −1.

### 2.7 Comparison

COMP is a COMPARE beat followed by RETURN.

| u | Event |
|---|---|
| 0 → 0.3 | the towers slide face to face, ±40 from the centre; padding darks fade in |
| 0.3 → 0.8 | the scan bar (`machine.scan`) runs down from the top; agreeing pairs dim to .35 |
| 0.8 → 1 | at the first difference the larger bulb flashes; the glyph bars tilt; the verdict appears |

**The COMP block's verdict** is a one-bulb tower born at the node centre, with value sign(a − b): blue for >, dark for =, red for <. Because the answer is a bulb, it can feed other blocks.
- Binary: colour decides first (blue > zero > red) without a scan. Two red towers are scanned and the verdict inverted.
- Ternary: lexicographic with T < 0 < 1. This is valid because the lower trits differ by at most 3^k − 1 < 3^k.

**Magnitude mode** (inside binary DIV) compares |D| with |R|:
- colours are ignored, and a red tower is scanned as its mirror;
- the verdict is a **transient mark** (`{k:'verdict'}`, 6.2): the node's chevrons flash blue ("fits") or dark ("does not fit") over [0.8, 1];
- no tower is born, so I1 and I6 are untouched.

### 2.8 Logic

**Binary: infinite two's complement with the sign lamp.** All results equal BigInt `& | ^ ~` (oracle checked for a, b ∈ [−130, 130]; plans checked over the ranges in 6.9).

**Which sockets use which form.**

| Sockets | Accept | Conversion beats |
|---|---|---|
| **Gate:** AND, OR, XOR, NOT | lamp form | a red sign-magnitude operand gets COMPLEMENT on the way in (2 beats); a blue one gains a dark lamp inside the GATE beat |
| **Arithmetic:** ADD, SUB, MULT, DIV, MOD, COMP, SHL, SHR (both sockets) | sign-magnitude | a lit-lamp operand converts back (2 beats); a dark lamp just fades during the RETURN that delivers it |
| Output | either | none: a lamp tower is shown as it is |

- **COMPLEMENT on the way in** (two beats) for a red tower of magnitude M ≠ 0:
  - `flip`: every bulb toggles and turns blue, and a red lamp lights above. Value −M − 1.
  - `addone`: a lit bulb flies into L0 and collides by the survivor rule. The carry never reaches the lamp; that would need every flipped bit to be 1, so M = 0.
  - Last step at u 0.9 (**fold**): while more than one level remains and the top bit equals the lamp, the top bit fades into the lamp and the lamp descends one level. This happens exactly when M is a power of two.
  - Examples:
    - red 110 (−6) → 001 under a red lamp (−7) → 010 under a red lamp (−6);
    - red 100 (−4) → 011 under a lamp at L3 (−5) → 100 → folds to 00 under a lamp at L2 (−4);
    - red 1 (−1) → 0 under a lamp at L1 (−2) → 1 under a lamp at L1 (−1), with no fold because only level 0 remains.
- **Back to sign-magnitude** (two beats): `flip` (bits flip, the lamp goes out and is removed, bulbs turn red; value v + 1), then `addone` with a red bulb, whose carry may grow the tower by one level (rule 3).
- **GATE beat.**
  - EXTEND, in the first quarter: the shorter tower grows to the taller one's height with new bulbs lit or dark per its lamp ("the lamp lends its bulbs").
  - The donor's bulbs and lamp fly across, and each level and the lamp resolve. Nothing climbs except XOR's evaporating carry.
  - At u 0.9 the fold runs as above; a dark lamp's fold is the ordinary leading-dark trim.

| Gate | (1,1) | (1,0) | (0,1) | (0,0) | Rule |
|---|---|---|---|---|---|
| AND | R stays, I fades | R goes dark, I fades | R stays dark, I fades | R stays | dark wins |
| OR | R stays, I fades | R stays | I stays lit, R fades | R stays | lit wins |
| XOR | R rises half a level and evaporates (the discarded carry); I stays dark | R stays | I stays | R stays | addition without carrying |
| NOT | unary `flip`: every bulb and the lamp toggle, then the fold | | | | NOT x = −x − 1 |

Lamps combine by the same table, where lit means 1.

**Examples:**
- 12 AND 10 = 8; 12 OR 10 = 14; 12 XOR 10 = 6.
- 12 + 10 = 6 + 2·8: XOR keeps the sums, and AND marks where the carries start.
- NOT 5 = 010 under a red lamp = −6; NOT 0 = −1; NOT −1 = 0.
- −5 AND 3 = 3.

**Balanced ternary (Kleene / Łukasiewicz, order T < 0 < 1):**

| Gate | Per level | Survivor |
|---|---|---|
| MIN (AND) | min(r, i) | red beats dark beats blue; on a tie R stays |
| MAX (OR) | max(r, i) | blue beats dark beats red; on a tie R stays |
| SUM (the XOR analog) | (r + i) mod 3, balanced; the carry is discarded | the survivor rule with the climber evaporating (+0.5 level) |
| CONS (consensus) | r if r = i, else 0 | equal: R stays, I fades; unequal: R darkens, I fades |
| NEG (NOT) | −r | `negate` |

**Why SUM is the XOR analog:**
1. It is PRIME's collision with the carry thrown away, the same mechanism as binary XOR.
2. It is a group operation with identity 0 and inverse NEG: (x ⊕ y) ⊕ (−y) = x. Parity, checksums and one-time pads rely on exactly this.
3. It pairs with CONS as XOR pairs with AND. Trit by trit, a + b = SUM + 3·CONS, so iterating (x, y) ← (SUM, 3·CONS) adds any two numbers. This takes at most 7 rounds for |a|, |b| ≤ 400.

On {0, 1}, SUM is **not** truth-functional XOR: 1 ⊕ 1 = T, because 2 ≡ −1 (mod 3). It is the carry-less sum.

**Not offered as a block: Kleene XOR**, max(min(a, −b), min(−a, b)), which equals −a·b for every pair of trits. It is a respectable three-valued connective:
- T (false) is its two-sided identity, since −a·(−1) = a;
- on the Boolean subset {T = false, 1 = true} it is exactly truth-functional XOR: T⊕T = T, T⊕1 = 1, 1⊕1 = T.

It is the wrong analog for this machine for three reasons:
- **It is negated multiplication, not addition.** It forms a commutative monoid with identity T in which 0 absorbs everything.
- **It is not a group.** 0 has no inverse, so (x ⊕ y) ⊕ y⁻¹ = x fails whenever y = 0.
- **It has no carry partner.** a + b − XOR_K(a, b) is not a multiple of 3 for (a, b) = (0, 1), so no "Kleene AND" could make a + b = XOR_K + 3·(anything).

The machine's collision family is additive, so SUM is the analog it can show. Kleene XOR ≡ −a·b, with T as its identity, is tested. In binary, AND is both min and consensus; ternary separates the two, which is itself worth showing (V8).

**Examples:**
- MIN(2, 1) = MIN(1T, 01) = 0T = −1; MAX(2, 1) = 11 = 4. Tritwise min and max are not numeric min and max.
- SUM(5, 7) = T10 = −6 and CONS(5, 7) = 1T0 = 6, so −6 + 3·6 = 12.

### 2.9 Master collision table

| Operation | Binary per level | Ternary per level | Vertical motion |
|---|---|---|---|
| ADD | survivor rule, same colour | survivor rule | climb exactly 1, lit in flight |
| ADD, opposite colours | annihilate, owed bulbs, then BORROW | (n/a: survivor rule) | borrow descends |
| SUB | NEGATE + ADD | NEGATE + ADD | as ADD |
| AND / MIN | dark wins | min wins | none |
| OR / MAX | lit wins | max wins | none |
| XOR / SUM | survivor rule; the carry evaporates | survivor rule; the carry evaporates | +0.5, fading |
| CONS | (= AND) | equal stays | none |
| NOT / NEG | flip, lamp included | swap colours | none |
| COMP | top-down scan (colour first) | top-down scan | none |
| MULT leaf, SHL / SHR | rise / descend k | rise / descend k (a red lead swaps colours) | k levels |
| MULT zero | ZERO: bulbs slide down into the zero bulb | same | down to level 0, fading |
| DIV round | COMPARE (magnitude), then COLLIDE + BORROW | TRY, then JUDGE (nearer zero, tie to a's sign) | descend 1 per round |

---

## 3. Base e

### 3.1 What is honest

- **Finite towers are exact polynomials in e.** e is transcendental, so Z[e, 1/e] ≅ Z[x, 1/x]. A finite tower Σ d_k·e^k is a Laurent polynomial in e, and different digit strings are different numbers. For example, e² + 2 = 102ₑ exactly (≈ 9.389).
- **Among rationals, only 0, 1 and 2 end.** A rational value in Z[e, 1/e] must be the constant term alone.
- **Values** are exact elements of Q[e, 1/e]. Inputs are rationals, `e`, `e^k`, and short sums such as `e^2+2`. Every decision is exact; floats appear only in heights and `≈` readouts.
- **Rigorous digits.**
  - First, a symbolic zero test.
  - Then the sign of P(e) by dyadic interval arithmetic: e ∈ [Σ_{n≤N} 1/n!, Σ + 1/(N!·N)], rounded outward to denominators 2^p, with p doubling from 64 to 8192. This terminates because P(e) ≠ 0 whenever P ≠ 0.
  - The greedy digit at level k is the largest d with S − d·e^k ≥ 0. It is automatically ≤ 2, because S < e^(k+1) < 3e^k.
- **The pile theorem** (from the engineer design). An integer-coefficient pile normalises to a finite numeral **if and only if it already is a legal numeral**, because P(e) = Q(e) implies P = Q. Legal means digits in 0..2 plus the greedy (Parry) condition Σ_{j<k} d_j·e^j < e^k for every k.
  - So every base-e carry is infinite: three ones are not exactly anything.
  - 22ₑ = 2e + 2 ≈ 7.437 > e² ≈ 7.389 is finite but not greedy; its greedy form is 100.0002…ₑ. **An irrational base carries by pattern, not by count.**

### 3.2 A number has two forms

- **The digit tower.** A level has room for e bulbs: two sockets and a sliver socket 0.718 wide, drawn as a dashed partial ring. This extends the card language, where an e^k stack is ⌊e^k⌋ whole cards and one sliced card.
  - e = 10ₑ, e² = 100ₑ, 2 = 2ₑ, 1 + e = 11ₑ.
  - 3 = 10.020…ₑ, 4 = 11.020…ₑ and 5 = 12.020…ₑ share the **same fractional part**, 3 − e = 0.0200112…ₑ. Only its part below level −3 is dust.
  - 7 = 21.111…ₑ, 16 = 201.011…ₑ, 23 = 1010.011…ₑ, 30 = 1102.110…ₑ (matching the README), 112 = 20010.001…ₑ.
- **The light.** A single bulb on a height rail at the level where one bulb would be worth x. Example: ln 16 ≈ 2.7726. The tower's top level is ⌊ln x⌋.
- **Heights (normative).** `height(x)` = round4(ln |x|), then clamped into [⌊ln |x|⌋, ⌊ln |x|⌋ + 0.9999] using the certified floor (the greedy top).
  - `height(e^k) = k` exactly, so only an exact power of e sits **on** a level.
  - Example: 2721/1001 has ln = 0.99999996, which rounds to 1.0000. The clamp puts its light at 0.9999, below level 1, where UNFOLD then deposits 2 bulbs at level 0.
  - The `reading` shows 4 decimals, or more digits when the rounded value is an integer but x ≠ e^k: `ln(2721/1001) ≈ 0.99999996`.
  - Planners and the renderer use stored heights only. No code compares two lights by height (3.7).

### 3.3 FOLD and UNFOLD: where ln appears

- **FOLD** (one beat, bottom-up). Each bulb merges into the next one above.
  - Merging a light at h₂ into one at h₁ ≥ h₂ lifts it by **ln(1 + e^(−(h₁ − h₂)))**, Gauss's addition logarithm.
  - Equal heights lift by ln 2 = 0.693; one level apart, by 0.313. The dust merges first.
  - The light ends at `height(x)`, and its reading appears at u 0.9 → 1.
- **UNFOLD** (one beat; in level pace, one beat per deposit). The light falls. Each time it passes a level k with d_k > 0, d_k bulbs condense out of it (born at scale .25 → 1), and it continues toward the logarithm of what is left.
  - **Each time the light comes to rest, it is at ln of what is left to place.** Between rests it glides; its path, and the moment each deposit condenses, follow the normative keyframe rule in 6.3.
  - The fill readout shows f = remainder / e^k ("how many bulbs' worth at this level") only where the light is at rest: at the start and end of a together-pace UNFOLD, and at every beat boundary in level pace. It is hidden while the light moves.
  - Each level keeps ⌊f⌋, and the rest moves down a level, where its fill is multiplied by e: the β-transformation, made visible.
  - Below the floor, the light fades into dust. If the remainder is exactly 0, the light lands and becomes the last bulb.
  - **For 112:** start at 4.7185, leave 2 at level 4, rest at 1.0309, leave 1 at level 1, rest at −2.4602, leave 1 at level −3, then dust.

### 3.4 ×e and ×e^k

- **×e^k** is the binary SHIFT leaf, unchanged. The multiplier e^k is one bulb at level k over k empty levels; it dissolves at A's units level as A rises k.
- **Digits are unchanged:** the greedy expansion of x·e^k is x's expansion shifted.
- **The dust gives up digits.** Levels that climb above the floor condense out of the haze. For example, 3·e² = 1002.001…ₑ: the 1 that sat at level −5 of 3 = 10.0200112…ₑ condenses at level −3. (3·e = 100.200…ₑ brings up a 0, so nothing visibly condenses; the tutorials use ×e² or ×e⁵ (1002001.12…ₑ).)
- **×e^(−k)** descends, and levels sinking below the floor merge into the dust. Nothing is lost; the value is exact.
- On the rail, the light rises by exactly k.

### 3.5 Addition: carries when the base is irrational

1. **PILE.** The donor's bulbs fly across and stack at their own levels: slots 0, 1, then the overhanging sliver bulb, then perched bulbs.
   - Opposite-coloured bulbs at the same level annihilate in pairs with a burst. This is the one exact simplification base e has.
   - Dust adds exactly. Nothing climbs, because no climb would be true.
2. **LEGAL.** If what remains is one colour and a legal numeral with no dust, a certified tick runs up the levels and ADD is done. Example: 1 + e = 11ₑ.
3. **Otherwise:**
   - FOLD each colour that is present into its own light;
   - MEET if both colours remain (3.7);
   - UNFOLD in the winner's colour.

   Example: 16 + 7. The pile reads 2|2|2.1|2|2 plus dust; it folds to ln 23 = 3.1355 and unfolds to 1010.011…ₑ.

The merged light is the higher light nudged up by at most ln 2 (log-sum-exp).

**Mixed signs.** ADD of a blue and a red tower (for example, a SUB result fed into ADD) takes exactly this route: PILE-annihilate, then LEGAL, then FOLD, MEET and UNFOLD. SUB is NEGATE plus this route.

**The carry explainer (V10):**
- Three bulbs at level 0 fold to ln 3 = 1.0986, which is 0.0986 past level 1.
- Unfolding leaves one bulb at level 1. The change, 3 − e ≈ 0.2817, falls on: two bulbs land at level −2, and the rest never runs out.
- In base 2, two bulbs fold to exactly one level; in base 3, three bulbs do. **PRIME's carry is a fold that lands exactly.** Base e is the base in which no whole number of bulbs ever lands on a level.

### 3.6 Multiplication

- **Signs.** The colour of a product is the product of the colours. SPLIT, SHIFT and SLIDE work on magnitudes. A red multiplier's leaves swap colours (as in ternary), and the final UNFOLD is drawn in the product's colour.
- **By e^k:** SHIFT.
- **Zero:** the ZERO beat, as in binary. 0 is never folded.
- **By a finite numeral with at most 6 bulbs** (for example 11ₑ or e² + 2): PRIME's SPLIT, peeling one bulb per split, so a digit 2 makes two leaves.
  - Every leaf is a SHIFT.
  - The + nodes born by the split carry `pile: true`: they PILE without normalising. The original node, now +, then runs LEGAL, or FOLD + UNFOLD.
  - (e + 1)² = 11ₑ × 11ₑ → 110 + 11 → pile 121 → legal → **121ₑ exactly**.
  - (e + 1)³ piles to 1331. The 3s are overfull, so FOLD + UNFOLD gives 2111.002…ₑ. Pascal's triangle breaks the moment a carry is needed.
- **Otherwise (the slide rule):**
  - FOLD both operands (one beat).
  - SLIDE: B's light flies onto A's rail and dissolves while A's light rises by B's height, ending at `height(ab)`. The planner stores height(ab), never a sum of rounded heights. The caption adds the displayed 2-decimal values: 2.77 + 1.95 = 4.72.
  - UNFOLD to 20010.001…ₑ.
  - **The carry in the heights:** top(ab) = top(a) + top(b), or one more. For 16 × 7 the levels add 2 + 1 = 3, yet 112 stands at level 4, because the fractional heights 0.77 + 0.95 passed a whole level.

### 3.7 Subtraction and comparison

- **SUB.**
  1. NEGATE: B's bulbs turn red.
  2. PILE: opposite bulbs at the same level annihilate in pairs.
  3. **LEGAL** on what remains:
     - nothing left: one dark bulb, 0;
     - one colour that is a legal numeral: done. Example: (e² + 2) − 2 = 100ₑ.
  4. Otherwise FOLD each colour present. **If only one colour remains, skip MEET.**
  5. **MEET:** the smaller light subtracts from the larger. The result sits at h_max + ln(1 − e^(−Δ)) (the subtraction logarithm) in the larger light's colour.
     - The planner decides which is larger with the certified `compare()`, never by height.
     - If the exact difference is zero (symbolic test), the lights annihilate in a burst and leave one dark bulb.
  6. UNFOLD in the winner's colour. A negative result is a red tower, sign-magnitude.
- **COMP.**
  - If either operand is zero or the colours differ, the colours decide without a fold.
  - Otherwise FOLD both, then RACE: the two lights stand on one rail.
    - The verdict is taken from the certified `compare()` of the values. Heights only draw it, because ln is monotone and the higher light is the larger magnitude.
    - **Two red towers:** the higher light is the more negative value, so the verdict is inverted, as in binary.
  - When the heights differ by less than 10⁻⁹, the caption says "Equal as far as the eye can see; the exact test decides." The certified sign is final.

### 3.8 LN, MEASURE, zero and tiny values

- **LN:** FOLD, then READ. The rail shows `ln x ≈ 4.7185`, Output shows `[ln 112 ≈ 4.7185]`, and ln e^k = k exactly.
  - LN produces a reading, not a tower, so it can feed only Output.
  - LN of a value ≤ 0, typed or computed (`ln(2−2)`), is a domain error caught before planning (2.6): "ln needs a positive number: 2 − 2 = 0 has no logarithm; its light would fall forever."
- **MEASURE** unfolds any value into its digit tower:
  - MEASURE 0 is one dark bulb ("0 is exact");
  - a negative value gives a **red** tower (greedy on |x|; `bases.js` also writes negative base-e digits);
  - its light, when shown, is red at height(|x|).
- **Values below the floor** (|x| < e⁻³, such as 1/30 or 1/10⁶):
  - the tower is empty sockets from level 0 down to −3 over the dust, the pill reading `1/30`, `≈ 0.0333`;
  - the folded light sits at height(x), for example −3.4012 or −13.8155;
  - the rail is drawn from min(−3, ⌊ln x⌋) to top + 1, and the layout reserves that depth (6.3b).

### 3.9 The thread through all three bases

| Base | A level holds | Merging a full level | Radix economy b / ln b |
|---|---|---|---|
| 2 | 1 bulb | 2 bulbs → exactly +1 level | 2.885 |
| Balanced 3 | 1 bulb of either colour | 3 → exactly +1 (2 = 3 − 1) | 2.731 |
| e | 2 bulbs and a 0.718 sliver | 3 → +1.0986: it overshoots | 2.718, the minimum |

### 3.10 Base-e palette

The base-e palette is ADD, SUB, MULT, ×eᵏ (k ∈ [−6, 12]), COMP, MEASURE and LN. DIV, MOD, shifts by counts, and logic are greyed out, with these reasons:
- "A quotient of e-numerals is usually not an e-numeral."
- "Logic needs whole-number levels; base e has none."

---

## 4. Where it lives and how it is driven

### 4.1 Mode wiring

- **Markup.** `index.html` gains:
  - `<button id="open-machine" aria-pressed="false">Machine</button>` between Numbers and Tutor;
  - `<section id="machine-mode" hidden aria-label="Machine">`;
  - in the equation transport, `<button id="watch-machine" hidden>` (4.6).
- **`app.js`:**
  - `showMachine(on, preset)`, a copy of `showNumbers`, with a dynamic `import('../machine/machine-app.js')`;
  - `body.machine-active`, whose CSS hides the workspace, dock, transport, entry bar and tutor bar, as `numbers-active` does.
- **Every place D must close Machine** (each currently closes Graph and/or Numbers):
  1. `showGraph(true)` and `showNumbers(true)` (mutual exclusion; `showMachine(true)` closes both);
  2. the shared `open-equation` / `open-tutor` click listener;
  3. `startLesson`, in both the graph and the non-graph branches;
  4. every `initNative.open` branch: graph, numbers, lessons, pemdas and equation;
  5. `initNative.back` (after dialogs, the peek and the tutor: `if machine is open → showMachine(false)`).

  Also:
  - `onStyle` gains `machine?.restyle()`;
  - the global keydown guard gains `machine-active`.
- **Navigation.** `src/native.js` routes `abacus://open/machine` to a new `place === 'machine'` branch. Home-screen quick actions are unchanged.
- **URLs.**
  - `?machine` opens the default state.
  - `?machine=empty` opens IO with no blocks (`load({tree: {}})`).
  - `?machine=<op or expression>&mbase=binary|ternary|e&input=16,7&sp=1&pace=together|level&auto=0|1` opens preloaded.
  - The machine's base is `mbase`, because `app.js` already reads `?base=` for the equation space.
  - `&automation` exposes `window.__machine` (6.7); `&recording` turns on recording mode (5.1). Both are for tests and videos only.
- **Build.** `tools/build.mjs` copies `src/machine` into both `dist` and `dist-app`.

### 4.2 The Enter ritual

**Opening state:**
- base 2; a × block (`n1`) hangs under IO; Input holds `[16,7]`; AUTO comes from memory (default on);
- the plan is precomputed, and the stage shows 16 and 7 as coins in the Input pill;
- **fine pointer** (`matchMedia('(pointer: fine)')`): `#machine-input` has focus with its text selected, and the caption reads "Press Enter";
- **touch:** `#machine-stage` has focus, so no soft keyboard rises. `#machine-run` is the large primary button, and the caption reads "Tap Run".

**One Enter rule.** It is used by Enter in `#machine-input`, Enter on the stage, `#machine-run` and `#machine-step`.
1. **Start**, if any of these holds:
   - the input text, the tree, the base or the pace changed since the plan was built;
   - no run has started;
   - the run has finished OUTPUT.

   Then parse, rebuild if needed (PRIME: reset, then solve), rewind to beat 0 and play beat 0. With AUTO on, play continues to OUTPUT.
2. **Otherwise Step:**
   - mid-beat (playing or paused), finish this beat now; it never skips more than one;
   - between beats, play the next beat, after which AUTO, if on, continues.

**Consequences:**
- With AUTO off and focus kept in Input, 16 Enters play beats 0–15 and reach Output `[112]` (browser test 2).
- With AUTO on, one Enter plays the run, and a second Enter mid-run finishes the current beat without restarting.
- Typing `[16,7]` over the selection and pressing Enter gives the same run.

**Refusals** appear in `#machine-status`, with the pill shaking:
- no block under IO: "Hang a block under the triangle first: drag one from the palette, or tap the triangle's socket and then a block";
- wrong number of inputs: "This machine takes 2 numbers";
- a domain error: shown on its block (2.6);
- anything past a limit (6.10).

### 4.3 Building machines and entering numbers

- **Palettes:**
  - binary: ADD SUB MULT DIV MOD COMP SHL SHR AND OR XOR NOT;
  - ternary: ADD SUB MULT DIV MOD COMP SHL SHR MIN MAX SUM CONS NEG;
  - e: ADD SUB MULT ×eᵏ COMP MEASURE LN.
- **Attaching a block:**
  - Tap or Tab to a socket (in the outline or on the stage), then tap a palette block. This is the primary, accessible path.
  - Or drag a block: the nearest open socket within r 250 previews a wire (PRIME `Ping`), and dropping attaches.
  - On touch, a horizontal movement in the palette strip scrolls it. A drag starts only after a vertical movement of more than 10 px out of the strip, or a 350 ms press.
  - Dropping on an occupied socket pushes the existing block into the new block's left socket.
  - Backspace on a selected block detaches it; so does the Take off button (`#machine-remove`), shown while a block is selected, which is the touch path.
- **Edits rewind.** Any attach, detach, base switch or pace switch, mid-run or after OUTPUT:
  - re-plans at once;
  - rewinds to beat 0;
  - shows the full tree again, with the spent blocks back and the inputs as coins in the Input pill.

  Typed Input text is taken at the next Enter.
- **Expression field** (`#machine-expr`). It builds the tree and fills Input. Examples:
  - `16*7`, `(5+3)*7`, `45/6`, `45%6`, `12&10`, `~5`, `7<=>9`, `5<<3`, `shr(45,2)`;
  - `min(2,1)`, `sum(5,7)`, `cons(5,7)`, `ln(112)`, `measure(3)`;
  - literals `0b…` and `0t…` (`bases.js` `expandBaseLiterals`).
  - `>>` is refused with the message in 2.5.
- **Input** (`#machine-input`, `inputmode="text"`). It accepts `[16,7]`, `16,7` or `16 7`; brackets are optional, so phones need no bracket key. In base e an item may be a sum: `[e^2+2, 7]`.
- **Base switch** (`#machine-base`, or the B key).
  - It is refused with a reason when the tree uses a block the new base lacks.
  - Switching to e first awaits `import('./e-base.js')` (6.1).
  - The machine's base is its own state and never calls `bases.setBase`.

### 4.4 Controls

Shortcuts listen on `#machine-stage` and never fire in fields, with one exception: Enter in Input runs the Enter rule.

| Key | Control | Effect |
|---|---|---|
| Enter (Input or stage), →, ↓ | `#machine-step` / `#machine-run` | the Enter rule (4.2) |
| ←, ↑ | `#machine-back` | jump to the start of the previous beat (plans are pure, so this is free) |
| A | `#machine-auto` / HUD bulb | toggle AUTO; remembered in localStorage (try/catch); the default is on, and `&auto=` overrides both |
| Space | `#machine-pause` | freeze or resume mid-beat |
| [ / ] | `#machine-slower` / `#machine-faster` | beat length 0.25, 0.5, 1, 1.5, 2, 3 s, applied **from the next beat** (section 8 lists the key mapping as a deviation) |
| Home / End | | restart / finish |
| R | `#machine-rebuild` | back to beat 0 (PRIME's blocks were consumed; ours are not) |
| T / O | `#machine-centre` / `#machine-overview` | recentre on the active node / fit the whole machine |
| D | `#machine-digits` | place values and digit glyphs |
| P | `#machine-pace` | Carries: together, or one level at a time |
| B | `#machine-base` | cycle 2 → ±3 → e |
| Esc | | leave the field; a second Esc leaves the mode |

**Read along** (`#machine-readalong`) is off by default (PRIME's rhythm) and on under reduced motion. It adds a gap after each beat of max(0, 0.8 + chars/15 − beat length) seconds, capped at **6 s**, enough for a 110-character caption. The Steps list keeps every caption either way.

**Touch:** pinch to zoom; drag the background to pan; tap a tower for a peek of its digits and value.

### 4.5 Camera

- **Following** (PRIME's `CenterOn`): the active node sits 62 units below the stage centre.
- **Framing:** the union of the active node, its towers and pills at the beat's start and end, and its parent socket, padded by 24 px.
  - The scale lies between **18/74 CSS px per unit** (bulbs at least 18 px across) and 1.2.
  - `view.inset` (recording mode, 5.1) shrinks the usable viewport.
  - The opening frames IO, the inputs and the machine as built. When that just misses at the minimum scale (on a phone the root hangs as far below IO as the tallest tower it will hold), it is framed without its margins, centred. When it misses even so (a machine of two rows, (5 + 3) × 7), it is framed from IO down: IO and the inputs keep their margins at the top and the stage reaches as far into the machine as it can, with IO and the root block framed tight if that alone leaves the block out. Never only a wire running off the stage while IO and the root block fit together.
- **Panning when the frame does not fit.** If the box does not fit at the minimum scale, the camera stays at the minimum scale and pans along the tower during the beat:
  - it follows the motion front: the carry being resolved (level pace), the climbing ripple from bottom to top (together pace), A's top (shift), the donor (borrow), or the light (UNFOLD);
  - the pan is eased like the beat, so every moving bulb passes through the frame at ≥ 18 px;
  - **the pan settles**: when the beat's moving bulbs fit the stage at the minimum scale (their towers' pills may not), the beat ends with every one of them on it, 3 px clear of the edge, with their towers whole if those fit, else as much of the pill as that leaves; the next beat starts there. Only bulbs taller than the stage end at the motion front (at 844 × 390 a 15-level tower settles; the 16-level 65025 cannot).
- **Coins far away.** Towers **outside** the active node collapse to coins when their bulbs would draw under 12 px across. The active node's towers never collapse, even in the overview (O).
- **Overrides:** a manual pan or zoom suspends following until T or the next Step.
- The camera is a pure function of t (`cameraAt`), so videos and tests are exact.

### 4.6 Relation to the equation space

- **v1 keeps the equation space's behaviour** for × and ÷ in every base.
- **Watch in the machine** (owned by D):
  - When a × or ÷ term is tapped (and so evaluated) or keyboard-focused in base 2 or balanced ternary, `#watch-machine` appears in the transport bar, reading "Watch 16 × 7 in the machine". The term needs integer operands, parenthesised sums are allowed (`(5+3)×7`), and it must parse in the machine grammar within the limits.
  - It is an ordinary button, so it can be pressed. The peek closes on release (`drag.js` `endPeek`), so it is not a place for actions.
  - It hides when the base changes, another term is focused, the equation is reloaded, or 8 s after the term's animation ends.
  - It opens Machine with `{expression: termText, base}`.
  - Only × and ÷ terms qualify: + and − are not operation terms in the equation space.
  - Every ÷ but the last must divide exactly. The machine's ÷ passes only its quotient up (the remainder fades), so `7 ÷ 2 × 4` would play 3 × 4 = 12 beside the cards' 14; the last ÷ shows its quotient and remainder, as a lone `7 ÷ 2` does.
  - Moving between the modes is a plain mode switch; the earlier row-to-column quarter turn is dropped from v1.
- **To the cards** (`#machine-to-cards`) loads Output's first value into the equation space. The app.js `cards` handler:
  1. calls `showMachine(false)`;
  2. calls `chooseBase(detail.base)`. Machine base ids equal `bases.js` ids. Numbers' handler never changes the base; this one does, because the value's digits belong to that base.
  3. calls `controller.load(String(value))`.

  It is disabled, with the reason as its title, for:
  - irrational base-e values and LN readings: "this value is not a card";
  - |value| > Number.MAX_SAFE_INTEGER: "Too large for the cards: they hold whole numbers up to 9 007 199 254 740 991". `engine.js` would otherwise throw.
- **Phase 5, after v1.** × in base 2 and balanced ternary in the equation space animates the **row form of the split**:
  - one copy of the multiplicand per non-zero multiplier digit, shifted to that place (a red copy for T);
  - the copies are added with `unitPlanMany(…, {sequential: true, base})`.

  It imports nothing from `src/machine`, so lazy loading stays intact. It is gated on `base !== 'decimal'`, so the decimal hashes are untouched, and ÷ keeps the crossfade. The files phase 5 touches are listed in 6.11.
- **Cross-engine test.** The final digits of a machine ADD equal `unitPlanMany`'s final tokens for |a|, |b| ≤ 200 in both bases.

### 4.7 Styles

- **Sketchpad** is PRIME's SKETCH: paper (`textures/swf-24`), ink wires, Garamond.
- **Cyber** realises PRIME's TRON theme, which was defined but never reachable (§1): neon hairlines on black glass, monospace pills, and HUD corner brackets round the active node.
- Both are driven by `ink` plus the new tokens. `machine.restyle()` (called from app.js `onStyle`) redraws the current frame and the `<symbol>` defs.

### 4.8 Phones, tablets and desktop

- **Desktop (≥ 1024 px):**
  - the stage, with the HUD top left and the palette at the bottom (raised on hover);
  - `#machine-side` on the right, with two tabs: **Steps** and **Parts** (the outline, visible; 4.9);
  - the bar above the stage: base, Input, Run, expression, Rebuild, To the cards.
- **Tablet:** the same, with the palette always raised and 48 px blocks.
- **Phone portrait:**
  - the bar wraps to two rows;
  - the stage fills the height, which suits vertical trees and towers;
  - below it come the sentence and caption, a 56 px palette strip that scrolls sideways, and a control row (Step 64 px wide, AUTO, −/+, Back, Rebuild, Pause, Steps, Centre, Overview), with every target ≥ 44 px. It wraps (two rows from 360 to 414 px, in both styles) rather than scrolling any of them out of sight;
  - the options (carries, Digits, Read along, Reduced motion) are at the foot of the Steps sheet, under both tabs, on phones in either orientation: a strip of their own under the control row cost the stage 52 px at the opening, when the camera needs the height most;
  - the HUD is one line along the top of the stage from 375 px wide (two below), and the stage is ≈ 480 px tall at 390×844 and ≈ 300 px at 375×667 at the opening;
  - **during a run** (playing, or paused mid-plan) the palette strip and the bar's second row collapse, giving the stage about 110 px more (≈ 590 px tall at 390×844, room for a 27-level tower at the minimum scale);
  - Steps and Parts open in a bottom sheet;
  - Input is never auto-focused (4.2).
- **Phone landscape** (height < 520 px): the palette (one row that scrolls sideways and folds away during a run) and the controls form a 280 px right rail, like the dock, so Step, Back, AUTO and Pause are on screen from the opening; Take off, while a block is selected, leads the controls, under the palette. The base switch's buttons are 44 px wide like every touch target, and the rail is wide enough for Input beside them. The brand's motto folds away in the mode, so the stage has the height (≈ 330 px at 844×390). Tall towers use the camera pan (4.5).
- **All devices:** safe areas are respected. A `ResizeObserver` recomputes only the camera, because the layout does not depend on the viewport.
- **A header with six buttons.** The browser test asserts no wrap or overflow at 360 × 740. The CSS fallback at ≤ 420 px hides the brand motto, sets nav padding to 4 px, and shows "Equation" as "Eq." through a long/short span pair.

### 4.9 Accessibility and reduced motion

- **One live region** (`#machine-live`, visually hidden, `aria-live="polite"`). Announcements are paced so a screen reader never falls behind:
  - when stepping (AUTO off, or Step pressed) or with Read along on: "caption. sentence." once per beat;
  - under AUTO without Read along: the sentence once per **completed node** (at its RETURN), and the Output.

  The visible `#machine-caption` and `#machine-sentence` are not live, so nothing is announced twice. `#machine-status` is `role=status` (6.7), a polite region of its own: refusals and edits are announced from there and never written to `#machine-live` as well.
- **The sentence line** writes the tree as algebra after each beat:
  - `16 × 7` → `16 × 4 + 16 × 3` → `64 + 16 × 3` → `64 + (16 × 2 + 16 × 1)` → … → `112`;
  - division shows its invariant: `100 = 7 × 12 + 16`.
- **The stage SVG is `aria-hidden`.** `#machine-outline` (`role="tree"`) mirrors the machine and is **visible**: the Parts tab on desktop and the Parts sheet on phones.
  - Nodes and sockets are focusable `treeitem`s with labels such as "× block, left socket: 16, binary 10000".
  - Selecting a socket there and pressing a palette button attaches a block.
  - When the sheet is closed, the outline is `inert`, so keyboard users never tab onto hidden elements.
- **The Steps list** (`#machine-steps`, an `<ol>` of buttons) is both the transcript and keyboard navigation.
- **Shape cues:** a bar on red bulbs and on the red lamp; digit 2 as two bulbs; the Digits view.
- **Reduced motion** (`prefers-reduced-motion`, or the option):
  - each beat holds the before state (0–0.45), crossfades (0.45–0.55), then holds the after state;
  - carries, borrows, shifts and falls are drawn as faint ghost arrows, so no information is lost;
  - the camera cuts;
  - the default beat length is 1.5 s and Read along is on.
- **Haptics** (`haptics.js` kinds):
  - `tick` per beat in step mode;
  - `pop` per annihilation;
  - `thud` when a tower grows past its top;
  - `success` at OUTPUT;
  - `error` on a domain error.

---

## 5. Silent explainer tutorials

### 5.1 Recording

**Already on main** (merge 266f0f2, `feature/led-arithmetic`):
- `record({path})`;
- `ctx.caption(text, seconds)`: about 15 characters per second, at least 1.6 s, with `done()`;
- the MP4 muxed without an audio track when there are no clips;
- the `.srt` that is always written.

**Add (B):**
- `record({…, silent = false, overlay})`.
  - In silent mode, `ctx.say` throws "silent video: use ctx.caption", so no narration slips in. `voice.mjs` stays a static import; it reads no key until `speak()` runs.
  - `overlay` overrides the format's overlay variables per tutorial (6.8).
- `ctx.caption` chunks text longer than `format.captionChars` (64 landscape, 60 portrait) with the existing `chunk()`. Its synthetic word timings are proportional to characters.
- `ctx.caption(text, seconds, {at: 'top'})` places a caption in the top band, for build scenes where the bar and palette are on screen.
- `ctx.key(key, {label})`: DevTools `Input.dispatchKeyEvent` keyDown and keyUp, plus an overlay keycap `__rec.key(label)` that fades over 0.6 s.
- `ctx.type(selector, text)`: tap the element, then `Input.insertText` one character per 80 ms of video.
- `ctx.machine`, through the automation hook:
  - `load(params)`, `beats()`, `state()`;
  - `chrome(mode)`: `'build'` shows the bar and palette; `'run'` hides them (the recording-mode default);
  - `until(i | 'end')`: frames advance until beat i has ended;
  - `stretch(i, seconds)`: waits for beat i, then plays it over `seconds` via `ctx.stretch`;
  - **`captionBeat(i, {extra, min})`:** shows the plan's own caption for beat i and stretches the beat to max(min ?? 1.5, reading time of the caption) seconds. AUTO therefore never moves on before the caption has been read, and a subtitle can never disagree with the maths.
- **App recording mode** (`&recording`, D):
  - hides `#machine-caption`, `#machine-sentence`, `#machine-side`, the Steps sheet and the control row, plus the bar and palette unless `chrome('build')` is set;
  - gives the camera a bottom inset equal to the burned-in caption band (landscape 120 CSS px, portrait 170 CSS px).

  The burned-in caption therefore never covers the in-app text or controls, and never covers a moving bulb.
- `__rec.bulbTitle({bits, base, title, subtitle})` in `page.js`: title and end cards with a row of CSS radial-gradient bulbs in theme colours.
- `tools/video/machine-tutorials.mjs` holds the ten entries, each with `silent: true` and `path: '/?machine…&automation&recording'`.
- **Selection in `make-videos.mjs`:**
  - with no names, `npm run videos` still renders **only the three narrated videos**, as the README promises;
  - `--silent` (and `npm run videos:machine`) selects the machine set;
  - names may come from either set, and unknown names list both.

  Output goes to `videos/machine/<name>-<format>.mp4` plus `.srt`. ElevenLabs is never needed.

### 5.2 Formats

- **Landscape** 1920×1080 (1280×720 CSS × 1.5) and **portrait** 1080×1920 (540×960 × 2), at 30 fps.
- **Captions** are burned in, with an `.srt` sidecar.
  - Machine videos pass `overlay: {'caption-bottom': '40px'}` in portrait. Recording mode hides the bottom rows, so the studio default of 240 px, which clears the equation space's controls, is not needed.
  - Landscape keeps 10 px.
- **Pacing:** each beat lasts max(1.5 s, the caption's reading time) through `captionBeat`, and key beats are stretched to about 3–4 s.
- **Per format:** landscape zooms the camera 1.2× and hides the palette after building; portrait uses the default layout.
- One script serves both formats, because the layout does not depend on the viewport.

### 5.3 Storyboards

*(plan)* marks a caption taken from the plan with `captionBeat`. All other text is written here and is normative. Lengths are estimates at reading pace.

**V1 `machine-multiply`, "16 × 7 in lights"** (about 100 s, binary)
1. Title: bulb row 1110000. "Multiplying in lights" / "16 × 7 as shifts and sums"
2. `load({tree: {}})` (`?machine=empty`), chrome build, top captions: "A function machine: numbers in, numbers out."
3. Tap the triangle's socket, then tap ×: "Hang a × block under the triangle."
4. Type `[16,7]`: "Type the two numbers: [16,7]."
5. Keycap Enter; input, deliver; chrome run: "Press Enter. The numbers drop down the wire."
6. Fanout, Digits on: "Each number is a tower of bulbs." / "Each level is worth twice the one below."
7. Hold on 111: "7 has three lit bulbs: 4 + 2 + 1."
8. Split (3 s): *(plan)*
9. Shift ×4 (4 s): *(plan)*, then "The top bulb of 4 vanishes: × 1 changes nothing."
10. Return: *(plan)*
11. Split, shift, return, shift, return: *(plan)* each
12. Collide 32 + 16 (3 s): "Adding is a collision, level by level." *(plan)*
13. Collide 64 + 48: "No two lit bulbs meet, so nothing carries." *(plan)*
14. Output: "112: three shifts and two sums."
15. Cut to `[7,16]`: "Swap them: 16 has one lit bulb," / "so 7 × 16 is a single shift."
16. End card: "Multiply = split into shifts, then add."

**V2 `binary-carry`, "Carries climb"** (about 75 s, level pace)
1. Title: "Carries climb"
2. ADD `[13,9]`, collide stretched: "13 + 9: the bulbs fly across and wait beside their own levels."
3. "Two lit bulbs meet: the resident climbs a level, the newcomer goes dark."
4. "The climbing bulb lands on a dark level and stays." / "10110 = 22."
5. `[6,3]`: "A carry lands on a lit bulb: that bulb climbs on, and the carry stays dark." / "1001 = 9."
6. `[7,1]`: "7 + 1: each lit bulb hands its light one level up…" / "…and the column grows: 1000 = 8."
7. `[13,3]` with Carries: together: "PRIME does the whole chain in one beat. A carry is always lit as it climbs."
8. End: "A carry is a bulb that climbs one level."

**V3 `binary-negative`, "Red bulbs and borrowing"** (about 70 s)
1. "Negative numbers are red: −5." (red 101)
2. SUB `[12,5]`, negate, the minus turns into a plus: "Subtracting 5 adds −5."
3. Collide: "A blue and a red bulb on one level cancel."
4. "A red bulb on a dark level is owed."
5. Borrow (4 s): "The nearest blue bulb above comes down," / "lighting every level it passes," / "and pays the debt at the bottom." / "111 = 7."
6. `[5,12]`: "The larger tower receives, so the answer is red: −7."
7. End: "Borrowing is a carry run backwards."

**V4 `binary-shift-divide`, "Shifts and long division"** (about 95 s)
1. SHL `[5,3]`: "×2³: three dark bulbs slide in; 5 rises three levels." / "40."
2. SHR `[45,2]`: "÷2²: the bottom two bulbs fall out: the remainder." / "11 r 1."
3. DIV `[45,6]`, prep: "Lift a copy of 6 to the height of 45: 48."
4. Compare: "Does 48 fit under 45? No: quotient bulb 3 stays dark."
5. Descend: "Drop one level: 24."
6. Compare, collide, borrow: "24 fits: subtract it and light quotient bulb 2."
7. Remaining rounds at 2×: "12 fits. 6 fits."
8. Output `[7, 3]`: "45 = 7 × 6 + 3."
9. End: "Division is comparing and subtracting, top level first."

**V5 `binary-logic`, "Gates in lights"** (about 95 s)
1. AND `[12,10]`: "AND: a dark bulb wins." / "8."
2. OR: "OR: a lit bulb wins." / "14."
3. XOR: "XOR: two lit bulbs make a carry that evaporates." / "6."
4. Expression `(12^10)+((12&10)<<1)` (chrome build, top captions): "What stays is XOR. What climbs is AND." / "Shift AND up a level and add: 22 = 12 + 10."
5. NOT `[5]`: "NOT flips every bulb, and the lamp above the top lights red:" / "every level above is lit, forever. Together they are worth −6."
6. AND `[-5,3]`, complement: "A red number enters a gate by flipping and adding one." / "3."
7. End: "Logic never moves a bulb up or down."

**V6 `ternary-basics`, "Blue, dark, red"** (about 70 s)
1. "Balanced ternary: each level is worth 3 of the one below."
2. "A bulb is +1 (blue), 0 (dark) or −1 (red)."
3. Tower 1TT: "5 = 9 − 3 − 1."
4. NEG: "Swap the colours and you have −5. No minus sign needed."
5. ADD `[5,7]`: "Blue meets red: they cancel."
6. "Two reds make one red carry and leave a blue: −2 = −3 + 1."
7. Result 110: "12."
8. COMP `[5,-5]`: "Comparing reads from the top: blue wins."
9. End: "Three states, no signs."

**V7 `ternary-multiply-divide`** (about 100 s)
1. MULT `[16,7]`: "7 = 9 − 3 + 1."
2. Split: *(plan)*
3. Shift ×9: "×9: rise two levels."
4. Shift ×(−3): "×(−3): rise one level and swap every colour."
5. Collides: "Red carries climb too." / "112: same answer, different journey."
6. DIV `[19,5]`, try: "Try subtracting 15 from 19…"
7. Judge: "…4 is nearer zero than 19: keep it."
8. Next round: "4 − 5 = −1 is nearer zero than 4: keep it."
9. Output `[4, −1]`: "19 = 4 × 5 − 1: ternary rounds to the nearest."
10. `[14,4]` last round: "2 or −2: equally near zero." / "A tie keeps the dividend's sign: 14 = 3 × 4 + 2."
11. End: "The remainder is never more than half the divisor."

**V8 `ternary-logic`** (about 75 s)
1. MIN `[2,1]`: "MIN keeps the lower state: red, then dark, then blue." / "−1."
2. MAX: "MAX keeps the higher." / "4. Level by level, not number by number."
3. SUM `[5,7]`: "SUM adds each level and throws the carry away." / "−6."
4. CONS `[5,7]`: "CONS keeps a level only where both agree: the carries." / "6."
5. Expression `sum(5,7)+(cons(5,7)<<1)` (chrome build): "−6 + 3 × 6 = 12 = 5 + 7."
6. End: "SUM and CONS do for 3 what XOR and AND do for 2."

**V9 `e-towers`, "Base e: towers that never end"** (about 80 s)
1. "Base e: each level is worth e ≈ 2.718 of the one below."
2. Close-up of a level: "A level has room for e bulbs: two, and a sliver."
3. e, e², 2, 1 + e: "e = 10ₑ, e² = 100ₑ, 2 = 2ₑ."
4. e² + 2: "102ₑ is exactly e² + 2."
5. MEASURE `[3]`, unfold: "3 = 10.02…: the light leaves one bulb at level 1, two at level −2…"
6. Dust close-up: "…and what is left never runs out: e is transcendental."
7. "Only 0, 1 and 2 end."
8. ×e² on 3: "×e² is a shift: two levels up, and a 1 condenses out of the dust." / "1002.001…ₑ"
9. ×e³ on 2: "×e³: three levels up." / "2000ₑ."
10. End: "Shifts are exact; whole numbers never end."

**V10 `e-logarithms`, "Adding and multiplying with logarithms"** (about 100 s)
1. Fold two bulbs at level 0: "Merge two bulbs: the light rises ln 2 = 0.69."
2. Three bulbs: "Three rise ln 3 = 1.099: past the next level."
3. Unfold: "One bulb lands at level 1; the change falls on, forever."
4. Inset, binary 1 + 1: "In base 2, two bulbs rise exactly one level: a carry."
5. ADD `[16,7]`, pile, fold: "Pile them up and merge to one light at height ln 23."
6. Unfold: "Let it fall: it leaves bulbs where it can afford them." / "1010.011…ₑ"
7. `22ₑ`: "Even 22ₑ is too full: 2e + 2 is more than e²."
8. MULT `[16,7]`, fold: "Fold both: ln 16 = 2.77, ln 7 = 1.95."
9. Slide: "Multiplying adds heights: 2.77 + 1.95 = 4.72."
10. "Levels 2 + 1 = 3, but 112 stands at level 4: the heights carried."
11. Unfold to 20010.001…ₑ: "112."
12. LN block: "The height of the folded light is ln."
13. End card, bases 2, 3 and e side by side: "The cost of a base, b ÷ ln b: 2.885, 2.731, 2.718."

All ten together run about 15 minutes per format.

### 5.4 In-app guided lessons (phase 5, owner D)

- **A separate list.** Lessons live in `src/machine/lessons.js` as their own list, **not** in `tutor.js` `lessons`.
  - `app.js` appends them to the lesson dialog under a *Machine* heading and starts one with `startMachineLesson(lesson)`, which opens Machine.
  - `startMachineLesson` never calls `startLesson`, never touches `EquationModel`, and never forces the equation base to decimal.
  - So `tests/physics-tutor.test.js`, which runs every `tutor.js` lesson with `!l.graph` through `EquationModel`, and "lessons count in tens" are unaffected.
- **Flow:** Watch (AUTO, level pace) → **Predict** → **Your turn**, with fresh inputs from `tutor.js` `random(seed)` and 200 problems tested per lesson in `tests/machine-lessons.test.js`.
- **Predict** pauses before chosen beats. Examples: "Which level will the carry land on? Tap it", "Keep or discard?", "Which level is ⌊ln x⌋?".
- **Lessons:** Split and shift; Carries climb; Borrowing; Long division; Gates; Trits; Closest to zero; Base-e fold.
- **Data:** `{id, base, tree, make(r), pauses: [{beatKind, question, answer(plan, beat)}]}`.

---

## 6. Engineering contract

### 6.1 Files and owners

The owners A–D are defined in section 7.

| File | Owner | Responsibility |
|---|---|---|
| `src/machine/bigmath.js` | A | BigInt digits, two's complement with lamp normal form, tritwise ops, both division conventions, formatting (own BigInt digit text with `bases.js`'s `₂` / ` bal₃` suffixes) |
| `src/machine/oracle.js` | A | reference results for every binary and ternary op, with no animation |
| `src/machine/registry.js` | A | `registerBase` / `getBase` / `hasBase`: the frozen base contract (6.6) |
| `src/machine/bt-base.js` | A | registers `binary` and `ternary` (parse, evaluate, display, validateTower, place, ops) |
| `src/machine/tree.js` | A | machine trees, input and expression parsing (values through the registry), palettes, `evaluateTree`, `sentence` (reads `Tower.text`) |
| `src/machine/scene.js` | A | `applyDiff`, `snapshotAt`, `diffScenes` (reference code in 6.2) |
| `src/machine/builder.js` | A | `PlanBuilder`, the only way planners write beats; fills display strings through the registry |
| `src/machine/plan.js` | A | `planMachine` (pre-check, then dispatch through the registry), flow beats (input/deliver/fanout/return/output), `LIMITS`, `validatePlan`, `evaluateScene` |
| `src/machine/captions.js` | A | caption templates for the shared kinds and the binary/ternary ops |
| `src/machine/ops/{collide,borrow,multiply,shift,divide,compare,logic}.js` | A | binary and ternary planners |
| `src/machine/e-exact.js` | B | exact Q[e, 1/e], certified sign and compare, greedy digits, legality, `height` |
| `src/machine/ops/e.js` | B | base-e planners (pile, legal, fold, unfold, slide, meet, race, read, measure, zero) |
| `src/machine/e-base.js` | B | registers `e` when imported; nothing imports it statically |
| `tools/make-e-fixture.mjs`, `tests/fixtures/base-e.json`, `tests/fixtures/machine/e-*.json` (except `e-measure-3.json`), `tests/machine-e-baselines.json` | B | an independent 80-digit fixed-point oracle and its output; base-e plan fixtures and their snapshot hashes |
| `tools/video/studio.mjs`, `tools/video/page.js`, `tools/video/machine-tutorials.mjs`, `tools/make-videos.mjs` | B | silent recording and the ten videos |
| `src/machine/layout.js` | C | the normative layout (6.3b); `cameraAt` |
| `src/machine/render.js` | C | pure SVG renderer, symbols, block glyphs, digit glyphs; reads strings only |
| `src/machine/scenes.js` | C | named plans for snapshots and the test bench (binary/ternary through `planMachine`; base e from `tests/fixtures/machine/e-*.json` files when present) |
| `src/mvc/theme.js` | C | `bulb.amber` and `machine` tokens in both styles |
| `src/mvc/view.js` | C | an optional trailing `palette` parameter on `bulb` and `socket` (byte-identical default) |
| `tools/machine-visual-tests.mjs`, `tests/machine-baselines.json`, `tests/fixtures/machine/{plan-5x11-binary,plan-5xm4-ternary,e-measure-3}.json` | C | machine snapshots and the full-plan fixtures from 6.4 and 6.5 |
| `src/machine/clock.js` | D | `schedule`, `BeatClock` (the Enter rule's step semantics) |
| `src/machine/machine-app.js` | D | `MachineView`: DOM, input, palette, building, keys, camera override, a11y, haptics, hook, recording mode; lazy-imports `e-base.js` |
| `index.html`, `src/mvc/app.js`, `src/mvc/style.css`, `src/mvc/cyber.css`, `src/native.js`, `tools/build.mjs`, `package.json`, `tools/interaction-tests.mjs`, `tools/perf.mjs`, `README.md`, `docs/verification.md` | D | the mode shell, Watch in the machine, To the cards, styles, routing, build, browser and perf tests, docs |
| `src/machine/lessons.js`, `tests/machine-lessons.test.js` | D (phase 5) | guided lessons |

### 6.2 Shared formats

**Value strings.**
- Binary and ternary: decimal BigInt strings (`"-20"`).
- Base e: `E.key()` canonical text. Terms are in descending exponent, the coefficient is omitted when 1, and rationals are written `p/q`. Examples: `"e^2+2"`, `"2e+2"`, `"3-e"`, `"1/3"`, `"e^-1"`.
- **Display strings are separate fields** (`text`, `approx`, `digits`, `reading`), written by planners through the registry's `display`. Captions and display use U+2212, and negative operands are parenthesised after an operator.

```ts
type Base = 'binary' | 'ternary' | 'e';
type OpId = 'add'|'sub'|'mul'|'div'|'mod'|'cmp'|'shl'|'shr'|'and'|'or'|'xor'|'not'
          | 'min'|'max'|'sum'|'cons'|'neg' | 'mule'|'measure'|'ln';
type NodeId = string;            // 'n1', 'n2', … never reused
type Place = `in:${number}` | `io:${number}` | `out:${number}`
           | `${NodeId}.${'L'|'R'|'C'|'Q'}` | `${NodeId}.C:${number}`;  // Q quotient register; C:i coin slot
interface Node  { op: OpId; parent: NodeId | 'io'; socket: 'L'|'R'|'C';
                  glyph?: number /*alpha, default 1*/; tilt?: -1|0|1;
                  arg?: string   /*DIV/MOD: the divisor, for evaluateScene*/;
                  pile?: true }  /*base e: a split-born + that piles without normalising*/
interface Tower { at: Place; form: 'tower'|'coin'|'light'; value: string;
                  text: string;          // pill line 1: '112', '−20', 'e² + 2', '13 + 9' while pending
                  approx?: string;       // base e, non-integer: '≈ 9.389'
                  digits?: string;       // '1110000₂', '11011 bal₃', '20010.001…ₑ', '…1010₂'
                  reading?: string;      // light towers: 'ln 112 ≈ 4.7185'
                  note?: string;         // '×2³', 'q', 'r 3'
                  pending?: true;        // level pace: lanes in use, exempt from I3 until the last carry beat
                  pile?: true;           // base e: not normalised
                  dust?: true;           // base e: exact non-zero remainder below level −3
                  ghost?: true }         // drawn at .55 (ternary TRY)
interface Bulb  { t: string; l: number; s: -1|0|1;
                  slot?: number;   // base e: 0, 1 sockets; 2 sliver/overhang; ≥ 3 perched.
                                   // binary/ternary (level pace only): 1 = left lane (x −84), 2 = right lane (x +84)
                  k?: 'lamp'|'light';   // sign lamp (binary logic) or base-e light (l may be fractional)
                  o?: 1 }               // owed (binary, between COLLIDE and the last BORROW)
interface Scene { nodes: Record<NodeId, Node>; towers: Record<string, Tower>; bulbs: Record<string, Bulb> }
type Patch<T> = Partial<T> | null;      // null deletes; a new id carries the full object; a field set to null is removed
interface Diff  { nodes?: Record<string, Patch<Node>>; towers?: Record<string, Patch<Tower>>; bulbs?: Record<string, Patch<Bulb>> }
interface Motion {                      // the closed set of overrides; semantics in 6.3
  from?: {t: string, l: number, slot?: number}; to?: {t: string, l: number, slot?: number};
  move?: [number, number]; state?: [number, number]; fade?: [number, number]; in?: [number, number];
  via?: {s: -1|0|1, at?: [number, number]};   // in-flight colour, default at [0, 0.3]
  dissolve?: true; burst?: true; grow?: true; path?: [number, number][] }   // path: [u, level] keyframes
type Mark = {k: 'ring', t: string, l: number}
          | {k: 'scan', node: NodeId, from: number, stop: number | null}
          | {k: 'verdict', node: NodeId, s: -1|0|1};   // transient COMPARE verdict inside DIV
type BeatKind = 'input'|'deliver'|'fanout'|'split'|'shift'|'zero'|'drop'|'collide'|'carry'|'borrow'|'negate'
              | 'compare'|'gate'|'flip'|'addone'|'prep'|'descend'|'try'|'judge'|'clear'
              | 'pile'|'legal'|'fold'|'unfold'|'slide'|'meet'|'race'|'read'|'return'|'output';
type Ledger = {law: 'move', value?: string} | {law: 'split', a, b, t, r} | {law: 'shift', a, m, k, sign, out}
  | {law: 'zero', a, b, out} | {law: 'sum', a, b, out} | {law: 'negate', a, out} | {law: 'regroup', value}
  | {law: 'power', k, out} | {law: 'gate', op, a, b?, out} | {law: 'complement', step: 'flip'|'addone', a, out}
  | {law: 'compare', a, b, out} | {law: 'divstep', a, b, q, r} | {law: 'quotient', a, b, q, r}
  | {law: 'fold', value, h} | {law: 'unfold', value} | {law: 'slide', a, b, out}
  | {law: 'read', value, h};             // all operands are value strings
interface Beat  { i: number; kind: BeatKind; node: NodeId | 'io'; dur?: number /*default 1; 0.5 for level-pace carry*/;
                  caption: string; ledger: Ledger; set: Diff; motion?: Record<string, Motion>; marks?: Mark[] }
interface Plan  { v: 1; base: Base; pace: 'together'|'level'; tree: Record<NodeId, Node>; inputs: string[];
                  start: Scene; beats: Beat[]; result: {values: string[]; text: string; label?: string /*'q 7 · r 3'*/};
                  stats: {beats: number; nodes: number; maxLevels: number; maxBulbs: number} }
```

**Start-scene ids.** Inputs become towers t1, t2, … in order. Bulbs are numbered b1, b2, … through t1's levels bottom-up, then t2's, and so on.

**Scene arithmetic (reference code, normative):**

```js
// scene.js — scenes[0] = plan.start; scenes[i+1] = applyDiff(scenes[i], beats[i].set)
export function applyDiff(scene, diff) {
  const out = {nodes: scene.nodes, towers: scene.towers, bulbs: scene.bulbs};
  for (const key of ['nodes', 'towers', 'bulbs']) {
    const patch = diff[key]; if (!patch) continue;
    const next = {...scene[key]};
    for (const [id, p] of Object.entries(patch)) {
      if (p === null) { delete next[id]; continue; }
      next[id] = id in next ? {...next[id], ...p} : {...p};
      for (const f in p) if (p[f] === null) delete next[id][f];   // a field set to null is removed
    }
    out[key] = next;
  }
  return out;
}
const memo = new WeakMap();
export function snapshotAt(plan, i) {           // 0 ≤ i ≤ plan.beats.length
  let list = memo.get(plan); if (!list) memo.set(plan, list = [plan.start]);
  while (list.length <= i) list.push(applyDiff(list.at(-1), plan.beats[list.length - 1].set));
  return list[i];
}
export function diffScenes(a, b) { /* inverse of applyDiff: new ids full, changed fields only, removed → null */ }
```

**Rules for writing plans:**
- BigInt values never appear as JS BigInt in a plan, only as strings, so plans are JSON round-trip safe and can be snapshotted.
- Every tower carries `text`; `digits`, `approx` and `reading` are present when they apply. `PlanBuilder` fills them from `getBase(base).display(value, {form})` whenever `value` or `form` changes, unless the planner sets `text` itself (pending sums).
- Base-e light heights and path keyframes are `height(x)` (3.2): rounded to 4 decimals and clamped below the next level. Deposit times are rounded to 4 decimals.

### 6.3 Renderer semantics (normative)

**Time.** t is measured in beat units on the plan's own clock; `dur` is applied by the clock, not the renderer.
- **Beats are half-open.**
  - t = 0 draws `renderStatic(start)`.
  - For t ∈ (i, i + 1], the renderer draws beat i at u = t − i. So the frame at integer t = i ≥ 1 is beat i − 1 at u = 1.
- For a window [a, b], v = clamp((u − a)/(b − a), 0, 1), and every motion uses ease(v) = 1 − (1 − v)².

`P_i(b)` is a bulb's position in scene i:
- `layout.place(tower.at)`, plus the slot or lane x offset (6.3b),
- minus `pitch·l` in y, where pitch is 84 for towers and lights and 6 for coins.

| Bulb case | Position | Opacity | Colour |
|---|---|---|---|
| in S_i and S_{i+1} | lerp(P_i, P_{i+1}) over `move` (default [0, 1]); with `path`, the level follows the keyframes, eased per segment | 1 | s_i → `via.s` over `via.at` (default [0, 0.3]) if `via`; then → s_{i+1} over `state` (default [0.6, 1]) |
| only in S_i (removed) | from P_i to the `to` target, evaluated with S_{i+1}'s placement (slot omitted = column); otherwise its own position, carried along if its tower moves; `path` overrides the level | 1 − ease over `fade` (default [0.3, 1]; **[0.6, 1] when `burst`**); `dissolve`: the core brightens over [0, 0.5] while it fades over [0, 1] | s_i → `via.s` over `via.at` if `via`; otherwise s_i |
| only in S_{i+1} (born) | `from` given: lerp(P_i(from), P_{i+1}); otherwise P_{i+1} | `from` given: 1; otherwise ease over `in` (default [0, 0.3]); `grow`: scale .25 → 1 over `in` | s_{i+1} |

**Light paths and deposits (normative; the planner writes them and the renderer only interpolates):**
- With n deposit events (levels with d_k > 0, top down to the floor):
  - keyframe j (0 ≤ j ≤ n) sits at u_j = 0.9·j/n, at height h_j = height(remainder before event j);
  - the final keyframe h_n is height(dust), but never below the rail's end at −14 (6.10: the fading tail of a value just off a numeral, such as 9545/25946 = 0.100…ₑ with dust at −21, is no reason to refuse the run), or, when the result is exact, the level of the last deposit.
  - In level pace, each deposit is its own beat with n = 1.
- Within segment j, the light's height is h_j + (h_{j+1} − h_j)·ease((u − u_j)/Δ), with Δ = u_{j+1} − u_j.
- Deposit j at level k_j crosses at f_j = (h_j − k_j)/(h_j − h_{j+1}). Its bulbs are born with **`in` = [c_j, c_j + 0.081]**, where **c_j = u_j + Δ·(1 − √(1 − f_j))**, the inverse of the ease. Every bulb is therefore born within 0.05 level of the light (tested).
- The light fades over [0.9, 1].

**Other elements:**
- **Bursts.** `burst` on removed bulbs draws one `cancel-burst` per distinct (tower, level) end position over [0.6, 1], with opacity 1 − ease, so it is 0 at u = 1.
- **Towers.**
  - The label text is the old text until u = 0.9, then the new text, positioned 42 above the top bulb's current position.
  - `ghost`: opacity .55.
  - A `light` tower draws its rail with integer ticks from min(−3, ⌊h⌋) to top + 1 and its `reading`.
  - `dust`: an amber haze under level −3 with "…".
  - Base-e levels always draw two sockets and the sliver from the floor to max(top, 0).
  - `lamp` bulbs get two ghost bulbs above.
  - Lane bulbs have no digit glyphs.
- **Nodes.**
  - A born node slides from its parent's centre to its place over [0, 1] while its wire grows.
  - A removed node's wire reels into the parent socket over [0, 1], and its glyph fades over [0, 0.5] if not already 0.
  - An `op` change crossfades the glyph over [0, 0.15]; `glyph` and `tilt` interpolate over [0, 1].
  - `view.highlight` outlines one node in `machine.error`, used for domain errors on a static frame.
- **Beads by kind:**
  - `input`: Input pill → IO;
  - `deliver`: IO → root;
  - `return`: node → parent socket;
  - `output`: IO → Output pill.
- **Marks.** Marks are visible only during their beat: they fade in over [0, 0.1] and out over [0.9, 1].
  - `ring`: an r6 amber outline beside the tower at that level.
  - `scan`: a bar descending from `from` to `stop` over [0.3, 0.8].
  - `verdict`: the node's chevrons flash in the verdict's colour over [0.8, 1].
- **Omission.** Any element whose opacity rounds to 0 is omitted. With half-open beats, this is what makes the beat-boundary property exact: every fade, burst and mark is invisible at u = 1, and every `from`-born bulb or born node has reached its place.
- **Reduced motion.** The frame at u is S_i for u < 0.45, a crossfade for 0.45 ≤ u ≤ 0.55, and S_{i+1} after. Ghost arrows (opacity .35) mark every level change of the beat.
- **Determinism.** No clock, no randomness, no DOM. Every coordinate is rounded to 3 decimals (view.js `round`).
- **Strings.** The renderer reads `text`, `approx`, `digits`, `reading` and `note`, and never formats a value. It imports nothing from `e-exact.js`, `bigmath.js` or `bases.js`.
- **Symbols.** Bulbs are drawn as `<use href="#m-bulb-blue">` and friends, from `machineDefs`.

### 6.3b Layout (normative; `layout.js`)

All coordinates are machine units, with y pointing down. The layout is a pure function of the plan: it scans every scene, so nothing depends on the viewport, and positions are fixed for the plan's life.

1. **Nodes.** The node set is every node present in any scene. Born split nodes are included, and the union tree is well defined because a node id's parent never changes.
2. **Places relative to the node centre:**
   - `.L` = (−socketX, 0) and `.R` = (+socketX, 0), with socketX = 88 (150 in base e);
   - `.C` = (0, 0);
   - `.Q` = (x_Q, 0), where x_Q = max(264, rightmost extent of any pill ever shown at `.R` + 8 + 37);
   - `.C:i`: the i-th of m coins at (96·(i − (m − 1)/2), −88);
   - lanes: slot 1 at x −84 and slot 2 at x +84 from the tower's place;
   - base-e slots: x −34, +34 and +102 at scale .8; perched bulbs stack above the level at scale .7, 30 apart;
   - level l: y −84·l for towers and lights, −6·l for coins;
   - IO = (0, 0); Input pill (−162, −94); Output pill (+162, −94); `in:i`, `out:i` and `io:i` slots inside and under them.
3. **Pills.**
   - Width 24 + 17·(the longest line's characters), height 36 per line. The width is a fixed estimate, so it does not depend on the style.
   - Each pill sits 42 above its top bulb, centred, but `.L` pills keep their right edge ≤ −14 and `.R` pills keep their left edge ≥ +14 (they shift outward).
   - A node's notes and the DIV register's pill follow the same rule.
4. **Extents.** A node's half-width W(n) is the maximum over its places of |x| + the place's horizontal extent:
   - bulb 37 + digit gutter 48 + place-value column 56 on the leftmost place;
   - lanes 84 + 37;
   - pill extents;
   - a two-socket block's socket rings, socketX + 44, and the 8 of a selected socket's mark: a machine still being built has no towers to widen it, and siblings packed by their faces alone overlapped rings, so a tap on one socket picked its neighbour.

   up(n) is the highest point above the centre line of any tower, lane, pill or rail in n's places over all scenes, at least 44. down(n) is the lowest point below it: 37 for binary/ternary, 84·(−minLevel) + 37 in base e including rails and dust, at least 44.
5. **Rows.**
   - Nodes at depth d share row d, with up_d = max up(n) and down_d = max down(n) in the row.
   - y_1 = 60 (the triangle's tip) + up_1 + 36; y_{d+1} = y_d + down_d + 36 + up_{d+1}.
   - IO therefore sits above the root by the root row's clearance.
6. **Columns.** A Reingold–Tilford tidy tree on the union tree, with node widths 2·W(n), 36 units between subtree contours, children in socket order, and the root at x = 0.
7. **Wires** are elbows:
   - from the parent socket (x_p ± socketX, y_p) straight down to the row-gap midline y_p + down_d + 18;
   - across to the child's x;
   - down to the child's hub (x_c, y_c − 44).

   The vertical drop into a child passes between its `.L` and `.R` towers and pills (rules 3 and 4). IO's wire drops straight to the root hub.
8. **Boxes.** `towerBox(scene, id)` is its bulbs, lanes, slots, rail, dust and pill, plus the digit gutter (the worst case, with Digits on). `nodeBox(id)` is the block. `wire(id)` is the polyline.
9. **The layout test** (`tests/machine-layout.test.js`). At every beat boundary of every golden plan and named scene:
   - no tower box intersects another tower's box, any node box other than its own node's block, or any wire other than its own node's incoming wire (a tower at a node's `.C` sits on the wire it is about to ride);
   - no two pills overlap;
   - positions never change during a plan.

### 6.4 Worked plan: 5 × 11 in binary

This is the fixture `tests/fixtures/machine/plan-5x11-binary.json`; the planner's output must deep-equal it. It reproduces PRIME §4.6, with the label on top and 12 beats between FANOUT and OUTPUT.

```json
{"v":1,"base":"binary","pace":"together","tree":{"n1":{"op":"mul","parent":"io","socket":"C"}},"inputs":["5","11"],
 "start":{"nodes":{"n1":{"op":"mul","parent":"io","socket":"C"}},
  "towers":{"t1":{"at":"in:0","form":"coin","value":"5","text":"5","digits":"101₂"},"t2":{"at":"in:1","form":"coin","value":"11","text":"11","digits":"1011₂"}},
  "bulbs":{"b1":{"t":"t1","l":0,"s":1},"b2":{"t":"t1","l":1,"s":0},"b3":{"t":"t1","l":2,"s":1},"b4":{"t":"t2","l":0,"s":1},"b5":{"t":"t2","l":1,"s":1},"b6":{"t":"t2","l":2,"s":0},"b7":{"t":"t2","l":3,"s":1}}},
 "beats":[
 {"i":0,"kind":"input","node":"io","caption":"[5, 11] goes in.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"io:0"},"t2":{"at":"io:1"}}}},
 {"i":1,"kind":"deliver","node":"n1","caption":"The numbers ride down the wire to the × block.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C:0"},"t2":{"at":"n1.C:1"}}}},
 {"i":2,"kind":"fanout","node":"n1","caption":"5 and 11 drop into the sockets and stand up.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.L","form":"tower"},"t2":{"at":"n1.R","form":"tower"}}}},
 {"i":3,"kind":"split","node":"n1","caption":"11 = 8 + 3, so 5 × 11 = 5 × 8 + 5 × 3.","ledger":{"law":"split","a":"5","b":"11","t":"8","r":"3"},"set":{"nodes":{"n1":{"op":"add"},"n2":{"op":"mul","parent":"n1","socket":"L"},"n3":{"op":"mul","parent":"n1","socket":"R"}},"towers":{"t1":{"at":"n2.L"},"t2":{"at":"n2.R","value":"8","text":"8","digits":"1000₂"},"t3":{"at":"n3.L","form":"tower","value":"5","text":"5","digits":"101₂"},"t4":{"at":"n3.R","form":"tower","value":"3","text":"3","digits":"11₂"}},"bulbs":{"b4":{"t":"t4"},"b5":{"t":"t4"},"b8":{"t":"t3","l":0,"s":1},"b9":{"t":"t3","l":1,"s":0},"b10":{"t":"t3","l":2,"s":1},"b11":{"t":"t2","l":0,"s":0},"b12":{"t":"t2","l":1,"s":0}}},"motion":{"b8":{"from":{"t":"t1","l":0}},"b9":{"from":{"t":"t1","l":1}},"b10":{"from":{"t":"t1","l":2}}},"marks":[{"k":"ring","t":"t2","l":1}]},
 {"i":4,"kind":"shift","node":"n2","caption":"5 × 8: 3 dark bulbs slide under 5; it rises 3 levels. 40.","ledger":{"law":"shift","a":"5","m":"8","k":3,"sign":1,"out":"40"},"set":{"nodes":{"n2":{"glyph":0}},"towers":{"t1":{"at":"n2.C","value":"40","text":"40","digits":"101000₂"},"t2":null},"bulbs":{"b1":{"l":3},"b2":{"l":4},"b3":{"l":5},"b6":{"t":"t1"},"b7":null,"b11":{"t":"t1"},"b12":{"t":"t1"}}},"motion":{"b7":{"to":{"t":"t1","l":3},"dissolve":true}}},
 {"i":5,"kind":"return","node":"n2","caption":"40 rides up.","ledger":{"law":"move","value":"40"},"set":{"nodes":{"n2":null},"towers":{"t1":{"at":"n1.L"}}}},
 {"i":6,"kind":"split","node":"n3","caption":"3 = 2 + 1, so 5 × 3 = 5 × 2 + 5 × 1.","ledger":{"law":"split","a":"5","b":"3","t":"2","r":"1"},"set":{"nodes":{"n3":{"op":"add"},"n4":{"op":"mul","parent":"n3","socket":"L"},"n5":{"op":"mul","parent":"n3","socket":"R"}},"towers":{"t3":{"at":"n4.L"},"t4":{"at":"n4.R","value":"2","text":"2","digits":"10₂"},"t5":{"at":"n5.L","form":"tower","value":"5","text":"5","digits":"101₂"},"t6":{"at":"n5.R","form":"tower","value":"1","text":"1","digits":"1₂"}},"bulbs":{"b4":{"t":"t6"},"b13":{"t":"t5","l":0,"s":1},"b14":{"t":"t5","l":1,"s":0},"b15":{"t":"t5","l":2,"s":1},"b16":{"t":"t4","l":0,"s":0}}},"motion":{"b13":{"from":{"t":"t3","l":0}},"b14":{"from":{"t":"t3","l":1}},"b15":{"from":{"t":"t3","l":2}}},"marks":[{"k":"ring","t":"t4","l":0}]},
 {"i":7,"kind":"shift","node":"n4","caption":"5 × 2: 1 dark bulb slides under 5; it rises 1 level. 10.","ledger":{"law":"shift","a":"5","m":"2","k":1,"sign":1,"out":"10"},"set":{"nodes":{"n4":{"glyph":0}},"towers":{"t3":{"at":"n4.C","value":"10","text":"10","digits":"1010₂"},"t4":null},"bulbs":{"b5":null,"b8":{"l":1},"b9":{"l":2},"b10":{"l":3},"b16":{"t":"t3"}}},"motion":{"b5":{"to":{"t":"t3","l":1},"dissolve":true}}},
 {"i":8,"kind":"return","node":"n4","caption":"10 rides up.","ledger":{"law":"move","value":"10"},"set":{"nodes":{"n4":null},"towers":{"t3":{"at":"n3.L"}}}},
 {"i":9,"kind":"shift","node":"n5","caption":"5 × 1: the 1 dissolves; 5 stays put.","ledger":{"law":"shift","a":"5","m":"1","k":0,"sign":1,"out":"5"},"set":{"nodes":{"n5":{"glyph":0}},"towers":{"t5":{"at":"n5.C"},"t6":null},"bulbs":{"b4":null}},"motion":{"b4":{"to":{"t":"t5","l":0},"dissolve":true}}},
 {"i":10,"kind":"return","node":"n5","caption":"5 rides up.","ledger":{"law":"move","value":"5"},"set":{"nodes":{"n5":null},"towers":{"t5":{"at":"n3.R"}}}},
 {"i":11,"kind":"collide","node":"n3","caption":"10 + 5: nothing carries. 15.","ledger":{"law":"sum","a":"10","b":"5","out":"15"},"set":{"nodes":{"n3":{"glyph":0}},"towers":{"t3":{"at":"n3.C","value":"15","text":"15","digits":"1111₂"},"t5":null},"bulbs":{"b9":null,"b13":{"t":"t3"},"b14":null,"b15":{"t":"t3"},"b16":null}},"motion":{"b16":{"to":{"t":"t3","l":0}},"b14":{"to":{"t":"t3","l":1}},"b9":{"to":{"t":"t3","l":2}}}},
 {"i":12,"kind":"return","node":"n3","caption":"15 rides up.","ledger":{"law":"move","value":"15"},"set":{"nodes":{"n3":null},"towers":{"t3":{"at":"n1.R"}}}},
 {"i":13,"kind":"collide","node":"n1","caption":"40 + 15: 1 carry climbs. 55.","ledger":{"law":"sum","a":"40","b":"15","out":"55"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"55","text":"55","digits":"110111₂"},"t3":null},"bulbs":{"b1":{"l":4},"b2":null,"b6":null,"b8":{"t":"t1"},"b10":{"t":"t1","s":0},"b11":null,"b12":null,"b13":{"t":"t1"},"b15":{"t":"t1"}}},"motion":{"b11":{"to":{"t":"t1","l":0}},"b12":{"to":{"t":"t1","l":1}},"b6":{"to":{"t":"t1","l":2}},"b2":{"to":{"t":"t1","l":4}}}},
 {"i":14,"kind":"return","node":"n1","caption":"55 rides up into the triangle.","ledger":{"law":"move","value":"55"},"set":{"nodes":{"n1":null},"towers":{"t1":{"at":"io:0"}}}},
 {"i":15,"kind":"output","node":"io","caption":"Output [55].","ledger":{"law":"move","value":"55"},"set":{"towers":{"t1":{"at":"out:0","form":"coin"}}}}],
 "result":{"values":["55"],"text":"[55]"},
 "stats":{"beats":16,"nodes":5,"maxLevels":6,"maxBulbs":15}}
```

**How to read beat 13.**
- At L3 the resident b1 (lit) and the incoming b10 (lit) meet. b1 climbs to L4 while lit (its state already equals the carry, so it needs no `via`); b10 stays at L3 and goes dark.
- At L4 the carry b1 is the bulb that already shows 1, so the dark resident b2 fades.
- Result: 110111 = 55.

**Rules for building the split (beat 3):**
- The node keeps its id and changes op.
- The copy A′ is born `from` A's bulbs.
- B's lit bulbs below k move to the R tower, and new dark bulbs are born in their place in B.
- R's dark levels below its top are new dark bulbs in R's tower.

### 6.5 Worked plans: 5 × (−4) in balanced ternary, and MEASURE 3 in base e

**`tests/fixtures/machine/plan-5xm4-ternary.json`.** 5 = 1TT and −4 = TT; nz = 2, so 7 beats lie between FANOUT and OUTPUT.

```json
{"v":1,"base":"ternary","pace":"together","tree":{"n1":{"op":"mul","parent":"io","socket":"C"}},"inputs":["5","-4"],
 "start":{"nodes":{"n1":{"op":"mul","parent":"io","socket":"C"}},
  "towers":{"t1":{"at":"in:0","form":"coin","value":"5","text":"5","digits":"1TT bal₃"},"t2":{"at":"in:1","form":"coin","value":"-4","text":"−4","digits":"TT bal₃"}},
  "bulbs":{"b1":{"t":"t1","l":0,"s":-1},"b2":{"t":"t1","l":1,"s":-1},"b3":{"t":"t1","l":2,"s":1},"b4":{"t":"t2","l":0,"s":-1},"b5":{"t":"t2","l":1,"s":-1}}},
 "beats":[
 {"i":0,"kind":"input","node":"io","caption":"[5, −4] goes in.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"io:0"},"t2":{"at":"io:1"}}}},
 {"i":1,"kind":"deliver","node":"n1","caption":"The numbers ride down the wire to the × block.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C:0"},"t2":{"at":"n1.C:1"}}}},
 {"i":2,"kind":"fanout","node":"n1","caption":"5 and −4 drop into the sockets and stand up.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.L","form":"tower"},"t2":{"at":"n1.R","form":"tower"}}}},
 {"i":3,"kind":"split","node":"n1","caption":"−4 = −3 + (−1), so 5 × (−4) = 5 × (−3) + 5 × (−1).","ledger":{"law":"split","a":"5","b":"-4","t":"-3","r":"-1"},"set":{"nodes":{"n1":{"op":"add"},"n2":{"op":"mul","parent":"n1","socket":"L"},"n3":{"op":"mul","parent":"n1","socket":"R"}},"towers":{"t1":{"at":"n2.L"},"t2":{"at":"n2.R","value":"-3","text":"−3","digits":"T0 bal₃"},"t3":{"at":"n3.L","form":"tower","value":"5","text":"5","digits":"1TT bal₃"},"t4":{"at":"n3.R","form":"tower","value":"-1","text":"−1","digits":"T bal₃"}},"bulbs":{"b4":{"t":"t4"},"b6":{"t":"t3","l":0,"s":-1},"b7":{"t":"t3","l":1,"s":-1},"b8":{"t":"t3","l":2,"s":1},"b9":{"t":"t2","l":0,"s":0}}},"motion":{"b6":{"from":{"t":"t1","l":0}},"b7":{"from":{"t":"t1","l":1}},"b8":{"from":{"t":"t1","l":2}}},"marks":[{"k":"ring","t":"t2","l":0}]},
 {"i":4,"kind":"shift","node":"n2","caption":"5 × (−3): 1 dark bulb slides under 5; it rises 1 level and every colour swaps. −15.","ledger":{"law":"shift","a":"5","m":"-3","k":1,"sign":-1,"out":"-15"},"set":{"nodes":{"n2":{"glyph":0}},"towers":{"t1":{"at":"n2.C","value":"-15","text":"−15","digits":"T110 bal₃"},"t2":null},"bulbs":{"b1":{"l":1,"s":1},"b2":{"l":2,"s":1},"b3":{"l":3,"s":-1},"b5":null,"b9":{"t":"t1"}}},"motion":{"b5":{"to":{"t":"t1","l":1},"dissolve":true}}},
 {"i":5,"kind":"return","node":"n2","caption":"−15 rides up.","ledger":{"law":"move","value":"-15"},"set":{"nodes":{"n2":null},"towers":{"t1":{"at":"n1.L"}}}},
 {"i":6,"kind":"shift","node":"n3","caption":"5 × (−1): every colour swaps. −5.","ledger":{"law":"shift","a":"5","m":"-1","k":0,"sign":-1,"out":"-5"},"set":{"nodes":{"n3":{"glyph":0}},"towers":{"t3":{"at":"n3.C","value":"-5","text":"−5","digits":"T11 bal₃"},"t4":null},"bulbs":{"b4":null,"b6":{"s":1},"b7":{"s":1},"b8":{"s":-1}}},"motion":{"b4":{"to":{"t":"t3","l":0},"dissolve":true}}},
 {"i":7,"kind":"return","node":"n3","caption":"−5 rides up.","ledger":{"law":"move","value":"-5"},"set":{"nodes":{"n3":null},"towers":{"t3":{"at":"n1.R"}}}},
 {"i":8,"kind":"collide","node":"n1","caption":"−15 + (−5): 1 carry climbs. −20.","ledger":{"law":"sum","a":"-15","b":"-5","out":"-20"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"-20","text":"−20","digits":"T1T1 bal₃"},"t3":null},"bulbs":{"b1":null,"b6":{"t":"t1"},"b7":{"t":"t1","s":-1},"b8":null,"b9":null}},"motion":{"b9":{"to":{"t":"t1","l":0}},"b1":{"to":{"t":"t1","l":2},"burst":true},"b8":{"to":{"t":"t1","l":2},"burst":true}}},
 {"i":9,"kind":"return","node":"n1","caption":"−20 rides up into the triangle.","ledger":{"law":"move","value":"-20"},"set":{"nodes":{"n1":null},"towers":{"t1":{"at":"io:0"}}}},
 {"i":10,"kind":"output","node":"io","caption":"Output [−20].","ledger":{"law":"move","value":"-20"},"set":{"towers":{"t1":{"at":"out:0","form":"coin"}}}}],
 "result":{"values":["-20"],"text":"[−20]"},
 "stats":{"beats":11,"nodes":3,"maxLevels":4,"maxBulbs":9}}
```

**How to read beat 8.** The receiver is −15 = T110, the larger magnitude.
- L0: the incoming blue b6 lands on the dark b9, which fades.
- L1: (1, 1) sums to 2 = 3 − 1. The resident b1 climbs blue, and the incoming b7 turns red.
- L2: the resident b2 already shows the answer 1. The arriving carry b1 (+1) and the incoming red b8 fade together over [0.6, 1] in one burst, both fully visible as they meet.
- Result: T1T1 = −27 + 9 − 3 + 1 = −20.

**`tests/fixtures/machine/e-measure-3.json`.** MEASURE [3] in base e, the full plan. Its UNFOLD beat is the normative base-e rendering fixture.

```json
{"v":1,"base":"e","pace":"together","tree":{"n1":{"op":"measure","parent":"io","socket":"C"}},"inputs":["3"],
 "start":{"nodes":{"n1":{"op":"measure","parent":"io","socket":"C"}},
  "towers":{"t1":{"at":"in:0","form":"light","value":"3","text":"3","reading":"ln 3 ≈ 1.0986"}},
  "bulbs":{"b1":{"t":"t1","l":1.0986,"s":1,"k":"light"}}},
 "beats":[
 {"i":0,"kind":"input","node":"io","caption":"[3] goes in.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"io:0"}}}},
 {"i":1,"kind":"deliver","node":"n1","caption":"3 rides down the wire to the ruler.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C:0"}}}},
 {"i":2,"kind":"fanout","node":"n1","caption":"3 arrives as one light at height ln 3 ≈ 1.0986.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C"}}}},
 {"i":3,"kind":"unfold","node":"n1","caption":"The light falls and leaves the bulbs that fit: 3 = 10.020…ₑ.","ledger":{"law":"unfold","value":"3"},
  "set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"form":"tower","dust":true,"digits":"10.020…ₑ","reading":null}},
         "bulbs":{"b1":null,"b2":{"t":"t1","l":1,"s":1,"slot":0},"b3":{"t":"t1","l":-2,"s":1,"slot":0},"b4":{"t":"t1","l":-2,"s":1,"slot":1}}},
  "motion":{"b1":{"path":[[0,1.0986],[0.45,-1.2668],[0.9,-4.5055]],"fade":[0.9,1]},
            "b2":{"in":[0.0095,0.0905],"grow":true},"b3":{"in":[0.5042,0.5852],"grow":true},"b4":{"in":[0.5042,0.5852],"grow":true}}},
 {"i":4,"kind":"return","node":"n1","caption":"3 rides up into the triangle.","ledger":{"law":"move","value":"3"},"set":{"nodes":{"n1":null},"towers":{"t1":{"at":"io:0"}}}},
 {"i":5,"kind":"output","node":"io","caption":"Output [3].","ledger":{"law":"move","value":"3"},"set":{"towers":{"t1":{"at":"out:0","form":"coin"}}}}],
 "result":{"values":["3"],"text":"[3]"},
 "stats":{"beats":6,"nodes":1,"maxLevels":5,"maxBulbs":3}}
```

**Check of the UNFOLD beat.**
- The keyframes are height(3) = 1.0986, height(3 − e) = −1.2668 and height(3 − e − 2e⁻²) = −4.5055.
- Level 1 is crossed at f = 0.0417, so c = 0.45·(1 − √0.9583) = 0.0095.
- Level −2 is crossed at f = 0.2264, so c = 0.45 + 0.45·(1 − √0.7736) = 0.5042.
- Linear interpolation would give 0.019 and 0.552. At 0.552 the eased light is already at −2.57, so the bulbs would condense about half a level above it; the inverted ease avoids that.

### 6.5b Golden beats for the edge cases

These beats live in `tests/machine-golden.test.js` (A). For each case, `planMachine` must produce exactly these beats at these indices. Beats 0–2 are the standard flow, and the start ids follow 6.2.

**Binary 13 + 3** (13 = b1..b4, 3 = b5, b6; together pace). It pins the lit in-flight carry.

```json
{"i":3,"kind":"collide","node":"n1","caption":"13 + 3: 4 carries climb. 16.","ledger":{"law":"sum","a":"13","b":"3","out":"16"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"16","text":"16","digits":"10000₂"},"t2":null},"bulbs":{"b1":{"l":1,"s":0},"b2":{"l":2},"b3":{"l":3,"s":0},"b4":{"l":4},"b5":{"t":"t1","s":0},"b6":null}},"motion":{"b2":{"via":{"s":1}},"b6":{"to":{"t":"t1","l":1}}}}
```

**Ternary 10 + (−5)** (10 = 101 → b1..b3; −5 = T11 → b4..b6). The dark resident lights as it climbs, and the burst has a visible partner.

```json
{"i":3,"kind":"collide","node":"n1","caption":"10 + (−5): 2 carries climb. 5.","ledger":{"law":"sum","a":"10","b":"-5","out":"5"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"5","text":"5","digits":"1TT bal₃"},"t2":null},"bulbs":{"b1":{"l":1,"s":-1},"b2":null,"b4":{"t":"t1","s":-1},"b5":null,"b6":null}},"motion":{"b2":{"to":{"t":"t1","l":2},"via":{"s":1},"burst":true},"b5":{"to":{"t":"t1","l":1}},"b6":{"to":{"t":"t1","l":2},"burst":true}}}
```

**Binary 13 + 9, level pace** (13 = b1..b4 receives; 9 = b5..b8 comes from the right, so incoming waits in lane 2 and carries in lane 1):

```json
{"i":3,"kind":"collide","node":"n1","caption":"13 + 9: the bulbs wait beside their levels. Level 0: 1 + 1, the resident climbs.","ledger":{"law":"sum","a":"13","b":"9","out":"22"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"22","text":"13 + 9","digits":null,"pending":true},"t2":null},"bulbs":{"b1":{"l":1,"slot":1},"b5":{"t":"t1","s":0},"b6":{"t":"t1","slot":2},"b7":{"t":"t1","slot":2},"b8":{"t":"t1","slot":2}}}}
{"i":4,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 1: the carry lands on a dark level and stays.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b1":{"slot":null},"b2":null,"b6":null}},"motion":{"b6":{"to":{"t":"t1","l":1}}}}
{"i":5,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 2: only a dark bulb arrives; the 1 stays.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b7":null}},"motion":{"b7":{"to":{"t":"t1","l":2}}}}
{"i":6,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 3: 1 + 1: the resident climbs; the newcomer stays, dark.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b4":{"l":4,"slot":1},"b8":{"slot":null,"s":0}}}}
{"i":7,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 4: the carry lands above the top and the tower grows. 22.","ledger":{"law":"regroup","value":"22"},"set":{"towers":{"t1":{"pending":null,"text":"22","digits":"10110₂"}},"bulbs":{"b4":{"slot":null}}}}
```

**Ternary 4 + 4, level pace.** The tie goes to the right operand, so t2 (b3, b4) receives. The donor t1 (b1, b2) comes from the left, so incoming waits in lane 1 and carries in lane 2.

```json
{"i":3,"kind":"collide","node":"n1","caption":"4 + 4: the bulbs wait beside their levels. Level 0: 1 + 1 = 3 − 1: the resident climbs.","ledger":{"law":"sum","a":"4","b":"4","out":"8"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t2":{"at":"n1.C","value":"8","text":"4 + 4","digits":null,"pending":true},"t1":null},"bulbs":{"b3":{"l":1,"slot":2},"b1":{"t":"t2","s":-1},"b2":{"t":"t2","slot":1}}}}
{"i":4,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 1: three blue bulbs make 3: the resident climbs, the carry goes dark.","ledger":{"law":"regroup","value":"8"},"set":{"bulbs":{"b4":{"l":2,"slot":2},"b3":{"slot":null,"s":0},"b2":null}},"motion":{"b2":{"to":{"t":"t2","l":1}}}}
{"i":5,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 2: the carry lands above the top and the tower grows. 8.","ledger":{"law":"regroup","value":"8"},"set":{"towers":{"t2":{"pending":null,"text":"8","digits":"10T bal₃"}},"bulbs":{"b4":{"slot":null}}}}
```

**0 × 9** (binary: 9 = b2..b5; ternary: 9 = 100 → b2..b4, with the same shape minus b5). It is followed by RETURN (beat 4) and OUTPUT `[0]` (beat 5).

```json
{"i":3,"kind":"zero","node":"n1","caption":"Nothing to multiply: 0 × 9 = 0.","ledger":{"law":"zero","a":"0","b":"9","out":"0"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C"},"t2":null},"bulbs":{"b2":null,"b3":null,"b4":null,"b5":null}},"motion":{"b2":{"to":{"t":"t1","l":0}},"b3":{"to":{"t":"t1","l":0}},"b4":{"to":{"t":"t1","l":0}},"b5":{"to":{"t":"t1","l":0}}}}
```

### 6.6 Exported signatures

```js
// ── registry.js (A) — frozen on day 1 ───────────────────────────
export function registerBase(id /* Base */, spec);
export function getBase(id) /* spec; throws Error(`base ${id} is not loaded`) */;
export function hasBase(id);
/* spec = {
     id, palette: OpId[],
     parseValue(text)              → {ok:true, value} | {ok:false, error},
     evaluate(op, args /*value strings*/) → {ok:true, values} | {ok:false, reason:'zeroDivision'|'domain', message},
     display(value, {form})        → {text, approx?, digits?, reading?},
     checkLimits(value)            → null | message,
     validateTower(scene, towerId) → string[]   // I2 and I3 for this base
     place(b /*PlanBuilder*/, towerId, value, {asLight = false}) → void   // FANOUT: write a value's bulbs
     ops: Record<OpId, (b, node, operands: towerId[]) => {result: towerId, other?: towerId}>,
   } */

// ── bigmath.js (A) ──────────────────────────────────────────────
export const RADIX = {binary: 2n, ternary: 3n};
export function digits(n, base) /* Int8Array LSB-first; binary negatives' lit bits are −1; [0] for 0 */;
export function fromDigits(d, base) /* bigint, Σ d_k·radix^k */;
export function twos(n) /* {bits: Uint8Array (≥1), lamp: 0|1} in lamp normal form: n = Σ bits_i·2^i − lamp·2^len */;
export function fromTwos(bits, lamp) /* bigint */;
export function tritwise(op /* 'min'|'max'|'sum'|'cons' */, a, b) /* bigint */;
export function divTrunc(a, b) /* {q, r}: BigInt / and % */;
export function divRound(a, b) /* {q, r}: q = sign(a)sign(b)⌊(2|a|+|b|−1)/(2|b|)⌋ */;
export function fmt(v) /* '−20' with U+2212 */;  export function fmtOperand(v) /* '(−20)' when negative */;
export function baseString(v, base, {lamp} = {}) /* '1110000₂', '11011 bal₃', '…1010₂' (own BigInt digits) */;

// ── oracle.js (A) ───────────────────────────────────────────────
export function evaluate(op, base /*'binary'|'ternary'*/, args /* bigint[] */) /* {value, remainder?} | {error:'zeroDivision'|'domain'} */;

// ── tree.js (A) ─────────────────────────────────────────────────
export const ARITY /* {add:2, …, not:1, neg:1, measure:1, ln:1} */;
export function palette(base) /* getBase(base).palette */;
export function defaultMachine() /* {n1: {op:'mul', parent:'io', socket:'C'}} */;
export function attach(tree, socket /* 'io' | `${id}.L|R|C` */, op) /* {tree, node} */;
export function detach(tree, node) /* tree */;
export function openSockets(tree) /* SocketId[], depth-first, left first */;
export function parseInput(text, base) /* {ok:true, values: string[]} | {ok:false, error} */;
export function parseExpression(text, base) /* {ok:true, tree, inputs} | {ok:false, error}; refuses '>>' */;
export function evaluateTree(tree, inputs, base)
  /* {ok:true, values: string[], text} | {ok:false, reason:'zeroDivision'|'domain', node, message} */;
export function sentence(scene) /* '64 + (32 + 16 × 1)', from Tower.text */;

// ── builder.js (A) ──────────────────────────────────────────────
export class PlanBuilder {
  constructor({base, tree, inputs, pace});      // start scene: inputs at in:i, ids per 6.2
  get scene(); get base(); get pace();           // read-only working scene
  id(kind /* 'b'|'t'|'n' */);                    // next id, never reused
  begin(kind, node, {caption, ledger, dur = 1});
  bulb(id, props, motion);  drop(id, motion);    // create (full props) or patch; remove
  tower(id, props);         dropTower(id);       // fills text/approx/digits/reading via display(); dropTower drops its bulbs
  node(id, props);          dropNode(id);
  mark(m);
  bulbsOf(towerId) /* [id, Bulb][] by level, slot */;  valueOf(towerId) /* bigint, lamp included */;
  end() /* Beat: computes the diff, checks I2/I3 on touched towers, appends */;
  finish(result) /* Plan */;
}

// ── plan.js (A) ─────────────────────────────────────────────────
import './bt-base.js';                            // registers binary and ternary
export const LIMITS /* section 6.10 */;
export function planMachine({tree, inputs, base, pace = 'together'})
  /* 1 parse + arity → 2 evaluateTree pre-check → 3 limits → 4 plan.
     {ok:true, plan} | {ok:false, reason: 'input'|'arity'|'zeroDivision'|'domain'|'tooBig', node?, message, result?} */;
export function validatePlan(plan) /* string[]: 'beat 7 I3: tower t2 has a leading dark bulb'; [] when sound */;
export function evaluateScene(scene, base) /* exact value strings of the tree; DIV in progress = Q + R/arg; ghosts excluded */;

// ── ops/collide.js (A) ──────────────────────────────────────────
export function survivor({base, r, i, c})   // r, i ∈ {−1,0,1} or null when absent; c ∈ {−1,1} or null
  /* {d, cOut, stay: 'R'|'C'|'I', climb: 'R'|null, via: −1|1|null /*set when R is dark*/,
      fade: ('R'|'C'|'I')[], burst: boolean} */;

// ── e-exact.js (B) ──────────────────────────────────────────────
export class E {
  static of(v /* bigint | {n, d} */); static e(k = 1); static parse(text);
  key(); add(y); sub(y); neg(); mul(y); shift(k); coeff(k) /* {n, d} */; levels(); isZero(); isInteger();
}
export class PrecisionError extends Error {}
export function eBounds(p) /* {lo: {n, d}, hi: {n, d}}: dyadic, rounded outward */;
export function sign(x, {maxBits = 8192} = {}) /* −1|0|1, certified */;
export function compare(x, y) /* −1|0|1, certified */;
export function greedy(x, {floor = -3} = {}) /* {sign, top, digits: Map<level, 0|1|2>, rest: E, exact} on |x| */;
export function isLegalNumeral(x) /* integer digits 0..2 and the Parry condition, certified */;
export function approx(x) /* number, display only */;
export function height(x) /* clamp(round4(ln|x|), top, top + 0.9999); exactly k for e^k */;
export function lnText(x) /* 'ln 3 ≈ 1.0986'; more digits when round4 is an integer but x ≠ e^k */;

// ── ops/e.js and e-base.js (B) ──────────────────────────────────
export const E_OPS /* {add, sub, mul, mule, cmp, measure, ln}, the op-module signature above */;
// e-base.js: import {registerBase} from './registry.js'; registerBase('e', {...}); — no exports needed

// ── layout.js (C) ───────────────────────────────────────────────
export const UNITS = {block: [176, 88], socketX: {binary: 88, ternary: 88, e: 150}, pitch: 84, coin: 6,
  bulbR: 37, lane: 84, eScale: .8, eSlots: [-34, 34, 102], labelGap: 42, pillLine: 36, charW: 17,
  gutter: 48, placeCol: 56, wire: 2.5, hub: 25, bead: 9, rowGap: 36, qMinX: 264};
export function layoutPlan(plan)
  /* Layout: {base, place(at, slot?) → {x, y}, nodeAt(id), nodeBox(id), towerBox(scene, id), pillBox(scene, id),
              wire(id) → [x, y][], bounds} */;
export function cameraAt(plan, layout, t, viewport /* {width, height} */, {reduced = false, inset = {}} = {})
  /* {x, y, w, h} */;

// ── render.js (C) ───────────────────────────────────────────────
export const easeOut = u => 1 - (1 - u) ** 2;
export function machineDefs(palette = ink, prefix = 'm-') /* <symbol>s: bulb-blue, bulb-red (minus bar), bulb-amber, socket, lamp, sliver */;
export function blockGlyphSVG(op, palette = ink) /* a small <svg> for palette buttons */;
export function renderMachine(plan, t, layout, palette = ink,
  view = {viewport, camera /* override */, motion: 'full', digits: false, prefix: 'm-', selected: null, highlight: null, inset: {}})
  /* {svg, viewBox, beat, u} */;
export function renderStatic(scene, layout, palette = ink, view = {}) /* svg body of a beat boundary */;

// ── view.js (C; the only change) ────────────────────────────────
export function bulb(x, y, color, opacity = 1, palette = ink);   // default output byte-identical
export function socket(x, y, palette = ink);

// ── clock.js (D) ────────────────────────────────────────────────
export function schedule(plan, sp, {readAlong = false} = {}) /* {starts, ends: Float64Array, total} seconds; carry beats sp/2 */;
export class BeatClock { constructor(plan, {sp = 1, auto = true, readAlong = false});
  t(now); start(now); step(now) /* finish this beat, or play the next */; pause(now); back(); seek(t);
  setAuto(on, now); setSpeed(sp, now) /* from the next beat */; get playing(); get beat(); get done(); }

// ── machine-app.js (D) ──────────────────────────────────────────
export class MachineView extends EventTarget {
  show(preset); hide(); load(preset /* {tree?|op?|expression?, base, input, sp, pace, auto} */) /* Promise<{ok, message?}> */;
  enter() /* the Enter rule */; step(); back(); seek(t); setAuto(on); setSpeed(sp); setBase(base); setPace(pace);
  restyle(); get state(); }
// events: 'cards' {value, base} · 'beat' {i} · 'done' {result}
```

### 6.7 UI ids, URL and automation hook (D implements; B's videos and D's tests rely on them)

| Element | Notes |
|---|---|
| `#open-machine` | header button, `aria-pressed` |
| `#machine-mode` | the section |
| `#machine-base` | radiogroup of `button[data-base=binary\|ternary\|e]` |
| `#machine-input` | `[16,7]`; auto-focused only on a fine pointer |
| `#machine-run` | Run ⏎ (the Enter rule); primary on touch |
| `#machine-expr` | expression field |
| `#machine-rebuild` | Rebuild |
| `#machine-to-cards` | To the cards; disabled with a reason (4.6) |
| `#machine-stage` | `tabindex=0`; a persistent `<svg aria-hidden="true">`; `data-beat`, `data-beats`, `data-playing`, `data-t` |
| `#machine-hud` | DOM overlay: title, BASE, AUTO bulb, SPEED bulbs |
| `#machine-palette` | `role=toolbar`; `button[data-op]`, draggable (touch: vertical drag or long press) |
| `#machine-step`, `#machine-back`, `#machine-auto`, `#machine-pause` | controls; AUTO and Pause use `aria-pressed` |
| `#machine-slower`, `#machine-faster`, `#machine-speed` | speed controls; `#machine-speed` is an output |
| `#machine-pace` | select: together / level |
| `#machine-digits`, `#machine-readalong` | checkboxes |
| `#machine-centre`, `#machine-overview` | camera buttons |
| `#machine-caption`, `#machine-sentence` | visible text (hidden in recording mode) |
| `#machine-live` | `aria-live=polite`, visually hidden, paced as in 4.9 |
| `#machine-side`, `#machine-steps`, `#machine-steps-toggle` | side panel / sheet with the Steps tab |
| `#machine-outline` | `role=tree`, the visible Parts tab; `inert` when its sheet is closed |
| `#machine-status` | `role=status` |
| `#watch-machine` | equation transport: "Watch … in the machine" (4.6) |

**URL presets:**
- `?machine` opens the default state.
- `?machine=empty` opens an empty machine (`load({tree: {}})`).
- `?machine=<op|expression>&mbase=&input=&sp=&pace=&auto=` opens a preloaded machine.
- `&automation` exposes the hook below.
- `&recording` turns on recording mode (5.1).

With `&automation` in the URL, the app exposes:

```js
window.__machine = { state() /* {base, beat, beats, t, playing, auto, sp, pace, caption, sentence, output, error} */,
  beats() /* [{i, kind, node, caption, start, end}] seconds at the current sp */,
  plan()  /* the Plan, JSON-safe */, load(params) /* Promise<void>; awaits e-base.js for mbase=e */,
  seek(t), chrome(mode /* 'build'|'run' */) };
```

### 6.8 Studio changes (B)

`record({origin, format, script, out, fps, scale, quality, log, path = '/?examples=written', silent = false, overlay = {}})`

`overlay` merges into the format's overlay variables, for example `{'caption-bottom': '40px'}` for portrait machine videos.

ctx additions:

| Helper | Behaviour |
|---|---|
| `caption(text, seconds, {at})` | the version on main, plus chunking past `captionChars`, plus `at: 'top'` |
| `key(key, {label})` | a real key event plus an overlay keycap |
| `type(selector, text)` | tap, then insert text at 80 ms per character |
| `machine.load(params)` | load through the automation hook |
| `machine.beats()`, `machine.state()` | read through the hook |
| `machine.chrome(mode)` | show the bar and palette for building, or hide them for runs |
| `machine.until(i \| 'end')` | advance frames until beat i has ended |
| `machine.stretch(i, seconds)` | play beat i over `seconds` of video |
| `machine.captionBeat(i, {extra, min})` | show beat i's plan caption and hold the beat until it has been read |

Other changes:
- `page.js` gains `__rec.key(label)`, `__rec.bulbTitle({bits, base, title, subtitle})` and top-band captions.
- `machine-tutorials.mjs` exports `machineTutorials = {name: {title, silent: true, path, overlay, script}}`.
- `make-videos.mjs`:
  - with no names, it records the narrated `tutorials` only (unchanged);
  - `--silent` selects `machineTutorials`;
  - explicit names may come from either set, and an unknown name lists both;
  - silent outputs go to `videos/machine/`.
- The narrated path is untouched: with clips present, mixing and loudnorm behave as before.

### 6.9 Tests

Unit and property tests run with `node --test tests/*.test.js`.

**Time budget.** All `tests/machine-*.test.js` together finish in **under 30 s** on the reference machine, and the time is recorded in `docs/verification.md`. `machine-plan.test.js` asserts its own wall time is under 20 s.

| File | Owner | Proves |
|---|---|---|
| `tests/machine-bigmath.test.js` | A | `digits`/`fromDigits` round trip for \|n\| ≤ 10⁶; `twos`/`fromTwos` and lamp normal form (0, −1, −2, −4, −2^62); `divTrunc` ≡ BigInt; `divRound` ≡ closed form for a ∈ [−2000, 2000], b ∈ [−60, 60]\{0}, with odd symmetry |
| `tests/machine-collide.test.js` | A | `survivor()` over every possible case: binary blue r ∈ {0,1}, i ∈ {0,1,∅}, c ∈ {1,∅} plus (∅,∅,1) = 13 cases; the 13 red mirrors; 12 opposite-colour annihilation cases (r ∈ {0,σ}, i ∈ {0,−σ,∅}, σ = ±1); ternary r ∈ {T,0,1}, i ∈ {T,0,1,∅}, c ∈ {T,1,∅} plus (∅,∅,±1) = 38 cases; XOR (6) and SUM (12) with c = ∅. Each case conserves (r + i + c)·b^k = d·b^k + c′·b^(k+1), leaves exactly one bulb at the level (and the climber at k + 1), matches the tables in 2.2, has an in-flight climber state of c′ (`via` exactly when R is dark), and marks every fading carry as `burst` |
| `tests/machine-plan.test.js` | A | every op × {binary, ternary} for a, b ∈ [−20, 20] exhaustively (k ∈ [0, 6] for shifts; b ≠ 0 for ÷ and %); ADD, SUB and MULT in both paces. Every plan's result equals the oracle and `validatePlan` returns []. Also 200 seeded random pairs per op and base near the limits, which, with the goldens, are also planned twice and deep-equal, survive a JSON round trip, and plan in under 50 ms |
| `tests/machine-identities.test.js` | A | at the oracle level for a, b ∈ [−130, 130]: XOR + 2·AND = a + b; SUM + 3·CONS = a + b (the loop takes ≤ 7 rounds for \|a\|, \|b\| ≤ 400); De Morgan in both bases; NOT∘NOT = id; NEG∘NEG = id; MIN/MAX absorption; **Kleene XOR ≡ −a·b, and T is its two-sided identity**; a = q·b + r with each convention's bounds; SHR(a, k) = DIV(a, b^k); gates = BigInt `& \| ^ ~`. Borrow beats ≤ 10 for 0 ≤ i < r < 2000, using the planner's pure borrow schedule (Number arithmetic, no scenes) |
| `tests/machine-golden.test.js` | A | `planMachine` deep-equals `plan-5x11-binary.json` and `plan-5xm4-ternary.json`; the beats in 6.5b (13 + 3, ternary 10 + (−5), level-pace 13 + 9 and 4 + 4, 0 × 9 in both bases); `[16,7]` binary and ternary kinds, nodes, values and captions (tables in 2.4); `[7,16]` is one SHIFT; 9 × 0 and 0 × 0 are 2 beats; `[45,6]` is 16 beats → [7, 3] with label `q 7 · r 3`; ternary `[19,5]` → [4, −1] and `[14,4]` → [3, 2]; SHR `[−13,2]` → [−3, −1] and `[5,4]` → [0, 5]; `9/(3-3)` → `{ok:false, reason:'zeroDivision', node}` (the DIV node); `(3-3)%2` → [0, 0]; a negative computed shift count → `domain`; COMPLEMENT of −1, −2, −4 and −2^62 ends in lamp normal form; NOT 0 = −1 and NOT −1 = 0; PRIME regressions (7 + 5 = 12, 9 + 5 = 14, the 40 + 15 label on top, 257, 1024, 0 + 0, `[5, 3]` parses as two numbers) |
| `tests/machine-tree.test.js` | A | parsing (`>>` refused with its message), attach/detach, open-socket order, `evaluateTree` (including domain errors with the node), `sentence` for the [16,7] beats |
| `tests/machine-crossengine.test.js` | A | final digits of a machine ADD = `unitPlanMany` final tokens, \|a\|, \|b\| ≤ 200, both bases |
| `tests/machine-e.test.js` | B | E arithmetic; `sign` and `compare` agree with floats when the gap > 1e−9; no `PrecisionError` on 10 000 random piles within the limits; digits match `tests/fixtures/base-e.json` (0..2000, k/7, k/10, 8 places); only 0, 1 and 2 are exact among the integers 0..2000; e² + 2 = 102ₑ; (e + 1)² = 121ₑ exact; (e + 1)³ → 2111.0021…; 22ₑ is not legal → 100.0002…; the pile theorem on random piles; the shift law; 3e² = 1002.001…ₑ; the unrounded fold function equals ln within 1e−12; \|height(x) − ln\|x\|\| ≤ 1e−4, height(e^k) = k, height(2721/1001) = 0.9999 with an 8-digit reading; unfold = greedy digits; top(ab) − top(a) − top(b) ∈ {0, 1}; COMP of two reds inverts; mixed-sign ADD and SUB; (e² + 2) − 2 skips FOLD; MEASURE −3 is red; 1/30 and 1/10⁶ draw dust only; `ln(2-2)` → `domain`; the planner reproduces `e-measure-3.json`; base-e plans pass `validatePlan` |
| `tests/machine-e.test.js` (todo) | B | agreement with `bases.js` `digitsOf` for integers 1..2000 at 3 places, marked `todo`: a mismatch is reported, never fixed here (6.11) |
| `tests/machine-render.test.js` | C | purity (identical strings twice); no `NaN`/`undefined`; both styles; **the beat-boundary property** (half-open): for every integer i, `renderMachine(plan, i)` equals `renderStatic(snapshotAt(plan, i))`; each live bulb id is drawn once; a climber is never drawn dark between u 0.3 and 0.6; in `e-measure-3`, each deposit is born within 0.05 level of the light; reduced-motion frames never place a bulb between levels; `machineDefs` symbols use `bulb()`/`socket()` geometry; `bulb()`/`socket()` default output is byte-identical to the pre-change strings; token parity of `machine` and `bulb.amber` across both styles; render.js imports no arithmetic module |
| `tests/machine-layout.test.js` | C | the 6.3b test at every beat boundary of the goldens and named scenes (no tower box intersects another tower, a foreign node box or a foreign wire; no pill overlap); positions fixed over a plan's life; `cameraAt` pure, within bounds, and at scale ≥ 18/74 while following |
| `tools/machine-visual-tests.mjs` → `tests/machine-baselines.json` (C) and `tests/machine-e-baselines.json` (B) | C / B | `scenes.js` × u ∈ {0, .25, .5, .75, 1} × {sketchpad, cyber} × {landscape, portrait}. Scenes: split, shift, zero, carry collide (together, and **level pace at every boundary**), the via carry (13 + 3), borrow, compare, verdict, descend, drop, gates, NOT with lamp and fold, ternary add/split/try/judge, a domain-error highlight, plus the fixtures. Base-e scenes come from `e-*.json`. Scripts: `test:visual:machine` and `test:visual:machine:update` |
| `tools/interaction-tests.mjs` | D | the browser list below |
| `tools/perf.mjs` | D | the performance scenes below |

**Browser tests** (`tools/interaction-tests.mjs`, D):
1. Open Machine (fine pointer): the × block is under IO, Input holds `[16,7]` and has focus. Press Enter with AUTO on, and Output reads `[112]`.
2. **AUTO off, focus kept in `#machine-input`:** 16 Enters play beats 0–15. The captions of beats 3–14 equal the 12 golden captions, and Output reads `[112]`. With AUTO on, a second Enter mid-run finishes the current beat and does not restart. ← on the stage goes back one beat.
3. Typing `[`, `a`, `t` or `]` in Input fires no shortcut; `>>` in the expression field shows its refusal.
4. The ternary switch plays `[5,−4]` → `[−20]`. The base-e switch lazy-loads `e-base.js` and plays MEASURE 3.
5. Tap-to-attach and drag-to-attach both work. On touch, a horizontal swipe scrolls the palette and does not start a drag. An edit after OUTPUT rewinds and shows the full tree.
6. **Phones, 390×844 and 844×390:**
   - on open, the stage has focus and no input is focused;
   - the palette is reachable;
   - for the `[16,7]` run, every moving bulb is on screen and ≥ 18 px across at u ∈ {.1, .5, .9} of its beat;
   - for `[1048575, 1]` (a 20-level ADD whose carry runs the whole tower, ending at 21 levels), every moving bulb is ≥ 18 px and on screen in at least 2 of the 5 sampled frames of its beat (the pan).
7. At 360×740 the header neither wraps nor overflows.
8. Emulated reduced motion plays the same beats.
9. Switching style mid-run works, and digit glyphs are light on the cyber stage.
10. Leaving Machine returns keys to the equation space. Starting a lesson, opening the equation dialog and Android back all close Machine.
11. `9/(3-3)` outlines the DIV block, the status names the zero divisor, and Output shows `[—]`.
12. In base 2, tapping `16×7` in the equation space shows `#watch-machine`, which opens Machine preloaded. To the cards is disabled for `[4294967295, 4294967295]` with its reason.
13. The outline is not reachable by Tab while its sheet is closed.

**Performance scenes** (`tools/perf.mjs`, D), in both styles. Median frame ≤ 16.7 ms and p95 ≤ 34 ms:
- (2³² − 1) × (2³² − 1) in binary, at its widest ADD (64 levels, camera panning);
- ((3²⁰ − 1)/2)² in ternary;
- (2⁶³ − 1) ÷ 3;
- base-e UNFOLD of 600.

`npm run test:visual` must still report exactly 720 unchanged decimal hashes.

**`validatePlan` invariants**, checked at every beat end:

| | Invariant |
|---|---|
| I1 | `evaluateScene` is constant across every beat, except beats whose ledger law changes the tree value: `quotient`, `compare`, `gate`, `complement`, `read`, and `power` at FANOUT |
| I2 | Every tower's bulbs encode its value: Σ s·base^l over all bulbs (lanes and lamp included). Base e: digits + exact dust = value, with `dust` ⇔ remainder ≠ 0. Lights: **l === height(value)** (the same function the planner uses; `machine-e.test.js` separately bounds \|height − ln\| ≤ 1e−4). Every tower has `text` |
| I3 | Normal form: dense levels 0..top (base e: floor..top, valid slots); one bulb per level; no leading darks; binary uses a single colour; lamp at the top, with the top bit ≠ the lamp unless only level 0 remains; base-e towers are greedy. **Exempt:** `pending` towers until their last carry beat (lanes allowed); towers at `node.Q` until the node's RETURN (leading darks allowed); `o: 1` bulbs between a COLLIDE and its last BORROW; `pile` and `light` towers from greediness |
| I4 | Every ledger law holds (split: b = t + r and t is one non-zero digit; shift: out = a·m and m = ±b^k; zero: a = 0 or b = 0, and out = 0; sum: out = a + b; …) |
| I5 | Motion bounds: collide, carry and gate move bulbs by 0 or +1 level; removed XOR/SUM climbers by +0.5; lanes change only x; a climber is never dark in flight (`via.s` or s_i is ±1); shift and drop move by exactly ±k; zero moves removed bulbs down to level 0; borrow moves only the donor, down to the owed level; fold, unfold, slide, meet and race occur only in base e; flow beats change no levels |
| I6 | Ids are unique and never reused; `from`/`to` reference towers that exist in the right scene; at the end only Output's towers remain (a non-root DIV/MOD's other tower fades in its RETURN) |
| I7 | Counts, case by case. MULT: 5·nz(B) − 3, or 2 when A = 0 or B = 0 (plus carry beats in level pace). ADD together: 1 for same colours or ternary; 1 + owed bulbs for binary opposite colours. ADD level: 1 + one carry beat per level ≥ 1 that held a waiting bulb (binary opposite colours as together). SUB: 1 (NEGATE) + the ADD count. Lamp conversions: +2 per red operand entering a gate, +2 per lit-lamp operand entering an arithmetic socket. DIV rounds: K + 1 (fewer only through CLEAR). Borrow beats: owed bulbs |
| I8 | Captions are non-empty and ≤ 110 characters; `dur` ∈ {0.5, 1}, and 0.5 only for `carry` |

### 6.10 Limits, and what happens past them

| Limit | Binary | Balanced ternary | Base e |
|---|---|---|---|
| Typed input | integer, \|v\| < 2⁶³ | integer, \|v\| ≤ (3⁴⁰ − 1)/2 | rational p/q with \|p\|, q ≤ 10⁶, or an e-expression of ≤ 6 terms with exponents −6..12; \|value\| ≤ e²⁰ |
| Any tower at any beat | ≤ 64 levels (lamp not counted) | ≤ 41 levels | levels −3..+20 (rails may reach ⌊ln x⌋ ≥ −14), ≤ 6 drawn bulbs per level (badge beyond) |
| Practical MULT | len(a) + len(b) ≤ 64, so two factors below 2³² always fit | trits(a) + trits(b) ≤ 41 | split only for finite multipliers of ≤ 6 bulbs; otherwise the slide rule |
| Shift k (a whole number ≥ 0) | SHL: k ≤ 64 − len(a); SHR: k ≤ 63 | SHL: k ≤ 41 − len(a); SHR: k ≤ 40 | ×eᵏ: −6 ≤ k ≤ 12 |
| Machine | ≤ 24 user blocks, ≤ 8 inputs, ≤ 256 nodes in a plan | same | same |
| Beats | soft 400: ask "Long run (N beats): play at 4× or show the answer"; hard 2000 | same | same |
| Frame | ≤ 1500 bulbs drawn after culling off-camera towers; towers outside the active node draw as coins when their bulbs would be < 12 px across; the active node's towers never collapse | same | same |
| Certified precision | none | none | 8192 bits (`PrecisionError`, never reached within the limits; tested) |

**Past a limit:**
- **Typed input:** refused at Enter. The pill shakes and the status names the limit.
- **Computed values:** a zero divisor, a non-positive LN operand or a negative shift count is a domain error, found by the pre-check (2.6). A computed shift count past its limit is `tooBig`. The pre-check still works the exact answer out far past every tower (binary and balanced ternary up to 2¹⁴ bits, base e up to e^±2048), so `cmp(shl(1, 5000), 3)` is `tooBig` with the answer [1]; only a value past that budget is `tooBig` with no answer, and its message says why: "That number is too long to work out: it would need more than 16 384 bits (2¹⁴)." The budget is a size in bits in both bases (a decimal digit count would be wrong both ways: 2¹⁶³⁸⁴ and 10⁴⁹³³ − 1 both have 4 933 digits), and a ternary shift is measured, not bounded at 2 bits a trit.
- **While planning:** the planner checks every tower as it is built. When a tower would exceed its cap, or the node or beat cap is passed, it returns `{ok:false, reason:'tooBig', result}`.
- **Level pace:** the planner first retries in together pace. The mode also plays carries together when a level-pace plan would pass 1000 beats ((2³² − 1)² is 1649): laying that out froze the page for over a second, for a run that takes minutes even at 4×. Between 400 and 1000 beats the soft limit asks at Enter.
- The app then shows the exact answer statically in Output, with "Too big to animate step by step; here is the exact answer." Nothing is ever truncated or rounded silently.

### 6.11 What must not change (v1)

- **`tests/visual-baselines.json`:** all 720 decimal hashes stay byte-identical (`scenarios.js` × 2 orientations × 3 cameras × 5 progress points). `scenarios.js`, `renderEquation` and the decimal path are untouched.
- **`view.js`:** only the optional trailing `palette` parameter on `bulb` and `socket`, whose default output is byte-identical (tested). `bulbNumeral`, `tray` and the rest are unchanged.
- **Not modified in v1:** `bases.js`, `units.js`, `operations.js`, `animation.js`, `place-value.js`, `tutor.js`, `drag.js`. Any `bases.js` base-e float disagreement found by the cross-check is reported as a `todo`, for a separate change.
- **Tutor:** the existing lessons and their 200-problem tests, and "lessons count in tens".
- **Narrated videos:** the three videos, the ElevenLabs path, and `npm run videos` with no arguments. The audio-less mux runs only when there are no clips.
- **App start:** Machine is lazy-loaded, makes no network requests, adds no dependencies, and adds ≤ 120 KB raw to `dist-app` (measured in `docs/verification.md`). `e-base.js` is loaded only on first use of base e. The global key handler changes only to ignore `machine-active`.

**Phase 5 (owner D, after v1), the files it will touch:**
- Lessons: `src/machine/lessons.js` and `tests/machine-lessons.test.js` (new); `src/machine/machine-app.js` (lesson mode); `src/mvc/app.js` (dialog entries, `startMachineLesson`).
- The row-form split: `src/mvc/operations.js`, `src/mvc/animation.js` and `src/mvc/view.js` (copy rows), gated on `base !== 'decimal'`; new binary/ternary scenarios in a separate baselines file. The 720 decimal hashes stay unchanged and are re-verified.

---

## 7. Implementation order and ownership

There are four non-overlapping file sets; owners only read each other's files. They meet at the frozen contracts in 6.2, 6.3, 6.3b, 6.6 (the registry first) and 6.7, and at the fixtures in 6.4, 6.5 and 6.5b.

| Engineer | Branch(es) | Files owned |
|---|---|---|
| **A: arithmetic core** | `feature/machine-core` | `src/machine/{bigmath,oracle,registry,bt-base,tree,scene,builder,plan,captions}.js`, `src/machine/ops/{collide,borrow,multiply,shift,divide,compare,logic}.js`, `tests/machine-{bigmath,collide,plan,identities,golden,tree,crossengine}.test.js` |
| **B: base e and videos** | `feature/machine-e`, then `feature/machine-videos` | `src/machine/{e-exact,e-base}.js`, `src/machine/ops/e.js`, `tools/make-e-fixture.mjs`, `tests/fixtures/base-e.json`, `tests/fixtures/machine/e-*.json` (except `e-measure-3.json`), `tests/machine-e-baselines.json`, `tests/machine-e.test.js`, `tools/video/{studio.mjs,page.js,machine-tutorials.mjs}`, `tools/make-videos.mjs` |
| **C: picture** | `feature/machine-view` | `src/machine/{layout,render,scenes}.js`, `src/mvc/theme.js`, `src/mvc/view.js` (palette parameter only), `tools/machine-visual-tests.mjs`, `tests/machine-baselines.json`, `tests/fixtures/machine/{plan-5x11-binary,plan-5xm4-ternary,e-measure-3}.json`, `tests/machine-{render,layout}.test.js` |
| **D: the mode** | `feature/machine-mode` | `src/machine/{clock,machine-app}.js`, `index.html`, `src/mvc/{app.js,style.css,cyber.css}`, `src/native.js`, `tools/build.mjs`, `package.json` (adds `test:visual:machine`, `test:visual:machine:update`, `videos:machine`), `tools/{interaction-tests,perf}.mjs`, `README.md`, `docs/verification.md` |

**Why the merge order works.**

| File | Imports | Owners of those imports |
|---|---|---|
| A's files | each other and `bases.js` (suffixes only) | A |
| C's `render.js` and `layout.js` | strings from plans; `theme.js`, `view.js` | C; render.js imports no arithmetic module |
| C's `scenes.js` | `plan.js` | A |
| B's `ops/e.js`, `e-base.js` | `registry.js`, `builder.js` | A |
| D's `machine-app.js` | everything above; `e-base.js` only dynamically | A, B, C |

No file statically imports a file that merges after it.

**Order:**
1. **Day 0.** Nothing to commit: the caption-only studio path is already on main (266f0f2). Every branch starts from main.
2. **First commits.**
   - A lands `registry.js`, `scene.js` and `builder.js` exactly as specified.
   - C checks in the three full-plan fixtures from 6.4 and 6.5 verbatim.
   - From then on:
     - B builds `ops/e.js` and `e-base.js` against the registry and builder;
     - C renders the fixtures (`e-measure-3.json` covers base e until B lands);
     - D drives the fixtures through `BeatClock` and `renderMachine` stubs until the real ones land.
3. **Merge order:** A → C → B (`machine-e`) → D → B (`machine-videos`), each merged `--no-ff`.
   - At B's first merge, `scenes.js` picks up the new `e-*.json` fixtures and B commits `tests/machine-e-baselines.json`.
4. **Phase 5,** after the four-way build, owned by D: lessons, and the equation-space row-form split for × in bulb bases (files in 6.11).

**Done means:**
- all of 6.9 passes within its time budget;
- Enter on `[16,7]` with MULT gives `[112]` in both bases, including by repeated Enter with AUTO off in the Input;
- the 720 decimal hashes are unchanged;
- the ten videos render in both formats with no audio track, and `npm run videos` with no arguments still renders only the narrated three.

---

## 8. Deviations from PRIME, earlier findings, open points

**Deliberate deviations from PRIME:**
- upright towers on screen y (pitch 84) and a flat projection;
- a tidy, fixed tree layout with elbow wires, instead of the downward stagger with straight wires;
- zero is one labelled dark bulb;
- clones are born in their real state, carries are lit in flight, and state crossfades come in the second half of a beat;
- the fixes listed in 1.6;
- Back, Pause, Rebuild, the Steps list and the Parts outline;
- inputs fill every open socket;
- a real SPEED readout, applied from the next beat, and no perspective-follow;
- **speed keys:** `[` is slower and `]` is faster, matching media players and the − / + buttons. PRIME's `[` shortened the beat (`sp − 0.5`), which made it faster.
- level-pace lanes, a carry option PRIME did not have;
- new blocks: SUB, DIV, MOD, a working COMP, SHL, SHR, logic, and the base-e blocks. TRIG is not ported.

**Round-1 review findings, resolved in revision 1 and kept:**
- one per-tower cap with a defined `tooBig` path;
- "3, 4, 5 share the same fractional part 3 − e";
- base-e zero, SUB and COMP;
- the ternary tie rule (round half toward zero) with a matching TRY/JUDGE tie;
- `bases.js` never modified;
- scene diffs plus a closed motion table;
- the cyber drop-shadow turned off in the stage;
- the corrected "SUM on {0,1}" claim;
- the sign lamp instead of W-bit registers;
- dyadic outward-rounded bounds;
- no eager import of the machine;
- one caption path;
- the header crowding test.

**Open points for the user:**
1. Should the HUD title stay `PRIME / FUNCTION`, the user's own movie (proposed), or read "Machine"?
2. Should *Carries: together* (PRIME, proposed) stay the free-play default, with lessons and V2 using *one level at a time*?
3. Should a second, hardware-style SUB for binary (flip and add one to the subtrahend) be offered? This is not proposed: the two-colour collision matches the cards, and two's complement is taught by the lamp in V5.

---

## Changelog (revision 2)

**Blocker**
- **Base registry** (`registry.js`, A). Binary and ternary are registered by A; base e is registered by B's `e-base.js`, which D lazy-loads.
  - `OPS` and `placeE` were replaced by registry entries.
  - Planners write every display string (`Tower.text/approx/digits/reading`), so `render.js` reads only strings.
  - Base-e snapshot scenes come from fixture files.
  - The merge order A → C → B → D now has no forward imports (6.1, 6.6, 7).

**Major**
- **Survivor rule.** In-flight state `Motion.via` added; a climbing carry is always lit, and burst partners fade over [0.6, 1]. Goldens 13 + 3 and ternary 10 + (−5) added (2.1, 6.3, 6.5b).
- **Level pace.** Lanes (`slot` 1/2) and `pending` towers are defined, with I3 and I7 stated for them. Goldens 13 + 9 (binary) and 4 + 4 (ternary) added, and level-pace snapshots added (2.2, 6.2, 6.5b, 6.9).
- **Zero multiplication.** 0 × B and A × 0 now use one ZERO beat and then RETURN; I7 counts 2 for them; 0 × 9 golden added in both bases.
- **Ternary TRY.** The sign was corrected: the ghost collides with a copy of −t·B·3^k, a copy of D in the sign opposite to R.
- **Kleene XOR.** The reasons for rejecting it were rewritten: T is its identity and it equals Boolean XOR on {T, 1}, but it is negated multiplication, not a group, and has no carry partner.
- **Heights.** `height()` is rounded and clamped, and I2 now compares against that same function instead of a 1e−9 tolerance.
- **UNFOLD timing.** The deposit rule is normative (an inverted ease), and the fixture now uses `in` [0.0095, 0.0905] and [0.5042, 0.5852]. A render test checks that each deposit is born within 0.05 level of the light.
- **One Enter rule**, shared by Input, stage, Run and Step. A browser test plays 16 Enters with AUTO off and focus kept in the Input (4.2).
- **Domain errors.** `planMachine` evaluates the tree first; the offending node is highlighted and Output shows `[—]`. Goldens: `9/(3−3)`, `(3−3)%2` → `[0, 0]` (not `[0]`, because a root MOD shows `[q, r]`), and `ln(2−2)`.
- **Layout.** A normative layout was added: row clearances, Reingold–Tilford columns, elbow wires, pill placement, `.Q` position, no `.P`. The test now covers tower boxes, nodes, wires and pills at every beat (6.3b).
- **Camera on phones.** Coin collapse is based on bulb pixels and spares the active node; the camera pans when a beat does not fit; the palette collapses during runs. Phone tests at 390×844 and 844×390 added.
- **Half-open beats.** Integer t is the end of the previous beat, which makes the beat-boundary property provable.
- **Normal form.** The Q register is exempt until RETURN; the lamp normal form was fixed; the lamp fold was added to `addone` and the gates; the other tower of a non-root DIV/MOD fades in its RETURN.
- **Watch in the machine** is now a pressable `#watch-machine` button for × and ÷ terms, owned by D. The quarter-turn transition was dropped from v1.

**Minor**
- Lamp rule 5 dropped (it can never fire); lamp folds are tested for −1, −2, −4 and −2^62.
- Lamp-to-sign-magnitude sockets are listed; `>>` is refused; `[−13,2]` → `[−3, −1]` is a golden.
- SHR pads short towers (`[5,4]` → q 0, r 5); negative counts are refused or treated as a domain error.
- DIV's COMPARE gained a magnitude mode with a transient `verdict` mark.
- I3 exemptions added; I7 restated case by case; I5 allows the +0.5 XOR/SUM motion.
- UNFOLD: the claim is now "each time the light comes to rest", and the fill readout is shown only at rest.
- Base-e cases added: COMP of two reds, mixed-sign ADD, product colours, SUB that is already legal or has one colour left, red MEASURE, values below the floor, and `compare()` for MEET and RACE.
- The 4-decimal clamp keeps 2721/1001 below level 1, with an 8-digit reading.
- Captions fixed in V2 (twice), V4 and V9; the 3.4 example now uses ×e².
- Text fixed: 12 − 5 = 111; 8 − 5 → 10; returns at beats 5, 8, 10, 12, 14; CONS(r, i); the "one survivor rule" claim restricted to ADD, SUB, XOR and SUM.
- `survivor()` tests enumerate absent operands and real (non-zero) carries only, with the visual and in-flight checks.
- DIV/MOD output is `[q, r]` with a `q · r` label; the help text explains the ternary balanced MOD.
- The COLLIDE wording now says each tower slides 88.
- Phase 5: lessons get their own list; the files it touches and its owner are named.
- To the cards is disabled beyond safe integers, and `app.js` calls `chooseBase` before `controller.load`.
- Input is auto-focused only on a fine pointer.
- Speed applies from the next beat; the `[ ]` mapping is listed as a deviation; AUTO is remembered with a default of on.
- Video pacing: `captionBeat` holds each beat until its caption is read; recording mode hides the in-app text; the portrait caption sits lower; `npm run videos` defaults to the narrated three.
- `?machine=empty` preset added.
- Live-region pacing added; the outline is visible in a Parts tab and inert when its sheet is closed.
- The ternary table now has all 27 rows plus the absent-donor rows; `Node.pile` added; base-e signs stated.
- Cyber digit glyphs use `machine.glyph`.
- Every place app.js must close Machine is listed, and `restyle` is added to `onStyle`.
- Test budget under 30 s, with exhaustive tests over [−20, 20] plus seeded random pairs.
- Edits rewind to beat 0; touch drag versus scroll is disambiguated.
- Day 0 corrected: the caption path is already on main.
