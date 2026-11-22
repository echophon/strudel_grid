import { n, s } from '@strudel/core';
import '@strudel/tonal';
import { describe, expect, it } from 'vitest';
import { readTags } from '../src/widgets/tag';
import { notes } from '../src/widgets/notes';
import { toggles } from '../src/widgets/toggles';
import { stepAt } from '../src/widgets/steps';
import { makeEnv, onsets } from './helpers';

const cellOf = (h: any) => readTags(h).map((t) => `${t.x},${t.y}`).join('+');

describe('toggles', () => {
  it('init seeds once; state then belongs to the grid and survives re-creation', () => {
    const env = makeEnv();
    const a = toggles(env, { y: 0, init: 'x.......' , w: 8 }, 'k');
    a.onKey(2, 0, true);
    expect(env.changes).toBe(1);
    const b = toggles(env, { y: 0, init: '........', w: 8 }, 'k'); // re-eval with a different init
    expect(onsets(s('bd').struct(b.pattern)).map(cellOf)).toEqual(['0,0', '2,0']);
  });

  it('reads live state at query time', () => {
    const env = makeEnv();
    const t = toggles(env, { y: 3, w: 4 }, 't');
    expect(onsets(t.pattern)).toHaveLength(0);
    t.onKey(1, 0, true);
    expect(onsets(t.pattern).map(cellOf)).toEqual(['1,3']);
  });
});

describe('notes (pitch matrix)', () => {
  const make = (opts = {}) => notes(makeEnv(), { y: 2, h: 5, init: '0..2..3.4...2.1.', ...opts }, 'mel');

  it('maps degrees to scale and tags the exact cell (bottom row = degree 0)', () => {
    const m = make();
    const haps = onsets(n(m.pattern).scale('C:minor'));
    expect(haps.map((h: any) => h.value.note)).toEqual(['C3', 'Eb3', 'F3', 'G3', 'Eb3', 'D3']);
    expect(haps.map(cellOf)).toEqual(['0,6', '3,4', '6,3', '8,2', '12,4', '14,5']);
  });

  it('transposed notes still flash their source cell', () => {
    const haps = onsets(n(make().pattern.add(7)).scale('C:minor'));
    expect(haps[0].value.note).toBe('C4');
    expect(cellOf(haps[0])).toBe('0,6');
  });

  it('mono: tap sets/replaces pitch, tap lit cell = rest', () => {
    const m = make();
    m.onKey(0, 0, true); // col 0, top row → degree 4 replaces degree 0
    expect(onsets(m.pattern)[0].value).toBe(4);
    m.onKey(0, 0, true); // tap it again → rest
    expect(onsets(m.pattern)[0].value).toBe(2); // first onset is now col 3
  });

  it('poly: cells toggle independently into chords', () => {
    const m = make({ poly: true, init: '0' });
    m.onKey(0, 2, true); // degree 2 added to col 0
    const vals = onsets(m.pattern).map((h: any) => h.value).sort();
    expect(vals).toEqual([0, 2]);
  });
});

describe('sequence lengths', () => {
  const times = (pat: any, b: number, e: number) => onsets(pat, b, e).map((h: any) => Number(h.whole.begin.valueOf().toFixed(4)));

  it('width defaults to the init string length', () => {
    const env = makeEnv();
    expect(toggles(env, { x: 6, init: 'x..x.' }, 'a').w).toBe(5);
    expect(notes(env, { init: '0.2' }, 'b').w).toBe(3);
    expect(toggles(env, { x: 6 }, 'c').w).toBe(10); // no init: rest of the row
  });

  it('without step: every width fits one cycle (6 against 5 polyrhythm)', () => {
    const env = makeEnv();
    const six = toggles(env, { init: 'x.....' }, 'six').pattern;
    const five = toggles(env, { x: 6, init: 'x....' }, 'five').pattern;
    expect(times(six, 0, 2)).toEqual([0, 1]);
    expect(times(five, 0, 2)).toEqual([0, 1]);
  });

  it('with step: equal step lengths, lengths 6 and 5 drift (polymeter)', () => {
    const env = makeEnv();
    const six = toggles(env, { init: 'x.....', step: 1 / 8 }, 'six').pattern;
    const five = toggles(env, { x: 6, init: 'x....', step: 1 / 8 }, 'five').pattern;
    expect(times(six, 0, 2)).toEqual([0, 0.75, 1.5]); // every 6 steps
    expect(times(five, 0, 2)).toEqual([0, 0.625, 1.25, 1.875]); // every 5 steps
    // they realign after lcm(6,5) = 30 steps = 3.75 cycles
    expect(times(six, 3.7, 3.8)).toEqual([3.75]);
    expect(times(five, 3.7, 3.8)).toEqual([3.75]);
  });

  it('tags still point at the right cell when stretched', () => {
    const env = makeEnv();
    const t = toggles(env, { x: 6, y: 0, init: '..x..', step: 1 / 4 }, 't').pattern;
    expect(onsets(t, 0, 1.25).map(cellOf)).toEqual(['8,0']);
  });

  it('notes take step too', () => {
    const env = makeEnv();
    const m = notes(env, { init: '0..', step: 1 / 4 }, 'm').pattern;
    expect(times(m, 0, 2)).toEqual([0, 0.75, 1.5]);
  });

  it('playhead follows the step length and rejects bad steps', () => {
    expect([0, 0.125, 0.75, 0.875].map((c) => stepAt(c, 6, 1 / 8))).toEqual([0, 1, 0, 1]);
    expect(stepAt(0.5, 4, undefined)).toBe(2);
    expect(() => toggles(makeEnv(), { step: 0 }, 'bad')).toThrow(/positive/);
  });
});
