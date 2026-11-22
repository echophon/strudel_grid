// pages: a strip of page buttons. Navigation is just another control: put it anywhere, any
// orientation, list only some pages, or leave it out. Declared on every page by default
// (page: null) so it stays reachable; give it a page to make a "sub-menu" instead.
//
// LEDs: current page bright · a page whose controls just played pulses · other pages dim.
import { FLASH_MS } from '../surface';
import type { Nav, Widget } from './types';

export interface PagesOpts {
  id?: string;
  x?: number;
  y?: number;
  /** lay the buttons out downwards instead of across */
  vertical?: boolean;
  /** which pages, in which order (default: all pages, in declaration order) */
  pages?: string[];
}

export function pages(nav: Nav, opts: PagesOpts, defaultId: string): Widget {
  const { x = 0, y = 7, vertical = false } = opts;
  const id = opts.id ?? defaultId;
  let list: string[] = opts.pages?.map(String) ?? [];
  const size = (n: number) => (vertical ? { w: 1, h: Math.max(1, n) } : { w: Math.max(1, n), h: 1 });

  const widget: Widget = {
    id, kind: 'pages', page: null, x, y, ...size(list.length),
    get labels() { return list; },
    fit(all) {
      list = opts.pages ? opts.pages.map(String).filter((p) => all.includes(p)) : all.slice(0, vertical ? 8 - y : 16 - x);
      Object.assign(widget, size(list.length));
    },
    onKey(cx, cy, down) {
      const name = list[vertical ? cy : cx];
      if (down && name !== undefined) nav.go(name);
    },
    draw(put, { now }) {
      list.forEach((name, i) => {
        const lv = name === nav.current() ? 12 : now - nav.lastActivity(name) < FLASH_MS ? 8 : 4;
        put(vertical ? x : x + i, vertical ? y + i : y, lv);
      });
    },
  };
  return widget;
}
