// Registers base e with the machine. Nothing imports this statically: Machine loads it the
// first time base e is chosen, so the exact arithmetic of Q[e, 1/e] never weighs on start.
import { registerBase } from './registry.js';
import { eSpec } from './ops/e.js';

registerBase('e', eSpec);
