import { describe, it, expect } from 'vitest';
import { computeBioEmbedding, Profile } from '../src/social';

describe('computeBioEmbedding', () => {
  it('returns empty array if profile has no channels', () => {
    const profile: Profile = {
      peerID: 'userA',
      channels: [],
      followerCount: 0,
      followingCount: 0,
      joinedAt: Date.now()
    };
    expect(computeBioEmbedding(profile)).toEqual([]);
  });

  it('computes mean of channel embeddings', () => {
    const profile: Profile = {
      peerID: 'userA',
      channels: [
        {
          channelID: 'ch1',
          name: 'Channel 1',
          description: '',
          embedding: [1, 2, 3],
          postCount: 0,
          latestEmbedding: [1, 2, 3]
        },
        {
          channelID: 'ch2',
          name: 'Channel 2',
          description: '',
          embedding: [3, 4, 5],
          postCount: 0,
          latestEmbedding: [3, 4, 5]
        }
      ],
      followerCount: 0,
      followingCount: 0,
      joinedAt: Date.now()
    };
    expect(computeBioEmbedding(profile)).toEqual([2, 3, 4]);
  });
});