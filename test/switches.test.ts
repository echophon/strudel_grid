import { rev, s } from '@strudel/core';
import { describe, expect, it } from 'vitest';
import { createCell, gate, pendingAt, scheduleChange, switches, valueAt } from '../src/widgets/switches';
import { readTags } from '../src/widgets/tag';
import { play } from '../src/widgets/play';
import { makeEnv, onsets } from './helpers';

const show = (haps: any[]) => haps.map((h) => `${h.whole.begin.valueOf()}:${h.value.s}`);

describe('switch timeline', () => {
  it('quantises to the next multiple of q and supersedes pending changes', () => {
    const c = createCell();
    expect(scheduleChange(c, true, 0.62, 1)).toBe(1);
    expect(valueAt(c, 0.99)).toBe(false);
    expect(valueAt(c, 1)).toBe(true);
    expect(pendingAt(c, 0.7)).toBe(true);
    scheduleChange(c, false, 0.8, 1); // changed mind before it landed
    expect(valueAt(c, 1.5)).toBe(false);
    expect(scheduleChange(c, true, 2.3, 0)).toBe(2.3); // q: 0 = immediate
  });
});

describe('gate', () => {
  const cell = createCell();
  scheduleChange(cell, true, 0.62, 1); // on at 1
  scheduleChange(cell, false, 1.3, 0); // off at 1.3
  const pat = gate(cell, (x) => x.fast(2), { id: 't', x: 0, y: 0 })(s('bd sd hh oh'));

  it('switches exactly at change points, by onset, with no doubles or chops', () => {
    expect(show(onsets(pat, 0, 2))).toEqual([
      '0:bd', '0.25:sd', '0.5:hh', '0.75:oh', '1:bd', '1.125:sd', '1.25:hh', '1.5:hh', '1.75:oh',
    ]);
  });

  it('gives identical results however the scheduler slices its queries', () => {
    const ticked: any[] = [];
    for (let t = 0; t < 2; t += 0.05) ticked.push(...pat.queryArc(t, Math.min(2, t + 0.05)));
    expect(show(ticked.filter((h) => h.hasOnset()))).toEqual(show(onsets(pat, 0, 2)));
  });

  it('tags transformed haps with the switch cell', () => {
    const tagged = onsets(pat, 1, 1.3).map((h: any) => readTags(h)[0]);
    expect(tagged.every((t: any) => t.id === 't')).toBe(true);
  });
});

describe('switches widget', () => {
  it('tap latches, long hold is momentary, and latched state persists in the store', () => {
    const env = makeEnv();
    const { widget, api } = switches(env, { fns: [(x) => x.fast(2)], q: 0 }, 'sw');
    widget.onKey(0, 0, true);
    widget.onKey(0, 0, false); // quick release: stays latched
    expect(env.store.sw.latched['0,0']).toBe(true);
    expect(onsets(api.all(s('bd')), 0, 1)).toHaveLength(2); // fast(2) applied

    widget.onKey(0, 0, true);
    widget.onKey(0, 0, false); // second tap: unlatched
    expect(onsets(api.all(s('bd')), 1, 2)).toHaveLength(1);

    const realNow = performance.now;
    let t = 1000;
    performance.now = () => t;
    widget.onKey(0, 0, true);
    t += 500; // held past HOLD_MS → momentary: release restores the previous state
    widget.onKey(0, 0, false);
    performance.now = realNow;
    expect(env.store.sw.latched['0,0']).toBe(false);
  });
});

describe('play toggle', () => {
  const pl = () => {
    const env = makeEnv({}, () => cycle);
    let cycle = 0;
    const p = play(env, { id: 'go', x: 15, y: 3 }, 'd');
    return { env, p, setCycle: (c: number) => { cycle = c; } };
  };

  it('plays by default, stops on the next cycle after a tap, and restarts', () => {
    const { p, setCycle } = pl();
    const pat = p.fn(s('bd sd'));
    setCycle(0.3);
    p.widget.onKey(0, 0, true); p.widget.onKey(0, 0, false); // stop, lands at 1
    setCycle(2.2);
    p.widget.onKey(0, 0, true); p.widget.onKey(0, 0, false); // start, lands at 3
    expect(show(onsets(pat, 0, 4))).toEqual(['0:bd', '0.5:sd', '3:bd', '3.5:sd']);
  });

  it('tags what it plays with its own cell (so the button flashes), keeping inner tags', () => {
    const { p } = pl();
    const inner = gate(createCell(), (x) => x, { id: 'k', x: 0, y: 0 })(s('bd'));
    const tags = readTags(onsets(p.fn(inner))[0]).map((t) => t.id);
    expect(tags).toContain('go');
  });

  it('persists its state; init: false starts silent', () => {
    const env = makeEnv();
    const p = play(env, { init: false }, 'quiet');
    expect(onsets(p.fn(s('bd')))).toHaveLength(0);
    expect(env.store.quiet).toEqual({ on: false });
  });
});

describe('switches under the scheduler', () => {
  // The scheduler asks for small slices; a transform must sound the same however time is sliced.
  const sliced = (pat: any, b: number, e: number, n: number) => {
    const out: any[] = [];
    for (let i = 0; i < n; i++) out.push(...onsets(pat, b + ((e - b) * i) / n, b + ((e - b) * (i + 1)) / n));
    return show(out).sort();
  };
  const fns = [(x: any) => x.fast(2), (x: any) => x.ply(2), (x: any) => x.room(0.5), rev, (x: any) => x.iter(4)];

  for (let col = 0; col < fns.length; col++) {
    it(`column ${col} (after the others in a row) sounds the same in slices as in whole cycles`, () => {
      const env = makeEnv();
      const sw = switches(env, { fns }, `sched${col}`);
      sw.widget.onKey(col, 0, true); sw.widget.onKey(col, 0, false); // on from cycle 0
      const pat = sw.api.row(0)(s('bd ~ ~ sd ~ ~ hh ~'));
      expect(sliced(pat, 0, 2, 37)).toEqual(show(onsets(pat, 0, 2)).sort());
      expect(onsets(pat, 0, 2).length).toBeGreaterThan(0);
    });
  }

  it('a change point still cuts cleanly: no note from the old side leaks past it', () => {
    const c = createCell();
    scheduleChange(c, true, 0.4, 1); // rev on at 1
    const pat = gate(c, rev, { id: 'r', x: 0, y: 0 })(s('bd sd'));
    expect(sliced(pat, 0, 2, 13)).toEqual(['0.5:sd', '0:bd', '1.5:bd', '1:sd']);
  });
});
