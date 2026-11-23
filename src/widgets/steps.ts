// Timing shared by step-based controls (toggles, notes).
//
// Default (no `step`): the control's steps span exactly one cycle, whatever its width — two controls
// of width 6 and 5 give a 6-against-5 POLYRHYTHM that realigns every cycle.
// With `step` (cycles per step, e.g. 1/8): every step lasts that long, so the loop is w*step cycles —
// widths 6 and 5 with the same step give a POLYMETER that drifts and realigns every 30 steps.
import { Fraction, fastcat } from '@strudel/core';
import type { Pattern } from './types';

export interface StepOpts {
  /** cycles per step (e.g. 1/8, 1/16). Omit to fit all steps into one cycle. */
  step?: number;
}

/** width: explicit w, else the init string's length, else the rest of the row */
export function stepWidth(o: { x?: number; w?: number; init?: string }) {
  return o.w ?? (o.init ? o.init.length : 16 - (o.x ?? 0));
}

export function checkStep(step: number | undefined, id: string) {
  if (step === undefined) return undefined;
  if (!(typeof step === 'number' && step > 0 && Number.isFinite(step)))
    throw new Error(`${id}: step must be a positive number of cycles, e.g. 1/8 (got ${String(step)})`);
  return step;
}

/** which step of a w-step control is playing at `cycle` */
export function stepAt(cycle: number, w: number, step: number | undefined) {
  const i = step === undefined ? Math.floor((((cycle % 1) + 1) % 1) * w) : Math.floor(cycle / step + 1e-9) % w;
  return (i + w) % w;
}

// --- loop range (hold one step + tap another) -------------------------------------------------
export type Loop = [number, number] | null;

export const clampLoop = (loop: Loop | undefined, w: number): Loop => {
  if (!Array.isArray(loop)) return null;
  const a = Math.max(0, Math.min(w - 1, Math.floor(Number(loop[0]))));
  const b = Math.max(0, Math.min(w - 1, Math.floor(Number(loop[1]))));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const r: [number, number] = [Math.min(a, b), Math.max(a, b)];
  return r[0] === 0 && r[1] === w - 1 ? null : r;
};

/**
 * Sequence a row of per-step patterns. Without loop/step: all w steps in one cycle (unchanged
 * behaviour). With a loop, the step length is kept (step, else 1/w cycle) and only steps a..b
 * play, so the loop gets shorter — kria-style. Exact fractions keep long runs drift-free.
 */
export function sequence(cells: Pattern[], w: number, step: number | undefined, loop: Loop): Pattern {
  const [a, b] = loop ?? [0, w - 1];
  const slice = cells.slice(a, b + 1);
  const pat = fastcat(...slice);
  if (!loop && step === undefined) return pat;
  const stepLen = step === undefined ? Fraction(1).div(w) : Fraction(step);
  return pat.slow(stepLen.mul(slice.length));
}

/** playhead column (absolute within the control) for the current loop, or -1 when stopped */
export function loopPlayhead(started: boolean, cycle: number, w: number, step: number | undefined, loop: Loop) {
  if (!started) return -1;
  const [a, b] = loop ?? [0, w - 1];
  const n = b - a + 1;
  if (!loop) return stepAt(cycle, w, step);
  return a + stepAt(cycle, n, step ?? 1 / w);
}

/** how long column A must be held before tapping B makes a loop (quicker overlaps are just edits) */
export const LOOP_HOLD_MS = 300;

/**
 * Hold column A (at least LOOP_HOLD_MS), tap column B → loop A..B (again with the same range →
 * clear). The edit A's key-down already made is undone, and B isn't edited. Overlapping keys
 * from fast editing (A not held long enough yet) are ordinary edits. Keys in the same column
 * edit normally (e.g. building a chord in a poly pitch matrix). armed() names the column that
 * is ready to anchor a loop, so the widget can light it.
 */
export function loopGesture<S>(o: {
  snap(col: number): S;
  undo(col: number, s: S): void;
  getLoop(): Loop;
  setLoop(l: Loop): void;
  now?: () => number;
  holdMs?: number;
}) {
  const now = o.now ?? (() => performance.now());
  const holdMs = o.holdMs ?? LOOP_HOLD_MS;
  const held = new Map<number, { snap: S; undone: boolean; keys: number; downAt: number }>();
  const anchor = (t: number, except?: number) =>
    [...held.entries()].find(([c, h]) => c !== except && t - h.downAt >= holdMs);
  return {
    down(col: number, edit: () => void) {
      const t = now();
      const a = anchor(t, col);
      if (a) {
        const [ac, h] = a;
        if (!h.undone) { o.undo(ac, h.snap); h.undone = true; }
        const next: Loop = [Math.min(ac, col), Math.max(ac, col)];
        const cur = o.getLoop();
        o.setLoop(cur && cur[0] === next[0] && cur[1] === next[1] ? null : next);
        return;
      }
      const h = held.get(col);
      if (h) h.keys++;
      else held.set(col, { snap: o.snap(col), undone: false, keys: 1, downAt: t });
      edit();
    },
    up(col: number) {
      const h = held.get(col);
      if (h && --h.keys <= 0) held.delete(col);
    },
    /** the column currently held long enough to anchor a loop, if any */
    armed(t = now()): number | undefined {
      return anchor(t)?.[0];
    },
  };
}
