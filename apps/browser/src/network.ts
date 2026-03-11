import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { noise } from '@libp2p/noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { Keypair } from '@isc/core';

export async function initNode(_keypair: Keypair) {
  // We need to convert the subtle CryptoKey into a libp2p expected format
  // For Phase 1, we will just let libp2p generate its own peerId for now
  // until we wire up the custom ed25519 Web Crypto API keys properly to libp2p.

  const node = await createLibp2p({
    addresses: {
      listen: [
        '/webrtc' // Listen for WebRTC connections
      ]
    },
    transports: [
      webSockets(), // Needed to connect to bootstrap relays
      webRTC()      // Needed for direct browser-to-browser chat
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux(), mplex()],
    connectionGater: {
      denyDialMultiaddr: async () => false, // allow local/private for dev
    }
  });

  await node.start();
  console.log('libp2p node started with peerId:', node.peerId.toString());

  // Listen for connections
  node.addEventListener('peer:connect', (evt) => {
    console.log('Connected to peer:', evt.detail.toString());
  });

  return node;
}
