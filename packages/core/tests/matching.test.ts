import { describe, it, expect } from 'vitest';
import { relationalMatch, parseLocation, parseTime } from '../src/matching';
import { Distribution } from '../src/semantic';

describe('relationalMatch', () => {
  it('computes root-only alignment (monte_carlo)', () => {
    const myDists: Distribution[] = [{ type: 'root', mu: [1, 0, 0], sigma: 0 }];
    const peerDists: Distribution[] = [{ type: 'root', mu: [1, 0, 0], sigma: 0 }];

    const score = relationalMatch(myDists, peerDists, 'high', 'monte_carlo');
    expect(score).toBeCloseTo(1.0);
  });

  it('computes root-only alignment (analytic)', () => {
    const myDists: Distribution[] = [{ type: 'root', mu: [1, 0, 0], sigma: 0 }];
    const peerDists: Distribution[] = [{ type: 'root', mu: [1, 0, 0], sigma: 0 }];

    const score = relationalMatch(myDists, peerDists, 'high', 'analytic');
    expect(score).toBeCloseTo(1.0);
  });

  it('computes tag-match bonus', () => {
    const myDists: Distribution[] = [
      { type: 'root', mu: [1, 0, 0], sigma: 0 },
      { type: 'fused', mu: [0.8, 0.6, 0], sigma: 0, tag: 'with_mood', object: 'happy', weight: 1.0 }
    ];
    const peerDists: Distribution[] = [
      { type: 'root', mu: [1, 0, 0], sigma: 0 },
      { type: 'fused', mu: [0.8, 0.6, 0], sigma: 0, tag: 'with_mood', object: 'happy', weight: 1.0 }
    ];

    const scoreMC = relationalMatch(myDists, peerDists, 'high', 'monte_carlo');
    const scoreAnalytic = relationalMatch(myDists, peerDists, 'high', 'analytic');
    // Without bonus: (1.0 + 1.0) / 2 = 1.0
    // With 1.2x tag bonus: (1.0 + 1.2 * 1.0) / 2 = 1.1 -> capped at 1.0
    expect(scoreMC).toBeCloseTo(1.0); // Bounded to [0, 1]
    expect(scoreAnalytic).toBeCloseTo(1.0);
  });

  it('computes no tag-match bonus for mismatched tags', () => {
    const myDists: Distribution[] = [
      { type: 'root', mu: [1, 0, 0], sigma: 0 },
      { type: 'fused', mu: [0, 1, 0], sigma: 0, tag: 'with_mood', object: 'happy', weight: 1.0 }
    ];
    const peerDists: Distribution[] = [
      { type: 'root', mu: [1, 0, 0], sigma: 0 },
      { type: 'fused', mu: [0, 1, 0], sigma: 0, tag: 'under_domain', object: 'psychology', weight: 1.0 }
    ];

    const scoreMC = relationalMatch(myDists, peerDists, 'high', 'monte_carlo');
    const scoreAnalytic = relationalMatch(myDists, peerDists, 'high', 'analytic');
    // Root = 1.0
    // Fused = 1.0 similarity * 1.0 bonus (no tag match) = 1.0
    // Total = 1.0
    expect(scoreMC).toBeCloseTo(1.0);
    expect(scoreAnalytic).toBeCloseTo(1.0);
  });

  it('computes spatiotemporal bonus', () => {
    const myDists: Distribution[] = [
      { type: 'root', mu: [1, 0, 0], sigma: 0 },
      { type: 'fused', mu: [1, 0, 0], sigma: 0, tag: 'in_location', object: 'lat:35.6895, long:139.6917, radius:50km', weight: 1.0 }
    ];
    const peerDists: Distribution[] = [
      { type: 'root', mu: [1, 0, 0], sigma: 0 },
      { type: 'fused', mu: [1, 0, 0], sigma: 0, tag: 'in_location', object: 'lat:35.6895, long:139.6917, radius:50km', weight: 1.0 }
    ];

    const scoreMC = relationalMatch(myDists, peerDists, 'high', 'monte_carlo');
    const scoreAnalytic = relationalMatch(myDists, peerDists, 'high', 'analytic');
    // Root = 1.0
    // Fused = 1.0 similarity * 1.2 tag bonus + 1.0 overlap * 0.5 boost = 1.7
    // Total = (1.0 + 1.7) / 2 = 1.35 -> capped at 1.0
    expect(scoreMC).toBeCloseTo(1.0);
    expect(scoreAnalytic).toBeCloseTo(1.0);
  });

  it('parses locations correctly', () => {
    const loc = parseLocation('lat:35.6895, long:139.6917, radius:50km');
    expect(loc).toEqual({ lat: 35.6895, long: 139.6917, radius: 50 });
  });

  it('parses time windows correctly', () => {
    const time = parseTime('start:2026-01-01T00:00:00Z, end:2026-12-31T23:59:59Z');
    expect(time?.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(time?.end.toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });
});
