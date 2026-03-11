import { describe, it, expect, vi } from 'vitest';
import { handleDelegateRequest, requestDelegation, Capabilities } from '../src/delegate';
import { DelegateRequest, DelegateResponse } from '../src/messages';
import { fromString, toString } from 'uint8arrays';

const mockKeypair = {
  publicKey: new Uint8Array(32).fill(1),
  privateKey: new Uint8Array(64).fill(2)
};

// Mock crypto module directly using standard jest/vitest module mocking.
vi.mock('@isc/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@isc/core')>();
  return {
    ...actual,
    sign: vi.fn(async () => new Uint8Array([99, 100, 101])),
    verify: vi.fn(async () => true),
    encodePayload: vi.fn((data: any) => new Uint8Array([1, 2, 3]))
  };
});

describe('Delegate Protocol', () => {
  it('correctly handles an incoming delegate request', async () => {
    const req: DelegateRequest = { requestID: 'req1', timestamp: Date.now(), text: 'test' };

    let sinkData: Uint8Array | null = null;
    const mockStream = {
      source: (async function* () {
        yield fromString(JSON.stringify(req));
      })(),
      sink: async (source: AsyncIterable<Uint8Array>) => {
        for await (const chunk of source) {
          sinkData = chunk;
        }
      }
    };

    const mockCapabilities: Capabilities = {
      maxConcurrentRequests: 1,
      modelAdapter: {
        load: async () => {},
        embed: async (text: string) => [0.1, 0.2, 0.3],
        id: 'mock',
        isReady: true
      },
      supernodeKeypair: mockKeypair as any
    };

    await handleDelegateRequest(mockStream, mockCapabilities);

    expect(sinkData).not.toBeNull();
    const str = toString(sinkData!);
    const res: DelegateResponse = JSON.parse(str);

    expect(res.requestID).toBe('req1');
    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(res.modelHash).toBe('canonical_hash_placeholder');
    expect(res.signature).toBeDefined();
  });

  it('correctly formats and sends a delegate request', async () => {
    const req: DelegateRequest = { requestID: 'req2', timestamp: Date.now(), text: 'hello' };
    const expectedRes: DelegateResponse = {
      requestID: 'req2',
      embedding: [0.5, 0.5],
      modelHash: 'hash',
      signature: 'sig'
    };

    const mockStream = async function* (source: AsyncIterable<Uint8Array>) {
      // Capture the request
      let reqStr = '';
      for await (const chunk of source) {
        reqStr += toString(chunk);
      }
      expect(JSON.parse(reqStr)).toMatchObject({ requestID: 'req2', text: 'hello' });

      // Yield the response
      yield fromString(JSON.stringify(expectedRes));
    };

    const res = await requestDelegation(mockStream, req);
    expect(res).toEqual(expectedRes);
  });
});
