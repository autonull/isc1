import { cosineSimilarity } from './math.js';
import { Distribution } from './semantic.js';

/**
 * Samples from a multivariate normal distribution given a mean vector and standard deviation.
 * Uses the Box-Muller transform for normal distribution generation.
 *
 * @param mu The mean vector
 * @param sigma The standard deviation (spread)
 * @param n The number of samples to draw
 * @param rng Optional random number generator (for deterministic tests)
 * @returns Array of sampled unit vectors
 */
export function sampleFromDistribution(
  mu: number[],
  sigma: number,
  n: number,
  rng: () => number = Math.random
): number[][] {
  const samples: number[][] = [];

  // If sigma is 0 or we only need 1 sample, just return mu (or normalized mu)
  if (sigma === 0 || n === 1) {
    const norm = Math.sqrt(mu.reduce((sum, v) => sum + v * v, 0));
    const normalizedMu = norm > 0 ? mu.map(v => v / norm) : [...mu];
    for (let i = 0; i < n; i++) {
      samples.push([...normalizedMu]);
    }
    return samples;
  }

  for (let i = 0; i < n; i++) {
    const sample = new Array(mu.length);
    for (let j = 0; j < mu.length; j++) {
      // Box-Muller transform to get a normally distributed random variable
      let u = 0, v = 0;
      while (u === 0) u = rng(); // Converting [0,1) to (0,1)
      while (v === 0) v = rng();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

      sample[j] = mu[j] + z * sigma;
    }

    // Normalize the sample back to the unit hypersphere
    const norm = Math.sqrt(sample.reduce((sum, v) => sum + v * v, 0));
    samples.push(norm > 0 ? sample.map(v => v / norm) : sample);
  }

  return samples;
}

/**
 * Computes an analytic match score between two distributions (Gaussian overlap).
 * This is an alternative to Monte Carlo sampling for performance.
 * It computes the cosine similarity of the means and applies a penalty based on the spread.
 *
 * @param muA Mean vector of distribution A
 * @param sigmaA Spread of distribution A
 * @param muB Mean vector of distribution B
 * @param sigmaB Spread of distribution B
 * @returns A similarity score between -1 and 1
 */
export function analyticDistributionMatch(
  muA: number[],
  sigmaA: number,
  muB: number[],
  sigmaB: number
): number {
  const baseSim = cosineSimilarity(muA, muB);

  // A simple heuristic: if the centers are far apart, larger spread makes them overlap more.
  // If the centers are close, larger spread makes them overlap less (more diffuse).
  // For simplicity in Phase 1, we use a basic adjustment.
  // We want the score to gracefully degrade as uncertainty (sigma) increases.

  const combinedSigma = Math.sqrt(sigmaA * sigmaA + sigmaB * sigmaB);

  // Softmax-like penalty based on distance and spread
  const distanceSq = 2 * (1 - baseSim); // 0 when identical, 4 when opposite

  // If sigma is very high, everything tends towards a neutral similarity (0)
  // If sigma is very low, it approaches the base cosine similarity
  const penaltyFactor = Math.exp(-combinedSigma * distanceSq);

  return baseSim * penaltyFactor;
}
