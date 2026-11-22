// Short, readable legend text for a user function.
//   x => x.fast(2)   → .fast(2)      (the parameter is implied)
//   rev              → rev           (a library function: its global name, not its minified source)
const MAX = 48;

/** name under which fn is visible to the editor's code (Strudel's evalScope puts exports on globalThis) */
function globalName(fn: Function): string | undefined {
  const g = globalThis as Record<string, unknown>;
  for (const k of Object.keys(g)) {
    try {
      if (g[k] === fn) return k;
    } catch { /* getter that throws */ }
  }
}

export function fnLabel(fn: Function): string {
  const src = String(fn).replace(/\s+/g, ' ').trim();
  const arrow = /^\(?\s*(\w+)\s*\)?\s*=>\s*([\s\S]*)$/.exec(src);
  let text: string;
  if (arrow) {
    const [, param, body] = arrow;
    text = body.startsWith(param + '.') ? body.slice(param.length) : `${param} => ${body}`;
  } else {
    text = globalName(fn) ?? (fn.name && fn.name.length > 2 ? fn.name : 'function');
  }
  return text.length > MAX ? text.slice(0, MAX - 1) + '…' : text;
}
