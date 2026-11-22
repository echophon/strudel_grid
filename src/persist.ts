// localStorage autosave for editor code, widget state and the current page.
// Every access is guarded: storage can be unavailable (private mode, blocked site data).
const KEY = 'strudel-grid:v3'; // v3: nothing reserved; navigation is the grid.pages() primitive

export interface Saved {
  code?: string;
  store?: Record<string, any>;
  page?: string;
  nudgeMs?: number;
}

export function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') ?? {};
  } catch {
    return {};
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** debounced: collects the latest snapshot and writes it once things settle */
export function save(get: () => Saved, delayMs = 400) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(get()));
    } catch {
      /* storage unavailable: state just won't survive a reload */
    }
  }, delayMs);
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
