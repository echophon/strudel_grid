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
  /** nominal playhead step for a widget `w` steps wide (one cycle per width, or `step` cycles per
   * step when given), or -1 when stopped */
  playStep(w: number, step?: number): number;
}

export type Put = (x: number, y: number, level: number) => void;

export interface Widget {
  id: string;
  kind: string;
  /** set by the surface at registration; null = shown on every page */
  page: Page;
  x: number;
  y: number;
  w: number;
  h: number;
  /** optional per-column descriptions (e.g. switch transforms) for the on-screen legend */
  labels?: string[];
  /** cx/cy are relative to the widget's origin */
  onKey(cx: number, cy: number, down: boolean): void;
  draw(put: Put, ctx: DrawCtx): void;
  /** optional: JSON state for snapshots / capture-to-code */
  snapshot?(): any;
  /** optional: bring the control to a snapshot's state (quantised controls schedule it) */
  restore?(state: any): void;
  /** optional: option values to write back into the code on capture, e.g. { init: 'x..x' } */
  capture?(): Record<string, unknown>;
  /** optional: called at commit with the final page list (e.g. to size a page selector) */
  fit?(pages: string[]): void;
}

/** a page name, or null for "every page" */
export type Page = string | null;

/** what navigation controls may do to the surface */
export interface Nav {
  readonly pages: string[];
  current(): string;
  go(page: string): void;
  /** ms timestamp of the last flash from a control on that page */
  lastActivity(page: string): number;
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
