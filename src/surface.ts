// The surface: pages of widgets on a 16x8 grid, with nothing reserved.
//
// Pages are declared in code (grid.page('drums')) in order of first appearance. To switch, press
// BOTH bottom corners together: row 7 temporarily becomes page buttons (overlay); tap one to go
// there (closes the overlay). Only the two corner keys pay a small CHORD_MS wait to tell a
// chord from a normal press; every other key dispatches immediately.
//
// Declarations are transactional: begin() collects a new layout, commit() swaps it in, abort()
// (eval error) keeps the old one — a typo never blanks the grid.
//
// No DOM, no serial: input is key(x, y, down), output is frame() → levels[y][x] (0..15).
import type { DrawCtx, GridTag, Widget } from './widgets/types';

export const W = 16;
export const H = 8;
export const CHORD_MS = 60;
export const FLASH_MS = 140;
export const DEFAULT_PAGE = 'main';

type Timer = unknown;
export interface SurfaceDeps {
  setTimeout(fn: () => void, ms: number): Timer;
  clearTimeout(t: Timer): void;
  warn(msg: string): void;
}

interface Layout {
  pages: string[];
  widgets: Widget[];
}

const CORNERS: [number, number][] = [[0, H - 1], [W - 1, H - 1]];
const isCorner = (x: number, y: number) => CORNERS.some(([cx, cy]) => cx === x && cy === y);
const k = (x: number, y: number) => `${x},${y}`;

export class Surface {
  private layout: Layout = { pages: [DEFAULT_PAGE], widgets: [] };
  private pending: (Layout & { declPage: string }) | null = null;
  current = DEFAULT_PAGE;
  navOpen = false;
  private held = new Map<string, Widget | 'nav' | null>();
  private deferred = new Map<string, { timer: Timer; released: boolean }>();
  private flashes = new Map<string, number>(); // `${page}|x,y` → ms
  private activity = new Map<string, number>(); // page → ms of last flash
  private listeners = new Set<() => void>();

  constructor(private deps: SurfaceDeps) {}

  // ---- declarations (during eval) ----------------------------------------------
  begin() {
    this.pending = { pages: [], widgets: [], declPage: DEFAULT_PAGE };
  }
  page(name: string) {
    const p = this.requirePending();
    p.declPage = String(name);
    if (!p.pages.includes(p.declPage)) p.pages.push(p.declPage);
  }
  register<T extends Widget>(w: T, page?: string): T {
    const p = this.requirePending();
    w.page = page ?? p.declPage;
    if (!p.pages.includes(w.page)) p.pages.push(w.page);
    if (w.x < 0 || w.y < 0 || w.x + w.w > W || w.y + w.h > H)
      this.deps.warn(`${w.id} (x${w.x} y${w.y} ${w.w}×${w.h}) extends past the ${W}×${H} grid; it will be clipped`);
    const clash = p.widgets.filter(
      (o) => o.page === w.page && o.id !== w.id &&
        w.x < o.x + o.w && o.x < w.x + w.w && w.y < o.y + o.h && o.y < w.y + w.h,
    );
    if (clash.length) this.deps.warn(`${w.id} overlaps ${clash.map((c) => c.id).join(', ')} on page "${w.page}" (last declared wins)`);
    if (p.widgets.some((o) => o.id === w.id)) this.deps.warn(`duplicate widget id "${w.id}" (last declared wins)`);
    p.widgets = p.widgets.filter((o) => o.id !== w.id).concat(w);
    return w;
  }
  commit() {
    if (!this.pending) return;
    const { pages, widgets } = this.pending;
    if (pages.length > W) this.deps.warn(`${pages.length} pages declared; only the first ${W} are reachable from the grid`);
    this.layout = { pages: pages.length ? pages : [DEFAULT_PAGE], widgets };
    this.pending = null;
    if (!this.layout.pages.includes(this.current)) this.current = this.layout.pages[0];
    this.emit();
  }
  abort() {
    this.pending = null;
  }
  /** page that new declarations land on (for default widget ids) */
  declaringPage() {
    return this.requirePending().declPage;
  }
  private requirePending() {
    if (!this.pending) this.begin(); // tolerate declarations outside an eval
    return this.pending!;
  }

