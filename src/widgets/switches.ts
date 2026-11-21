// switches: a block of boolean switches, each column bound to a code-defined transform.
//   const fx = grid.switches({ y: 7, fns: [rev, x => x.fast(2)], q: 1 })
//   pat.sw(fx.row(0))   // all switches of a row, applied left → right
//   pat.sw(fx.at(1))    // one switch, anywhere in a chain
//   all(fx.all)         // globally
// Tap = latch; hold > HOLD_MS = momentary. Changes land on the next multiple of q cycles
// (q: 0 = immediate); armed switches blink until then.
import { Pattern as StrudelPattern, TimeSpan, Fraction } from '@strudel/core';
import { tag } from './tag';
import type { Env, GridTag, Pattern, Widget } from './types';

export const HOLD_MS = 300;

// --- timeline: switch value as a function of cycle time (lookahead-safe) -------------
export interface Cell {
  latched: boolean;
  history: [number, boolean][];
  downAt: number;
}
export const createCell = (latched = false): Cell => ({ latched, history: [[-Infinity, latched]], downAt: 0 });

export function valueAt(cell: Cell, c: number): boolean {
  let v = false;
  for (const [t, val] of cell.history) {
    if (t <= c) v = val;
    else break;
  }
  return v;
}
export function scheduleChange(cell: Cell, value: boolean, nowCycle: number, q: number): number {
  const at = q > 0 ? Math.ceil(nowCycle / q - 1e-9) * q : nowCycle;
  cell.history = cell.history.filter(([t]) => t < at); // supersede pending changes
  cell.history.push([at, value]);
  if (cell.history.length > 32) cell.history = cell.history.slice(-32);
  return at;
}
export const pendingAt = (cell: Cell, nowCycle: number) => cell.history.some(([t]) => t > nowCycle);
/** after a stop, cycle time restarts at 0: collapse to the latched value */
export const resetTimeline = (cell: Cell) => { cell.history = [[-Infinity, cell.latched]]; };

// --- the gate -----------------------------------------------------------------------
/**
 * Split each query at the switch's change points; per sub-span take haps from fn(pat) when on,
 * else pat, keeping only haps whose ONSET lies in the sub-span → no chopped notes, no doubles.
 */
export function gate(cell: Cell, fn: (p: Pattern) => Pattern, t: GridTag) {
  return (pat: Pattern): Pattern => {
    const transformed = tag(fn(pat), t);
    return new StrudelPattern((state: any) => {
      const b = state.span.begin.valueOf();
      const e = state.span.end.valueOf();
      const cuts = [b, ...cell.history.map(([c]) => c).filter((c) => c > b && c < e), e];
      const out: any[] = [];
      for (let i = 0; i < cuts.length - 1; i++) {
        const [sb, se] = [cuts[i], cuts[i + 1]];
        const src = valueAt(cell, sb) ? transformed : pat;
        for (const h of src.query(state.setSpan(new TimeSpan(Fraction(sb), Fraction(se))))) {
          if (!h.whole) { out.push(h); continue; }
          const on = h.whole.begin.valueOf();
          if (on >= sb && on < se) out.push(h);
        }
      }
      return out;
    });
  };
}

// --- widget -------------------------------------------------------------------------
export interface SwitchesOpts {
  id?: string;
  x?: number;
  y?: number;
  h?: number;
  fns: ((p: Pattern) => Pattern)[];
  q?: number;
}
export interface SwitchesApi {
  at(col: number, row?: number): (p: Pattern) => Pattern;
  row(row?: number): (p: Pattern) => Pattern;
  all: (p: Pattern) => Pattern;
}

/** runtime timelines (not persisted; rebuilt from the persisted `latched` flags) */
const timelines = new Map<string, Cell>();
export const allTimelines = () => timelines.values();

export function switches(env: Env, opts: SwitchesOpts, defaultId: string): { widget: Widget; api: SwitchesApi } {
  const { x = 0, y = 0, h = 1, fns, q = 1 } = opts;
  if (!Array.isArray(fns) || !fns.length) throw new Error('grid.switches: `fns` must be a non-empty array of functions');
  const id = opts.id ?? defaultId;
  const st: { latched: Record<string, boolean> } = (env.store[id] ??= { latched: {} });
  const cell = (cx: number, cy: number): Cell => {
    const k = `${id}|${cx},${cy}`;
    let c = timelines.get(k);
    if (!c) timelines.set(k, (c = createCell(!!st.latched[`${cx},${cy}`])));
    return c;
  };
  const flip = (cx: number, cy: number) => {
    const c = cell(cx, cy);
    c.latched = !c.latched;
    st.latched[`${cx},${cy}`] = c.latched;
    scheduleChange(c, c.latched, env.nowCycle(), q);
    env.changed();
  };

  const at = (cx: number, cy = 0) => gate(cell(cx, cy), fns[cx], { id, x: x + cx, y: y + cy });
  const row = (cy = 0) => (pat: Pattern) => fns.reduce((p, _, cx) => at(cx, cy)(p), pat);

  const widget: Widget = {
    id, kind: 'switches', page: '', x, y, w: fns.length, h,
    labels: fns.map((f) => String(f).replace(/\s+/g, ' ')),
    onKey(cx, cy, down) {
      const c = cell(cx, cy);
      if (down) {
        c.downAt = performance.now();
        flip(cx, cy); // tap = latch
      } else if (performance.now() - c.downAt > HOLD_MS) {
        flip(cx, cy); // long hold = momentary: release undoes it
      }
    },
    draw(put, { now, cycle }) {
      for (let cy = 0; cy < h; cy++)
        for (let cx = 0; cx < fns.length; cx++) {
          const c = cell(cx, cy);
          let lv = valueAt(c, cycle) ? 9 : 2;
          if (pendingAt(c, cycle) && Math.floor(now / 125) % 2) lv = 6;
          put(x + cx, y + cy, lv);
        }
    },
  };
  return { widget, api: { at, row, all: row(0) } };
}
