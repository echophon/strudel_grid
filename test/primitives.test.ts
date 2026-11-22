import { n, note, s, sequence as seq } from '@strudel/core';
import '@strudel/tonal';
import { beforeEach, describe, expect, it } from 'vitest';
import { captureToCode, literal } from '../src/capture';
import { createGridApi, installPatternMethods } from '../src/gridApi';
import { Surface } from '../src/surface';
import { clips } from '../src/widgets/clips';
import { fader, segValueAt } from '../src/widgets/fader';
import { notes } from '../src/widgets/notes';
import { radio } from '../src/widgets/radio';
import { snapshots } from '../src/widgets/snapshots';
import { switches } from '../src/widgets/switches';
import { readTags } from '../src/widgets/tag';
import { clearTimelines, timelineFor, valueAt } from '../src/widgets/timeline';
import { toggles } from '../src/widgets/toggles';
import { transport } from '../src/widgets/transport';
import { view } from '../src/widgets/view';
import { makeEnv, onsets } from './helpers';

let cycle = 0;
const env = (store: Record<string, any> = {}) => makeEnv(store, () => cycle);
const tap = (w: any, cx = 0, cy = 0) => { w.onKey(cx, cy, true); w.onKey(cx, cy, false); };
const show = (haps: any[], key = 's') => haps.map((h) => `${+h.whole.begin.valueOf().toFixed(4)}:${typeof h.value === 'object' ? h.value[key] : h.value}`);
const frame = (w: any, ctx: Partial<{ now: number; cycle: number; started: boolean }> = {}) => {
  const lv: Record<string, number> = {};
  w.draw((x: number, y: number, l: number) => { lv[`${x},${y}`] = l; }, { now: 0, cycle: 0, started: false, playStep: () => -1, ...ctx });
  return lv;
};

beforeEach(() => { cycle = 0; clearTimelines(); });

describe('radio', () => {
  it('fns: applies the selected transform, switching on the next cycle', () => {
    const r = radio(env(), { id: 'sc', fns: [(x: any) => x, (x: any) => x.fast(2)] }, 'd');
    const pat = (r.value as any)(s('bd sd'));
    cycle = 0.4;
    tap(r.widget, 1);
    expect(show(onsets(pat, 0, 2))).toEqual(['0:bd', '0.5:sd', '1:bd', '1.25:sd', '1.5:bd', '1.75:sd']);
  });

  it('values: a value pattern usable on the right of any control, changing on q', () => {
    const r = radio(env(), { id: 'kit', x: 2, y: 5, values: ['tr909', 'tr808'] }, 'd');
    const pat = s('bd*4').bank(r.value);
    cycle = 0.3;
    tap(r.widget, 1);
    expect(onsets(pat, 0, 2).map((h: any) => h.value.bank)).toEqual([...Array(4).fill('tr909'), ...Array(4).fill('tr808')]);
    // the chosen button's cell is tagged, so it flashes with the notes it shapes
    expect(readTags(onsets(pat, 1, 2)[0])).toContainEqual({ id: 'kit', x: 3, y: 5 });
  });

  it('LEDs: selected bright, target blinks while armed', () => {
    const r = radio(env(), { id: 'r', values: [1, 2, 3] }, 'd');
    cycle = 0.5;
    tap(r.widget, 2);
    expect(frame(r.widget, { cycle: 0.5, now: 0 })).toMatchObject({ '0,0': 9, '1,0': 3, '2,0': 3 });
    expect(frame(r.widget, { cycle: 0.5, now: 125 })['2,0']).toBe(11);
    expect(frame(r.widget, { cycle: 1 })).toMatchObject({ '0,0': 3, '2,0': 9 });
  });

  it('rejects ambiguous or empty choices', () => {
    expect(() => radio(env(), { fns: [], values: [] }, 'x')).toThrow();
  });
});

describe('clips', () => {
  it('queues a clip for the next cycle; tapping the playing clip stops it', () => {
    const c = clips(env(), { id: 'bass', patterns: [s('a'), s('b b')] }, 'd');
    expect(onsets(c.pattern, 0, 1)).toHaveLength(0); // nothing playing at first
    cycle = 0.2;
    tap(c.widget, 1);
    cycle = 1.5;
    tap(c.widget, 0);
    cycle = 2.5;
    tap(c.widget, 0);
    expect(show(onsets(c.pattern, 0, 4))).toEqual(['1:b', '1.5:b', '2:a']);
    expect(readTags(onsets(c.pattern, 1, 2)[0])).toContainEqual({ id: 'bass', x: 1, y: 0 });
  });
});

