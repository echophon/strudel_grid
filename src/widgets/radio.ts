// radio: a strip of buttons, exactly one selected. Two flavours:
//   const scene = grid.radio({ y: 5, fns: [x=>x, x=>x.fast(2), rev] })   → (pat) => pat: pat.sw(scene)
//   const kit   = grid.radio({ y: 6, values: ['tr909', 'tr808'] })        → value pattern: .bank(kit)
// Changes land on the next multiple of q cycles (default 1; 0 = immediate); the target blinks
// until then. The selected button flashes whenever its choice shapes a note.
import { pure } from '@strudel/core';
import { fnLabel } from './label';
import { tag } from './tag';
import { pendingAt, pendingValue, scheduleChange, switchBy, timelineFor, valueAt, type Timeline } from './timeline';
import type { Env, Pattern, Widget } from './types';

export interface StripOpts {
  id?: string;
  x?: number;
  y?: number;
  /** lay the buttons out downwards instead of across */
  vertical?: boolean;
  /** quantise changes to multiples of q cycles (0 = immediate) */
  q?: number;
}
export interface RadioOpts extends StripOpts {
  fns?: ((p: Pattern) => Pattern)[];
  values?: unknown[];
  /** initially selected index (default 0) */
  init?: number;
}

/** geometry of a 1-D strip of n buttons */
export function strip(x: number, y: number, n: number, vertical = false) {
  return {
    w: vertical ? 1 : n,
    h: vertical ? n : 1,
    index: (cx: number, cy: number) => (vertical ? cy : cx),
    cell: (i: number) => (vertical ? { x, y: y + i } : { x: x + i, y }),
  };
}

/** a quantised "one of n" selection with persisted state; -1 can mean "none" */
export function selection(env: Env, id: string, init: number, q: number) {
  const st: { sel: number } = (env.store[id] ??= { sel: init });
  const tl: Timeline<number> = timelineFor(`${id}|sel`, st.sel);
  const select = (i: number) => {
    st.sel = i;
    scheduleChange(tl, i, env.nowCycle(), q);
    env.changed();
  };
  return { st, tl, select };
}

export function stripLevel(tl: Timeline<number>, i: number, now: number, cycle: number, on = 9, off = 3) {
  const blink = Math.floor(now / 125) % 2 === 1;
  if (pendingAt(tl, cycle) && pendingValue(tl, cycle) === i) return blink ? 11 : off;
  return valueAt(tl, cycle) === i ? on : off;
}

export function radio(env: Env, opts: RadioOpts, defaultId: string): { widget: Widget; value: Pattern | ((p: Pattern) => Pattern) } {
  const { x = 0, y = 0, vertical = false, q = 1, init = 0, fns, values } = opts;
  const id = opts.id ?? defaultId;
  const choices: unknown[] | undefined = fns ?? values;
  if (!Array.isArray(choices) || !choices.length || (fns && values))
    throw new Error(`${id}: give either fns: [...] (transforms) or values: [...] (a value pattern), non-empty`);
  const n = choices.length;
  const g = strip(x, y, n, vertical);
  const { st, tl, select } = selection(env, id, Math.min(Math.max(0, init), n - 1), q);
  if (st.sel >= n) select(n - 1);
  const t = (i: number) => ({ id, ...g.cell(i) });

  const value = fns
    ? (pat: Pattern) => {
        const branches = fns.map((f, i) => tag(f(pat), t(i)));
        return switchBy(tl, (i) => branches[i] ?? pat);
      }
    : (() => {
        const branches = values!.map((v, i) => tag(pure(v), t(i)));
        return switchBy(tl, (i) => branches[i] ?? branches[0], 'span');
      })();

  const widget: Widget = {
    id, kind: 'radio', page: '', x, y, w: g.w, h: g.h,
    labels: choices.map((c) => (typeof c === 'function' ? fnLabel(c) : JSON.stringify(c))),
    onKey(cx, cy, down) {
      if (down) select(g.index(cx, cy));
    },
    draw(put, { now, cycle }) {
      for (let i = 0; i < n; i++) {
        const c = g.cell(i);
        put(c.x, c.y, stripLevel(tl, i, now, cycle));
      }
    },
    snapshot: () => st.sel,
    restore(sel: number) {
      if (typeof sel === 'number' && sel !== st.sel && sel >= 0 && sel < n) select(sel);
    },
    capture: () => (opts.init === undefined && st.sel === 0 ? {} : { init: st.sel }), // don't write defaults
  };
  return { widget, value };
}
