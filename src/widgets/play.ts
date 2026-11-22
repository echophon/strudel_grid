// play: a single toggle that starts/stops a pattern — a clip-launcher button.
//   const groove = grid.play({ x: 15, y: 0 })
//   s("bd*4, hh*8").sw(groove)        // or groove(pattern)
// Tap = latch on/off; hold > HOLD_MS = momentary (plays only while held, or mutes while held if on).
// Changes land on the next multiple of q cycles (q: 0 = immediate) and blink until then.
// LEDs: on = bright, flashing with every note the pattern plays · off = dim.
// One button can drive several patterns: use the same function on each.
import { silence } from '@strudel/core';
import { gate, holdable, pendingAt, scheduleChange, timelineFor, valueAt } from './switches';
import type { Env, Pattern, Widget } from './types';

export interface PlayOpts {
  id?: string;
  x?: number;
  y?: number;
  /** quantise starts/stops to multiples of q cycles (default 1; 0 = immediate) */
  q?: number;
  /** playing when first created (default true, so adding a button doesn't silence anything) */
  init?: boolean;
}

export function play(env: Env, opts: PlayOpts, defaultId: string): { widget: Widget; fn: (p: Pattern) => Pattern } {
  const { x = 0, y = 0, q = 1, init = true } = opts;
  const id = opts.id ?? defaultId;
  const st: { on: boolean } = (env.store[id] ??= { on: !!init });
  const cell = timelineFor(`${id}|play`, st.on);
  const flip = () => {
    st.on = !cell.latched;
    scheduleChange(cell, st.on, env.nowCycle(), q);
    env.changed();
  };
  const fn = gate(cell, (p) => p, { id, x, y }, () => silence);

  const widget: Widget = {
    id, kind: 'play', page: '', x, y, w: 1, h: 1,
    onKey(_cx, _cy, down) {
      holdable(cell, flip)(down);
    },
    draw(put, { now, cycle }) {
      let lv = valueAt(cell, cycle) ? 7 : 2;
      if (pendingAt(cell, cycle) && Math.floor(now / 125) % 2) lv = 11;
      put(x, y, lv);
    },
  };
  return { widget, fn };
}
