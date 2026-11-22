// transport: start/stop from the grid, with a beat light and a bar counter.
//   grid.transport({ x: 15, y: 7 })          // one button
//   grid.transport({ x: 8, y: 7, w: 8 })     // button + 7-cycle position strip
//   grid.transport({ x: 15, y: 0, w: 4, vertical: true })  // the same, running downwards
// Cell 0: tap = start (re-runs the code) / stop. Pulses on every beat while playing.
// Cells 1..w-1: which cycle of the group is playing (cycle mod (w-1)).
import { strip } from './radio';
import type { Widget } from './types';

export interface Transport {
  start(): void;
  stop(): void;
  started(): boolean;
}

export interface TransportOpts {
  id?: string;
  x?: number;
  y?: number;
  /** cells: 1 = just the button, more = button + cycle-position strip */
  w?: number;
  /** lay the strip out downwards */
  vertical?: boolean;
  /** beat pulses per cycle (default 4) */
  beats?: number;
}

export function transport(t: Transport, opts: TransportOpts, defaultId: string): Widget {
  const { x = 0, y = 0, beats = 4, vertical = false } = opts;
  const n = Math.max(1, opts.w ?? 1);
  const id = opts.id ?? defaultId;
  const g = strip(x, y, n, vertical);
  const put1 = (put: (x: number, y: number, lv: number) => void, i: number, lv: number) => {
    const c = g.cell(i);
    put(c.x, c.y, lv);
  };
  return {
    id, kind: 'transport', page: '', x, y, w: g.w, h: g.h,
    onKey(cx, cy, down) {
      if (!down || g.index(cx, cy) !== 0) return;
      if (t.started()) t.stop();
      else t.start();
    },
    draw(put, { started, cycle }) {
      if (!started) {
        put1(put, 0, 3);
        for (let i = 1; i < n; i++) put1(put, i, 0);
        return;
      }
      const phase = (((cycle * beats) % 1) + 1) % 1;
      const downbeat = (((cycle % 1) + 1) % 1) < 1 / beats;
      put1(put, 0, Math.round((downbeat ? 15 : 11) - phase * 6));
      const bar = Math.floor(cycle) % Math.max(1, n - 1);
      for (let i = 1; i < n; i++) put1(put, i, i - 1 === bar ? 9 : 1);
    },
  };
}
