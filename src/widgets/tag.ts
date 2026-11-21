// Grid tags ride in hap.context.locations: Hap.combineContext is a shallow merge EXCEPT for
// `locations`, which is concatenated — so tags from several widgets shaping one hap all survive
// (prototype 1). The editor highlighter iterates locations as {start, end}; our entries yield an
// "undefined:undefined" key that matches no mark, so they're ignored there.
import type { GridTag, Pattern } from './types';

export function tag(pat: Pattern, t: GridTag): Pattern {
  return pat.withContext((ctx: any) => ({
    ...ctx,
    locations: (ctx.locations || []).concat([{ grid: t }]),
  }));
}

export function readTags(hap: any): GridTag[] {
  return (hap.context?.locations || []).filter((l: any) => l && l.grid).map((l: any) => l.grid);
}

export type FlashFn = (hap: any, targetTime: number, currentTime: number) => void;

/**
 * The single output-agnostic hook. Applied via repl({editPattern}) to every evaluated pattern:
 * chains onto any existing hap onTrigger (e.g. .midi(), which is dominant). With none, keeps
 * dominantTrigger falsy so getTrigger still calls defaultOutput (superdough) too.
 */
export function wrapForFlash(pattern: Pattern, onFlash: FlashFn): Pattern {
  return pattern.withHap((hap: any) => {
    const prev = hap.context.onTrigger;
    return hap.setContext({
      ...hap.context,
      onTrigger: (h: any, currentTime: number, cps: number, targetTime: number) => {
        onFlash(h, targetTime, currentTime);
        return prev?.(h, currentTime, cps, targetTime);
      },
      dominantTrigger: prev ? hap.context.dominantTrigger : false,
    });
  });
}
