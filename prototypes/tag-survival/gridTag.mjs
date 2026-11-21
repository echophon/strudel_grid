// PROTOTYPE — throwaway. The portable logic for "tag widget haps + flash from one hook".
// Pure: no I/O. Imported by the TUI (tui.mjs) and by the hardware spike (../grid-spike).
//
// QUESTION: Does a per-cell tag on toggles-widget haps survive Strudel combinators
// (struct/mask/pick/stack/rev/fast/firstOf/degrade/ply/off), including when TWO widgets
// combine on one hap? And does a single onTrigger wrapper see every fired hap,
// regardless of output (default/superdough vs a dominant trigger like .midi())?

import { Pattern, fastcat, pure, silence } from '@strudel/core';

export const STRATEGIES = ['key', 'tags', 'locations'];

// Attach the tag {id, x} to a hap's context using one of three strategies.
// Hap.combineContext is a SHALLOW merge, except `locations` which is concatenated.
function tagContext(ctx, tag, strategy) {
  switch (strategy) {
    case 'key': // our own key: one object; second widget overwrites first on merge
      return { ...ctx, grid: tag };
    case 'tags': // Strudel's built-in tags array (as .tag() does) — also shallow-merged
      return { ...ctx, tags: (ctx.tags || []).concat([`grid:${tag.id}:${tag.x}`]) };
    case 'locations': // piggyback on the one array combineContext concatenates
      return { ...ctx, locations: (ctx.locations || []).concat([{ grid: tag }]) };
  }
}

// Read every grid tag carried by a hap, as [{id, x}].
export function readTags(hap, strategy) {
  const c = hap.context || {};
  switch (strategy) {
    case 'key':
      return c.grid ? [c.grid] : [];
    case 'tags':
      return (c.tags || [])
        .filter((t) => typeof t === 'string' && t.startsWith('grid:'))
        .map((t) => {
          const [, id, x] = t.split(':');
          return { id, x: Number(x) };
        });
    case 'locations':
      return (c.locations || []).filter((l) => l && l.grid).map((l) => l.grid);
  }
}

// A toggles widget: a boolean step pattern, one cycle wide, that reads LIVE state at
// query time (so grid presses are picked up on the next scheduler query).
export function makeToggles(id, getBits, getStrategy) {
  return new Pattern((state) => {
    const bits = getBits();
    const strategy = getStrategy();
    const steps = bits.map((on, x) =>
      on ? pure(true).withContext((ctx) => tagContext(ctx, { id, x }, strategy)) : silence,
    );
    return fastcat(...steps).query(state);
  });
}

// The single output-agnostic hook: chain onto whatever onTrigger a hap already has
// (e.g. .midi() sets one with dominantTrigger=true). If there was none, we keep
// dominantTrigger falsy so repl's getTrigger still calls defaultOutput (superdough).
export function wrapForFlash(pattern, onFlash) {
  return pattern.withHap((hap) => {
    const prev = hap.context.onTrigger;
    return hap.setContext({
      ...hap.context,
      onTrigger: (h, currentTime, cps, targetTime) => {
        onFlash(h, targetTime, currentTime);
        return prev?.(h, currentTime, cps, targetTime);
      },
      dominantTrigger: prev ? hap.context.dominantTrigger : false,
    });
  });
}
