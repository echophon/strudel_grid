import { describe, expect, it } from 'vitest';
import { createParser, encodeQuadrant, type MextMessage } from '../src/grid/mext';

describe('mext parser', () => {
  it('parses key down/up even when split across reads', () => {
    const got: MextMessage[] = [];
    const feed = createParser((m) => got.push(m));
    feed([0x21, 3]);
    feed([5, 0x20, 3, 5]);
    expect(got).toEqual([
      { type: 'key', x: 3, y: 5, down: true },
      { type: 'key', x: 3, y: 5, down: false },
    ]);
  });

  it('parses size and id, and resyncs on unknown headers', () => {
    const got: MextMessage[] = [];
    const feed = createParser((m) => got.push(m));
    const id = Array.from('m1000123').map((c) => c.charCodeAt(0));
    feed([0xee, 0x03, 16, 8, 0x01, ...id, ...Array(32 - id.length).fill(0)]);
    expect(got).toEqual([{ type: 'size', x: 16, y: 8 }, { type: 'id', id: 'm1000123' }]);
  });
});

describe('encodeQuadrant', () => {
  it('packs two 4-bit levels per byte, high nibble first, row-major', () => {
    const levels = Array.from({ length: 8 }, () => Array(16).fill(0));
    levels[0][8] = 15;
    levels[0][9] = 1;
    levels[7][15] = 7;
    const q = encodeQuadrant(levels, 8, 0);
    expect([...q.slice(0, 4)]).toEqual([0x1a, 8, 0, 0xf1]);
    expect(q[34]).toBe(0x07);
    expect(q.length).toBe(35);
  });
});
