import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { SignedAnnouncement } from './messages.js';

/**
 * Handles incoming announcement streams and yields parsed announcements.
 */
export async function handleIncomingAnnounce(stream: any, onAnnounce: (announcement: SignedAnnouncement) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const req: SignedAnnouncement = JSON.parse(str);
            onAnnounce(req);
          } catch (e) {
            console.warn('Failed to parse incoming announcement', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling announce stream', err);
  }
}

/**
 * Sends an announcement over an established stream.
 */
export async function sendAnnounceMessage(stream: any, announcement: SignedAnnouncement) {
  try {
    const serialized = JSON.stringify(announcement);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending announcement', err);
    throw err;
  }
}
