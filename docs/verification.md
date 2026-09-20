# Verification

The following checks were performed during the first implementation.

## Automated

`node --test tests/*.test.js`: 13 passing tests, including:

- Exact rational arithmetic and safe intermediate reduction.
- Parsing signs, decimals, grouped thousands, parentheses, and fractions.
- Rejection of malformed input, non-linear expressions, and zero factors that destroy equivalence.
- All eight lesson answers checked by exact substitution.
- Transposition, cancellation, simplification, and both-side operations preserve solution sets across every lesson and four positive/negative rational factors.
- 0 / 1 / 10 support-card cycling at local magnitudes 1 / 10 / 100, with comma resets.
- Every occupied top and support card face receives the correct k/M inscription.

`node tools/build.mjs`: static build succeeds; approximately 0.44 MB including the original production textures. Unused reference assets are excluded.

## In-browser interactions

- Original SWF opened locally with Ruffle; keyboard input and dragging inspected.
- Modern app: physically dragged `+3` across equals in `x + 3 = 7`, verified `x = 7 − 3`, then dragged the red `−3` onto blue `+7` and verified `x = 4`.
- Solved `3x + 2 = 14` by moving 2, combining, and dividing by 3. Undo restored `3x = 12`.
- Solved `x/2 + 1/3 = 5/6` with exact fractions and multiplication by 2.
- Division by zero produces an explanation and preserves the workspace.
- Input `x + 1,234 = 2,234` builds correctly; `x*x=4` is rejected with a linear-equation explanation.
- Carry and division animations played to completion; borrow and multiplication steps exercised.
- Selected the hundred-thousands digit in `1,234,567` and enabled Spread cards: ten under-cards per occupied cell, k inscriptions, one nested outline, and the correct 200,000 contribution were visible.
- At a 390 × 844 viewport, the page fits without horizontal document overflow, and tap-to-select / Move / Combine solves the first lesson.
- Browser console checked for errors and warnings; none observed in these flows.

These checks do not replace user testing of the teaching model or verification in every browser. The prototype's scripted arithmetic workshop and linear-equation scope are documented in the README.
