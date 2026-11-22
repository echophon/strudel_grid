// view: show ANY pattern on the grid — `.grid()` on a pattern, display only.
//   s("bd*4, ~ sd, hh*8").grid({ y: 4 })       // one row per sound (auto)
//   n("0 2 4 <5 7>").scale("C:minor").grid({ y: 0, h: 5 })   // pitches folded into h rows
// Rows (auto): if events carry a number (n / note / bare number) they're folded into h rows
// (lowest at the bottom); otherwise one row per sound (s, or the value), in order of appearance.
// Columns: w steps across `cycles` cycles. Events are dim; the ones sounding now are bright.
import type { DrawCtx, Pattern, Widget } from './types';

export interface ViewOpts {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  /** rows (default: automatic from the pattern, up to the bottom of the grid) */
  h?: number;
  /** cycles shown across the width (default 1) */
  cycles?: number;
  /** force the row mode */
  rows?: 'auto' | 'pitch' | 'sound';
}

const numberOf = (v: any): number | undefined => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    for (const k of ['n', 'note', 'freq']) if (typeof v[k] === 'number') return v[k];
  }
  return undefined;
};
const soundOf = (v: any): string => (v && typeof v === 'object' ? String(v.s ?? v.sound ?? JSON.stringify(v)) : String(v));

const onsetHaps = (pat: Pattern, b: number, e: number) => {
  try {
    return pat.queryArc(b, e).filter((h: any) => h.hasOnset());
  } catch {
    return []; // a pattern that can't be queried out of context just shows nothing
  }
};

export function view(pat: Pattern, opts: ViewOpts, defaultId: string): Widget {
  const { x = 0, y = 0, cycles = 1 } = opts;
  const w = Math.max(1, opts.w ?? 16 - x);
  const id = opts.id ?? defaultId;
  const maxH = Math.max(1, 8 - y);

  // probe a few cycles to pick rows
  const probe = onsetHaps(pat, 0, Math.max(4, cycles));
  const nums = probe.map((h: any) => numberOf(h.value)).filter((n: any): n is number => n !== undefined);
  const mode = opts.rows && opts.rows !== 'auto' ? opts.rows : nums.length && nums.length === probe.length ? 'pitch' : 'sound';
  const sounds: string[] = [];
  if (mode === 'sound') for (const h of probe) { const k = soundOf(h.value); if (!sounds.includes(k)) sounds.push(k); }
  const lo = nums.length ? Math.min(...nums) : 0;
  const hi = nums.length ? Math.max(...nums) : 0;
  const h = Math.max(1, Math.min(maxH, opts.h ?? (mode === 'pitch' ? Math.floor(hi - lo) + 1 : sounds.length || 1)));

  const rowOf = (v: any): number | undefined => {
    if (mode === 'pitch') {
      const n = numberOf(v);
      if (n === undefined) return undefined;
      return h - 1 - ((((Math.floor(n - lo)) % h) + h) % h);
    }
    const k = soundOf(v);
    if (!sounds.includes(k) && sounds.length < h) sounds.push(k);
    const i = sounds.indexOf(k);
    return i >= 0 ? i : undefined;
  };

  return {
    id, kind: 'view', page: '', x, y, w, h,
    get labels() { return mode === 'sound' ? sounds.map((s, i) => `row ${y + i}: ${s}`) : [`pitch, lowest ${lo} at the bottom`]; },
    onKey() {},
    draw(put, ctx: DrawCtx) {
      const now = ctx.started ? ctx.cycle : 0;
      const start = Math.floor(now / cycles) * cycles;
      const lit = new Map<string, number>(); // several events can share a cell: keep the brightest
      for (const hp of onsetHaps(pat, start, start + cycles)) {
        const b = hp.whole.begin.valueOf();
        const e = hp.whole.end.valueOf();
        const col = Math.floor(((b - start) / cycles) * w);
        const row = rowOf(hp.value);
        if (row === undefined || col < 0 || col >= w) continue;
        const sounding = ctx.started && b <= now && now < e;
        const k = `${col},${row}`;
        lit.set(k, Math.max(lit.get(k) ?? 0, sounding ? 12 : 4));
      }
      for (const [k, lv] of lit) {
        const [c, r] = k.split(',').map(Number);
        put(x + c, y + r, lv);
      }
    },
  };
}
