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

/**
 * Computes seeded Locality-Sensitive Hashing (LSH).
 * In Phase 1, we simulate this with a deterministic pseudo-random projection.
 */
export function lshHash(vec: number[], seed: string, numHashes: number): string[] {
  const hashes: string[] = [];

  // Simple LSH implementation using random projection
  // We use the seed to deterministically generate projection vectors
  for (let i = 0; i < numHashes; i++) {
    const projection = generateDeterministicVector(vec.length, `${seed}_${i}`);
    const dot = dotProduct(vec, projection);
    // Simple 1-bit quantization per projection, accumulated into a string
    // In a real implementation this would generate multiple multi-bit hashes
    const bit = dot > 0 ? '1' : '0';
    // For test purposes, we'll return strings that look like hashes
    hashes.push(`hash_${seed}_${i}_${bit}`);
  }

  return hashes;
}

// Simple deterministic random number generator based on a string seed
function pseudoRandom(seedStr: string): () => number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
  }

  // Mulberry32
  let a = hash;
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function generateDeterministicVector(length: number, seed: string): number[] {
  const prng = pseudoRandom(seed);
  const vec = new Array(length);
  for (let i = 0; i < length; i++) {
    // Normal distribution approximation (Box-Muller)
    let u = 0, v = 0;
    while(u === 0) u = prng();
    while(v === 0) v = prng();
    vec[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  return vec;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
