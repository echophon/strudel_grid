import { n, s } from '@strudel/core';
import '@strudel/tonal';
import { describe, expect, it } from 'vitest';
import { readTags } from '../src/widgets/tag';
import { notes } from '../src/widgets/notes';
import { toggles } from '../src/widgets/toggles';
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
