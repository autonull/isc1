import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../src/math';

describe('cosineSimilarity', () => {
  it('computes identical vectors as 1.0', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1.0);
  });

  it('computes orthogonal vectors as 0.0', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0.0);
  });

  it('computes opposite vectors as -1.0', () => {
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBe(-1.0);
  });

  it('handles near-zero vectors gracefully', () => {
    expect(cosineSimilarity([0, 0, 0.00001], [1, 0, 0])).toBeCloseTo(0);
  });
});
