// notes: pitch matrix. Column = step, row = scale degree (bottom row = 0).
// Returns a pattern of degree numbers — scale/octave/sound stay in code: n(mel).scale("C:minor").
// Mono (default): tapping a step sets its pitch, tapping the lit cell makes it a rest.
// poly: each cell toggles independently → chords.
import { Pattern as StrudelPattern, fastcat, pure, silence, stack } from '@strudel/core';
import { tag } from './tag';
import type { Env, Pattern, Widget } from './types';

export interface NotesOpts {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  poly?: boolean;
  /** one char per step: digit = degree, anything else = rest. e.g. '0..2..3.4...2.1.' */
  init?: string;
}

export const parseDegrees = (init: string | undefined, w: number): number[][] =>
  Array.from({ length: w }, (_, i) => {
    const c = init?.[i] ?? '';
    return /[0-9]/.test(c) ? [Number(c)] : [];
  });

export function notes(env: Env, opts: NotesOpts, defaultId: string): Widget & { pattern: Pattern } {
  const { x = 0, y = 0, poly = false, init } = opts;
  const w = opts.w ?? 16 - x;
  const h = opts.h ?? 5;
  const id = opts.id ?? defaultId;
  const st: { cols: number[][] } = (env.store[id] ??= { cols: parseDegrees(init, w) });
  st.cols = Array.from({ length: w }, (_, i) => (st.cols[i] ?? []).filter((d) => d < h));
  const rowOf = (deg: number) => y + (h - 1 - deg);

  const pattern = new StrudelPattern((state: any) =>
    fastcat(
      ...st.cols.map((ds, i) =>
        ds.length ? stack(...ds.map((d) => tag(pure(d), { id, x: x + i, y: rowOf(d) }))) : silence,
      ),
    ).query(state),
  );

  return {
    id, kind: 'notes', page: '', x, y, w, h, pattern,
    onKey(cx, cy, down) {
      if (!down) return;
      const deg = h - 1 - cy;
      const col = st.cols[cx];
      if (col.includes(deg)) st.cols[cx] = col.filter((d) => d !== deg);
      else st.cols[cx] = poly ? [...col, deg] : [deg];
      env.changed();
    },
    draw(put, { playStep }) {
      const ps = playStep(w);
      for (let i = 0; i < w; i++)
        for (let r = 0; r < h; r++) {
          const deg = h - 1 - r;
          let lv = st.cols[i].includes(deg) ? 6 : deg === 0 ? 1 : 0; // dim root row for orientation
          if (i === ps) lv = Math.max(lv, 2);
          put(x + i, y + r, lv);
        }
    },
  };
}
