// toggles: a row of on/off steps → boolean step pattern (one cycle across its width).
// Use with .struct()/.mask(); every hap carries its absolute cell tag for LED flashes.
import { Pattern as StrudelPattern, fastcat, pure, silence } from '@strudel/core';
import { tag } from './tag';
import type { Env, Pattern, Widget } from './types';

export interface TogglesOpts {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  /** e.g. 'x...x...' — any char other than . - or space is "on". Applied only when first created. */
  init?: string;
}

export const parseBits = (init: string | undefined, w: number): boolean[] =>
  Array.from({ length: w }, (_, i) => /[^.\s-]/.test(init?.[i] ?? '.'));

export function toggles(env: Env, opts: TogglesOpts, defaultId: string): Widget & { pattern: Pattern } {
  const { x = 0, y = 0, init } = opts;
  const w = opts.w ?? 16 - x;
  const id = opts.id ?? defaultId;
  const st: { bits: boolean[] } = (env.store[id] ??= { bits: parseBits(init, w) });
  st.bits = Array.from({ length: w }, (_, i) => !!st.bits[i]); // tolerate width changes

  const pattern = new StrudelPattern((state: any) =>
    fastcat(...st.bits.map((on, i) => (on ? tag(pure(true), { id, x: x + i, y }) : silence))).query(state),
  );

  return {
    id, kind: 'toggles', page: '', x, y, w, h: 1, pattern,
    onKey(cx, _cy, down) {
      if (!down) return;
      st.bits[cx] = !st.bits[cx];
      env.changed();
    },
    draw(put, { playStep }) {
      const ps = playStep(w);
      for (let i = 0; i < w; i++) put(x + i, y, st.bits[i] ? 5 : i === ps ? 2 : 0);
    },
  };
}
