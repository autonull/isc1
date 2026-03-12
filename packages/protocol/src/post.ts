import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { SignedPost } from '@isc/core';

export const PROTOCOL_POST = '/isc/post/1.0';
export const PROTOCOL_REPLY = '/isc/reply/1.0';
export const PROTOCOL_QUOTE = '/isc/quote/1.0';

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

/**
 * Handles incoming reply streams and yields parsed SignedPost.
 */
export async function handleIncomingReply(stream: any, onReply: (msg: SignedPost) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const msg: SignedPost = JSON.parse(str);
            if (msg.signature && typeof msg.signature === 'object') {
              msg.signature = Uint8Array.from(Object.values(msg.signature));
            }
            onReply(msg);
          } catch (e) {
            console.warn('Failed to parse incoming reply message', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling reply stream', err);
  }
}

/**
 * Sends a reply message over an established stream.
 */
export async function sendReplyMessage(stream: any, reply: SignedPost) {
  try {
    const serialized = JSON.stringify(reply);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending reply message', err);
    throw err;
  }
}

/**
 * Handles incoming quote streams and yields parsed SignedPost.
 */
export async function handleIncomingQuote(stream: any, onQuote: (msg: SignedPost) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const msg: SignedPost = JSON.parse(str);
            if (msg.signature && typeof msg.signature === 'object') {
              msg.signature = Uint8Array.from(Object.values(msg.signature));
            }
            onQuote(msg);
          } catch (e) {
            console.warn('Failed to parse incoming quote message', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling quote stream', err);
  }
}

/**
 * Sends a quote message over an established stream.
 */
export async function sendQuoteMessage(stream: any, quote: SignedPost) {
  try {
    const serialized = JSON.stringify(quote);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending quote message', err);
    throw err;
  }
}
