import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { DelegationHealth } from './messages.js';

/**
 * Handles incoming delegation health streams and yields parsed health metrics.
 */
export async function handleDelegationHealth(stream: any, onHealth: (health: DelegationHealth) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const req: DelegationHealth = JSON.parse(str);
            if (req.type !== 'delegation_health') continue;
            onHealth(req);
          } catch (e) {
            console.warn('Failed to parse incoming delegation health', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling delegation health stream', err);
  }
}

/**
 * Sends a delegation health metric over an established stream.
 */
export async function sendDelegationHealth(stream: any, health: DelegationHealth) {
  try {
    const serialized = JSON.stringify(health);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending delegation health', err);
    throw err;
  }
}
