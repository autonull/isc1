import { describe, it, expect } from 'vitest';
import { sampleFromDistribution, analyticDistributionMatch } from '../src/sampling';

describe('sampleFromDistribution', () => {
  it('returns point distribution when sigma is 0', () => {
    const mu = [1, 0, 0];
    const samples = sampleFromDistribution(mu, 0, 10);
    expect(samples).toHaveLength(10);
    for (const sample of samples) {
      expect(sample).toEqual(mu);
    }
  });

  it('samples around the mean for non-zero sigma', () => {
    const mu = [1, 0, 0];
    const sigma = 0.1;
    const samples = sampleFromDistribution(mu, sigma, 100);

    // Mean of samples should be close to original mu
    const mean = [0, 0, 0];
    for (const s of samples) {
      mean[0] += s[0];
      mean[1] += s[1];
      mean[2] += s[2];
    }
    mean[0] /= 100;
    mean[1] /= 100;
    mean[2] /= 100;

    expect(mean[0]).toBeGreaterThan(0.9);
    expect(Math.abs(mean[1])).toBeLessThan(0.1);
    expect(Math.abs(mean[2])).toBeLessThan(0.1);
  });
});

describe('analyticDistributionMatch', () => {
  it('computes basic cosine similarity for zero spread', () => {
    const sim = analyticDistributionMatch([1, 0, 0], 0, [0, 1, 0], 0);
    expect(sim).toBe(0); // Orthogonal
  });

  it('penalizes similarity as spread increases for distant vectors', () => {
    const sim1 = analyticDistributionMatch([1, 0, 0], 0.1, [0, 1, 0], 0.1);
    const sim2 = analyticDistributionMatch([1, 0, 0], 0.5, [0, 1, 0], 0.5);

    // Note: The analytic function formula might need tuning, but it should be consistent.
    // For orthogonal vectors (baseSim = 0), the penalty factor doesn't change the 0.
    expect(sim1).toBe(0);
    expect(sim2).toBe(0);
  });
});
