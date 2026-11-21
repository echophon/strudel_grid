// Shared contracts between widgets, the surface (pages/routing/LEDs) and the Strudel layer.

/** Strudel Pattern — untyped upstream. */
export type Pattern = any;

/** A widget's tag, carried on every hap it produces (absolute grid cell). */
export interface GridTag {
  id: string;
  x: number;
  y: number;
}

export interface DrawCtx {
  /** performance.now() in ms */
  now: number;
  /** current scheduler position in cycles */
  cycle: number;
  started: boolean;
  /** nominal playhead step for a widget `w` steps wide (one cycle per width), or -1 when stopped */
  playStep(w: number): number;
}

export type Put = (x: number, y: number, level: number) => void;

export interface Widget {
  id: string;
  kind: string;
  /** set by the surface at registration */
  page: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** optional per-column descriptions (e.g. switch transforms) for the on-screen legend */
  labels?: string[];
  /** cx/cy are relative to the widget's origin */
  onKey(cx: number, cy: number, down: boolean): void;
  draw(put: Put, ctx: DrawCtx): void;
}

/** JSON-serialisable widget state, keyed by widget id. Persisted to localStorage. */
export type Store = Record<string, any>;

export interface Env {
  store: Store;
  /** current scheduler cycle (0 when stopped) */
  nowCycle(): number;
  /** call after any state mutation so it can be persisted */
  changed(): void;
}
