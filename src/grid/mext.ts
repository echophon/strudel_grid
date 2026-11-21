// monome "mext" serial protocol — just what a varibright grid needs.
// https://monome.org/docs/serialosc/serial.txt
//   in : 0x00 query resp [0x00, section, count] · 0x01 id [0x01, 32 chars] · 0x02 offset [0x02,x,y]
//        0x03 size [0x03, x, y] · 0x0f firmware [0x0f, 8 bytes] · 0x20 key up / 0x21 key down [h, x, y]
//   out: 0x00 query · 0x01 id · 0x05 size · 0x1A led level map [0x1A, x0, y0, 32 bytes]

const IN_LEN: Record<number, number> = { 0x00: 3, 0x01: 33, 0x02: 3, 0x03: 3, 0x0f: 9, 0x20: 3, 0x21: 3 };

export type MextMessage =
  | { type: 'key'; x: number; y: number; down: boolean }
  | { type: 'size'; x: number; y: number }
  | { type: 'id'; id: string }
  | { type: 'other'; bytes: number[] };

/** Streaming parser: messages may be split across (or packed into) USB reads. Unknown headers resync. */
export function createParser(onMessage: (m: MextMessage) => void) {
  let buf: number[] = [];
  return (bytes: Iterable<number>) => {
    for (const b of bytes) {
      buf.push(b);
      const need = IN_LEN[buf[0]];
      if (need === undefined) { buf = []; continue; }
      if (buf.length < need) continue;
      const m = buf;
      buf = [];
      if (m[0] === 0x20 || m[0] === 0x21) onMessage({ type: 'key', x: m[1], y: m[2], down: m[0] === 0x21 });
      else if (m[0] === 0x03) onMessage({ type: 'size', x: m[1], y: m[2] });
      else if (m[0] === 0x01) onMessage({ type: 'id', id: String.fromCharCode(...m.slice(1)).replace(/\0+$/, '') });
      else onMessage({ type: 'other', bytes: m });
    }
  };
}

/** Encode one 8x8 quadrant (levels[y][x], 0..15) as /led/level/map: two levels per byte, high nibble first. */
export function encodeQuadrant(levels: number[][], x0: number, y0: number): Uint8Array {
  const out = new Uint8Array(35);
  out[0] = 0x1a;
  out[1] = x0;
  out[2] = y0;
  let i = 3;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x += 2) {
      const a = levels[y0 + y]?.[x0 + x] ?? 0;
      const b = levels[y0 + y]?.[x0 + x + 1] ?? 0;
      out[i++] = ((a & 15) << 4) | (b & 15);
    }
  return out;
}

export const QUERY = new Uint8Array([0x00]);
export const REQUEST_ID = new Uint8Array([0x01]);
export const REQUEST_SIZE = new Uint8Array([0x05]);
