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

function seededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let state = Math.abs(hash);
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Computes seeded Locality-Sensitive Hashing (LSH).
 * Mapped to DHT keys via seeded random-projection LSH.
 */
export function lshHash(vec: number[], seed: string, numHashes: number = 20, hashLen: number = 32): string[] {
  const rng = seededRng(seed);
  const hashes: Set<string> = new Set();

  // Keep generating unique hashes until we have numHashes
  // In a really small space, this could loop forever, so we add a safeguard
  let attempts = 0;
  const maxAttempts = numHashes * 10;

  while (hashes.size < numHashes && attempts < maxAttempts) {
    let hashBits = '';

    // Each hash requires hashLen projections
    for (let h = 0; h < hashLen; h++) {
      // Generate projection vector
      const proj = Array.from({ length: vec.length }, () => rng() * 2 - 1);

      // Project vector onto random hyperplane using dot product
      let dotProduct = 0;
      for (let j = 0; j < vec.length; j++) {
        dotProduct += vec[j] * proj[j];
      }

      // 1 if positive, 0 if negative
      hashBits += dotProduct > 0 ? '1' : '0';
    }

    hashes.add(hashBits);
    attempts++;
  }

  // If we couldn't get enough unique hashes, just pad with additional hashes
  // generated without uniqueness check (this should be extremely rare)
  const result = Array.from(hashes);
  while (result.length < numHashes) {
    let hashBits = '';
    for (let h = 0; h < hashLen; h++) {
      const proj = Array.from({ length: vec.length }, () => rng() * 2 - 1);
      let dotProduct = 0;
      for (let j = 0; j < vec.length; j++) {
        dotProduct += vec[j] * proj[j];
      }
      hashBits += dotProduct > 0 ? '1' : '0';
    }
    result.push(hashBits);
  }

  return result;
}
