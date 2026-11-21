import { miniAllStrings } from '@strudel/mini';
import type { Env } from '../src/widgets/types';

miniAllStrings();

export function makeEnv(store: Record<string, any> = {}, cycle = () => 0): Env & { changes: number } {
  const env = { store, nowCycle: cycle, changes: 0, changed: () => { env.changes++; } };
  return env;
}

/** onset haps in [b, e), sorted by time */
export const onsets = (pat: any, b = 0, e = 1) =>
  pat.queryArc(b, e).filter((h: any) => h.hasOnset()).sort((a: any, c: any) => a.whole.begin - c.whole.begin);
