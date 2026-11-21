// Regression tests for prototype 1's findings: tags survive combinators (incl. two widgets on one
// hap), and the single onTrigger wrapper fires once per onset for default AND dominant outputs.
import { getTrigger, rev, s, stack } from '@strudel/core';
import { describe, expect, it } from 'vitest';
import { readTags, wrapForFlash } from '../src/widgets/tag';
import { toggles } from '../src/widgets/toggles';
import { makeEnv, onsets } from './helpers';

const env = makeEnv();
const kick = toggles(env, { y: 0, init: 'x...x...x...x.x.' }, 'kick').pattern;
const snare = toggles(env, { y: 1, init: 'xx..xx..xx..xx..' }, 'snare').pattern;
// tag order depends on the combinator (mask puts the masking widget first), so compare sorted
const xs = (pat: any) => onsets(pat).map((h: any) => readTags(h).map((t) => `${t.id}${t.x}`).sort().join('+'));

describe('tag survival', () => {
  it.each([
    ['struct', () => s('bd').struct(kick)],
    ['mask', () => s('bd*16').mask(kick)],
    ['fast', () => s('bd').struct(kick).fast(2)],
    ['ply', () => s('bd').struct(kick).ply(2)],
    ['stack', () => stack(s('bd').struct(kick), s('hh*8')).filterValues((v: any) => v.s === 'bd')],
  ])('%s keeps a tag on every hap', (_n, build) => {
    const haps = onsets(build());
    expect(haps.length).toBeGreaterThan(0);
    for (const h of haps) expect(readTags(h).length).toBe(1);
  });

  it('follows the sound through rev (truthful feedback)', () => {
    expect(xs(s('bd').struct(kick.rev()))).toEqual(['kick14', 'kick12', 'kick8', 'kick4', 'kick0']);
  });

  it('keeps BOTH widget tags when two widgets shape one hap', () => {
    expect(xs(s('bd*16').struct(kick).mask(snare))).toEqual([
      'kick0+snare0', 'kick4+snare4', 'kick8+snare8', 'kick12+snare12',
    ]);
  });
});

describe('wrapForFlash', () => {
  const run = async (pat: any) => {
    let out = 0, flashes = 0;
    const trigger = getTrigger({ defaultOutput: () => out++, getTime: () => 0 });
    for (const h of onsets(wrapForFlash(pat, () => flashes++), 0, 2)) await trigger(h, 0, h.duration, 0.5, 0);
    return { out, flashes };
  };

  it('fires once per onset and still calls the default output', async () => {
    expect(await run(s('bd').struct(kick))).toEqual({ out: 10, flashes: 10 });
  });

  it('chains a dominant trigger (like .midi()) without calling the default output', async () => {
    let midi = 0;
    const r = await run(s('bd').struct(kick).onTrigger(() => midi++, true));
    expect(r).toEqual({ out: 0, flashes: 10 });
    expect(midi).toBe(10);
  });

  it('works through rev too', async () => {
    expect((await run(s('bd').struct(kick).firstOf(2, rev))).flashes).toBe(10);
  });
});
