// PROTOTYPE — throwaway. Boolean switches that gate user-defined pattern transforms.
//
// QUESTION: Does a grid of latching/momentary switches, each bound to a code-defined
// transform (rev, fast(2), jux(rev)...), feel good both globally (via all()) and
// per pattern (interspersed with .sw(...))? Does quantising switch changes to the
// cycle (or not) matter?
//
// Pure except for the `now()` and `q` the caller supplies.

import { Pattern, TimeSpan, Fraction } from '@strudel/core';

// --- switch timeline: value as a function of cycle time --------------------------
// history: sorted [[cycle, value], ...]. Changes are scheduled in *cycle* time so the
// scheduler's lookahead queries see them consistently.
export function createCell() {
  return { history: [[-Infinity, false]], latched: false, downAt: 0 };
}
export const valueAt = (cell, c) => {
  let v = false;
  for (const [t, val] of cell.history) if (t <= c) v = val; else break;
  return v;
};
export function scheduleChange(cell, value, nowCycle, q) {
  const at = q > 0 ? Math.ceil(nowCycle / q - 1e-9) * q : nowCycle;
  cell.history = cell.history.filter(([t]) => t < at); // drop superseded pending changes
  cell.history.push([at, value]);
  if (cell.history.length > 32) cell.history = cell.history.slice(-32);
  return at;
}
export const pendingAt = (cell, nowCycle) => cell.history.some(([t]) => t > nowCycle);

// --- the gate --------------------------------------------------------------------
// Split each query at the switch's change points; within each sub-span take haps from
// fn(pat) if on, else pat, keeping only haps whose ONSET is inside the sub-span (so a
// switch flip never chops a note in half and never double-triggers).
export function gate(cell, fn, tag) {
  return (pat) => {
    const transformed = fn(pat).withContext((ctx) => ({
      ...ctx,
      locations: (ctx.locations || []).concat([{ grid: tag }]),
    }));
    return new Pattern((state) => {
      const b = state.span.begin.valueOf();
      const e = state.span.end.valueOf();
      const cuts = [b, ...cell.history.map(([t]) => t).filter((t) => t > b && t < e), e];
      const out = [];
      for (let i = 0; i < cuts.length - 1; i++) {
        const [sb, se] = [cuts[i], cuts[i + 1]];
        const src = valueAt(cell, sb) ? transformed : pat;
        const span = new TimeSpan(Fraction(sb), Fraction(se));
        for (const h of src.query(state.setSpan(span))) {
          if (!h.whole) { out.push(h); continue; }
          const on = h.whole.begin.valueOf();
          if (on >= sb && on < se) out.push(h);
        }
      }
      return out;
    });
  };
}
