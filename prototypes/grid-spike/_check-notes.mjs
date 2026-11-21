// PROTOTYPE sanity check for widgets.notes — throwaway
import { n } from '@strudel/core';
import '@strudel/tonal';
import { miniAllStrings } from '@strudel/mini';
import { notes } from './widgets.mjs';
import { readTags } from '../tag-survival/gridTag.mjs';
miniAllStrings();
const store = {};
const w = notes(store, { id: 'mel', y: 2, h: 5, init: '0..2..3.4...2.1.' });
const show = (pat) => pat.queryArc(0, 1).filter((h) => h.hasOnset())
  .sort((a, b) => a.whole.begin - b.whole.begin)
  .map((h) => `${h.value.note ?? h.value.n ?? h.value}@(${readTags(h, 'locations').map((t) => `${t.x},${t.y}`).join('+')})`).join(' ');
console.log('degrees      :', show(w.pattern));
console.log('scaled       :', show(n(w.pattern).scale('C:minor')));
console.log('add(7)+scale :', show(n(w.pattern.add(7)).scale('C:minor')));
w.onKey(4, 0, 1);   // col 4, top row → degree 4 (mono: adds pitch on empty step)
w.onKey(0, 4, 1);   // col 0, bottom row (already degree 0) → clears it
console.log('after edits  :', show(w.pattern));
