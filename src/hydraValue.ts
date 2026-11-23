// H(pattern) → a function hydra calls every frame, giving the pattern's value right now.
// Works with everything the grid returns:
//   number patterns (fader, xy, radio values, n(...)) → that number
//   step patterns (toggles, s("bd").struct(kick))       → 1 while a step sounds, else `fallback`
//   pure(1).sw(someSwitch)                              → 1 while the switch is on, else `fallback`
// Unlike @strudel/hydra's H it never throws on silence, so a quiet step can't crash hydra's loop.
import { reify } from '@strudel/core';

export function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v && typeof v === 'object') {
    for (const k of ['value', 'n', 'note', 'gain']) {
      const n = (v as Record<string, unknown>)[k];
      if (typeof n === 'number' && Number.isFinite(n)) return n;
    }
    return 1; // an event without a number (a drum hit): "on"
  }
  return undefined;
}

export const makeH = (now: () => number) => (p: unknown, fallback = 0) => {
  const pat = reify(p);
  return () => {
    const t = now();
    try {
      for (const h of pat.queryArc(t, t)) {
        const n = toNumber(h.value);
        if (n !== undefined) return n;
      }
    } catch {
      /* a pattern that can't be sampled shows as the fallback */
    }
    return fallback;
  };
};
