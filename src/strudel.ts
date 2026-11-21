// Strudel editor + REPL wiring (unbundled packages, pinned versions — never mix with @strudel/web,
// which bundles its own copy of core).
import { StrudelMirror } from '@strudel/codemirror';
import { evalScope } from '@strudel/core';
import { transpiler } from '@strudel/transpiler';
import {
  aliasBank,
  getAudioContext,
  initAudioOnFirstClick,
  registerSynthSounds,
  samples,
  webaudioOutput,
} from '@strudel/webaudio';
import { readTags, wrapForFlash } from './widgets/tag';
import type { GridTag } from './widgets/types';

const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';

export interface EditorHooks {
  root: HTMLElement;
  initialCode: string;
  /** extra globals for evaluated code (e.g. { grid }) */
  scope: Record<string, unknown>;
  beforeEval(): void;
  afterEval(): void;
  onEvalError(err: Error): void;
  onToggle(started: boolean): void;
  onCodeChange(code: string): void;
  /** called at the moment a tagged hap is heard (audio clock + output latency + nudge) */
  onFlash(tags: GridTag[]): void;
  nudgeMs(): number;
  onSamplesLoaded(): void;
}

export function createEditor(h: EditorHooks) {
  const editor: any = new StrudelMirror({
    root: h.root,
    initialCode: h.initialCode,
    transpiler,
    defaultOutput: webaudioOutput,
    getTime: () => getAudioContext().currentTime,
    drawTime: [0, 0],
    prebake: async () => {
      initAudioOnFirstClick();
      await evalScope(
        import('@strudel/core'),
        import('@strudel/mini'),
        import('@strudel/tonal'),
        import('@strudel/webaudio'),
        import('@strudel/draw'),
        h.scope,
      );
      await Promise.all([
        registerSynthSounds(),
        samples(`${DOUGH}/tidal-drum-machines.json`),
        samples(`${DOUGH}/Dirt-Samples.json`),
      ]);
      aliasBank('RolandTR909', 'tr909');
      aliasBank('RolandTR808', 'tr808');
      h.onSamplesLoaded();
    },
    beforeEval: () => h.beforeEval(),
    afterEval: () => h.afterEval(),
    onEvalError: (e: Error) => h.onEvalError(e),
    onToggle: (started: boolean) => h.onToggle(started),
    // the single, output-agnostic flash hook (works for superdough, .midi(), any extension)
    editPattern: (pat: any) =>
      wrapForFlash(pat, (hap, targetTime, currentTime) => {
        const tags = readTags(hap);
        if (!tags.length) return;
        const latency = getAudioContext().outputLatency || 0;
        const delayMs = (targetTime - currentTime + latency) * 1000 + h.nudgeMs();
        setTimeout(() => h.onFlash(tags), Math.max(0, delayMs));
      }),
  });

  // StrudelMirror tracks code internally; observe edits for autosave
  editor.root.addEventListener('keyup', () => h.onCodeChange(editor.code));
  editor.root.addEventListener('input', () => h.onCodeChange(editor.code));

  return {
    evaluate: () => editor.evaluate(),
    stop: () => editor.stop(),
    get code(): string { return editor.code; },
    /** scheduler position in cycles (0 when stopped) */
    cycle(): number {
      const s = editor.repl.scheduler;
      return s.started ? s.now() : 0;
    },
    get started(): boolean { return !!editor.repl.scheduler.started; },
  };
}
