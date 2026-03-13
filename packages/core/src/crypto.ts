import { publicKeyFromProtobuf } from '@libp2p/crypto/keys';
import { peerIdFromString } from '@libp2p/peer-id';

export interface Keypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export type Signature = Uint8Array;
export type PublicKey = CryptoKey;

/**
 * Extracts a Web Crypto PublicKey from a libp2p PeerID string.
 */
export async function getPublicKeyFromPeerId(peerIdStr: string): Promise<PublicKey> {
  const peerIdObj = peerIdFromString(peerIdStr);
  if (!peerIdObj.publicKey) {
    throw new Error('PeerID does not contain a public key');
  }

  // peerIdObj.publicKey is already a Uint8Array representing the protobuf wrapper.
  // The old @libp2p/crypto version took a Uint8Array, the current returns an object that has `.raw`.
  const libp2pKey = publicKeyFromProtobuf(peerIdObj.publicKey as any);
  const cryptoAPI = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : (await import('crypto')).webcrypto;

  // Note: Since libp2p uses its own key wrappers, we need to convert it to a Web Crypto API key
  // The marshal returns protobuf encoded bytes. We can use WebCrypto importKey if it's raw.
  const rawKeyBytes = libp2pKey.raw || (libp2pKey as any).bytes;

  // If the above doesn't work, we could also use `cryptoAPI.subtle.importKey` with the raw Uint8Array
  if (!rawKeyBytes) {
      throw new Error('Failed to extract raw key bytes from libp2p public key');
  }

  return await (cryptoAPI.subtle as any).importKey(
    'raw',
    rawKeyBytes,
    { name: 'Ed25519' },
    true,
    ['verify']
  );
}

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

// Bounded queue to track processed request IDs and prevent memory leaks
const MAX_REQUEST_IDS = 10000;
const processedRequestIDs = new Set<string>();
const requestIDQueue: string[] = [];

/**
 * Validates the signature of a signed payload object.
 * Extracts the payload (without the signature), base64-decodes the signature, and verifies.
 * Also performs basic replay attack prevention via requestID tracking.
 */
export async function verifySignature(payloadObj: any, publicKey: PublicKey): Promise<boolean> {
  if (!payloadObj || !payloadObj.signature) {
    return false;
  }

  // Prevent replay attacks using requestID
  if (payloadObj.requestID) {
    if (processedRequestIDs.has(payloadObj.requestID)) {
      return false; // Replay detected
    }
  }

  try {
    // Decode base64 signature
    const signatureStr = payloadObj.signature;
    let signatureBytes: Uint8Array;

    if (typeof Buffer !== 'undefined') {
      // Node.js
      signatureBytes = new Uint8Array(Buffer.from(signatureStr, 'base64'));
    } else if (typeof globalThis.atob === 'function') {
      // Browser / Web Workers
      const binaryString = globalThis.atob(signatureStr);
      signatureBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        signatureBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      throw new Error("No base64 decoding available in this environment");
    }

    // Extract the unsigned payload object (copy without signature)
    const { signature, ...unsignedObj } = payloadObj;

    // Ensure canonical encoding for verification
    const encodedUnsigned = encodePayload(unsignedObj);

    const isValid = await verify(encodedUnsigned, signatureBytes, publicKey);

    // Only cache requestID on successful verification to prevent cache poisoning DoS
    if (isValid && payloadObj.requestID) {
      processedRequestIDs.add(payloadObj.requestID);
      requestIDQueue.push(payloadObj.requestID);
      if (requestIDQueue.length > MAX_REQUEST_IDS) {
        const oldest = requestIDQueue.shift();
        if (oldest) processedRequestIDs.delete(oldest);
      }
    }

    return isValid;
  } catch (error) {
    console.warn("Signature verification error:", error);
    return false;
  }
}
