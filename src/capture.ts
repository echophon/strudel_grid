// Capture-to-code: write the grid's current state back into the code as `init:` (and `loop:`)
// options, so a performance becomes source. Only those option values are touched — everything
// else in the code keeps its exact text.
//
// Controls are matched to their grid.<kind>({...}) call by explicit `id: '...'`, or by the same
// default id the API computes (kind@page:x,y), tracking literal grid.page(...) calls in source
// order. Calls whose id can't be worked out statically (computed x/y, loops) are reported, not
// guessed.
import { parse } from 'acorn';
import type { Widget } from './widgets/types';

const CONTROL_KINDS = new Set(['toggles', 'notes', 'switches', 'play', 'radio', 'clips', 'fader', 'snapshots', 'transport', 'pages']);

export interface CaptureResult {
  code: string;
  /** ids whose options were written */
  changed: string[];
  /** grid calls that couldn't be matched to a control */
  skipped: string[];
}

interface Edit { start: number; end: number; text: string; seq?: number }

/** JS literal source for a captured value, matching the default code's style (single quotes) */
export function literal(v: unknown): string {
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  if (v === null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  throw new Error(`can't write ${typeof v} into code`);
}

function walk(node: any, visit: (n: any) => void) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const k in node) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit));
    else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, visit);
  }
}

const propName = (p: any) => (p.type === 'Property' && !p.computed ? (p.key.name ?? p.key.value) : undefined);
const literalValue = (n: any): { ok: boolean; value?: unknown } => {
  if (!n) return { ok: true, value: undefined };
  if (n.type === 'Literal') return { ok: true, value: n.value };
  if (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'Literal') return { ok: true, value: -n.argument.value };
  if (n.type === 'ArrayExpression') {
    const items = n.elements.map(literalValue);
    return items.every((i: { ok: boolean }) => i.ok) ? { ok: true, value: items.map((i: { value?: unknown }) => i.value) } : { ok: false };
  }
  return { ok: false };
};

export function captureToCode(code: string, widgets: Widget[]): CaptureResult {
  const ast = parse(code, {
    ecmaVersion: 'latest', sourceType: 'module',
    allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, allowImportExportEverywhere: true,
  });
  const calls: any[] = [];
  walk(ast, (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed &&
        n.callee.object.type === 'Identifier' && n.callee.object.name === 'grid') calls.push(n);
  });
  calls.sort((a, b) => a.start - b.start);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const edits: Edit[] = [];
  const changed: string[] = [];
  const skipped: string[] = [];
  let page: string | null | undefined = 'main'; // undefined = unknown (non-literal grid.page)

  for (const call of calls) {
    const kind = call.callee.property.name;
    if (kind === 'page') {
      const v = literalValue(call.arguments[0]);
      page = v.ok ? (v.value === null || v.value === undefined ? null : String(v.value)) : undefined;
      continue;
    }
    if (!CONTROL_KINDS.has(kind)) continue;
    const obj = call.arguments[0];
    if (obj && obj.type !== 'ObjectExpression') { skipped.push(`grid.${kind} at ${lineOf(code, call.start)}`); continue; }
    const props = new Map<string, any>((obj?.properties ?? []).map((p: any) => [propName(p), p]));

    let id: string | undefined;
    const idv = literalValue(props.get('id')?.value);
    if (props.has('id')) id = idv.ok && typeof idv.value === 'string' ? idv.value : undefined;
    else {
      const xv = literalValue(props.get('x')?.value);
      const yv = literalValue(props.get('y')?.value);
      const pv = props.has('page') ? literalValue(props.get('page').value) : { ok: true, value: kind === 'pages' ? null : page };
      if (xv.ok && yv.ok && pv.ok && pv.value !== undefined) {
        const y = yv.value ?? (kind === 'pages' ? 7 : 0);
        id = `${kind}@${pv.value ?? '*'}:${xv.value ?? 0},${y}`;
      }
    }
    const w = id ? byId.get(id) : undefined;
    if (!w) { skipped.push(`grid.${kind} at ${lineOf(code, call.start)}`); continue; }
    const cap = w.capture?.();
    if (!cap) continue;

    let wrote = false;
    for (const [key, value] of Object.entries(cap)) {
      const prop = props.get(key);
      if (value === undefined) {
        if (prop) { edits.push(removal(obj, prop)); wrote = true; }
        continue;
      }
      const text = literal(value);
      if (prop) {
        // compare values, not text: `.8` and "x..." already say 0.8 and 'x...' — leave the author's spelling
        const cur = literalValue(prop.value);
        if (!(cur.ok && JSON.stringify(cur.value) === JSON.stringify(value)) && code.slice(prop.value.start, prop.value.end) !== text) {
          edits.push({ start: prop.value.start, end: prop.value.end, text });
          wrote = true;
        }
      } else {
        edits.push(insertion(call, obj, `${key}: ${text}`));
        wrote = true;
      }
    }
    if (wrote) changed.push(w.id);
  }

  // apply back to front; merge insertions at the same point in order
  edits.forEach((e, i) => (e.seq = i));
  edits.sort((a, b) => b.start - a.start || b.end - a.end || b.seq! - a.seq!);
  let out = code;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { code: out, changed, skipped };
}

function insertion(call: any, obj: any, text: string): Edit {
  if (!obj) {
    const at = call.end - 1; // before ')'
    return { start: at, end: at, text: `{ ${text} }` };
  }
  const last = obj.properties[obj.properties.length - 1];
  if (!last) return { start: obj.start, end: obj.end, text: `{ ${text} }` };
  // after the last property (keeping a trailing comma, if any, where it was)
  return { start: last.end, end: last.end, text: `, ${text}` };
}

function removal(obj: any, prop: any): Edit {
  const ps = obj.properties;
  const i = ps.indexOf(prop);
  if (ps.length === 1) return { start: obj.start, end: obj.end, text: '{}' };
  if (i < ps.length - 1) return { start: prop.start, end: ps[i + 1].start, text: '' };
  return { start: ps[i - 1].end, end: prop.end, text: '' };
}

const lineOf = (code: string, pos: number) => `line ${code.slice(0, pos).split('\n').length}`;
