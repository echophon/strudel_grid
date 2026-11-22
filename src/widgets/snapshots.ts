// snapshots: a strip of memory slots for control states.
//   grid.snapshots({ x: 8, y: 7, w: 8 })                 // every control that supports it
//   grid.snapshots({ y: 6, w: 4, of: ['kick', 'mel'] })  // only these ids
// Tap an empty slot = save · tap a full slot = recall · hold > HOLD_MS = save over it.
// Recall is immediate for step controls; quantised controls (switches, radio) schedule it on
// their own q, and faders glide there.
// LEDs: empty = faint · saved = dim · last saved/recalled = bright · held long enough = blink.
import { HOLD_MS } from './switches';
import { strip } from './radio';
import type { Env, Widget } from './types';

export interface SnapshotsOpts {
  id?: string;
  x?: number;
  y?: number;
  /** number of slots (default 8) */
  w?: number;
  vertical?: boolean;
  /** ids of the controls to include (default: every control that supports snapshots) */
  of?: string[];
}

type Slot = Record<string, unknown> | null;

export function snapshots(env: Env, controls: () => Widget[], opts: SnapshotsOpts, defaultId: string): Widget {
  const { x = 0, y = 0, vertical = false, of } = opts;
  const n = Math.max(1, opts.w ?? 8);
  const id = opts.id ?? defaultId;
  const g = strip(x, y, n, vertical);
  const st: { slots: Slot[]; last: number } = (env.store[id] ??= { slots: [], last: -1 });
  st.slots = Array.from({ length: n }, (_, i) => st.slots[i] ?? null);
  const downAt = new Map<number, number>();

  const included = () =>
    controls().filter((w) => w.id !== id && w.snapshot && w.restore && (!of || of.includes(w.id)));
  const save = (i: number) => {
    st.slots[i] = Object.fromEntries(included().map((w) => [w.id, structuredClone(w.snapshot!())]));
    st.last = i;
    env.changed();
  };
  const recall = (i: number) => {
    const slot = st.slots[i];
    if (!slot) return;
    for (const w of included()) if (w.id in slot) w.restore!(structuredClone(slot[w.id]));
    st.last = i;
    env.changed();
  };

  return {
    id, kind: 'snapshots', page: '', x, y, w: g.w, h: g.h,
    onKey(cx, cy, down) {
      const i = g.index(cx, cy);
      if (down) { downAt.set(i, performance.now()); return; }
      const t = downAt.get(i);
      downAt.delete(i);
      if (t === undefined) return;
      if (performance.now() - t >= HOLD_MS || !st.slots[i]) save(i);
      else recall(i);
    },
    draw(put, { now }) {
      for (let i = 0; i < n; i++) {
        const c = g.cell(i);
        const held = downAt.get(i);
        let lv = i === st.last && st.slots[i] ? 12 : st.slots[i] ? 5 : 1;
        if (held !== undefined && now - held >= HOLD_MS) lv = Math.floor(now / 100) % 2 ? 15 : 3;
        put(c.x, c.y, lv);
      }
    },
  };
}
