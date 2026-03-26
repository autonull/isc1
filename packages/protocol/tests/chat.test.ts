import { describe, it, expect, vi } from 'vitest';
import { handleIncomingChat, sendChatMessage } from '../src/chat';
import { ChatMessage } from '../src/messages';
import { fromString } from 'uint8arrays';

describe('Chat Protocol', () => {
  it('correctly parses an incoming chat stream', async () => {
    const msg: ChatMessage = { channelID: 'test_ch', msg: 'hello' };

    // Create a mock stream that yields our serialized message
    const mockStream = {
      source: (async function* () {
        yield fromString(JSON.stringify(msg));
      })()
    };

    let receivedMsg: ChatMessage | null = null;
    await handleIncomingChat(mockStream, (parsed) => {
      receivedMsg = parsed;
    });

    expect(receivedMsg).toEqual(msg);
  });

  it('correctly serializes an outgoing chat message', async () => {
    const msg: ChatMessage = { channelID: 'test_ch', msg: 'world' };
    let outgoingChunk: Uint8Array | null = null;

    // Create a mock stream with a sink that captures the data
    const mockStream = {
      sink: async (source: AsyncIterable<Uint8Array>) => {
        for await (const chunk of source) {
          outgoingChunk = chunk;
        }
      }
    };

    await sendChatMessage(mockStream, msg);

    expect(outgoingChunk).not.toBeNull();
    const decoder = new TextDecoder();
    const str = decoder.decode(outgoingChunk!);
    expect(JSON.parse(str)).toEqual(msg);
  });
});
