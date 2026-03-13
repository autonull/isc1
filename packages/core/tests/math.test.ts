import { describe, it, expect } from 'vitest';
import { cosineSimilarity, meanVector } from '../src/math';

describe('meanVector', () => {
  it('returns empty array if input is empty', () => {
    expect(meanVector([])).toEqual([]);
  });

  it('computes mean of vectors correctly', () => {
    const vectors = [
      [1, 2, 3],
      [3, 4, 5],
      [2, 3, 4]
    ];
    expect(meanVector(vectors)).toEqual([2, 3, 4]);
  });

  it('throws an error if dimensionalities do not match', () => {
    const vectors = [
      [1, 2],
      [1, 2, 3]
    ];
    expect(() => meanVector(vectors)).toThrow('All vectors must have the same dimensionality');
  });
});

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
