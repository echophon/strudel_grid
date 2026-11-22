// The surface: pages of controls on a 16x8 grid. NOTHING is reserved or hard-wired.
//
// Pages are declared in code (grid.page('drums')) in order of first appearance. A control declared
// on page null (grid.page(null), or `page: null`) is shown on every page. Switching pages is itself
// just a primitive (grid.pages()) placed wherever the code puts it — or left out entirely, in which
// case pages are switched from the on-screen tabs.
//
// Declarations are transactional: begin() collects a new layout, commit() swaps it in, abort()
// (eval error) keeps the old one — a typo never blanks the grid.
// No DOM, no serial: input is key(x, y, down), output is frame() → levels[y][x] (0..15).
import type { DrawCtx, GridTag, Nav, Page, Widget } from './widgets/types';

export const W = 16;
export const H = 8;
export const FLASH_MS = 140;
export const DEFAULT_PAGE = 'main';
/** page value for controls shown on every page */
export const EVERY_PAGE = null;

export interface SurfaceDeps {
  warn(msg: string): void;
}

interface Layout {
  pages: string[];
  widgets: Widget[];
}

const cellKey = (x: number, y: number) => `${x},${y}`;
const pageKey = (p: Page) => p ?? '*';

export class Surface implements Nav {
  private layout: Layout = { pages: [DEFAULT_PAGE], widgets: [] };
  private pending: (Layout & { declPage: Page }) | null = null;
  currentPage = DEFAULT_PAGE;
  private held = new Map<string, Widget | null>();
  private flashes = new Map<string, number>(); // `${page}|x,y` → ms
  private recent = new Map<string, number>(); // page → ms of its last flash
  private listeners = new Set<() => void>();

  constructor(private deps: SurfaceDeps) {}

  // ---- declarations (during eval) ----------------------------------------------
  begin() {
    this.pending = { pages: [], widgets: [], declPage: DEFAULT_PAGE };
  }
  page(name: Page) {
    const p = this.requirePending();
    p.declPage = name === null || name === undefined ? EVERY_PAGE : String(name);
    if (p.declPage !== null && !p.pages.includes(p.declPage)) p.pages.push(p.declPage);
  }
  /** page of the next declaration (for default widget ids) */
  declaring(): Page {
    return this.requirePending().declPage;
  }
  register<T extends Widget>(w: T, page?: Page): T {
    const p = this.requirePending();
    w.page = page !== undefined ? page : p.declPage;
    if (w.page !== null && !p.pages.includes(w.page)) p.pages.push(w.page);
    if (p.widgets.some((o) => o.id === w.id)) this.deps.warn(`duplicate control id "${w.id}" (last declared wins)`);
    p.widgets = p.widgets.filter((o) => o.id !== w.id).concat(w);
    return w;
  }
  commit() {
    if (!this.pending) return;
    const { pages, widgets } = this.pending;
    this.pending = null;
    // a page that only exists implicitly (DEFAULT_PAGE with nothing on it) isn't worth a tab
    const used = pages.filter((pg) => pg !== DEFAULT_PAGE || widgets.some((w) => w.page === pg));
    this.layout = { pages: used.length ? used : [DEFAULT_PAGE], widgets };
    if (!this.layout.pages.includes(this.currentPage)) this.currentPage = this.layout.pages[0];
    for (const w of widgets) w.fit?.(this.layout.pages);
    this.validate();
    this.emit();
  }
  abort() {
    this.pending = null;
  }
  private requirePending() {
    if (!this.pending) this.begin(); // tolerate declarations outside an eval
    return this.pending!;
  }
  private validate() {
    const ws = this.layout.widgets;
    ws.forEach((w, i) => {
      if (w.x < 0 || w.y < 0 || w.x + w.w > W || w.y + w.h > H)
        this.deps.warn(`${w.id} (x${w.x} y${w.y} ${w.w}×${w.h}) extends past the ${W}×${H} grid and will be clipped`);
      const clash = ws.slice(0, i).filter(
        (o) => (o.page === w.page || o.page === null || w.page === null) &&
          w.x < o.x + o.w && o.x < w.x + w.w && w.y < o.y + o.h && o.y < w.y + w.h,
      );
      if (clash.length) this.deps.warn(`${w.id} overlaps ${clash.map((c) => c.id).join(', ')} (last declared wins)`);
    });
    if (this.layout.pages.length > 1 && !ws.some((w) => w.kind === 'pages'))
      this.deps.warn(`${this.layout.pages.length} pages but no grid.pages() control: switch pages from the tabs`);
  }

  // ---- queries / Nav -----------------------------------------------------------
  get pages() { return this.layout.pages; }
  get widgets() { return this.layout.widgets; }
  current() { return this.currentPage; }
  go(name: string) {
    if (!this.layout.pages.includes(name) || name === this.currentPage) return;
    this.currentPage = name;
    this.emit();
  }
  /** ms timestamp of the last flash from a control on this page (for "it's playing" hints) */
  lastActivity(name: string) {
    return this.recent.get(name) ?? -Infinity;
  }
  private visible(w: Widget) {
    return w.page === null || w.page === this.currentPage;
  }
  widgetAt(x: number, y: number) {
    return this.layout.widgets.findLast((w) => this.visible(w) && x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) ?? null;
  }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((fn) => fn()); }

  // ---- input -------------------------------------------------------------------
  key(x: number, y: number, down: boolean) {
    const id = cellKey(x, y);
    if (down) {
      const w = this.widgetAt(x, y);
      this.held.set(id, w);
      w?.onKey(x - w.x, y - w.y, true);
      return;
    }
    // key-up goes to whoever got key-down, even if the page changed in between
    const target = this.held.get(id);
    this.held.delete(id);
    target?.onKey(x - target.x, y - target.y, false);
  }

  // ---- feedback ----------------------------------------------------------------
  flash(t: GridTag, now: number) {
    const w = this.layout.widgets.find((o) => o.id === t.id);
    if (!w) return;
    this.flashes.set(`${pageKey(w.page)}|${cellKey(t.x, t.y)}`, now);
    if (w.page !== null) this.recent.set(w.page, now);
  }

  frame(ctx: DrawCtx): number[][] {
    const levels = Array.from({ length: H }, () => Array<number>(W).fill(0));
    const put = (x: number, y: number, lv: number) => {
      if (x >= 0 && x < W && y >= 0 && y < H) levels[y][x] = Math.max(0, Math.min(15, Math.round(lv)));
    };
    for (const w of this.layout.widgets) if (this.visible(w)) w.draw(put, ctx);
    for (const pk of [this.currentPage, pageKey(EVERY_PAGE)])
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const at = this.flashes.get(`${pk}|${cellKey(x, y)}`);
          if (at === undefined) continue;
          const age = ctx.now - at;
          if (age < FLASH_MS) levels[y][x] = Math.max(levels[y][x], Math.round(15 - (age / FLASH_MS) * 8));
        }
    return levels;
  }
}
