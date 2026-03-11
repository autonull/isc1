#!/usr/bin/env node
import { Command } from 'commander';
import { cosineSimilarity, lshHash } from '@isc/core';
import { nodeModel } from '@isc/adapters';
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@libp2p/noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { kadDHT } from '@libp2p/kad-dht';
import { ping } from '@libp2p/ping';
import { identify } from '@libp2p/identify';
import { bootstrap } from '@libp2p/bootstrap';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';

const program = new Command();

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// Helper to init an ephemeral libp2p node for CLI operations
async function initCliNode() {
  const node = await createLibp2p({
    transports: [webSockets()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux(), mplex()],
    peerDiscovery: [
      bootstrap({
        list: [
          '/ip4/127.0.0.1/tcp/9090/ws/p2p/12D3KooWKQDPN7rmocU385fhK23ukUNHqMHuH9Y1SSSFqHK3qsMk'
        ]
      })
    ],
    services: {
      ping: ping(),
      identify: identify(),
      dht: kadDHT({
        protocol: '/isc/kad/1.0.0',
        clientMode: true
      })
    }
  });

  await node.start();
  // Wait a bit to ensure bootstrap connects
  await new Promise(resolve => setTimeout(resolve, 2000));
  return node;
}

program
  .name('isc')
  .description('ISC Monorepo CLI for embedding, matching, and testing')
  .version('0.1.0');

program
  .command('embed')
  .description('Embed text into a vector space')
  .argument('<text>', 'Text to embed')
  .action(async (text: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);
    console.log(`Embedding: "${text}"`);

    const normalized = await nodeModel.embed(text);
    const norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));

    console.log(`Vector length: ${normalized.length}, Norm: ${norm.toFixed(4)}`);
    console.log(`[${normalized.slice(0, 5).map(n => n.toFixed(4)).join(', ')} ... ]`);
  });

program
  .command('match')
  .description('Compute cosine similarity between two texts')
  .argument('<text1>', 'First text')
  .argument('<text2>', 'Second text')
  .action(async (text1: string, text2: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);

    const vec1 = await nodeModel.embed(text1);
    const vec2 = await nodeModel.embed(text2);

    const sim = cosineSimilarity(vec1, vec2);
    console.log(`Text 1: "${text1}"`);
    console.log(`Text 2: "${text2}"`);
    console.log(`Cosine Similarity: ${sim.toFixed(4)}`);
  });

program
  .command('lsh')
  .description('Generate LSH hashes for text')
  .argument('<text>', 'Text to hash')
  .action(async (text: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);

    const vec = await nodeModel.embed(text);
    const hashes = lshHash(vec, 'test_seed_123', 5);
    console.log(`Text: "${text}"`);
    console.log('LSH Hashes:', hashes);
  });

const peerCmd = program.command('peer').description('Peer operations');

peerCmd
  .command('list')
  .description('List connected peers')
  .action(async () => {
    const node = await initCliNode();
    const connections = node.getConnections();
    console.log(`Connected to ${connections.length} peers:`);
    for (const conn of connections) {
      console.log(`- ${conn.remotePeer.toString()} (${conn.remoteAddr.toString()})`);
    }
    await node.stop();
  });

peerCmd
  .command('info')
  .description('Get detailed peer info')
  .argument('<peerId>', 'Peer ID to look up')
  .action(async (peerIdStr: string) => {
    const node = await initCliNode();
    console.log(`Looking up info for ${peerIdStr}...`);
    try {
      // Basic check, in a real implementation we would dial or use routing
      const connections = node.getConnections().filter(c => c.remotePeer.toString() === peerIdStr);
      if (connections.length > 0) {
        console.log(`Peer is connected:`);
        connections.forEach(c => console.log(`  Address: ${c.remoteAddr.toString()}`));
      } else {
        console.log(`Peer not currently connected to this CLI node.`);
      }
    } catch (e) {
      console.error('Failed to get peer info', e);
    }
    await node.stop();
  });

const dhtCmd = program.command('dht').description('DHT operations');

dhtCmd
  .command('put')
  .description('Signed DHT put (basic string implementation for now)')
  .argument('<key>', 'Key string')
  .argument('<value>', 'Value string')
  .action(async (keyStr: string, valueStr: string) => {
    const node = await initCliNode();
    console.log(`Putting to DHT: ${keyStr} -> ${valueStr}`);
    try {
      const keyBytes = uint8ArrayFromString(keyStr);
      const valueBytes = uint8ArrayFromString(valueStr);
      // Wait for DHT
      for await (const event of node.services.dht.put(keyBytes, valueBytes)) {
        console.log('DHT put event:', event.name);
      }
      console.log('Success.');
    } catch (e) {
      console.error('DHT put failed', e);
    }
    await node.stop();
  });

dhtCmd
  .command('get')
  .description('DHT get')
  .argument('<key>', 'Key string')
  .action(async (keyStr: string) => {
    const node = await initCliNode();
    console.log(`Getting from DHT: ${keyStr}`);
    try {
      const keyBytes = uint8ArrayFromString(keyStr);
      let found = false;
      for await (const event of node.services.dht.get(keyBytes)) {
        if (event.name === 'VALUE') {
          console.log(`Value: ${uint8ArrayToString(event.value)}`);
          found = true;
        }
      }
      if (!found) console.log('Key not found.');
    } catch (e) {
      console.error('DHT get failed', e);
    }
    await node.stop();
  });

const channelCmd = program.command('channel').description('Channel operations');

channelCmd
  .command('list')
  .description('List local channels (stub for CLI storage)')
  .action(async () => {
    console.log('Local channels:');
    console.log('(CLI local storage not fully implemented in Phase 1 stub)');
  });

program.parse();
