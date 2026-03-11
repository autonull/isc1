import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { SignedPost } from '@isc/core';

export const PROTOCOL_POST = '/isc/post/1.0';

/**
 * Handles incoming post streams and yields parsed SignedPost.
 */
export async function handleIncomingPost(stream: any, onPost: (msg: SignedPost) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const msg: SignedPost = JSON.parse(str);
            // Convert back to Uint8Array for the signature if it was serialized over JSON
            // For robust handling we should serialize this property better or accept it as string temporarily
            if (msg.signature && typeof msg.signature === 'object') {
              msg.signature = Uint8Array.from(Object.values(msg.signature));
            }
            onPost(msg);
          } catch (e) {
            console.warn('Failed to parse incoming post message', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling post stream', err);
  }
}

/**
 * Sends a post message over an established stream.
 */
export async function sendPostMessage(stream: any, post: SignedPost) {
  try {
    const serialized = JSON.stringify(post);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending post message', err);
    throw err;
  }
}
