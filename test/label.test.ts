import { rev } from '@strudel/core';
import { describe, expect, it } from 'vitest';
import { fnLabel } from '../src/widgets/label';

describe('fnLabel', () => {
  it('drops the implied parameter of a method chain', () => {
    expect(fnLabel((x: any) => x.fast(2))).toBe('.fast(2)');
    expect(fnLabel((x: any) => x.off(1 / 8, (y: any) => y.add(4)))).toBe('.off(1 / 8, (y) => y.add(4))');
  });
  it('keeps the arrow when the body is not a chain on the parameter', () => {
    expect(fnLabel((x: any) => rev(x))).toMatch(/^x => /);
  });
  it('names library functions instead of printing their source', () => {
    (globalThis as any).rev = rev;
    expect(fnLabel(rev)).toBe('rev');
  });
  it('caps long labels', () => {
    expect(fnLabel((x: any) => x.lpf(100).lpq(5).room(0.5).size(4).delay(0.25).gain(0.8)).length).toBeLessThanOrEqual(48);
  });
});
