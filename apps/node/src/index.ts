import { cosineSimilarity } from '@isc/core';
import { nodeModel } from '@isc/adapters';

import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@libp2p/noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { kadDHT } from '@libp2p/kad-dht';
import { ping } from '@libp2p/ping';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { handleIncomingChat, handleIncomingAnnounce, PROTOCOL_CHAT, PROTOCOL_ANNOUNCE } from '@isc/protocol';
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys';

async function main() {
  console.log('ISC Node Supernode Starting...');
  console.log('Initializing core protocols...');

  const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
  console.log(`Loading embedding model (${MODEL_ID})...`);

  try {
    await nodeModel.load(MODEL_ID);
    console.log('Model loaded successfully.');

    // Generated static keypair for testing (PeerID: 12D3KooWKQDPN7rmocU385fhK23ukUNHqMHuH9Y1SSSFqHK3qsMk)
    const STATIC_KEY_B64 = 'CAESQBlT5Glzyad7fxjvTdhHOIiQsPOCE1EOnC6NCNMpnJ5kjmT/4mFrwuCjOYSr6+A7C9/4GLWV671llATT7cwB/Js=';
    const privateKey = privateKeyFromProtobuf(Buffer.from(STATIC_KEY_B64, 'base64'));

    // Start P2P Node
    const node = await createLibp2p({
      privateKey,
      addresses: {
        // Listen on websockets for browser clients
        listen: ['/ip4/0.0.0.0/tcp/9090/ws']
      },
      transports: [
        webSockets()
      ],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux(), mplex()],
      services: {
        ping: ping(),
        identify: identify(),
        dht: kadDHT({
          protocol: '/isc/kad/1.0.0',
          clientMode: false // Act as a DHT server/router
        }),
        relay: circuitRelayServer()
      }
    });

    await node.start();
    console.log('libp2p Supernode started!');
    console.log('Listening on:');
    node.getMultiaddrs().forEach(ma => console.log(ma.toString()));

    node.handle(PROTOCOL_CHAT, (data: any) => {
      console.log('Received PROTOCOL_CHAT stream');
      handleIncomingChat(data.stream, (msg) => {
        console.log('Supernode observed chat msg:', msg);
      });
    });

    node.handle(PROTOCOL_ANNOUNCE, (data: any) => {
      console.log('Received PROTOCOL_ANNOUNCE stream');
      handleIncomingAnnounce(data.stream, (msg) => {
        console.log('Supernode observed announce msg:', msg);
      });
    });

    node.addEventListener('peer:connect', (evt) => {
      console.log('Peer connected:', evt.detail.toString());
    });

    node.addEventListener('peer:disconnect', (evt) => {
      console.log('Peer disconnected:', evt.detail.toString());
    });

    console.log('Setup complete. Ready to route traffic and serve DHT.');
  } catch (error) {
    console.error('Failed to initialize Node supernode:', error);
    process.exit(1);
  }
}

main();
