import { describe, it, expect } from 'vitest';
import { lshHash, cosineSimilarity } from '../src/math';
import { mockEmbed } from '../src/semantic';

describe('lshHash', () => {
  it('is deterministic for same vector and seed', async () => {
    const vec = await mockEmbed("hello world");
    const hashes1 = lshHash(vec, "seed123", 5);
    const hashes2 = lshHash(vec, "seed123", 5);

    expect(hashes1).toEqual(hashes2);
  });

  it('provides semantic space isolation (different seeds yield different hashes)', async () => {
    const vec = await mockEmbed("hello world");
    const hashes1 = lshHash(vec, "modelHashA", 5);
    const hashes2 = lshHash(vec, "modelHashB", 5);

    expect(hashes1).not.toEqual(hashes2);
  });

  it('outputs exactly 32 chars per hash by default', async () => {
    const vec = await mockEmbed("test string");
    const hashes = lshHash(vec, "seed", 1);

    expect(hashes[0]).toHaveLength(32);
    expect(hashes[0]).toMatch(/^[01]+$/);
  });

  it('generates the specified number of unique hashes', async () => {
    const vec = await mockEmbed("another string");
    const hashes = lshHash(vec, "seed", 20);

    expect(hashes).toHaveLength(20);
    const unique = new Set(hashes);
    expect(unique.size).toBe(20);
  });

  it('preserves bucket proximity for similar vectors', async () => {
    const vecA = await mockEmbed("distributed systems");
    const vecB = await mockEmbed("distributed systems and consensus");

    // Create somewhat similar vectors
    const vecC = vecA.map((v, i) => v * 0.9 + vecB[i] * 0.1);

    const hashesA = lshHash(vecA, "seed", 20);
    const hashesC = lshHash(vecC, "seed", 20);

    let collisions = 0;
    for (const h of hashesA) {
      if (hashesC.includes(h)) collisions++;
    }

    const sim = cosineSimilarity(vecA, vecC);

    // For very similar vectors, we expect some collisions
    // The exact rate depends on LSH properties and vector dimension,
    // but should be higher than for dissimilar vectors
    expect(sim).toBeGreaterThan(0.9);

    // We expect at least some collisions
    expect(collisions).toBeGreaterThan(0);
  });

  it('has low collision rate for dissimilar vectors', async () => {
    const vecA = await mockEmbed("distributed systems");
    const vecB = await mockEmbed("baking sourdough bread");

    const hashesA = lshHash(vecA, "seed", 20);
    const hashesB = lshHash(vecB, "seed", 20);

    let collisions = 0;
    for (const h of hashesA) {
      if (hashesB.includes(h)) collisions++;
    }

    // Dissimilar vectors should have very few collisions
    expect(collisions).toBeLessThanOrEqual(2);
  });

  it('dot-product projection correctly reflects sign', () => {
    // This tests the underlying logic by creating a deterministic test case
    // We mock a vector [1, 0] and [-1, 0]
    const vecPos = [1, 0, 0, 0, 0];
    const vecNeg = [-1, 0, 0, 0, 0];

    // Since projection vectors are pseudo-random, pos dot product and neg dot product
    // will have exactly opposite signs for every projection element if the other vector elements are 0.
    // Therefore, the bits should be exactly flipped.
    const hashPos = lshHash(vecPos, "test_seed", 1, 10)[0];
    const hashNeg = lshHash(vecNeg, "test_seed", 1, 10)[0];

    for (let i = 0; i < 10; i++) {
      expect(hashPos[i]).not.toBe(hashNeg[i]);
    }
  });
});
