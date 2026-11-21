import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHORD_MS, H, Surface } from '../src/surface';
import type { Widget } from '../src/widgets/types';

const BL: [number, number] = [0, H - 1];
const BR: [number, number] = [15, H - 1];

function fakeWidget(id: string, x: number, y: number, w = 16, h = 1) {
  const keys: string[] = [];
  const widget: Widget = {
    id, kind: 'fake', page: '', x, y, w, h,
    onKey: (cx, cy, down) => keys.push(`${cx},${cy}${down ? 'v' : '^'}`),
    draw: (put) => { for (let i = 0; i < w; i++) put(x + i, y, 3); },
  };
  return { widget, keys };
}
const ctx = { now: 0, cycle: 0, started: false, playStep: () => -1 };

let warnings: string[];
let s: Surface;
let seqRow7: ReturnType<typeof fakeWidget>;
let fxRow0: ReturnType<typeof fakeWidget>;

beforeEach(() => {
  vi.useFakeTimers();
  warnings = [];
  s = new Surface({ setTimeout, clearTimeout, warn: (m) => warnings.push(m) });
  seqRow7 = fakeWidget('seq7', 0, H - 1);
  fxRow0 = fakeWidget('fx0', 0, 0);
  s.begin();
  s.page('seq');
  s.register(seqRow7.widget);
  s.page('fx');
  s.register(fxRow0.widget);
  s.commit();
});

describe('pages', () => {
  it('are declared in order; first page is current', () => {
    expect(s.pages).toEqual(['seq', 'fx']);
    expect(s.current).toBe('seq');
  });

  it('route keys only to widgets on the current page (nothing reserved)', () => {
    s.key(5, H - 1, true);
    s.key(5, H - 1, false);
    expect(seqRow7.keys).toEqual(['5,0v', '5,0^']);
    s.key(5, 0, true);
    expect(fxRow0.keys).toEqual([]);
  });

  it('a failed eval (abort) keeps the previous layout', () => {
    s.begin();
    s.page('other');
    s.abort();
    expect(s.pages).toEqual(['seq', 'fx']);
  });

  it('keeps the current page across evals when it still exists', () => {
    s.setPage('fx');
    s.begin(); s.page('seq'); s.page('fx'); s.commit();
    expect(s.current).toBe('fx');
    s.begin(); s.page('seq'); s.commit();
    expect(s.current).toBe('seq');
  });
});

describe('corner chord → page overlay', () => {
  it('both corners together open the overlay without touching the widget underneath', () => {
    s.key(...BL, true);
    s.key(...BR, true);
    vi.advanceTimersByTime(CHORD_MS * 2);
    s.key(...BL, false);
    s.key(...BR, false);
    expect(s.navOpen).toBe(true);
    expect(seqRow7.keys).toEqual([]);
    // overlay draws on the bottom row: current page brightest
    expect(s.frame(ctx)[H - 1].slice(0, 3)).toEqual([15, 4, 0]);
  });

  it('tapping a page in the overlay switches page and closes it', () => {
    s.key(...BL, true); s.key(...BR, true); s.key(...BL, false); s.key(...BR, false);
    s.key(1, H - 1, true);
    s.key(1, H - 1, false);
    expect(s.current).toBe('fx');
    expect(s.navOpen).toBe(false);
    expect(seqRow7.keys).toEqual([]);
  });

  it('a lone corner press is delivered after CHORD_MS (or immediately on release)', () => {
    s.key(...BL, true);
    expect(seqRow7.keys).toEqual([]);
    vi.advanceTimersByTime(CHORD_MS);
    expect(seqRow7.keys).toEqual(['0,0v']);
    s.key(...BL, false);
    expect(seqRow7.keys).toEqual(['0,0v', '0,0^']);

    s.key(...BR, true);
    s.key(...BR, false); // quick tap: flushed on release, no wait
    expect(seqRow7.keys.slice(2)).toEqual(['15,0v', '15,0^']);
  });

  it('corners pressed further apart than CHORD_MS are two normal presses', () => {
    s.key(...BL, true);
    vi.advanceTimersByTime(CHORD_MS + 1);
    s.key(...BR, true);
    vi.advanceTimersByTime(CHORD_MS + 1);
    expect(s.navOpen).toBe(false);
    expect(seqRow7.keys).toEqual(['0,0v', '15,0v']);
  });
});

describe('routing & feedback', () => {
  it('key-up goes to the widget that got key-down, even after a page switch', () => {
    s.key(3, H - 1, true);
    s.setPage('fx');
    s.key(3, H - 1, false);
    expect(seqRow7.keys).toEqual(['3,0v', '3,0^']);
  });

  it('flashes show on their own page only', () => {
    s.flash({ id: 'fx0', x: 2, y: 0 }, 0);
    expect(s.frame(ctx)[0][2]).toBe(0); // on seq page: fx flash not visible
    s.setPage('fx');
    expect(s.frame(ctx)[0][2]).toBe(15);
  });

  it('warns on overlaps and off-grid widgets', () => {
    s.begin();
    s.register(fakeWidget('a', 0, 0).widget);
    s.register(fakeWidget('b', 4, 0, 4).widget);
    s.register(fakeWidget('c', 14, 7, 4).widget);
    s.commit();
    expect(warnings.some((w) => w.includes('b overlaps a'))).toBe(true);
    expect(warnings.some((w) => w.includes('c ') && w.includes('clipped'))).toBe(true);
  });
});
