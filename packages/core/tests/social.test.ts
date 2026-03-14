import { describe, it, expect } from 'vitest';
import { computeBioEmbedding, Profile, createCommunityChannel, createCommunityJoinEvent } from '../src/social';
import { generateKeypair } from '../src/crypto';

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

describe('Communities', () => {
  it('creates a community channel with valid signature', async () => {
    const keypair = await generateKeypair();
    const comm = await createCommunityChannel(keypair, 'Test Comm', 'Desc', [0.1, 0.2], 'peerA');

    expect(comm.name).toBe('Test Comm');
    expect(comm.description).toBe('Desc');
    expect(comm.members).toEqual(['peerA']);
    expect(comm.coEditors).toEqual(['peerA']);
    expect(comm.embedding).toEqual([0.1, 0.2]);
    expect(comm.signature).toBeInstanceOf(Uint8Array);
    expect(comm.channelID.startsWith('comm_')).toBe(true);
  });

  it('creates a community join event with valid signature', async () => {
    const keypair = await generateKeypair();
    const event = await createCommunityJoinEvent(keypair, 'comm_123', 'peerB');

    expect(event.type).toBe('community_join');
    expect(event.channelID).toBe('comm_123');
    expect(event.peerID).toBe('peerB');
    expect(event.signature).toBeInstanceOf(Uint8Array);
  });
});