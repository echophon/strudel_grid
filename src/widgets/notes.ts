// notes: pitch matrix. Column = step, row = scale degree (bottom row = 0).
// Returns a pattern of degree numbers — scale/octave/sound stay in code: n(mel).scale("C:minor").
// Mono (default): tapping a step sets its pitch, tapping the lit cell makes it a rest.
// poly: each cell toggles independently → chords.
// Hold one column + tap another = loop that range (same range again = clear).
import { Pattern as StrudelPattern, pure, silence, stack } from '@strudel/core';
import { checkStep, clampLoop, loopGesture, loopPlayhead, sequence, stepWidth, type Loop, type StepOpts } from './steps';
import { tag } from './tag';
import type { Env, Pattern, Widget } from './types';

export interface NotesOpts extends StepOpts {
  id?: string;
  x?: number;
  y?: number;
  /** number of steps (default: init's length, else the rest of the row) */
  w?: number;
  h?: number;
  poly?: boolean;
  /** one char per step: digit = degree, anything else = rest, e.g. '0..2..3.4...2.1.';
   *  or an array per step: number | number[] (chord) | null (rest), e.g. [0, [0,2,4], null] */
  init?: string | (number | number[] | null)[];
  /** initial loop range [first, last] step (applied only when first created) */
  loop?: [number, number];
}

export const parseDegrees = (init: NotesOpts['init'], w: number): number[][] =>
  Array.from({ length: w }, (_, i) => {
    if (Array.isArray(init)) {
      const v = init[i];
      return (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]).map(Number).filter(Number.isFinite);
    }
    const c = init?.[i] ?? '';
    return /[0-9]/.test(c) ? [Number(c)] : [];
  });

/** shortest faithful init: a string when every step is a rest or one digit, else an array */
export function degreesToInit(cols: number[][]): string | (number | number[] | null)[] {
  if (cols.every((c) => c.length <= 1 && (c[0] ?? 0) <= 9)) return cols.map((c) => (c.length ? String(c[0]) : '.')).join('');
  return cols.map((c) => (c.length === 0 ? null : c.length === 1 ? c[0] : [...c].sort((a, b) => a - b)));
}

export function notes(env: Env, opts: NotesOpts, defaultId: string): Widget & { pattern: Pattern } {
  const { x = 0, y = 0, poly = false, init } = opts;
  const w = opts.w ?? (Array.isArray(init) ? init.length : stepWidth(opts as { x?: number; w?: number; init?: string }));
  const h = opts.h ?? 5;
  const id = opts.id ?? defaultId;
  const step = checkStep(opts.step, id);
  const st: { cols: number[][]; loop?: Loop } = (env.store[id] ??= { cols: parseDegrees(init, w), loop: clampLoop(opts.loop, w) });
  st.cols = Array.from({ length: w }, (_, i) => (st.cols[i] ?? []).filter((d) => d < h));
  st.loop = clampLoop(st.loop, w);
  const rowOf = (deg: number) => y + (h - 1 - deg);

  const pattern = new StrudelPattern((state: any) =>
    sequence(
      st.cols.map((ds, i) => (ds.length ? stack(...ds.map((d) => tag(pure(d), { id, x: x + i, y: rowOf(d) }))) : silence)),
      w,
      step,
      st.loop ?? null,
    ).query(state),
  );
  const gesture = loopGesture<number[]>({
    snap: (c) => [...st.cols[c]],
    undo: (c, v) => { st.cols[c] = v; },
    getLoop: () => st.loop ?? null,
    setLoop: (l) => { st.loop = clampLoop(l, w); env.changed(); },
  });

  return {
    id, kind: 'notes', page: '', x, y, w, h, pattern,
    onKey(cx, cy, down) {
      if (!down) return gesture.up(cx);
      gesture.down(cx, () => {
        const deg = h - 1 - cy;
        const col = st.cols[cx];
        if (col.includes(deg)) st.cols[cx] = col.filter((d) => d !== deg);
        else st.cols[cx] = poly ? [...col, deg] : [deg];
      });
      env.changed();
    },
    draw(put, { started, cycle, now }) {
      const ps = loopPlayhead(started, cycle, w, step, st.loop ?? null);
      const armed = gesture.armed(now); // held long enough: tap another column to loop
      const [a, b] = st.loop ?? [0, w - 1];
      for (let i = 0; i < w; i++) {
        const inLoop = i >= a && i <= b;
        for (let r = 0; r < h; r++) {
          const deg = h - 1 - r;
          let lv = st.cols[i].includes(deg) ? (inLoop ? 6 : 2) : deg === 0 && inLoop ? 1 : 0; // dim root row = orientation
          if (i === ps) lv = Math.max(lv, 2);
          if (i === armed) lv = Math.max(lv, 4); // light the whole anchor column
          put(x + i, y + r, lv);
        }
      }
    },
    snapshot: () => ({ cols: st.cols.map((c) => [...c]), loop: st.loop ?? null }),
    restore(s: { cols?: number[][]; loop?: Loop }) {
      if (!s || !Array.isArray(s.cols)) return;
      st.cols = Array.from({ length: w }, (_, i) => (s.cols![i] ?? []).filter((d) => d < h));
      st.loop = clampLoop(s.loop, w);
      env.changed();
    },
    capture: () => ({
      ...(init === undefined && st.cols.every((c) => !c.length) ? {} : { init: degreesToInit(st.cols) }),
      loop: st.loop ?? undefined,
    }),
  };
}
