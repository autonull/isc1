import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { CommunityReport } from '@isc/core';
import { PROTOCOL_MODERATION } from './messages.js';

export async function handleIncomingModeration(stream: any, onReport: (msg: CommunityReport) => void) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const msg: CommunityReport = JSON.parse(str);
            if (msg.signature && typeof msg.signature === 'object') {
              msg.signature = Uint8Array.from(Object.values(msg.signature));
            }
            onReport(msg);
          } catch (e) {
            console.warn('Failed to parse incoming moderation message', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling moderation stream', err);
  }
}

export async function sendModerationMessage(stream: any, report: CommunityReport) {
  try {
    const serialized = JSON.stringify(report);
    const chunk = fromString(serialized);
    await pipe(
      [chunk],
      stream.sink
    );
  } catch (err) {
    console.error('Error sending moderation message', err);
    throw err;
  }
}
