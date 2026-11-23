// Hydra (https://hydra.ojack.xyz) visuals behind the editor, driven by Strudel/grid patterns.
//   await initHydra()                // in your code, before any hydra calls
//   osc(H(cut)).kaleid(H(pad.y)).out()
// The canvas sits behind the page; html[data-hydra] makes the panels translucent while it is up.
import { clearHydra as clearStrudelHydra, initHydra as initStrudelHydra } from '@strudel/hydra';

/** pinned: @strudel/hydra would otherwise load whatever unpkg serves as "latest" */
const HYDRA_SRC = 'https://unpkg.com/hydra-synth@1.3.29/dist/hydra-synth.js';

export async function initHydra(options: Record<string, unknown> = {}) {
  const hydra = await initStrudelHydra({ src: HYDRA_SRC, ...options });
  document.documentElement.dataset.hydra = 'on'; // an attribute: Strudel's themes overwrite <html class>
  return hydra;
}

export function clearHydra() {
  clearStrudelHydra();
  delete document.documentElement.dataset.hydra;
}
