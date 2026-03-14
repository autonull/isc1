import { describe, it, expect } from 'vitest';
import { calculateReputation, Interaction } from '../src/reputation.js';

describe('Reputation System', () => {
  const ONE_DAY = 1000 * 60 * 60 * 24;

  it('starts at 0.5 with no history', () => {
    const now = Date.now();
    const score = calculateReputation([], now, now - 10 * ONE_DAY);
    expect(score).toBeCloseTo(0.5);
  });

  it('increases with successful interactions', () => {
    const now = Date.now();
    const interactions: Interaction[] = [
      { peerID: 'A', type: 'chat', successful: true, timestamp: now },
      { peerID: 'A', type: 'post_reaction', successful: true, timestamp: now }
    ];

    const score = calculateReputation(interactions, now, now - 10 * ONE_DAY);
    expect(score).toBeCloseTo(0.7); // 0.5 + 0.1 + 0.1
  });

  it('decreases with flags', () => {
    const now = Date.now();
    const interactions: Interaction[] = [
      { peerID: 'A', type: 'flag', successful: false, timestamp: now }
    ];

    const score = calculateReputation(interactions, now, now - 10 * ONE_DAY);
    expect(score).toBeCloseTo(0.3); // 0.5 - 0.2
  });

  it('decays back towards 0 over time (30 day half-life)', () => {
    const now = Date.now();
    const past30Days = now - (30 * ONE_DAY);

    // An interaction 30 days ago
    const interactions: Interaction[] = [
      { peerID: 'A', type: 'chat', successful: true, timestamp: past30Days }
    ];

    const score = calculateReputation(interactions, now, now - 40 * ONE_DAY);

    // Base 0.5 decayed by half = 0.25
    // Delta +0.1 decayed by half = 0.05
    // Total should be ~0.30
    expect(score).toBeCloseTo(0.30);
  });

  it('clamps to bounds [0, 1]', () => {
    const now = Date.now();
    const interactions: Interaction[] = Array(10).fill({
      peerID: 'A', type: 'chat', successful: true, timestamp: now
    });

    const maxScore = calculateReputation(interactions, now, now - 10 * ONE_DAY);
    expect(maxScore).toBe(1.0);

    const badInteractions: Interaction[] = Array(10).fill({
      peerID: 'A', type: 'flag', successful: false, timestamp: now
    });

    const minScore = calculateReputation(badInteractions, now, now - 10 * ONE_DAY);
    expect(minScore).toBe(0.0);
  });

  it('limits positive reputation impact during 7-day bootstrap period', () => {
    const now = Date.now();
    const createdTwoDaysAgo = now - 2 * ONE_DAY;
    const interactions: Interaction[] = [
      { peerID: 'A', type: 'chat', successful: true, timestamp: now },
      { peerID: 'A', type: 'post_reaction', successful: true, timestamp: now }
    ];

    // Raw score should be 0.7, but because it's < 7 days old, it's clamped to 0.5
    const score = calculateReputation(interactions, now, createdTwoDaysAgo);
    expect(score).toBe(0.5);
  });
});
