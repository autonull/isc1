import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { DelegateRequest, DelegateResponse } from './messages.js';
import { EmbeddingModelAdapter } from '@isc/adapters';
import { sign, Keypair, encodePayload } from '@isc/core';

export interface Capabilities {
  maxConcurrentRequests: number;
  modelAdapter: EmbeddingModelAdapter;
  supernodeKeypair: Keypair;
}

export async function handleDelegateRequest(stream: any, capabilities: Capabilities) {
  try {
    await pipe(
      stream.source,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          try {
            const str = toString(chunk);
            const req: DelegateRequest = JSON.parse(str);

            // Validate timestamp to prevent replay (e.g. within 60s)
            const now = Date.now();
            if (now - req.timestamp > 60000) {
              throw new Error('Request timestamp too old');
            }

            // Perform embedding via adapter
            const vec = await capabilities.modelAdapter.embed(req.text);

            // Note: Since browsers don't always have a straightforward sync crypto hash,
            // and we just need a reproducible string hash for model version negotiation
            const modelId = (capabilities.modelAdapter as any).id || 'unknown_model';
            let hashVal = 0;
            for (let i = 0; i < modelId.length; i++) {
               hashVal = Math.imul(31, hashVal) + modelId.charCodeAt(i) | 0;
            }
            const modelHash = hashVal.toString(16);

            // Construct response
            const resData = {
              requestID: req.requestID,
              embedding: vec,
              modelHash: modelHash
            };

            const payload = encodePayload(resData);
            const sig = await sign(payload, capabilities.supernodeKeypair);

            const res: DelegateResponse = {
              ...resData,
              signature: toString(sig, 'base64')
            };

            // Send response back
            await pipe([fromString(JSON.stringify(res))], stream.sink);

          } catch (e) {
            console.warn('Failed to handle delegate request', e);
          }
        }
      }
    );
  } catch (err) {
    console.error('Error handling delegate stream', err);
  }
}

export async function requestDelegation(stream: any, request: DelegateRequest): Promise<DelegateResponse> {
  let response: DelegateResponse | null = null;

  try {
    const serialized = JSON.stringify(request);

    await pipe(
      [fromString(serialized)],
      stream,
      async function (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          const str = toString(chunk);
          response = JSON.parse(str);
        }
      }
    );

    if (!response) {
      throw new Error('No response received from supernode');
    }

    return response;
  } catch (err) {
    console.error('Error sending delegate request', err);
    throw err;
  }
}
