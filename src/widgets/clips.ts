// clips: a clip launcher. One button per pattern; at most one plays at a time.
//   const bass = grid.clips({ y: 5, patterns: [bassA, bassB, bassC] })   → a pattern: stack(..., bass)
// Tap a clip = queue it (starts on the next multiple of q cycles; default 1); tap the playing clip
// = queue stop. Several lanes = several grid.clips calls.
// LEDs: playing = bright + flashes with its notes · queued = blink · stopped = dim.
import { silence } from '@strudel/core';
import { selection, strip, stripLevel, type StripOpts } from './radio';
import { tag } from './tag';
import { switchBy, valueAt } from './timeline';
import type { Env, Pattern, Widget } from './types';

export interface ClipsOpts extends StripOpts {
  patterns: Pattern[];
  /** clip playing when first created (default -1 = none) */
  init?: number;
}

export function clips(env: Env, opts: ClipsOpts, defaultId: string): { widget: Widget; pattern: Pattern } {
  const { x = 0, y = 0, vertical = false, q = 1, init = -1, patterns } = opts;
  const id = opts.id ?? defaultId;
  if (!Array.isArray(patterns) || !patterns.length) throw new Error(`${id}: patterns must be a non-empty array of patterns`);
  const n = patterns.length;
  const g = strip(x, y, n, vertical);
  const { st, tl, select } = selection(env, id, init, q);
  if (st.sel >= n) select(-1);

  const branches = patterns.map((p, i) => tag(p, { id, ...g.cell(i) }));
  const pattern = switchBy(tl, (i) => branches[i] ?? silence);

  const widget: Widget = {
    id, kind: 'clips', page: '', x, y, w: g.w, h: g.h,
    labels: patterns.map((_, i) => `clip ${i}`),
    onKey(cx, cy, down) {
      if (!down) return;
      const i = g.index(cx, cy);
      select(st.sel === i ? -1 : i); // the playing (or queued) clip again = stop
    },
    draw(put, { now, cycle }) {
      for (let i = 0; i < n; i++) {
        const c = g.cell(i);
        put(c.x, c.y, stripLevel(tl, i, now, cycle, 8, 3));
      }
      // queued stop: blink the clip that's about to stop
      const cur = valueAt(tl, cycle);
      if (st.sel === -1 && cur >= 0 && Math.floor(now / 125) % 2) {
        const c = g.cell(cur);
        put(c.x, c.y, 1);
      }
    },
  };
  return { widget, pattern };
}
