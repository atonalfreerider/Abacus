// Scene arithmetic. A plan stores its start scene and one diff per beat; the scene at beat
// boundary i is the start with the first i diffs applied. Entries are never mutated, so
// unchanged nodes, towers and bulbs are shared between scenes.
// scenes[0] = plan.start; scenes[i+1] = applyDiff(scenes[i], beats[i].set)
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
// Scene fields are strings, numbers and booleans; anything else compares by its JSON.
const same = (x, y) => x === y || (typeof x === 'object' && x !== null && typeof y === 'object' && y !== null && JSON.stringify(x) === JSON.stringify(y));
// The inverse of applyDiff: a new id carries its full object, a changed entry only its
// changed fields (a removed field as null), and a removed id is null.
export function diffScenes(a, b) {
  const diff = {};
  for (const key of ['nodes', 'towers', 'bulbs']) {
    const x = a[key] || {}, y = b[key] || {}; if (x === y) continue;
    let patch = null;
    for (const id in y) {
      const p = x[id], q = y[id]; if (p === q) continue;
      let d;
      if (!p) d = {...q};
      else {
        d = null;
        for (const f in q) if (!same(p[f], q[f])) (d ??= {})[f] = q[f];
        for (const f in p) if (!(f in q)) (d ??= {})[f] = null;
        if (!d) continue;
      }
      (patch ??= {})[id] = d;
    }
    for (const id in x) if (!(id in y)) (patch ??= {})[id] = null;
    if (patch) diff[key] = patch;
  }
  return diff;
}
