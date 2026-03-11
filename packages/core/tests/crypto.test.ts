import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeypair, sign, verify, encodePayload, Keypair } from '../src/crypto';

describe('Cryptography', () => {
  let keypairA: Keypair;
  let keypairB: Keypair;
  const payloadStr = 'hello world';
  const payloadObj = { message: 'hello', count: 42 };

  beforeAll(async () => {
    keypairA = await generateKeypair();
    keypairB = await generateKeypair();
  });

  it('generates a valid keypair', () => {
    expect(keypairA).toBeDefined();
    expect(keypairA.publicKey.type).toBe('public');
    expect(keypairA.privateKey.type).toBe('private');
    expect(keypairA.publicKey.algorithm.name).toBe('Ed25519');
  });

  it('signs and verifies a valid payload', async () => {
    const payload = new TextEncoder().encode(payloadStr);
    const signature = await sign(payload, keypairA);

    expect(signature).toBeDefined();

    const isValid = await verify(payload, signature, keypairA.publicKey);
    expect(isValid).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const payload = new TextEncoder().encode(payloadStr);
    const signature = await sign(payload, keypairA);

    const tamperedPayload = new TextEncoder().encode('hello world!');
    const isValid = await verify(tamperedPayload, signature, keypairA.publicKey);

    expect(isValid).toBe(false);
  });

  it('rejects a signature from the wrong key', async () => {
    const payload = new TextEncoder().encode(payloadStr);
    const signature = await sign(payload, keypairA);

    const isValid = await verify(payload, signature, keypairB.publicKey);
    expect(isValid).toBe(false);
  });

  it('can encode and sign JSON payloads', async () => {
    const encoded = encodePayload(payloadObj);
    const signature = await sign(encoded, keypairA);
    const isValid = await verify(encoded, signature, keypairA.publicKey);

    expect(isValid).toBe(true);
  });

  it('rejects a modified JSON payload', async () => {
    const encoded = encodePayload(payloadObj);
    const signature = await sign(encoded, keypairA);

    const tamperedEncoded = encodePayload({ message: 'hello', count: 43 });
    const isValid = await verify(tamperedEncoded, signature, keypairA.publicKey);

    expect(isValid).toBe(false);
  });
});
