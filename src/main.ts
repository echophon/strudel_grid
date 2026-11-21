import './style.css';
import { DEFAULT_CODE } from './defaultCode';
import { connectSerialGrid, type SerialGrid } from './grid/serial';
import { createVirtualGrid } from './grid/virtual';
import { createGridApi, installPatternMethods } from './gridApi';
import { clearSaved, load, save } from './persist';
import { createEditor } from './strudel';
import { Surface } from './surface';
import { allTimelines, resetTimeline } from './widgets/switches';
import type { DrawCtx, Env } from './widgets/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (msg: string) => {
  const el = $('log');
  const line = document.createElement('div');
  line.textContent = msg;
  el.prepend(line);
  while (el.childElementCount > 60) el.lastElementChild!.remove();
};

// ---- state ----
const saved = load();
const store: Record<string, any> = saved.store ?? {};
const nudge = $<HTMLInputElement>('nudge');
nudge.value = String(saved.nudgeMs ?? 0);

const surface = new Surface({
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  warn: (m) => log(`⚠ ${m}`),
});
if (saved.page) surface.current = saved.page;

let editor: ReturnType<typeof createEditor> | undefined;
const persist = () =>
  save(() => ({ code: editor?.code, store, page: surface.current, nudgeMs: Number(nudge.value) || 0 }));
const env: Env = { store, nowCycle: () => editor?.cycle() ?? 0, changed: persist };

installPatternMethods();
const grid = createGridApi(surface, env);

editor = createEditor({
  root: $('editor'),
  initialCode: saved.code ?? DEFAULT_CODE,
  scope: { grid },
  beforeEval: () => surface.begin(),
  afterEval: () => { surface.commit(); renderLegend(); persist(); },
  onEvalError: (e) => { surface.abort(); log(`error: ${e.message}`); },
  onToggle: (started) => {
    $('status').textContent = started ? 'playing' : 'stopped';
    if (!started) for (const c of allTimelines()) resetTimeline(c);
  },
  onCodeChange: persist,
  onFlash: (tags) => { const now = performance.now(); for (const t of tags) surface.flash(t, now); },
  nudgeMs: () => Number(nudge.value) || 0,
  onSamplesLoaded: () => log('samples loaded'),
});
nudge.addEventListener('change', persist);

// ---- input: hardware + virtual share one handler ----
const onKey = (x: number, y: number, down: boolean) => surface.key(x, y, down);
const virtual = createVirtualGrid($('vgrid'), onKey);

let device: SerialGrid | null = null;
$('connect').addEventListener('click', async () => {
  if (device) { await device.close(); device = null; setConn(false); return; }
  try {
    device = await connectSerialGrid({
      onKey,
      onInfo: (m) => {
        if (m.type === 'id') log(`grid id: ${m.id}`);
        else if (m.type === 'size') log(`grid size: ${m.x}×${m.y}`);
      },
      onDisconnect: () => { device = null; setConn(false); log('grid disconnected'); },
    });
    setConn(true);
    log('grid connected');
  } catch (e: any) {
    if (e?.name !== 'NotFoundError') log(`connect failed: ${e?.message} — is serialosc holding the port?`);
  }
});
function setConn(on: boolean) {
  $('connect').textContent = on ? 'Disconnect grid' : 'Connect grid';
  $('connect').classList.toggle('on', on);
}

$('play').addEventListener('click', () => editor!.evaluate());
$('stop').addEventListener('click', () => editor!.stop());
$('reset').addEventListener('click', () => {
  if (!confirm('Forget saved code and all grid state, and reload?')) return;
  clearSaved();
  location.reload();
});

// ---- page tabs + legend ----
function renderTabs() {
  const el = $('tabs');
  el.replaceChildren(
    ...surface.pages.map((name, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1} ${name}`;
      b.className = name === surface.current ? 'tab active' : 'tab';
      b.addEventListener('click', () => surface.setPage(name));
      return b;
    }),
  );
  $('navhint').hidden = !surface.navOpen;
  persist();
}
surface.onChange(renderTabs);
renderTabs();

function renderLegend() {
  const el = $('legend');
  el.replaceChildren(
    ...surface.pages.map((page) => {
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = page;
      sec.append(h);
      for (const w of surface.widgets.filter((o) => o.page === page)) {
        const p = document.createElement('div');
        p.className = 'wd';
        p.textContent = `${w.id} · ${w.kind} · x${w.x} y${w.y} ${w.w}×${w.h}`;
        sec.append(p);
        w.labels?.forEach((l, i) => {
          const d = document.createElement('div');
          d.className = 'fn';
          d.textContent = `col ${w.x + i}: ${l}`;
          sec.append(d);
        });
      }
      return sec;
    }),
  );
}

// ---- render loop ----
function frame() {
  const now = performance.now();
  const cycle = editor!.cycle();
  const started = editor!.started;
  const ctx: DrawCtx = {
    now, cycle, started,
    playStep: (w) => (started ? Math.floor((((cycle % 1) + 1) % 1) * w) : -1),
  };
  const levels = surface.frame(ctx);
  virtual.render(levels);
  device?.sendFrame(levels);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
