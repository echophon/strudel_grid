// The default project must evaluate and make sound — transpiled exactly like the editor does.
import * as core from '@strudel/core';
import { evalScope } from '@strudel/core';
import { evaluate } from '@strudel/transpiler';
import { describe, expect, it } from 'vitest';
import { captureToCode } from '../src/capture';
import { DEFAULT_CODE } from '../src/defaultCode';
import { createGridApi, installPatternMethods } from '../src/gridApi';
import { Surface } from '../src/surface';
import { clearTimelines } from '../src/widgets/timeline';
import { makeEnv } from './helpers';

describe('default code', () => {
  it('evaluates, declares a warning-free layout, and plays every part', async () => {
    clearTimelines();
    const warnings: string[] = [];
    const surface = new Surface({ warn: (m) => warnings.push(m) });
    const env = makeEnv();
    const grid = createGridApi(surface, env, { start() {}, stop() {}, started: () => false });
    installPatternMethods(grid);
    let global = (p: any) => p;
    await evalScope(core, import('@strudel/mini'), import('@strudel/tonal'), {
      grid, setcps: () => {}, all: (f: any) => { global = f; },
    });

    surface.begin();
    const { pattern } = await evaluate(DEFAULT_CODE);
    surface.commit();

    expect(warnings).toEqual([]);
    expect(surface.pages).toEqual(['drums', 'lead', 'fx', 'perform']);
    const kinds = new Set(surface.widgets.map((w) => w.kind));
    for (const k of ['pages', 'snapshots', 'transport', 'toggles', 'play', 'radio', 'notes', 'fader', 'switches', 'clips', 'view'])
      expect(kinds, k).toContain(k);

    const haps = global(pattern).queryArc(0, 2).filter((h: any) => h.hasOnset());
    const sounds = new Set(haps.map((h: any) => h.value.s));
    for (const snd of ['bd', 'sd', 'hh', 'rim', 'lt', 'sawtooth']) expect(sounds, snd).toContain(snd);
    expect(haps.find((h: any) => h.value.s === 'bd').value.bank).toBe('tr909');
    expect(typeof haps.find((h: any) => h.value.s === 'sawtooth').value.cutoff).toBe('number');

    // legend labels stay short: library functions by name, chains without the parameter
    const dfx = surface.widgets.find((w) => w.id === 'dfx')!;
    expect(dfx.labels).toEqual(['rev', '.fast(2)', '.ply(2)', '.degradeBy(0.5)', '.jux(rev)', '.lpf(600)', '.room(0.7)']);

    // capturing an untouched project changes nothing, and every control is matched
    const cap = captureToCode(DEFAULT_CODE, surface.widgets);
    expect(cap.skipped).toEqual([]);
    expect(cap.code).toBe(DEFAULT_CODE);

    // launching a bass clip makes the bass play from the next cycle
    const bass = surface.widgets.find((w) => w.id === 'bass')!;
    bass.onKey(0, 0, true);
    const later = global(pattern).queryArc(0, 1).filter((h: any) => h.hasOnset() && h.value.s === 'square');
    expect(later.length).toBeGreaterThan(0);
  });
});
