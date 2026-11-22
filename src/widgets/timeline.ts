// Timelines: a control's value as a function of CYCLE time, so the scheduler's lookahead
// queries see changes exactly where they land (quantised), never early or twice.
// Used by switches, play, radio, clips (and snapshots via those controls).
import { Fraction, Pattern as StrudelPattern, TimeSpan } from '@strudel/core';
import type { Pattern } from './types';

export interface Timeline<T> {
  /** the value the user last chose (persisted); may not have landed yet */
  latched: T;
  /** [cycle, value] change points, ascending; first entry is at -Infinity */
  history: [number, T][];
  /** performance.now() of the last key-down (for hold = momentary) */
  downAt: number;
}

export const createTimeline = <T>(latched: T): Timeline<T> => ({ latched, history: [[-Infinity, latched]], downAt: 0 });

export function valueAt<T>(tl: Timeline<T>, c: number): T {
  let v = tl.history[0][1];
  for (const [t, val] of tl.history) {
    if (t <= c) v = val;
    else break;
  }
  return v;
}

/** schedule `value` at the next multiple of q cycles after nowCycle (q 0 = now); returns when */
export function scheduleChange<T>(tl: Timeline<T>, value: T, nowCycle: number, q: number): number {
  const at = q > 0 ? Math.ceil(nowCycle / q - 1e-9) * q : nowCycle;
  tl.latched = value;
  tl.history = tl.history.filter(([t]) => t < at); // supersede pending changes
  tl.history.push([at, value]);
  if (tl.history.length > 32) tl.history = tl.history.slice(-32);
  return at;
}

export const pendingAt = <T>(tl: Timeline<T>, nowCycle: number) => tl.history.some(([t]) => t > nowCycle);
/** value of the change that hasn't landed yet, if any */
export const pendingValue = <T>(tl: Timeline<T>, nowCycle: number) => tl.history.find(([t]) => t > nowCycle)?.[1];
/** after a stop, cycle time restarts at 0: collapse to the latched value */
export const resetTimeline = <T>(tl: Timeline<T>) => { tl.history = [[-Infinity, tl.latched]]; };

/**
 * A pattern that follows the timeline: each query is split at change points and each sub-span
 * is answered by pick(value at that sub-span).
 *  - mode 'onset' (patterns that PLAY): at a change point, a hap belongs to the side its onset
 *    is on → no chopped notes, no doubles. Fragments at the query's own edges are kept (they
 *    have no onset, so they don't sound twice), which keeps rev/ply/… above us working
 *    however the scheduler slices its queries.
 *  - mode 'span' (patterns that supply VALUES, e.g. .s(sel)): keep every hap fragment, because
 *    the left side samples them over spans that may start after the hap's onset.
 */
export function switchBy<T>(tl: Timeline<T>, pick: (v: T) => Pattern, mode: 'onset' | 'span' = 'onset'): Pattern {
  return new StrudelPattern((state: any) => {
    const b = state.span.begin.valueOf();
    const e = state.span.end.valueOf();
    const cuts = [b, ...tl.history.map(([c]) => c).filter((c) => c > b && c < e), e];
    const out: any[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const [sb, se] = [cuts[i], cuts[i + 1]];
      const src = pick(valueAt(tl, sb));
      const span = cuts.length === 2 ? state.span : new TimeSpan(Fraction(sb), Fraction(se));
      // 'onset': a hap belongs to the side of a *change point* its onset is on. The query's own
      // edges are not change points — fragments of events that began before the query must
      // survive, because time-warping transforms above us (rev, ply, …) turn them into onsets.
      const lo = i > 0 ? sb : -Infinity;
      const hi = i < cuts.length - 2 ? se : Infinity;
      for (const h of src.query(state.setSpan(span))) {
        if (mode === 'span' || !h.whole) { out.push(h); continue; }
        const on = h.whole.begin.valueOf();
        if (on >= lo && on < hi) out.push(h);
      }
    }
    return out;
  });
}

// --- runtime registry: timelines live outside the persisted store, keyed per control ----------
const registry = new Map<string, Timeline<any>>();

/** the runtime timeline for `key`, created from the persisted value on first use */
export function timelineFor<T>(key: string, latched: T): Timeline<T> {
  let tl = registry.get(key);
  if (!tl) registry.set(key, (tl = createTimeline(latched)));
  return tl;
}
export const allTimelines = () => registry.values();
/** forget runtime timelines (tests, reset) */
export const clearTimelines = () => registry.clear();
