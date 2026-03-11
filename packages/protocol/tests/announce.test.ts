import { describe, it, expect } from 'vitest';
import { handleIncomingAnnounce, sendAnnounceMessage } from '../src/announce';
import { SignedAnnouncement } from '../src/messages';
import { fromString } from 'uint8arrays';

describe('Announce Protocol', () => {
  it('correctly parses an incoming announcement', async () => {
    const msg: SignedAnnouncement = {
      peerID: '12D3KooW...',
      channelID: 'ch_ai_ethics',
      model: 'Xenova/all-MiniLM-L6-v2',
      vec: [0.12, -0.07],
      ttl: 300,
      signature: 'test_signature'
    };

    const mockStream = {
      source: (async function* () {
        yield fromString(JSON.stringify(msg));
      })()
    };

    let receivedMsg: SignedAnnouncement | null = null;
    await handleIncomingAnnounce(mockStream, (parsed) => {
      receivedMsg = parsed;
    });

    expect(receivedMsg).toEqual(msg);
  });

  it('correctly serializes an outgoing announcement', async () => {
    const msg: SignedAnnouncement = {
      peerID: '12D3KooW...',
      channelID: 'ch_ai_ethics',
      model: 'Xenova/all-MiniLM-L6-v2',
      vec: [0.12, -0.07],
      ttl: 300,
      signature: 'test_signature'
    };

    let outgoingChunk: Uint8Array | null = null;

    const mockStream = {
      sink: async (source: AsyncIterable<Uint8Array>) => {
        for await (const chunk of source) {
          outgoingChunk = chunk;
        }
      }
    };

    await sendAnnounceMessage(mockStream, msg);

    expect(outgoingChunk).not.toBeNull();
    const decoder = new TextDecoder();
    const str = decoder.decode(outgoingChunk!);
    expect(JSON.parse(str)).toEqual(msg);
  });
});
