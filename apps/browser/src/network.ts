import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { noise } from '@libp2p/noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { kadDHT } from '@libp2p/kad-dht';
import { ping } from '@libp2p/ping';
import { identify } from '@libp2p/identify';
import { bootstrap } from '@libp2p/bootstrap';
import { Keypair } from '@isc/core';
import { handleIncomingAnnounce, PROTOCOL_CHAT, PROTOCOL_ANNOUNCE, PROTOCOL_MODERATION, handleIncomingModeration } from '@isc/protocol';

export async function initNode(_keypair: Keypair, onChat?: (msg: any) => void, onAnnounce?: (msg: any) => void, onModeration?: (msg: any) => void) {
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
      webRTC(),      // Needed for direct browser-to-browser chat
      circuitRelayTransport({})
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux(), mplex()],
    peerDiscovery: [
      bootstrap({
        list: [
          '/ip4/127.0.0.1/tcp/9090/ws/p2p/12D3KooWKQDPN7rmocU385fhK23ukUNHqMHuH9Y1SSSFqHK3qsMk' // Bootstrap via the locally running Node.js supernode
        ]
      })
    ],
    services: {
      ping: ping(),
      identify: identify(),
      dht: kadDHT({
        protocol: '/isc/kad/1.0.0',
        clientMode: true // Browsers typically act as clients
      })
    },
    connectionGater: {
      denyDialMultiaddr: async () => false, // allow local/private for dev
    }
  });

  await node.start();
  console.log('libp2p node started with peerId:', node.peerId.toString());

  // Register Protocol Handlers
  node.handle(PROTOCOL_CHAT, (data: any) => {
    if (onChat) {
      // Pass the entire data object so the handler can see connection metadata (e.g., peer ID) and the stream
      onChat(data);
    }
  });

  node.handle(PROTOCOL_ANNOUNCE, (data: any) => {
    if (onAnnounce) {
      handleIncomingAnnounce(data.stream, onAnnounce);
    }
  });

  node.handle(PROTOCOL_MODERATION, (data: any) => {
    if (onModeration) {
      handleIncomingModeration(data.stream, onModeration);
    }
  });

  // Listen for connections
  node.addEventListener('peer:connect', (evt) => {
    console.log('Connected to peer:', evt.detail.toString());
  });

  return node;
}
