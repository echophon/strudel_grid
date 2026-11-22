import { beforeEach, describe, expect, it } from 'vitest';
import { FLASH_MS, Surface } from '../src/surface';
import { pages } from '../src/widgets/pages';
import type { Widget } from '../src/widgets/types';

function fakeWidget(id: string, x: number, y: number, w = 16, h = 1) {
  const keys: string[] = [];
  const widget: Widget = {
    id, kind: 'fake', page: '', x, y, w, h,
    onKey: (cx, cy, down) => keys.push(`${cx},${cy}${down ? 'v' : '^'}`),
    draw: (put) => { for (let i = 0; i < w; i++) put(x + i, y, 3); },
  };
  return { widget, keys };
}
const ctx = (now = 0) => ({ now, cycle: 0, started: false, playStep: () => -1 });
const tap = (s: Surface, x: number, y: number) => { s.key(x, y, true); s.key(x, y, false); };

let warnings: string[];
let s: Surface;
let kick: ReturnType<typeof fakeWidget>;
let mel: ReturnType<typeof fakeWidget>;
let glob: ReturnType<typeof fakeWidget>;

beforeEach(() => {
  warnings = [];
  s = new Surface({ warn: (m) => warnings.push(m) });
  kick = fakeWidget('kick', 0, 0);
  mel = fakeWidget('mel', 0, 0);
  glob = fakeWidget('glob', 0, 6, 4);
  s.begin();
  s.page('drums'); s.register(kick.widget);
  s.page('lead'); s.register(mel.widget);
  s.page(null); s.register(glob.widget);
  s.commit();
});

describe('surface: nothing reserved', () => {
  it('collects pages in order; first is active', () => {
    expect(s.pages).toEqual(['drums', 'lead']);
    expect(s.currentPage).toBe('drums');
  });

  it('every row, including the bottom one, is available to controls', () => {
    const bottom = fakeWidget('bottom', 0, 7);
    s.begin(); s.register(bottom.widget); s.commit();
    tap(s, 5, 7);
    expect(bottom.keys).toEqual(['5,0v', '5,0^']);
    expect(s.frame(ctx())[7][15]).toBe(3);
  });

  it('a failed eval (abort) keeps the previous layout', () => {
    s.begin(); s.page('other'); s.abort();
    expect(s.pages).toEqual(['drums', 'lead']);
  });

  it('keeps the active page across evals when it still exists', () => {
    s.go('lead');
    s.begin(); s.page('drums'); s.page('lead'); s.commit();
    expect(s.currentPage).toBe('lead');
  });

  it('warns on off-grid controls, overlaps, and multiple pages without a page selector', () => {
    expect(warnings.some((w) => w.includes('no grid.pages()'))).toBe(true);
    warnings = [];
    s.begin();
    s.register(fakeWidget('tall', 0, 0, 1, 9).widget);
    s.register(fakeWidget('b', 0, 0, 4).widget);
    s.commit();
    expect(warnings.some((w) => w.includes('tall') && w.includes('clipped'))).toBe(true);
    expect(warnings.some((w) => w.includes('b overlaps tall'))).toBe(true);
  });
});

describe('views', () => {
  it('show the current page + every-page controls', () => {
    tap(s, 1, 0);
    tap(s, 1, 6);
    expect(kick.keys).toEqual(['1,0v', '1,0^']);
    expect(glob.keys).toEqual(['1,0v', '1,0^']);
    s.go('lead');
    tap(s, 2, 0);
    tap(s, 2, 6);
    expect(kick.keys).toHaveLength(2);
    expect(mel.keys).toEqual(['2,0v', '2,0^']);
    expect(glob.keys.slice(2)).toEqual(['2,0v', '2,0^']);
  });

  it('key-up goes to the control that got key-down, even after switching page', () => {
    s.key(3, 0, true);
    s.go('lead');
    s.key(3, 0, false);
    expect(kick.keys).toEqual(['3,0v', '3,0^']);
    expect(mel.keys).toEqual([]);
  });

  it('flashes appear only on their own page', () => {
    s.flash({ id: 'mel', x: 2, y: 3 }, 0);
    expect(s.frame(ctx())[3][2]).toBe(0);
    s.go('lead');
    expect(s.frame(ctx())[3][2]).toBe(15);
    expect(s.lastActivity('lead')).toBe(0);
  });
});

describe('grid.pages primitive', () => {
  function withNav(opts: Parameters<typeof pages>[1]) {
    warnings = [];
    s.begin();
    s.page('drums'); s.register(kick.widget);
    s.page('lead'); s.register(mel.widget);
    s.page('fx'); s.register(fakeWidget('fx', 0, 0).widget);
    const nav = s.register(pages(s, opts, 'nav'), null);
    s.commit();
    return nav;
  }

  it('sizes itself to the declared pages and switches on press', () => {
    const nav = withNav({ y: 7 });
    expect([nav.w, nav.h]).toEqual([3, 1]);
    tap(s, 2, 7);
    expect(s.currentPage).toBe('fx');
    expect(warnings.some((w) => w.includes('no grid.pages()'))).toBe(false);
  });

  it('can be placed anywhere, vertical, with a chosen subset/order', () => {
    const nav = withNav({ x: 15, y: 0, vertical: true, pages: ['fx', 'drums'] });
    expect([nav.w, nav.h]).toEqual([1, 2]);
    tap(s, 15, 0);
    expect(s.currentPage).toBe('fx');
    tap(s, 15, 1);
    expect(s.currentPage).toBe('drums');
  });

  it('lights current bright, others dim, and pulses pages that just played', () => {
    withNav({ y: 7 });
    s.flash({ id: 'mel', x: 0, y: 0 }, 100);
    expect(s.frame(ctx(100))[7].slice(0, 4)).toEqual([12, 8, 4, 0]);
    expect(s.frame(ctx(100 + FLASH_MS))[7].slice(0, 3)).toEqual([12, 4, 4]);
  });
});
