# Legibility of the new pictures (TypeSafe Jev)

`tools/jev-legibility.mjs` asks TypeSafe's System One model Jev (`jev-latest`, https://docs.typesafe.ai) to read the
pictures added with the cyber style, the number bases and the marble fingerprints, as the riemann-zeta-visualization
project did for its marble language (`Tools/jev_marbles.py`). It is a development tool only: the app itself never
calls TypeSafe or any other service, and the privacy page is unchanged.

Each picture is drawn by the real app in headless Chrome, in both styles, and captured alone. Jev gets one Choice
question per picture: which reading does it show? The options are the truth and three near misses made in code,
shuffled; code keeps the score ("select instead of generate": the candidates are exact, Jev only judges which one the
picture shows).

* **Fingerprints** (32 numbers, no digits): which product of prime powers? Near misses: an exponent one off, a prime
  swapped for its neighbour, a factor dropped or added. The numbers are those of the riemann study's rounds 2–6 plus a
  few more composites (100, 12, 30, 56, 72, 81, …).
* **Trays** (8 numbers per base): which numeral in base 2, balanced ternary or base e? The trays carry their digits, so
  this checks that the barred 1 (the trit T), the group and point markers and base e's ellipsis read as intended. Near
  misses: one digit changed, T and 1 swapped, a digit dropped, the point moved.

## Results (2026-10-21)

| pictures | style | read right | confident (≥ 0.6) reads that were right | mean p(truth) |
|---|---|---|---|---|
| fingerprints (32) | sketchpad | 31 (97%) | 24 of 24 | 0.78 |
| fingerprints (32) | cyber | 30 (94%) | 20 of 20 | 0.75 |
| trays, base 2 (8) | sketchpad | 8 (100%) | 8 of 8 | 0.99 |
| trays, balanced ternary (8) | sketchpad | 8 (100%) | 8 of 8 | 0.95 |
| trays, base e (8) | sketchpad | 8 (100%) | 8 of 8 | 1.00 |
| trays, base 2 (8) | cyber | 8 (100%) | 8 of 8 | 0.99 |
| trays, balanced ternary (8) | cyber | 7 (88%) | 6 of 7 | 0.81 |
| trays, base e (8) | cyber | 8 (100%) | 8 of 8 | 0.99 |

The misses:

* 72 = 2³ × 3², read as 2² × 3² in both styles, with low confidence (0.49 sketchpad, 0.09 cyber). Its 2 wears the same
  two tilted rings as 360's, which was read right in both styles. The riemann study's one remaining miss was the same
  kind (360's 3² read as 3³): counting a container's tilted rings is the hardest part of the language, and Jev says so
  with low confidence rather than guessing confidently.
* 81 = 3⁴, read as 3³ in cyber (confidence 0.44); right in sketchpad.
* 40 = 1111 in balanced ternary, read as 111 in cyber (confidence 0.64): the only **confident** miss. In the picture
  the cyber trays' outlines (#25404e on near-black) and the group triangle after the first tray were almost invisible,
  so the first 1 stood apart from the row. That affected the equation space as much as the picture.

**The change it led to:** the cyber trays now have brighter, thicker outlines (#2f6475, 1.6) and the group and point
triangles a stronger stroke and fill. Re-reading the cyber trays afterwards (`--only trays --styles cyber`):

| pictures | style | read right | confident (≥ 0.6) reads that were right | mean p(truth) |
|---|---|---|---|---|
| trays, base 2 (8) | cyber | 8 (100%) | 8 of 8 | 0.99 |
| trays, balanced ternary (8) | cyber | 8 (100%) | 7 of 7 | 0.87 |
| trays, base e (8) | cyber | 8 (100%) | 8 of 8 | 0.98 |

(The near misses are drawn from a seeded generator, so a run that skips the fingerprints offers different near misses
for the trays: this is a re-check, not a strict A/B.)

The fingerprints were left as they are: the ring count is the language's own design (from the riemann project), and
its misses come with low confidence.

## Running it

```sh
TYPESAFE_API_KEY=… node tools/jev-legibility.mjs                       # everything, both styles (112 pictures)
TYPESAFE_API_KEY_FILE=path/to/key node tools/jev-legibility.mjs --only trays --styles cyber
```

Keep the key in the environment or a file outside the repository, never on the command line or in the repo. The
pictures, every answer (`answers.json`) and a summary table go to `artifacts/jev/` (not committed). Node 22+ and
Chrome are needed, as for the browser checks.
