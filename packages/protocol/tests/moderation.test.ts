import { describe, it, expect } from 'vitest';
import { handleIncomingModeration, sendModerationMessage } from '../src/moderation';
import { pipe } from 'it-pipe';
import { CommunityReport } from '@isc/core';

describe('Moderation Protocol', () => {
  it('should send and receive a community report', async () => {
    const mockReport: CommunityReport = {
      reporter: 'peer-A',
      targetPostID: 'post-123',
      reason: 'off-topic',
      evidence: 'test evidence',
      signature: new Uint8Array([1, 2, 3])
    };

    let receivedReport: CommunityReport | null = null;
    const mockStream = {
      source: [],
      sink: async (source: any) => {
        for await (const chunk of source) {
          mockStream.source.push(chunk);
        }
      }
    };

    // Send the report
    await sendModerationMessage(mockStream, mockReport);

    // Provide a mocked async iterable source
    const readableStream = {
      source: (async function* () {
        for (const chunk of mockStream.source) {
          yield chunk;
        }
      })()
    };

    // Receive the report
    await handleIncomingModeration(readableStream, (report) => {
      receivedReport = report;
    });

    expect(receivedReport).not.toBeNull();
    expect(receivedReport?.reporter).toBe(mockReport.reporter);
    expect(receivedReport?.targetPostID).toBe(mockReport.targetPostID);
    expect(receivedReport?.signature).toBeInstanceOf(Uint8Array);
    expect(receivedReport?.signature).toEqual(mockReport.signature);
  });
});
