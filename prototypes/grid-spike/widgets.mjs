// PROTOTYPE — throwaway. Code-declared grid widgets: toggles (rhythm) and notes (pitch matrix).
// Each widget = { id, x, y, w, h, pattern, onKey(cx, cy, down), draw(put, ctx) }.
// Patterns read LIVE state at query time and tag every hap with its absolute grid cell
// in context.locations (the only context field Strudel concatenates when combining haps).

import { Pattern, fastcat, pure, silence, stack } from '@strudel/core';

const tagged = (pat, id, x, y) =>
  pat.withContext((ctx) => ({ ...ctx, locations: (ctx.locations || []).concat([{ grid: { id, x, y } }]) }));

// init strings: toggles 'x..x' (x = on), notes '0..2.4' (digit = degree, '.' = rest)
const parseBits = (init, w) => Array.from({ length: w }, (_, i) => /[^.\s-]/.test(init?.[i] ?? '.'));
const parseDegrees = (init, w) =>
  Array.from({ length: w }, (_, i) => { const c = init?.[i]; return /[0-9]/.test(c ?? '') ? [Number(c)] : []; });

export function toggles(store, { id, x = 0, y = 0, w = 16, init }) {
  id ??= `toggles:${x},${y}`;
  const st = (store[id] ??= { bits: parseBits(init, w) });
  st.bits.length = w; // allow width changes on re-eval
  const pattern = new Pattern((state) =>
    fastcat(...Array.from({ length: w }, (_, i) => (st.bits[i] ? tagged(pure(true), id, x + i, y) : silence))).query(state),
  );
  return {
    id, x, y, w, h: 1, pattern,
    onKey(cx, cy, down) { if (down) st.bits[cx] = !st.bits[cx]; },
    draw(put, { playStep }) {
      for (let i = 0; i < w; i++) put(x + i, y, st.bits[i] ? 5 : i === playStep(w) ? 2 : 0);
    },
  };
}

// Pitch matrix: column = step, row = scale degree (bottom row = 0). Returns degree numbers;
// scale/octave/sound stay in code: n(mel).scale("C:minor").
export function notes(store, { id, x = 0, y = 0, w = 16, h = 5, poly = false, init }) {
  id ??= `notes:${x},${y}`;
  const st = (store[id] ??= { cols: parseDegrees(init, w) });
  st.cols.length = w;
  for (let i = 0; i < w; i++) st.cols[i] = (st.cols[i] ?? []).filter((d) => d < h);
  const rowOf = (deg) => y + (h - 1 - deg);
  const pattern = new Pattern((state) =>
    fastcat(
      ...Array.from({ length: w }, (_, i) => {
        const ds = st.cols[i];
        if (!ds.length) return silence;
        return stack(...ds.map((d) => tagged(pure(d), id, x + i, rowOf(d))));
      }),
    ).query(state),
  );
  return {
    id, x, y, w, h, pattern,
    onKey(cx, cy, down) {
      if (!down) return;
      const deg = h - 1 - cy;
      const col = st.cols[cx];
      if (col.includes(deg)) st.cols[cx] = col.filter((d) => d !== deg); // tap lit cell = clear
      else st.cols[cx] = poly ? [...col, deg] : [deg];                  // mono: replace pitch
    },
    draw(put, { playStep }) {
      const ps = playStep(w);
      for (let i = 0; i < w; i++)
        for (let r = 0; r < h; r++) {
          const deg = h - 1 - r;
          let lv = st.cols[i].includes(deg) ? 6 : deg === 0 ? 1 : 0; // dim root row for orientation
          if (i === ps) lv = Math.max(lv, 2);
          put(x + i, y + r, lv);
        }
    },
  };
}
