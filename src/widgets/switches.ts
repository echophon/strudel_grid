// switches: a block of boolean switches, each column bound to a code-defined transform.
//   const fx = grid.switches({ y: 7, fns: [rev, x => x.fast(2)], q: 1 })
//   pat.sw(fx.row(0))   // all switches of a row, applied left → right
//   pat.sw(fx.at(1))    // one switch, anywhere in a chain
//   all(fx.all)         // globally
// Tap = latch; hold > HOLD_MS = momentary. Changes land on the next multiple of q cycles
// (q: 0 = immediate); armed switches blink until then.
import { fnLabel } from './label';
import { tag } from './tag';
import { createTimeline, scheduleChange, switchBy, timelineFor, valueAt, pendingAt, type Timeline } from './timeline';
import type { Env, GridTag, Pattern, Widget } from './types';

export { scheduleChange, valueAt, pendingAt, timelineFor };
export { allTimelines, resetTimeline } from './timeline';

export const HOLD_MS = 300;

/** a boolean timeline (one switch) */
export type Cell = Timeline<boolean>;
export const createCell = (latched = false): Cell => createTimeline(latched);

/**
 * Per sub-span: fn(pat) (tagged with the switch's cell) when on, else offFn(pat) (default pat).
 * Only the "on" side carries the tag, so the switch flashes while it's shaping notes.
 */
export function gate(cell: Cell, fn: (p: Pattern) => Pattern, t: GridTag, offFn: (p: Pattern) => Pattern = (p) => p) {
  return (pat: Pattern): Pattern => {
    const on = tag(fn(pat), t);
    const off = offFn(pat);
    return switchBy(cell, (v) => (v ? on : off));
  };
}

/** tap = latch; hold > HOLD_MS = momentary (release undoes it) */
export function holdable(tl: { downAt: number }, flip: () => void) {
  return (down: boolean) => {
    if (down) {
      tl.downAt = performance.now();
      flip();
    } else if (performance.now() - tl.downAt > HOLD_MS) flip();
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


export function switches(env: Env, opts: SwitchesOpts, defaultId: string): { widget: Widget; api: SwitchesApi } {
  const { x = 0, y = 0, h = 1, fns, q = 1 } = opts;
  if (!Array.isArray(fns) || !fns.length) throw new Error('grid.switches: `fns` must be a non-empty array of functions');
  const id = opts.id ?? defaultId;
  const st: { latched: Record<string, boolean> } = (env.store[id] ??= { latched: {} });
  const cell = (cx: number, cy: number): Cell => {
    return timelineFor(`${id}|${cx},${cy}`, !!st.latched[`${cx},${cy}`]);
  };
  const flip = (cx: number, cy: number) => {
    set(cx, cy, !cell(cx, cy).latched);
  };

  const set = (cx: number, cy: number, v: boolean) => {
    st.latched[`${cx},${cy}`] = v;
    scheduleChange(cell(cx, cy), v, env.nowCycle(), q);
    env.changed();
  };
  const at = (cx: number, cy = 0) => gate(cell(cx, cy), fns[cx], { id, x: x + cx, y: y + cy });
  const row = (cy = 0) => (pat: Pattern) => fns.reduce((p, _, cx) => at(cx, cy)(p), pat);

  const widget: Widget = {
    id, kind: 'switches', page: '', x, y, w: fns.length, h,
    labels: fns.map(fnLabel),
    onKey(cx, cy, down) {
      holdable(cell(cx, cy), () => flip(cx, cy))(down);
    },
    snapshot: () => ({ ...st.latched }),
    restore(s: Record<string, boolean>) {
      for (let cy = 0; cy < h; cy++)
        for (let cx = 0; cx < fns.length; cx++) {
          const v = !!s?.[`${cx},${cy}`];
          if (cell(cx, cy).latched !== v) set(cx, cy, v);
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
