import { describe, it, expect } from 'vitest';
import { generateKeypair, exportPrivateKeyBytes, exportPublicKeyBytes, encryptForPeer, decryptFromPeer } from '../src/crypto';

describe('Direct Message Encryption', () => {
  it('encrypts and decrypts a message using libsodium', async () => {
    const alice = await generateKeypair();
    const bob = await generateKeypair();

    const alicePrivBytes = await exportPrivateKeyBytes(alice.privateKey);
    const alicePubBytes = await exportPublicKeyBytes(alice.publicKey);

    const bobPrivBytes = await exportPrivateKeyBytes(bob.privateKey);
    const bobPubBytes = await exportPublicKeyBytes(bob.publicKey);

    const message = new TextEncoder().encode("Hello Bob, this is a secret!");

    // Alice encrypts for Bob
    const cipherText = await encryptForPeer(message, alicePrivBytes, bobPubBytes);

    // Ensure it's not plaintext
    expect(new TextDecoder().decode(cipherText)).not.toContain("Hello Bob");

    // Bob decrypts from Alice
    const decrypted = await decryptFromPeer(cipherText, bobPrivBytes, alicePubBytes);

    expect(new TextDecoder().decode(decrypted)).toBe("Hello Bob, this is a secret!");
  });
});

import { createDirectMessage, decryptDirectMessage } from '../src/social';
import { getRawPublicKeyFromPeerId } from '../src/crypto';

describe('DirectMessage Social Layer', () => {
  it('creates, signs, encrypts and decrypts a DM', async () => {
    const alice = await generateKeypair();
    const bob = await generateKeypair();

    const alicePubBytes = await exportPublicKeyBytes(alice.publicKey);
    const bobPubBytes = await exportPublicKeyBytes(bob.publicKey);

    const dm = await createDirectMessage(
      alice,
      'peerAlice',
      'peerBob',
      bobPubBytes,
      'Secret message from Alice'
    );

    expect(dm.sender).toBe('peerAlice');
    expect(dm.recipient).toBe('peerBob');
    expect(dm.encrypted).toBeDefined();
    expect(dm.signature).toBeDefined();

    // Bob decrypts
    const decrypted = await decryptDirectMessage(
      dm,
      bob,
      alicePubBytes,
      alice.publicKey
    );

    expect(decrypted.content).toBe('Secret message from Alice');
    expect(decrypted.sender).toBe('peerAlice');
  });
});
