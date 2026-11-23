// Every example must evaluate cleanly, make sound, lay out without warnings, and survive
// capture unchanged — transpiled exactly like the editor does.
import * as core from '@strudel/core';
import { evalScope } from '@strudel/core';
import { evaluate } from '@strudel/transpiler';
import { beforeAll, describe, expect, it } from 'vitest';
import { captureToCode } from '../src/capture';
import { EXAMPLES } from '../src/examples';
import { createGridApi, installPatternMethods } from '../src/gridApi';
import { makeH } from '../src/hydraValue';
import { Surface } from '../src/surface';
import { clearTimelines } from '../src/widgets/timeline';
import { makeEnv } from './helpers';

/** hydra stand-in for node: every source/method chains, and function arguments (H(...) etc.)
 *  are called once so a broken parameter function fails the test */
function hydraStub() {
  let calls = 0;
  const chain: any = new Proxy(function () {}, {
    get: (_, k) => (k === 'then' || typeof k === 'symbol' ? undefined : chain),
    apply: (_, __, args) => {
      for (const a of args) if (typeof a === 'function' && a !== chain) { const v = a(); if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`hydra parameter gave ${v}`); }
      calls++;
      return chain;
    },
  });
  const names = ['osc', 'noise', 'voronoi', 'gradient', 'solid', 'src', 'render', 'o0', 'o1', 'o2', 'o3', 's0'];
  return {
    initHydra: async () => {}, clearHydra: () => {}, H: makeH(() => 0.1),
    ...Object.fromEntries(names.map((k) => [k, chain])),
    hydraCalls: () => calls,
  };
}

let surface: Surface;
let grid: ReturnType<typeof createGridApi>;
let warnings: string[] = [];
let global = (p: any) => p;

beforeAll(async () => {
  // `grid` is looked up through this holder so each example gets a fresh surface and store
  const proxy = new Proxy({}, { get: (_, k) => (grid as any)[k], ownKeys: () => Reflect.ownKeys(grid), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: (grid as any)[k] }) });
  await evalScope(core, import('@strudel/mini'), import('@strudel/tonal'), {
    grid: proxy, setcps: () => {}, all: (f: any) => { global = f; },
    ...hydraStub(),
  });
});

describe('examples', () => {
  it('is a numbered series', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(10);
    EXAMPLES.forEach((e, i) => expect(e.file.startsWith(String(i + 1).padStart(2, '0') + '-'), e.file).toBe(true));
  });

  for (const ex of EXAMPLES) {
    it(ex.title, async () => {
      clearTimelines();
      warnings = [];
      global = (p) => p;
      surface = new Surface({ warn: (m) => warnings.push(m) });
      grid = createGridApi(surface, makeEnv(), { start() {}, stop() {}, started: () => false });
      installPatternMethods(grid);

      surface.begin();
      const { pattern } = await evaluate(ex.code);
      surface.commit();

      expect(warnings).toEqual([]);
      expect(surface.widgets.length).toBeGreaterThan(0);
      const haps = global(pattern).queryArc(0, 2).filter((h: any) => h.hasOnset());
      expect(haps.length).toBeGreaterThan(0);

      const cap = captureToCode(ex.code, surface.widgets);
      expect(cap.skipped).toEqual([]);
      expect(cap.code).toBe(ex.code);
    });
  }
});
