// PROTOTYPE — throwaway. One page: WebSerial grid + virtual mirror + code-declared widgets
// (grid.toggles / grid.notes / grid.switches) + truthful flashes via one onTrigger wrapper.
import { initStrudel, evaluate, hush, getAudioContext, samples, aliasBank, Pattern } from '@strudel/web';
import { readTags, wrapForFlash } from '../tag-survival/gridTag.mjs';
import { connectGrid, encodeQuadrant } from './mext.mjs';
import { createCell, valueAt, scheduleChange, pendingAt, gate } from './switches.mjs';
import { toggles, notes } from './widgets.mjs';

const W = 16, H = 8, HOLD_MS = 300;
const $ = (id) => document.getElementById(id);
const log = (m) => { $('log').textContent = `${m}\n${$('log').textContent}`.slice(0, 4000); };

// ---- widget registry: rebuilt every eval; state persists by id in `store` ----
const store = {};
let widgets = [];
const register = (wd) => {
  const clash = widgets.filter((o) => o.id !== wd.id &&
    wd.x < o.x + o.w && o.x < wd.x + wd.w && wd.y < o.y + o.h && o.y < wd.y + wd.h);
  if (clash.length) log(`warning: ${wd.id} overlaps ${clash.map((c) => c.id).join(', ')} (last declared wins)`);
  widgets = widgets.filter((o) => o.id !== wd.id).concat(wd);
  return wd;
};
const widgetAt = (x, y) => widgets.findLast((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
const nowCycle = () => (repl?.scheduler?.started ? repl.scheduler.now() : 0);

function switches({ id, x = 0, y = 0, h = 1, fns, q = 1 }) {
  id ??= `switches:${x},${y}`;
  const cells = (store[id] ??= {});
  const cell = (cx, cy) => (cells[`${cx},${cy}`] ??= createCell());
  const at = (cx, cy = 0) => gate(cell(cx, cy), fns[cx], { id, x: x + cx, y: y + cy });
  const row = (cy = 0) => (pat) => fns.reduce((p, _, cx) => at(cx, cy)(p), pat);
  register({
    id, x, y, w: fns.length, h, fns, q,
    onKey(cx, cy, down) {
      const c = cell(cx, cy);
      if (down) { c.downAt = performance.now(); c.latched = !c.latched; scheduleChange(c, c.latched, nowCycle(), q); }
      else if (performance.now() - c.downAt > HOLD_MS) { c.latched = !c.latched; scheduleChange(c, c.latched, nowCycle(), q); }
    },
    draw(put, { now, cyc }) {
      for (let cy = 0; cy < h; cy++)
        for (let cx = 0; cx < fns.length; cx++) {
          const c = cell(cx, cy);
          let lv = valueAt(c, cyc) ? 9 : 2;
          if (pendingAt(c, cyc) && Math.floor(now / 125) % 2) lv = 6; // armed: blink until boundary
          put(x + cx, y + cy, lv);
        }
    },
  });
  return { at, row, all: row(0) };
}

window.grid = {
  toggles: (opts) => register(toggles(store, opts)).pattern,
  notes: (opts) => register(notes(store, opts)).pattern,
  switches,
};
// intersperse a switch (or a whole row of them) anywhere in a chain
Pattern.prototype.sw = function (f) { return f(this); };

// flash[y][x] = performance.now() of the last real trigger
const flash = Array.from({ length: H }, () => Array(W).fill(-1e9));

// ---- strudel ----
let repl;
const DS = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
const ready = initStrudel({
  prebake: async () => {
    await Promise.all([samples(`${DS}/tidal-drum-machines.json`), samples(`${DS}/Dirt-Samples.json`)]);
    aliasBank('RolandTR909', 'tr909');
    log('samples loaded');
  },
  beforeEval: () => { widgets = []; },
  editPattern: (pat) =>
    wrapForFlash(pat, (hap, targetTime, currentTime) => {
      const tags = readTags(hap, 'locations');
      if (!tags.length) return;
      const ac = getAudioContext();
      const delayMs = (targetTime - currentTime + (ac.outputLatency || 0)) * 1000 + Number($('nudge').value);
      setTimeout(() => {
        const now = performance.now();
        for (const t of tags) if (flash[t.y] && t.x < W) flash[t.y][t.x] = now;
      }, Math.max(0, delayMs));
    }),
}).then((r) => (repl = r));

function describe() {
  $('legend').textContent = widgets
    .map((w) => `${w.id}  x${w.x} y${w.y} ${w.w}×${w.h}` + (w.fns
      ? '\n' + w.fns.map((f, i) => `  col ${w.x + i}: ${String(f).replace(/\s+/g, ' ').slice(0, 48)}`).join('\n')
      : ''))
    .join('\n');
}
const play = async () => {
  await ready;
  try { await evaluate($('code').value); describe(); log('evaluated'); } catch (e) { log(`error: ${e.message}`); }
};
const stop = () => {
  hush();
  // cycle time restarts at 0 on next play: collapse switch timelines to their latched value
  for (const v of Object.values(store))
    for (const c of Object.values(v)) if (c?.history) c.history = [[-Infinity, c.latched]];
};
$('play').onclick = play;
$('stop').onclick = stop;
$('code').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); play(); }
  if (e.ctrlKey && e.key === '.') { e.preventDefault(); stop(); }
});

// ---- input (hardware + virtual share one handler) ----
const held = new Map(); // "x,y" -> widget that got the key-down (so key-up goes to the same one)
function onKey(x, y, down) {
  const k = `${x},${y}`;
  const wd = down ? widgetAt(x, y) : held.get(k);
  if (down) held.set(k, wd); else held.delete(k);
  wd?.onKey(x - wd.x, y - wd.y, down);
}

const cells = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = document.createElement('div');
  d.onpointerdown = (e) => { d.setPointerCapture(e.pointerId); onKey(x, y, 1); };
  d.onpointerup = () => onKey(x, y, 0);
  $('grid').appendChild(d);
  cells.push(d);
}

let device = null;
$('connect').onclick = async () => {
  try {
    device = await connectGrid({
      onKey,
      onInfo: (m) => log(`grid info: ${m.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`),
    });
    log('grid connected');
  } catch (e) { log(`connect failed: ${e.message} (is serialosc holding the port?)`); }
};

// ---- render loop: widgets draw, flashes overlay, push dirty quadrants ----
const FLASH_MS = 140;
let lastSent = ['', ''];
function frame() {
  const now = performance.now();
  const cyc = nowCycle();
  const started = repl?.scheduler?.started;
  const playStep = (w) => (started ? Math.floor((((cyc % 1) + 1) % 1) * w) : -1);
  const levels = Array.from({ length: H }, () => Array(W).fill(0));
  const put = (x, y, lv) => { if (x < W && y < H) levels[y][x] = lv; };
  for (const wd of widgets) wd.draw(put, { now, cyc, playStep });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const age = now - flash[y][x];
      if (age < FLASH_MS) levels[y][x] = Math.max(levels[y][x], Math.round(15 - (age / FLASH_MS) * 8));
    }
  levels.forEach((row, y) => row.forEach((lv, x) => {
    cells[y * W + x].style.background = lv ? `rgb(${40 + lv * 14}, ${30 + lv * 11}, ${10 + lv * 4})` : '#222';
  }));
  if (device) {
    [0, 8].forEach((x0, i) => {
      const q = encodeQuadrant(levels, x0, 0);
      const key = q.join(',');
      if (key !== lastSent[i]) { lastSent[i] = key; device.send(q); }
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