  // ---- queries -----------------------------------------------------------------
  get pages() { return this.layout.pages; }
  get widgets() { return this.layout.widgets; }
  widgetAt(x: number, y: number, page = this.current) {
    return this.layout.widgets.findLast((w) => w.page === page && x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) ?? null;
  }
  setPage(name: string) {
    if (!this.layout.pages.includes(name)) return;
    this.current = name;
    this.navOpen = false;
    this.emit();
  }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((fn) => fn()); }

  // ---- input -------------------------------------------------------------------
  key(x: number, y: number, down: boolean) {
    const id = k(x, y);
    if (down) {
      if (this.navOpen && y === H - 1) {
        this.held.set(id, 'nav');
        if (x < this.layout.pages.length) this.setPage(this.layout.pages[x]);
        else { this.navOpen = false; this.emit(); } // tap an empty slot to just close
        return;
      }
      if (isCorner(x, y)) {
        const other = CORNERS.map(([cx, cy]) => k(cx, cy)).find((c) => c !== id)!;
        const otherDeferred = this.deferred.get(other);
        if (otherDeferred && !otherDeferred.released) {
          // chord: swallow both corner presses and open the page overlay
          this.deps.clearTimeout(otherDeferred.timer);
          this.deferred.delete(other);
          this.held.set(other, 'nav');
          this.held.set(id, 'nav');
          this.navOpen = true;
          this.emit();
          return;
        }
        const entry = { released: false, timer: null as Timer };
        entry.timer = this.deps.setTimeout(() => this.flushDeferred(id, x, y), CHORD_MS);
        this.deferred.set(id, entry);
        return;
      }
      this.dispatchDown(id, x, y);
      return;
    }
    // key up
    const d = this.deferred.get(id);
    if (d) {
      d.released = true;
      this.deps.clearTimeout(d.timer);
      this.flushDeferred(id, x, y);
      return;
    }
    const target = this.held.get(id);
    this.held.delete(id);
    if (target && target !== 'nav') target.onKey(x - target.x, y - target.y, false);
  }
  private flushDeferred(id: string, x: number, y: number) {
    const d = this.deferred.get(id);
    if (!d) return;
    this.deferred.delete(id);
    this.dispatchDown(id, x, y);
    if (d.released) this.key(x, y, false);
  }
  private dispatchDown(id: string, x: number, y: number) {
    const w = this.widgetAt(x, y);
    this.held.set(id, w);
    w?.onKey(x - w.x, y - w.y, true);
  }

  // ---- feedback ----------------------------------------------------------------
  flash(t: GridTag, now: number) {
    const w = this.layout.widgets.find((o) => o.id === t.id);
    if (!w) return;
    this.flashes.set(`${w.page}|${k(t.x, t.y)}`, now);
    this.activity.set(w.page, now);
  }

  frame(ctx: DrawCtx): number[][] {
    const levels = Array.from({ length: H }, () => Array<number>(W).fill(0));
    const put = (x: number, y: number, lv: number) => {
      if (x >= 0 && x < W && y >= 0 && y < H) levels[y][x] = Math.max(0, Math.min(15, Math.round(lv)));
    };
    for (const w of this.layout.widgets) if (w.page === this.current) w.draw(put, ctx);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const at = this.flashes.get(`${this.current}|${k(x, y)}`);
        if (at === undefined) continue;
        const age = ctx.now - at;
        if (age < FLASH_MS) levels[y][x] = Math.max(levels[y][x], Math.round(15 - (age / FLASH_MS) * 8));
      }
    if (this.navOpen) {
      // overlay: current page bright, other pages dim + pulse with their activity, empty slots dark
      for (let x = 0; x < W; x++) {
        const name = this.layout.pages[x];
        let lv = 0;
        if (name === this.current) lv = 15;
        else if (name !== undefined) {
          const age = ctx.now - (this.activity.get(name) ?? -1e9);
          lv = age < FLASH_MS ? 10 : 4;
        }
        levels[H - 1][x] = lv;
      }
    }
    return levels;
  }
}
