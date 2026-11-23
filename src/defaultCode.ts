// The project a fresh browser starts with: the full set (the largest non-hydra example).
import { EXAMPLES } from './examples';

export const DEFAULT_CODE = EXAMPLES.find((e) => e.file.endsWith('-full-set.js'))!.code;
