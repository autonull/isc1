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
import { handleIncomingChat, handleIncomingAnnounce, handleDelegateRequest, PROTOCOL_CHAT, PROTOCOL_ANNOUNCE, PROTOCOL_DELEGATE, PROTOCOL_DELEGATION_HEALTH, sendDelegationHealth } from '@isc/protocol';
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

async function main() {
  console.log('ISC Node Supernode Starting...');
  console.log('Initializing core protocols...');

  let requestsServed24h = 0;
  let successfulRequests = 0;
  let totalLatencyMs = 0;

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
        if (msg.model && msg.model !== MODEL_ID) {
          console.warn(`Dropped announcement due to model mismatch. Expected ${MODEL_ID}, got ${msg.model}`);
          return;
        }
        console.log('Supernode observed announce msg:', msg);
      });
    });

    node.addEventListener('peer:connect', (evt) => {
      console.log('Peer connected:', evt.detail.toString());
    });

    node.handle(PROTOCOL_DELEGATE, async (data: any) => {
      console.log('Received PROTOCOL_DELEGATE request from', data.connection.remotePeer.toString());
      // Re-initialize Keypair from the privateKey (naive cast for simulation, real implementation requires proper subtle.CryptoKey setup for libp2p)
      const fakeKeypair = { publicKey: null as any, privateKey: null as any };

      const capabilities = {
        maxConcurrentRequests: 10,
        modelAdapter: nodeModel,
        supernodeKeypair: fakeKeypair
      };

      const startTime = Date.now();
      requestsServed24h++;
      try {
        await handleDelegateRequest(data.stream, capabilities);
        successfulRequests++;
        console.log('Successfully handled delegate request');
      } catch (e) {
        console.error('Failed to handle delegate request', e);
      } finally {
        totalLatencyMs += (Date.now() - startTime);
      }
    });

    // Broadcast health metrics periodically
    setInterval(async () => {
      const connections = node.getConnections();
      if (connections.length === 0) return;

      const successRate = requestsServed24h > 0 ? successfulRequests / requestsServed24h : 1.0;
      const avgLatencyMs = requestsServed24h > 0 ? totalLatencyMs / requestsServed24h : 50; // default 50ms

      const healthPayload = {
        type: 'delegation_health' as const,
        peerID: node.peerId.toString(),
        successRate,
        avgLatencyMs,
        requestsServed24h,
        timestamp: Date.now(),
        signature: 'dummy-signature-for-now' // In phase 2, properly sign it
      };

      console.log(`Broadcasting health metrics: ${successRate * 100}% success, ${avgLatencyMs}ms avg latency`);

      for (const conn of connections) {
        try {
          const stream = await node.dialProtocol(conn.remotePeer, PROTOCOL_DELEGATION_HEALTH);
          await sendDelegationHealth(stream, healthPayload);
        } catch (e) {
          // Peer doesn't support protocol or dial failed, ignore
        }
      }
    }, 30000); // 30 seconds for easier testing, normally 5 mins

    node.addEventListener('peer:disconnect', (evt) => {
      console.log('Peer disconnected:', evt.detail.toString());
    });

    console.log('Setup complete. Ready to route traffic, serve DHT, and act as Supernode.');
  } catch (error) {
    console.error('Failed to initialize Node supernode:', error);
    process.exit(1);
  }
}

main();
