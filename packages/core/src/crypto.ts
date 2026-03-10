export interface Keypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export type Signature = Uint8Array;
export type PublicKey = CryptoKey;

/**
 * Generates an Ed25519 keypair via the Web Crypto API.
 */
export async function generateKeypair(): Promise<Keypair> {
  // In Node.js 19+, crypto.webcrypto is available globally as 'crypto'
  const cryptoAPI = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : (await import('crypto')).webcrypto;

  return await cryptoAPI.subtle.generateKey(
    'Ed25519',
    true, // extractable
    ['sign', 'verify']
  ) as Keypair;
}

/**
 * Signs a Uint8Array payload using the provided keypair.
 */
export async function sign(payload: Uint8Array, keypair: Keypair): Promise<Signature> {
  const cryptoAPI = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : (await import('crypto')).webcrypto;

  const payloadBuffer = new ArrayBuffer(payload.length);
  new Uint8Array(payloadBuffer).set(payload);

  const signatureBuffer = await cryptoAPI.subtle.sign(
    'Ed25519',
    keypair.privateKey,
    payloadBuffer
  );

  return new Uint8Array(signatureBuffer);
}

/**
 * Verifies a signature against a payload using the public key.
 */
export async function verify(payload: Uint8Array, signature: Signature, publicKey: PublicKey): Promise<boolean> {
  const cryptoAPI = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : (await import('crypto')).webcrypto;

  const signatureBuffer = new ArrayBuffer(signature.length);
  new Uint8Array(signatureBuffer).set(signature);

  const payloadBuffer = new ArrayBuffer(payload.length);
  new Uint8Array(payloadBuffer).set(payload);

  return await cryptoAPI.subtle.verify(
    'Ed25519',
    publicKey,
    signatureBuffer,
    payloadBuffer
  );
}

/**
 * Helper: serializes an object to a canonical JSON string and encodes it as a Uint8Array for signing.
 */
export function encodePayload(obj: any): Uint8Array {
  // Simple stable stringify. For robust production use, consider a canonical JSON library
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return new TextEncoder().encode(str);
}