describe('fader', () => {
  it('snaps a tap to a value across the range (linear or exponential)', () => {
    const e = env();
    const f = fader(e, { id: 'f', w: 5, range: [0, 100] }, 'd');
    tap(f, 3);
    expect(e.store.f.value).toBe(75);
    const g = fader(e, { id: 'g', w: 3, range: [100, 10000], exp: true }, 'd');
    tap(g, 1);
    expect(e.store.g.value).toBeCloseTo(1000);
  });

  it('is a continuous value pattern that glides in cycle time', () => {
    const e = env();
    const f = fader(e, { id: 'cut', w: 3, range: [0, 1], glide: 2 }, 'd');
    cycle = 1;
    tap(f, 2); // 0 → 1 over cycles 1..3
    const tl = timelineFor<any>('cut|fader', null);
    expect(segValueAt(tl, 1)).toBe(0);
    expect(segValueAt(tl, 2)).toBeCloseTo(0.5);
    expect(segValueAt(tl, 5)).toBe(1);
    const haps = onsets(s('saw*4').lpf(f.pattern), 2, 3);
    expect(haps.map((h: any) => +h.value.cutoff.toFixed(3))).toEqual([0.5, 0.625, 0.75, 0.875]);
  });

  it('vertical: bottom is low', () => {
    const e = env();
    const f = fader(e, { id: 'v', x: 3, y: 2, vertical: true, w: 4, range: [0, 3] }, 'd');
    expect([f.w, f.h]).toEqual([1, 4]);
    tap(f, 0, 0); // top cell
    expect(e.store.v.value).toBe(3);
  });
});

describe('loop gesture', () => {
  it('hold a step + tap another → loop that range, first edit undone; same again clears', () => {
    const e = env();
    const t = toggles(e, { id: 'k', init: 'x.......' }, 'd');
    t.onKey(2, 0, true); // would toggle step 2 on...
    t.onKey(5, 0, true); // ...but this makes it a loop gesture
    t.onKey(5, 0, false);
    t.onKey(2, 0, false);
    expect(e.store.k.bits.filter(Boolean)).toHaveLength(1);
    expect(e.store.k.loop).toEqual([2, 5]);
    t.onKey(5, 0, true); t.onKey(2, 0, true); t.onKey(2, 0, false); t.onKey(5, 0, false);
    expect(e.store.k.loop).toBeNull();
  });

  it('a loop keeps the step length and plays only its steps', () => {
    const e = env();
    const t = toggles(e, { id: 'k', init: 'xx..x...', loop: [4, 5] }, 'd');
    // step = 1/8 cycle; loop of 2 steps lasts 1/4 cycle: step 4 (on), step 5 (off)
    expect(onsets(t.pattern, 0, 1).map((h: any) => +h.whole.begin.valueOf().toFixed(3))).toEqual([0, 0.25, 0.5, 0.75]);
    expect(readTags(onsets(t.pattern)[0])[0]).toMatchObject({ x: 4 });
    expect(frame(t, { started: true, cycle: 0.125 })['5,0']).toBe(2); // playhead on step 5
  });

  it('notes: same-column keys still build chords; across columns sets the loop', () => {
    const e = env();
    const m = notes(e, { id: 'm', w: 4, h: 4, poly: true }, 'd');
    m.onKey(1, 3, true); m.onKey(1, 1, true); m.onKey(1, 1, false); m.onKey(1, 3, false);
    expect(e.store.m.cols[1].sort()).toEqual([0, 2]);
    m.onKey(0, 0, true); m.onKey(3, 0, true); m.onKey(3, 0, false); m.onKey(0, 0, false);
    expect(e.store.m.loop).toBeNull(); // the full range 0..3 is the same as no loop
    m.onKey(1, 0, true); m.onKey(2, 0, true); m.onKey(2, 0, false); m.onKey(1, 0, false);
    expect(e.store.m.loop).toEqual([1, 2]);
    expect(e.store.m.cols[1].sort()).toEqual([0, 2]); // the anchor column's edit was undone
  });
});

describe('snapshots', () => {
  it('saves and recalls control states (quantised controls schedule the recall)', () => {
    const e = env();
    const k = toggles(e, { id: 'k', init: 'x...' }, 'd');
    const sw = switches(e, { id: 'sw', fns: [(x: any) => x] }, 'd');
    const snap = snapshots(e, () => [k, sw.widget], { id: 'snap', w: 2 }, 'd');
    tap(snap, 0); // empty → save
    tap(k, 1);
    tap(sw.widget, 0);
    cycle = 2.5;
    tap(snap, 0); // full → recall
    expect(e.store.k.bits).toEqual([true, false, false, false]);
    const tl = timelineFor<boolean>('sw|0,0', false);
    expect(valueAt(tl, 2.9)).toBe(true); // switch turns off on the next cycle
    expect(valueAt(tl, 3)).toBe(false);
    expect(frame(snap)).toMatchObject({ '0,0': 12, '1,0': 1 });
  });

  it('`of` limits which controls a slot holds', () => {
    const e = env();
    const a = toggles(e, { id: 'a', init: 'x' }, 'd');
    const b = toggles(e, { id: 'b', init: 'x' }, 'd');
    const snap = snapshots(e, () => [a, b], { id: 's', of: ['a'] }, 'd');
    tap(snap, 0);
    expect(Object.keys(e.store.s.slots[0])).toEqual(['a']);
  });
});

