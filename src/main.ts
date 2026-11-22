import './style.css';
import { DEFAULT_CODE } from './defaultCode';
import { connectSerialGrid, type SerialGrid } from './grid/serial';
import { createVirtualGrid } from './grid/virtual';
import { createGridApi, installPatternMethods } from './gridApi';
import { clearSaved, load, save } from './persist';
import { createEditor } from './strudel';
import { Surface } from './surface';
import { stepAt } from './widgets/steps';
import { allTimelines, clearTimelines, resetTimeline } from './widgets/timeline';
import { EXAMPLES } from './examples';
import { captureToCode } from './capture';
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

const surface = new Surface({ warn: (m) => log(`⚠ ${m}`) });
if (saved.page) surface.currentPage = saved.page;

let editor: ReturnType<typeof createEditor> | undefined;
const persist = () =>
  save(() => ({ code: editor?.code, store, page: surface.currentPage, nudgeMs: Number(nudge.value) || 0 }));
const env: Env = { store, nowCycle: () => editor?.cycle() ?? 0, changed: persist };

const grid = createGridApi(surface, env, {
  start: () => editor!.evaluate(),
  stop: () => editor!.stop(),
  started: () => !!editor?.started,
});
installPatternMethods(grid);

editor = createEditor({
  root: $('editor'),
  initialCode: saved.code ?? DEFAULT_CODE,
  scope: { grid },
  beforeEval: () => surface.begin(),
  afterEval: () => { surface.commit(); renderLegend(); persist(); },
  onEvalError: (e) => {
    surface.abort();
    const unknown = /grid\.(\w+) is not a function/.exec(e.message);
    log(unknown
      ? `error: grid.${unknown[1]} doesn't exist — available: ${Object.keys(grid).map((k) => `grid.${k}`).join(', ')}`
      : `error: ${e.message}`);
  },
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

// ---- capture-to-code (Ctrl/Cmd+Shift+Enter): write grid state into the init: options ----
function capture() {
  try {
    const r = captureToCode(editor!.code, surface.widgets);
    if (r.code !== editor!.code) editor!.setCode(r.code);
    log(r.changed.length ? `captured: ${r.changed.join(', ')}` : 'capture: code already matches the grid');
    if (r.skipped.length) log(`capture skipped (id not statically known — give it an id): ${r.skipped.join(', ')}`);
    persist();
  } catch (e: any) {
    log(`capture failed: ${e?.message}`);
  }
}
$('capture').addEventListener('click', capture);
$('editor').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    capture();
  }
}, true);

// ---- files: examples menu, open from disk (or drop on the editor), save ----
let loaded = { name: 'strudel-grid.js', code: '' }; // what was last loaded — unchanged code needs no confirm
loaded.code = editor.code;

/** replace the project: code, grid state and page all start fresh, then run it */
function loadProject(name: string, code: string) {
  if (editor!.code !== loaded.code && editor!.code !== code &&
      !confirm(`Load "${name}"? This replaces the code in the editor — Save first to keep it.`)) return;
  for (const k of Object.keys(store)) delete store[k]; // same ids in another file must not inherit state
  clearTimelines();
  surface.currentPage = ''; // → the new project's first page
  editor!.setCode(code);
  loaded = { name, code };
  log(`loaded ${name}`);
  editor!.evaluate();
  persist();
}

const examples = $<HTMLSelectElement>('examples');
EXAMPLES.forEach((ex, i) => examples.add(new Option(ex.title, String(i))));
examples.addEventListener('change', () => {
  const ex = EXAMPLES[Number(examples.value)];
  examples.value = ''; // back to the placeholder so the same example can be picked again
  if (ex) loadProject(ex.file, ex.code);
});

const fileInput = $<HTMLInputElement>('file');
const openFile = async (f: File | undefined) => { if (f) loadProject(f.name, await f.text()); };
$('open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { openFile(fileInput.files?.[0]); fileInput.value = ''; });
const edEl = $('editor');
edEl.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  e.preventDefault();
  edEl.classList.add('drop');
});
edEl.addEventListener('dragleave', () => edEl.classList.remove('drop'));
edEl.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  edEl.classList.remove('drop');
  openFile(e.dataTransfer.files[0]);
});

$('save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([editor!.code], { type: 'text/javascript' }));
  a.download = /\.\w+$/.test(loaded.name) ? loaded.name : `${loaded.name}.js`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  loaded.code = editor!.code; // saved → switching away no longer needs a confirm
});

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
  $('pages').replaceChildren(
    ...surface.pages.map((name) => {
      const b = document.createElement('button');
      b.textContent = name;
      b.className = 'tab' + (name === surface.currentPage ? ' active' : '');
      b.addEventListener('click', () => surface.go(name));
      return b;
    }),
  );
  persist();
}
let legendPage: string | null = null;
surface.onChange(() => {
  renderTabs();
  if (surface.currentPage !== legendPage) renderLegend();
});
renderTabs();

// help: only the current page's controls, then the ones shown on every page
function renderLegend() {
  legendPage = surface.currentPage;
  const page = surface.pages.includes(legendPage) ? legendPage : null;
  const groups = [...(page ? [[page, page] as const] : []), ['every page', null] as const];
  $('legend').replaceChildren(
    ...groups.flatMap(([label, page]) => {
      const ws = surface.widgets.filter((o) => o.page === page);
      if (!ws.length) return [];
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = label;
      sec.append(h);
      for (const w of ws) {
        const p = document.createElement('div');
        p.className = 'wd';
        p.textContent = `${w.id} · ${w.kind} · x${w.x} y${w.y} ${w.w}×${w.h}`;
        sec.append(p);
        w.labels?.forEach((l, i) => {
          const d = document.createElement('div');
          d.className = 'fn';
          d.textContent = w.kind === 'view' ? l : `${w.h > w.w ? `row ${w.y + i}` : `col ${w.x + i}`}: ${l}`;
          sec.append(d);
        });
      }
      return [sec];
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
    playStep: (w, step) => (started ? stepAt(cycle, w, step) : -1),
  };
  const levels = surface.frame(ctx);
  virtual.render(levels);
  device?.sendFrame(levels);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
