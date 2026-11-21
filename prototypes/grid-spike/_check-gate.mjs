// PROTOTYPE sanity check for switches.gate — throwaway
import { s, rev } from '@strudel/core';
import { miniAllStrings } from '@strudel/mini';
import { createCell, scheduleChange, gate } from './switches.mjs';
miniAllStrings();
const cell = createCell();
scheduleChange(cell, true, 0.62, 1);   // pressed mid-cycle 0, q=1 → on at 1
scheduleChange(cell, false, 1.3, 0);   // released at 1.3, q=0 → off at 1.3
const pat = gate(cell, (x) => x.fast(2), { id: 't', x: 0, y: 0 })(s('bd sd hh oh'));
const show = (haps) => haps.filter((h) => h.hasOnset()).map((h) => `${h.whole.begin.valueOf().toFixed(3)}:${h.value.s}`).join(' ');
const whole = show(pat.queryArc(0, 2));
let ticks = []; for (let t = 0; t < 2; t += 0.05) ticks.push(...pat.queryArc(t, Math.min(2, t + 0.05)));
console.log('one query :', whole);
console.log('ticked    :', show(ticks));
console.log('identical :', whole === show(ticks));
