import { n, pure, s, silence } from '@strudel/core';
import { describe, expect, it } from 'vitest';
import { makeH, toNumber } from '../src/hydraValue';
import { fader } from '../src/widgets/fader';
import { play } from '../src/widgets/play';
import { clearTimelines } from '../src/widgets/timeline';
import { toggles } from '../src/widgets/toggles';
import { xy } from '../src/widgets/xy';
import { makeEnv } from './helpers';

let t = 0;
const H = makeH(() => t);

describe('H (pattern → hydra parameter)', () => {
  it('samples grid value controls: fader and xy', () => {
    clearTimelines();
    const env = makeEnv();
    const f = fader(env, { id: 'f', w: 5, range: [0, 100] }, 'f');
    f.onKey(3, 0, true);
    expect(H(f.pattern)()).toBe(75);
    const p = xy(env, { id: 'p', w: 3, h: 3, xRange: [0, 10], yRange: [0, 2] }, 'p');
    p.onKey(2, 0, true);
    expect([H(p.px)(), H(p.py)()]).toEqual([10, 2]);
  });

  it('step patterns are 1 on a sounding step and the fallback between', () => {
    clearTimelines();
    const kick = toggles(makeEnv(), { init: 'x...' }, 'k').pattern;
    const hk = H(s('bd').struct(kick), -1);
    t = 0.1; expect(hk()).toBe(1);
    t = 0.3; expect(hk()).toBe(-1);
    t = 1.05; expect(H(kick)()).toBe(1);
  });

  it('a play toggle becomes an on/off number via pure(1).sw(toggle)', () => {
    clearTimelines();
    const env = makeEnv();
    const strobe = play(env, { init: false }, 'st');
    t = 0.5;
    expect(H(pure(1))()).toBe(1);
    expect(H(strobe.fn(pure(1)))()).toBe(0);
  });

  it('never throws: silence, plain numbers, note values', () => {
    expect(H(silence, 7)()).toBe(7);
    expect(H(3)()).toBe(3);
    t = 0; expect(H(n('5 7'))()).toBe(5);
    expect(toNumber({ s: 'bd' })).toBe(1);
    expect(toNumber(NaN)).toBeUndefined();
  });
});
