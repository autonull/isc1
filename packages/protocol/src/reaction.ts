import { pipe } from 'it-pipe';
import { Uint8ArrayList } from 'uint8arraylist';
import { SignedReaction } from '@isc/core';

export async function sendReactionMessage(stream: any, reaction: SignedReaction) {
  try {
    await pipe(
      [new TextEncoder().encode(JSON.stringify(reaction))],
      stream
    );
  } catch (err) {
    console.error('Failed to send reaction message:', err);
    throw err;
  }
}

export async function handleIncomingReaction(stream: any, onReaction: (reaction: SignedReaction) => void) {
  try {
    await pipe(
      stream,
      async function (source: AsyncIterable<Uint8ArrayList>) {
        for await (const msg of source) {
          const str = new TextDecoder().decode(msg.subarray());
          const reaction: SignedReaction = JSON.parse(str);
          onReaction(reaction);
        }
      }
    );
  } catch (err) {
    console.error('Failed to handle incoming reaction:', err);
  }
}
