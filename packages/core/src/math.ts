/**
 * Computes the cosine similarity between two vectors.
 * Returns a value between -1 and 1.
 * Handles near-zero vectors gracefully.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0; // Graceful fallback for zero vectors
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Mulberry32 PRNG for stable, high-quality pseudo-random numbers
// Replacing the flawed LCG from PROTOCOL.md with a robust 32-bit generator
function pseudoRandom(seedStr: string): () => number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
  }

  let a = hash;
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Computes seeded Locality-Sensitive Hashing (LSH).
 * Mapped to DHT keys via seeded random-projection LSH.
 */
export function lshHash(vec: number[], seed: string, numHashes: number = 20, hashLen: number = 32): string[] {
  const rng = pseudoRandom(seed);
  const hashes: string[] = [];

  for (let i = 0; i < numHashes; i++) {
    let hashBits = '';

    // Each hash requires hashLen projections
    for (let h = 0; h < hashLen; h++) {
      // Generate projection vector using Box-Muller transform for spherical symmetry
      const proj = new Array(vec.length);
      for (let j = 0; j < vec.length; j++) {
        let u = 0, v = 0;
        while (u === 0) u = rng(); // (0, 1) range
        while (v === 0) v = rng();
        proj[j] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      }

      // Project vector onto random hyperplane using dot product
      let dotProduct = 0;
      for (let j = 0; j < vec.length; j++) {
        dotProduct += vec[j] * proj[j];
      }

      // 1 if positive, 0 if negative
      hashBits += dotProduct > 0 ? '1' : '0';
    }

    hashes.push(hashBits);
  }

  return hashes;
}
