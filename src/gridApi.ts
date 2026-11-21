// The `grid` object exposed to Strudel code.
//   grid.page('drums')                                → subsequent widgets land on that page
//   const kick = grid.toggles({ y: 0, init: 'x...' }) → boolean step pattern
//   const mel  = grid.notes({ y: 2, h: 5 })          → degree pattern: n(mel).scale('C:minor')
//   const fx   = grid.switches({ y: 7, fns: [...] })  → { at, row, all }; use with .sw(...) / all(...)
// Every widget also accepts `page: 'name'` to override the current page.
// Identity (for state across evals): explicit `id`, else kind@page:x,y.
import { Pattern } from '@strudel/core';
import type { Surface } from './surface';
import { notes, type NotesOpts } from './widgets/notes';
import { switches, type SwitchesOpts } from './widgets/switches';
import { toggles, type TogglesOpts } from './widgets/toggles';
import type { Env } from './widgets/types';

type WithPage<T> = T & { page?: string };

export function createGridApi(surface: Surface, env: Env) {
  const defaultId = (kind: string, o: { x?: number; y?: number; page?: string }) =>
    `${kind}@${o.page ?? surface.declaringPage()}:${o.x ?? 0},${o.y ?? 0}`;

  return {
    page(name: string) {
      surface.page(name);
    },
    toggles(o: WithPage<TogglesOpts> = {}) {
      return surface.register(toggles(env, o, defaultId('toggles', o)), o.page).pattern;
    },
    notes(o: WithPage<NotesOpts> = {}) {
      return surface.register(notes(env, o, defaultId('notes', o)), o.page).pattern;
    },
    switches(o: WithPage<SwitchesOpts>) {
      const { widget, api } = switches(env, o, defaultId('switches', o));
      surface.register(widget, o.page);
      return api;
    },
  };
}

/** pat.sw(f): apply a switch / switch row anywhere in a chain (f is (pat) => pat) */
export function installPatternMethods() {
  Pattern.prototype.sw = function (f: (p: any) => any) {
    return f(this);
  };
}
