// Every example must evaluate cleanly, make sound, lay out without warnings, and survive
// capture unchanged — transpiled exactly like the editor does.
import * as core from '@strudel/core';
import { evalScope } from '@strudel/core';
import { evaluate } from '@strudel/transpiler';
import { beforeAll, describe, expect, it } from 'vitest';
import { captureToCode } from '../src/capture';
import { EXAMPLES } from '../src/examples';
import { createGridApi, installPatternMethods } from '../src/gridApi';
import { Surface } from '../src/surface';
import { clearTimelines } from '../src/widgets/timeline';
import { makeEnv } from './helpers';

let surface: Surface;
let grid: ReturnType<typeof createGridApi>;
let warnings: string[] = [];
let global = (p: any) => p;

beforeAll(async () => {
  // `grid` is looked up through this holder so each example gets a fresh surface and store
  const proxy = new Proxy({}, { get: (_, k) => (grid as any)[k], ownKeys: () => Reflect.ownKeys(grid), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: (grid as any)[k] }) });
  await evalScope(core, import('@strudel/mini'), import('@strudel/tonal'), {
    grid: proxy, setcps: () => {}, all: (f: any) => { global = f; },
  });
});

describe('examples', () => {
  it('is a numbered series ending with the full set', () => {
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
