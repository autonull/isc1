import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeypair, sign, verify, encodePayload, Keypair, verifySignature } from '../src/crypto';

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

describe('verifySignature', () => {
  let keypairA: Keypair;
  let keypairB: Keypair;

  beforeAll(async () => {
    keypairA = await generateKeypair();
    keypairB = await generateKeypair();
  });

  const getSignatureBase64 = async (obj: any, keypair: Keypair): Promise<string> => {
    const encoded = encodePayload(obj);
    const signatureBytes = await sign(encoded, keypair);
    const binaryString = Array.from(signatureBytes).map((b) => String.fromCharCode(b)).join('');
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(binaryString, 'binary').toString('base64');
    } else if (typeof globalThis.btoa === 'function') {
      return globalThis.btoa(binaryString);
    } else {
      throw new Error('Base64 encoding not available');
    }
  };

  it('returns true for a valid signature', async () => {
    const obj = { data: 'test', type: 'announce' };
    const signatureBase64 = await getSignatureBase64(obj, keypairA);
    const signedObj = { ...obj, signature: signatureBase64 };

    const isValid = await verifySignature(signedObj, keypairA.publicKey);
    expect(isValid).toBe(true);
  });

  it('returns false for tampered payload', async () => {
    const obj = { data: 'test', type: 'announce' };
    const signatureBase64 = await getSignatureBase64(obj, keypairA);
    const signedObj = { ...obj, data: 'tampered', signature: signatureBase64 };

    const isValid = await verifySignature(signedObj, keypairA.publicKey);
    expect(isValid).toBe(false);
  });

  it('returns false for missing signature field', async () => {
    const obj = { data: 'test', type: 'announce' };
    const isValid = await verifySignature(obj, keypairA.publicKey);
    expect(isValid).toBe(false);
  });

  it('returns false for wrong key', async () => {
    const obj = { data: 'test', type: 'announce' };
    const signatureBase64 = await getSignatureBase64(obj, keypairA);
    const signedObj = { ...obj, signature: signatureBase64 };

    // Signed by A, verifying with B
    const isValid = await verifySignature(signedObj, keypairB.publicKey);
    expect(isValid).toBe(false);
  });

  it('returns false for replay detection (same requestID)', async () => {
    const obj = { data: 'test', type: 'announce', requestID: 'uuid-1234' };
    const signatureBase64 = await getSignatureBase64(obj, keypairA);
    const signedObj = { ...obj, signature: signatureBase64 };

    // First time should be valid
    const isValid1 = await verifySignature(signedObj, keypairA.publicKey);
    expect(isValid1).toBe(true);

    // Second time with same requestID should be rejected as replay
    const isValid2 = await verifySignature(signedObj, keypairA.publicKey);
    expect(isValid2).toBe(false);
  });
});