describe('transport', () => {
  it('starts and stops; pulses while playing', () => {
    let on = false;
    const t = transport({ start: () => { on = true; }, stop: () => { on = false; }, started: () => on }, { w: 4 }, 'tp');
    tap(t);
    expect(on).toBe(true);
    expect(frame(t, { started: true, cycle: 1.01 })).toMatchObject({ '0,0': 15, '2,0': 9 });
    tap(t);
    expect(on).toBe(false);
  });

  it('vertical: the strip runs downwards', () => {
    const t = transport({ start() {}, stop() {}, started: () => true }, { x: 15, y: 2, w: 3, vertical: true }, 'tp');
    expect([t.w, t.h]).toEqual([1, 3]);
    expect(frame(t, { started: true, cycle: 1.01 })).toMatchObject({ '15,2': 15, '15,4': 9 });
  });
});

describe('view (.grid())', () => {
  it('sounds: one row per sound, events dim, sounding ones bright', () => {
    const v = view(s('bd*2, ~ sd'), { y: 4, w: 4 }, 'v');
    expect([v.w, v.h]).toEqual([4, 2]);
    expect(frame(v, { started: true, cycle: 0.6 })).toEqual({ '0,4': 4, '2,4': 12, '2,5': 12 });
  });

  it('pitches: folded into rows, lowest at the bottom', () => {
    const v = view(n(seq(0, 2, 4)), { w: 3 }, 'v');
    expect(v.h).toBe(5);
    expect(frame(v)).toEqual({ '0,4': 4, '1,2': 4, '2,0': 4 });
    expect(view(note(seq(60, 72)), { h: 3 }, 'v2').h).toBe(3);
  });

  it('pattern.grid() registers a view and returns the pattern', () => {
    const surface = new Surface({ warn: () => {} });
    const grid = createGridApi(surface, env(), { start() {}, stop() {}, started: () => false });
    installPatternMethods(grid);
    surface.begin();
    const p = s('bd');
    expect((p as any).grid({ y: 3 })).toBe(p);
    surface.commit();
    expect(surface.widgets.map((w) => w.kind)).toEqual(['view']);
  });
});

describe('capture-to-code', () => {
  it('rewrites init in place, leaving everything else untouched', () => {
    const code = `grid.page('drums')\nconst kick = grid.toggles({ id: 'kick', y: 0, init: 'x...' }) // keep me\n`;
    const surface = new Surface({ warn: () => {} });
    const grid = createGridApi(surface, env(), { start() {}, stop() {}, started: () => false });
    surface.begin(); grid.page('drums'); grid.toggles({ id: 'kick', y: 0, init: 'x...' }); surface.commit();
    expect(captureToCode(code, surface.widgets).changed).toEqual([]); // already matches
    surface.widgets[0].onKey(2, 0, true); surface.widgets[0].onKey(2, 0, false);
    expect(captureToCode(code, surface.widgets).code).toBe(code.replace("'x...'", "'x.x.'"));
  });

  it('matches implicit ids through literal grid.page calls, inserts missing options', () => {
    const code = `grid.page('lead')\nconst mel = grid.notes({ y: 1, w: 3 })\nconst r = grid.radio({ x: 2, values: [1, 2] })\n`;
    const surface = new Surface({ warn: () => {} });
    const e = env();
    const grid = createGridApi(surface, e, { start() {}, stop() {}, started: () => false });
    surface.begin();
    grid.page('lead');
    grid.notes({ y: 1, w: 3 });
    grid.radio({ x: 2, values: [1, 2] });
    surface.commit();
    const mel = surface.widgets[0];
    mel.onKey(0, 4, true); mel.onKey(0, 4, false); // degree 0 at step 0
    mel.onKey(2, 2, true); mel.onKey(2, 2, false); // degree 2 at step 2
    surface.widgets[1].onKey(1, 0, true);
    const r = captureToCode(code, surface.widgets);
    expect(r.code).toBe(`grid.page('lead')\nconst mel = grid.notes({ y: 1, w: 3, init: '0.2' })\nconst r = grid.radio({ x: 2, values: [1, 2], init: 1 })\n`);
    expect(r.changed).toEqual(['notes@lead:0,1', 'radio@lead:2,0']);
  });

  it('removes a loop option once the loop is cleared; reports calls it cannot match', () => {
    const code = `const t = grid.toggles({ id: 't', init: 'x.x.', loop: [0, 1] })\nfor (const i of [0]) grid.toggles({ y: i })\n`;
    const surface = new Surface({ warn: () => {} });
    const grid = createGridApi(surface, env(), { start() {}, stop() {}, started: () => false });
    surface.begin();
    grid.toggles({ id: 't', init: 'x.x.', loop: [0, 1] });
    grid.toggles({ y: 0 });
    surface.commit();
    const t = surface.widgets[0];
    t.onKey(0, 0, true); t.onKey(1, 0, true); t.onKey(1, 0, false); t.onKey(0, 0, false); // same range → clear
    const r = captureToCode(code, surface.widgets);
    expect(r.code.split('\n')[0]).toBe(`const t = grid.toggles({ id: 't', init: 'x.x.' })`);
    expect(r.skipped).toEqual(['grid.toggles at line 2']);
  });

  it('writes poly chords as arrays and escapes strings', () => {
    expect(literal([0, [0, 2], null])).toBe('[0, [0, 2], null]');
    expect(literal("it's")).toBe("'it\\'s'");
  });
});
