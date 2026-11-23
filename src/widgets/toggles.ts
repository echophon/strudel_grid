// toggles: a row of on/off steps → boolean step pattern (one cycle across its width, or `step`
// cycles per step). Use with .struct()/.mask(); every hap carries its absolute cell tag.
// Hold one step + tap another = loop that range (same range again = clear).
import { Pattern as StrudelPattern, pure, silence } from '@strudel/core';
import { checkStep, clampLoop, loopGesture, loopPlayhead, sequence, stepWidth, type Loop, type StepOpts } from './steps';
import { tag } from './tag';
import type { Env, Pattern, Widget } from './types';

export interface TogglesOpts extends StepOpts {
  id?: string;
  x?: number;
  y?: number;
  /** number of steps (default: init's length, else the rest of the row) */
  w?: number;
  /** e.g. 'x...x...' — any char other than . - or space is "on". Applied only when first created. */
  init?: string;
  /** initial loop range [first, last] step (applied only when first created) */
  loop?: [number, number];
}

export const parseBits = (init: string | undefined, w: number): boolean[] =>
  Array.from({ length: w }, (_, i) => /[^.\s-]/.test(init?.[i] ?? '.'));
export const bitsToString = (bits: boolean[]) => bits.map((b) => (b ? 'x' : '.')).join('');

export function toggles(env: Env, opts: TogglesOpts, defaultId: string): Widget & { pattern: Pattern } {
  const { x = 0, y = 0, init } = opts;
  const w = stepWidth(opts);
  const id = opts.id ?? defaultId;
  const step = checkStep(opts.step, id);
  const st: { bits: boolean[]; loop?: Loop } = (env.store[id] ??= { bits: parseBits(init, w), loop: clampLoop(opts.loop, w) });
  st.bits = Array.from({ length: w }, (_, i) => !!st.bits[i]); // tolerate width changes
  st.loop = clampLoop(st.loop, w);

  const pattern = new StrudelPattern((state: any) =>
    sequence(st.bits.map((on, i) => (on ? tag(pure(true), { id, x: x + i, y }) : silence)), w, step, st.loop ?? null).query(state),
  );
  const gesture = loopGesture<boolean>({
    snap: (c) => st.bits[c],
    undo: (c, v) => { st.bits[c] = v; },
    getLoop: () => st.loop ?? null,
    setLoop: (l) => { st.loop = clampLoop(l, w); env.changed(); },
  });

  return {
    id, kind: 'toggles', page: '', x, y, w, h: 1, pattern,
    onKey(cx, _cy, down) {
      if (!down) return gesture.up(cx);
      gesture.down(cx, () => { st.bits[cx] = !st.bits[cx]; });
      env.changed();
    },
    draw(put, { started, cycle, now }) {
      const ps = loopPlayhead(started, cycle, w, step, st.loop ?? null);
      const armed = gesture.armed(now); // held long enough: tap another step to loop
      const [a, b] = st.loop ?? [0, w - 1];
      for (let i = 0; i < w; i++) {
        const inLoop = i >= a && i <= b;
        let lv = st.bits[i] ? (inLoop ? 5 : 2) : st.loop && inLoop ? 1 : 0;
        if (i === ps) lv = Math.max(lv, 2);
        if (i === armed) lv = 12;
        put(x + i, y, lv);
      }
    },
    snapshot: () => ({ bits: [...st.bits], loop: st.loop ?? null }),
    restore(s: { bits?: boolean[]; loop?: Loop }) {
      if (!s || !Array.isArray(s.bits)) return;
      st.bits = Array.from({ length: w }, (_, i) => !!s.bits![i]);
      st.loop = clampLoop(s.loop, w);
      env.changed();
    },
    capture: () => ({
      ...(init === undefined && !st.bits.some(Boolean) ? {} : { init: bitsToString(st.bits) }),
      loop: st.loop ?? undefined,
    }),
  };
}
