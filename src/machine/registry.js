// The base registry: the one seam between the planner and a number base. binary and
// ternary are registered by bt-base.js (imported by plan.js); base e registers itself when
// e-base.js is imported, which the app does only on first use. Nothing here knows a base.
//
// spec = {
//   id, palette: OpId[],
//   parseValue(text)              → {ok:true, value} | {ok:false, error},
//   evaluate(op, args)            → {ok:true, values} | {ok:false, reason:'zeroDivision'|'domain', message},
//   display(value, {form})        → {text, approx?, digits?, reading?},
//   checkLimits(value)            → null | message,
//   validateTower(scene, towerId) → string[]            (I2 and I3 for this base)
//   place(b, towerId, value, {asLight = false}) → void  (write a value's bulbs)
//   ops: Record<OpId, (b, node, operands) => {result, other?}>,
// }
const bases = new Map();
export function registerBase(id, spec) { bases.set(id, spec); }
export function getBase(id) {
  const spec = bases.get(id);
  if (!spec) throw new Error(`base ${id} is not loaded`);
  return spec;
}
export function hasBase(id) { return bases.has(id); }
