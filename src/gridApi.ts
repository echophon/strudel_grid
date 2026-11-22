// The `grid` object exposed to Strudel code. Every control is a primitive the code picks and places;
// nothing on the grid is reserved.
//   grid.page('drums') / grid.page(null)              → following controls go on that page / every page
// sequencing
//   const kick = grid.toggles({ y: 0, init: 'x...' }) → boolean step pattern (.struct / .mask)
//   const mel  = grid.notes({ y: 0, h: 7 })          → degree pattern: n(mel).scale('C:minor')
// transforming / choosing
//   const fx   = grid.switches({ y: 0, fns: [...] })  → { at, row, all }: pat.sw(fx.row(0)), all(fx.all)
//   const go   = grid.play({ x: 15, y: 0 })            → start/stop toggle: pat.sw(go)
//   const sc   = grid.radio({ y: 5, fns: [...] })      → one-of-n transform: pat.sw(sc)
//   const kit  = grid.radio({ y: 5, values: [...] })   → one-of-n value pattern: .bank(kit)
//   const bass = grid.clips({ y: 6, patterns: [...] }) → clip launcher pattern: stack(..., bass)
// values
//   const cut  = grid.fader({ y: 6, range: [200, 4000], exp: true, glide: 1 }) → .lpf(cut)
// performance / system
//   grid.snapshots({ y: 7, w: 8 })                    → save/recall control states
//   grid.transport({ x: 15, y: 7 })                   → start/stop + beat light
//   grid.pages({ y: 7 })                              → page buttons (on every page unless `page` given)
// display
//   anyPattern.grid({ y: 4 })                         → show any pattern on the grid (returns it)
// Every control also accepts `page`. Identity (state across evals): explicit `id`, else kind@page:x,y.
import { Pattern } from '@strudel/core';
import type { Surface } from './surface';
import { clips, type ClipsOpts } from './widgets/clips';
import { fader, type FaderOpts } from './widgets/fader';
import { notes, type NotesOpts } from './widgets/notes';
import { pages, type PagesOpts } from './widgets/pages';
import { play, type PlayOpts } from './widgets/play';
import { radio, type RadioOpts } from './widgets/radio';
import { snapshots, type SnapshotsOpts } from './widgets/snapshots';
import { switches, type SwitchesOpts } from './widgets/switches';
import { toggles, type TogglesOpts } from './widgets/toggles';
import { transport, type Transport, type TransportOpts } from './widgets/transport';
import type { Env, Page, Widget } from './widgets/types';
import { view, type ViewOpts } from './widgets/view';

type Where = { page?: Page };

export function createGridApi(surface: Surface, env: Env, tp: Transport) {
  const pageOf = (o: Where) => (o.page !== undefined ? o.page : surface.declaring());
  const defaultId = (kind: string, o: Where & { x?: number; y?: number }, page = pageOf(o)) =>
    `${kind}@${page ?? '*'}:${o.x ?? 0},${o.y ?? 0}`;
  const add = <W extends Widget>(w: W, o: Where) => surface.register(w, o.page);

  return {
    page(name: Page) {
      surface.page(name);
    },
    toggles(o: TogglesOpts & Where = {}) {
      return add(toggles(env, o, defaultId('toggles', o)), o).pattern;
    },
    notes(o: NotesOpts & Where = {}) {
      return add(notes(env, o, defaultId('notes', o)), o).pattern;
    },
    switches(o: SwitchesOpts & Where) {
      const { widget, api } = switches(env, o, defaultId('switches', o));
      add(widget, o);
      return api;
    },
    play(o: PlayOpts & Where = {}) {
      const { widget, fn } = play(env, o, defaultId('play', o));
      add(widget, o);
      return fn;
    },
    radio(o: RadioOpts & Where) {
      const { widget, value } = radio(env, o, defaultId('radio', o));
      add(widget, o);
      return value;
    },
    clips(o: ClipsOpts & Where) {
      const { widget, pattern } = clips(env, o, defaultId('clips', o));
      add(widget, o);
      return pattern;
    },
    fader(o: FaderOpts & Where = {}) {
      return add(fader(env, o, defaultId('fader', o)), o).pattern;
    },
    snapshots(o: SnapshotsOpts & Where = {}) {
      add(snapshots(env, () => surface.widgets, o, defaultId('snapshots', o)), o);
    },
    transport(o: TransportOpts & Where = {}) {
      add(transport(tp, o, defaultId('transport', o)), o);
    },
    pages(o: PagesOpts & Where = {}) {
      const page = o.page !== undefined ? o.page : null; // navigation defaults to every page
      surface.register(pages(surface, o, defaultId('pages', { ...o, y: o.y ?? 7 }, page)), page);
    },
    /** show a pattern on the grid (display only); usually called as pattern.grid({...}) */
    view(pat: any, o: ViewOpts & Where = {}) {
      add(view(pat, o, defaultId('view', o)), o);
      return pat;
    },
  };
}

export type GridApi = ReturnType<typeof createGridApi>;

/**
 * pat.sw(f): apply a switch / radio / play toggle anywhere in a chain (f is (pat) => pat)
 * pat.grid(opts): show the pattern on the grid; returns the pattern unchanged
 */
export function installPatternMethods(grid: GridApi) {
  Pattern.prototype.sw = function (f: (p: any) => any) {
    return f(this);
  };
  Pattern.prototype.grid = function (o?: ViewOpts & Where) {
    return grid.view(this, o);
  };
}
