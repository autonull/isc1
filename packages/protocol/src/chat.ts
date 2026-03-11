import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { ChatMessage, PROTOCOL_CHAT } from './messages.js';

/**
 * Handles incoming chat streams and yields parsed messages.
 * Basic implementation for Phase 1.
 */
export async function handleIncomingChat(stream: any, onMessage: (msg: ChatMessage) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const msg: ChatMessage = JSON.parse(str);
            onMessage(msg);
          } catch (e) {
            console.warn('Failed to parse incoming chat message', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling chat stream', err);
  }
}

/**
 * Sends a chat message over an established stream.
 */
export async function sendChatMessage(stream: any, message: ChatMessage) {
  try {
    const serialized = JSON.stringify(message);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending chat message', err);
    throw err;
  }
}
