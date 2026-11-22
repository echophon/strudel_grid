// fader: a strip whose lit position is a number → a continuous value pattern.
//   const cut = grid.fader({ y: 6, range: [200, 5000], exp: true, glide: 1 })
//   s("saw").lpf(cut)            // any control parameter, setcps, .gain(...), etc.
// Tap a position = jump there (snap), or slide there over `glide` cycles (scheduler time, so it
// lands the same no matter how the scheduler slices its queries). Left/bottom = range[0].
// LEDs: a dim bar up to the current position, the current position bright, the target blinking
// while it glides.
import { signal } from '@strudel/core';
import { scheduleChange, timelineFor, type Timeline } from './timeline';
import type { Env, Pattern, Widget } from './types';

export interface FaderOpts {
  id?: string;
  x?: number;
  y?: number;
  /** number of positions (default: rest of the row, or rest of the column when vertical) */
  w?: number;
  vertical?: boolean;
  /** [low, high] (default [0, 1]) */
  range?: [number, number];
  /** exponential spacing (for frequencies, times) — needs low > 0 */
  exp?: boolean;
  /** cycles to slide to a new position (default 0 = jump) */
  glide?: number;
  /** initial value (default: low end) */
  init?: number;
}

export interface Seg {
  from: number;
  to: number;
  glide: number;
}

/** value of a glide timeline at cycle c */
export function segValueAt(tl: Timeline<Seg>, c: number): number {
  let at = -Infinity;
  let seg = tl.history[0][1];
  for (const [t, s] of tl.history) {
    if (t <= c) [at, seg] = [t, s];
    else break;
  }
  if (!(seg.glide > 0) || at === -Infinity) return seg.to;
  const k = Math.min(1, Math.max(0, (c - at) / seg.glide));
  return seg.from + (seg.to - seg.from) * k;
}

export function fader(env: Env, opts: FaderOpts, defaultId: string): Widget & { pattern: Pattern } {
  const { x = 0, y = 0, vertical = false, range = [0, 1], exp = false, glide = 0 } = opts;
  const id = opts.id ?? defaultId;
  const n = Math.max(2, opts.w ?? (vertical ? 8 - y : 16 - x));
  const [lo, hi] = range.map(Number);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error(`${id}: range must be [low, high] numbers`);
  if (exp && !(lo > 0 && hi > 0)) throw new Error(`${id}: exp needs a range above 0`);

  const valueOf = (pos: number) => {
    const k = pos / (n - 1);
    return exp ? lo * Math.pow(hi / lo, k) : lo + (hi - lo) * k;
  };
  const posOf = (v: number) => {
    const k = exp ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo || 1);
    return Math.min(n - 1, Math.max(0, Math.round(k * (n - 1))));
  };

  const st: { value: number } = (env.store[id] ??= { value: opts.init ?? lo });
  const tl = timelineFor<Seg>(`${id}|fader`, { from: st.value, to: st.value, glide: 0 });
  const setValue = (v: number) => {
    const now = env.nowCycle();
    st.value = v;
    scheduleChange(tl, { from: segValueAt(tl, now), to: v, glide }, now, 0);
    env.changed();
  };

  const pattern = signal((t: any) => segValueAt(tl, Number(t.valueOf())));
  const cell = (i: number) => (vertical ? { x, y: y + (n - 1 - i) } : { x: x + i, y });

  return {
    id, kind: 'fader', page: '', x, y, w: vertical ? 1 : n, h: vertical ? n : 1, pattern,
    onKey(cx, cy, down) {
      if (down) setValue(valueOf(vertical ? n - 1 - cy : cx));
    },
    draw(put, { now, cycle }) {
      const cur = posOf(segValueAt(tl, cycle));
      const target = posOf(st.value);
      for (let i = 0; i < n; i++) {
        const c = cell(i);
        let lv = i < cur ? 2 : i === cur ? 10 : 0;
        if (i === target && target !== cur && Math.floor(now / 125) % 2) lv = 6;
        put(c.x, c.y, lv);
      }
    },
    snapshot: () => st.value,
    restore(v: number) {
      if (typeof v === 'number' && v !== st.value) setValue(v);
    },
    capture: () => (opts.init === undefined && st.value === lo ? {} : { init: Number(st.value.toPrecision(4)) }),
  };
}

