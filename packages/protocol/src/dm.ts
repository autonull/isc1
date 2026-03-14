import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { DirectMessage } from '@isc/core';

/**
 * Handles incoming Direct Message streams.
 */
export async function handleIncomingDM(stream: any, onMessage: (msg: DirectMessage) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const msgObj = JSON.parse(str);
            // Convert arrays back to Uint8Arrays
            const msg: DirectMessage = {
              ...msgObj,
              signature: new Uint8Array(Object.values(msgObj.signature)),
              encrypted: new Uint8Array(Object.values(msgObj.encrypted))
            };
            onMessage(msg);
          } catch (e) {
            console.warn('Failed to parse incoming DM', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling DM stream', err);
  }
}

/**
 * Sends a Direct Message over an established stream.
 */
export async function sendDMMessage(stream: any, message: DirectMessage) {
  try {
    const serialized = JSON.stringify(message);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending DM message', err);
    throw err;
  }
}
