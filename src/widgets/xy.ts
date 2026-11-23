// xy: a 2-D pad — one key press sets two values at once.
//   const pad = grid.xy({ x: 8, y: 0, w: 8, h: 8, xRange: [200, 6000], xExp: true, yRange: [0, .9] })
//   s("saw").lpf(pad.x).room(pad.y)
// Column → pad.x (left = low), row → pad.y (bottom = low). Both are continuous value patterns,
// like grid.fader; `glide` slides both to the new point over that many cycles.
// LEDs: a dim crosshair through the current point, the point bright, the target blinking while
// it glides.
import { axis, glider } from './fader';
import type { Env, Pattern, Widget } from './types';

export interface XyOpts {
  id?: string;
  x?: number;
  y?: number;
  /** columns (default: rest of the row) */
  w?: number;
  /** rows (default: down to the bottom of the grid) */
  h?: number;
  /** [low, high] for pad.x (default [0, 1]) */
  xRange?: [number, number];
  /** [low, high] for pad.y (default [0, 1]) */
  yRange?: [number, number];
  /** exponential spacing per axis (frequencies, times) — needs a range above 0 */
  xExp?: boolean;
  yExp?: boolean;
  /** cycles to slide to a new point (default 0 = jump) */
  glide?: number;
  /** initial [x value, y value] (default: the low ends) */
  init?: [number, number];
}

export function xy(env: Env, opts: XyOpts, defaultId: string): Widget & { px: Pattern; py: Pattern } {
  const { x = 0, y = 0, glide = 0 } = opts;
  const id = opts.id ?? defaultId;
  const w = Math.max(2, opts.w ?? 16 - x);
  const h = Math.max(2, opts.h ?? 8 - y);
  const ax = axis(`${id} (x)`, w, opts.xRange ?? [0, 1], !!opts.xExp);
  const ay = axis(`${id} (y)`, h, opts.yRange ?? [0, 1], !!opts.yExp);

  const st: { value: [number, number] } = (env.store[id] ??= { value: [...(opts.init ?? [ax.lo, ay.lo])] });
  const gx = glider(env, `${id}|x`, st.value[0], glide);
  const gy = glider(env, `${id}|y`, st.value[1], glide);
  const setValue = (vx: number, vy: number) => {
    st.value = [vx, vy];
    gx.set(vx);
    gy.set(vy);
    env.changed();
  };
  const row = (pos: number) => y + (h - 1 - pos); // bottom row = low

  return {
    id, kind: 'xy', page: '', x, y, w, h, px: gx.pattern, py: gy.pattern,
    labels: [`x: ${(opts.xRange ?? [0, 1]).join('–')}${opts.xExp ? ' exp' : ''}`, `y: ${(opts.yRange ?? [0, 1]).join('–')}${opts.yExp ? ' exp' : ''}`],
    onKey(cx, cy, down) {
      if (down) setValue(ax.valueOf(cx), ay.valueOf(h - 1 - cy));
    },
    draw(put, { now, cycle }) {
      const cx = ax.posOf(gx.at(cycle));
      const cy = ay.posOf(gy.at(cycle));
      const tx = ax.posOf(st.value[0]);
      const ty = ay.posOf(st.value[1]);
      const blink = Math.floor(now / 125) % 2 === 1;
      for (let i = 0; i < w; i++)
        for (let j = 0; j < h; j++) {
          let lv = i === cx && j === cy ? 12 : i === cx || j === cy ? 2 : 0;
          if (i === tx && j === ty && (tx !== cx || ty !== cy) && blink) lv = 7;
          put(x + i, row(j), lv);
        }
    },
    snapshot: () => [...st.value],
    restore(v: [number, number]) {
      if (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && (v[0] !== st.value[0] || v[1] !== st.value[1]))
        setValue(v[0], v[1]);
    },
    capture: () =>
      opts.init === undefined && st.value[0] === ax.lo && st.value[1] === ay.lo
        ? {}
        : { init: st.value.map((v) => Number(v.toPrecision(4))) },
  };
}
