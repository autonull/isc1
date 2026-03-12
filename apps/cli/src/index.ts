#!/usr/bin/env node
import { Command } from 'commander';
import { cosineSimilarity, lshHash, Channel, computeRelationalDistributions, Distribution } from '@isc/core';
import { nodeModel, nodeStorage } from '@isc/adapters';
import { createSignedPost, generateKeypair, RateLimiter, RATE_LIMITS } from '@isc/core';
import { sendPostMessage, PROTOCOL_POST, sendChatMessage, PROTOCOL_CHAT } from '@isc/protocol';
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
import { multiaddr } from '@multiformats/multiaddr';

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
  await new Promise(resolve => setTimeout(resolve, 1000));
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

interface SavedChannel extends Channel {
  distributions?: Distribution[];
}

channelCmd
  .command('create')
  .description('Create a new channel and save it locally')
  .argument('<name>', 'Channel name')
  .argument('<description>', 'Channel description')
  .action(async (name: string, description: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);

    const channel: SavedChannel = {
      id: Math.random().toString(36).substring(2, 10),
      name,
      description,
      spread: 0.3, // default spread
    };

    console.log(`Computing embeddings for channel "${name}"...`);
    channel.distributions = await computeRelationalDistributions(channel, (text) => nodeModel.embed(text));

    let channels = await nodeStorage.get<SavedChannel[]>('isc:channels');
    if (!Array.isArray(channels)) channels = [];

    channels.push(channel);
    await nodeStorage.set('isc:channels', channels);

    console.log(`Channel "${name}" created and saved successfully (ID: ${channel.id})`);
  });

channelCmd
  .command('list')
  .description('List local channels')
  .action(async () => {
    const channels = await nodeStorage.get<SavedChannel[]>('isc:channels');
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      console.log('No local channels found. Use `isc channel create <name> <description>` to create one.');
      return;
    }

    console.log(`Found ${channels.length} local channel(s):\n`);
    channels.forEach((c: SavedChannel, i: number) => {
      console.log(`[${i + 1}] ID: ${c.id}`);
      console.log(`    Name: ${c.name}`);
      console.log(`    Description: ${c.description}`);
      if (c.distributions && c.distributions.length > 0) {
        console.log(`    Embeddings computed: Yes (${c.distributions.length} relations)`);
      } else {
        console.log(`    Embeddings computed: No`);
      }
      console.log('');
    });
  });

channelCmd
  .command('delete')
  .description('Delete a local channel by ID')
  .argument('<id>', 'Channel ID')
  .action(async (id: string) => {
    let channels = await nodeStorage.get<SavedChannel[]>('isc:channels');
    if (!channels || !Array.isArray(channels)) {
      console.log('No local channels found.');
      return;
    }

    const initialLength = channels.length;
    channels = channels.filter(c => c.id !== id);

    if (channels.length === initialLength) {
      console.log(`Channel with ID "${id}" not found.`);
      return;
    }

    await nodeStorage.set('isc:channels', channels);
    console.log(`Channel with ID "${id}" deleted successfully.`);
  });

const postCmd = program.command('post').description('Post operations');

postCmd
  .command('announce')
  .description('Embed and broadcast a post to connected peers')
  .argument('<content>', 'Post content')
  .argument('<channelID>', 'Associated channel ID')
  .action(async (content: string, channelID: string) => {
    console.log(`Loading model ${MODEL_ID}...`);
    await nodeModel.load(MODEL_ID);

    console.log(`Computing embeddings for post...`);
    const embedding = await nodeModel.embed(content);

    // In a real CLI app, we would load the saved keypair
    const keypair = await generateKeypair();

    const node = await initCliNode();
    const peerId = node.peerId.toString();

    const post = await createSignedPost(keypair, peerId, content, channelID, embedding);

    const connections = node.getConnections();
    if (connections.length === 0) {
      console.log('No peers connected. Cannot broadcast post.');
      await node.stop();
      return;
    }

    console.log(`Broadcasting post to ${connections.length} peers...`);
    let sentCount = 0;
    for (const conn of connections) {
      try {
        const stream = await node.dialProtocol(conn.remotePeer, PROTOCOL_POST);
        await sendPostMessage(stream, post);
        sentCount++;
      } catch (e) {
        console.warn(`Failed to send post to ${conn.remotePeer.toString()}`);
      }
    }

    console.log(`Post broadcasted successfully to ${sentCount} peers!`);
    await node.stop();
  });

const chatCmd = program.command('chat').description('Chat operations');

chatCmd
  .command('send')
  .description('Send a chat message to a peer')
  .argument('<peerId>', 'Peer ID to send to')
  .argument('<channelID>', 'Channel ID')
  .argument('<message>', 'Message content')
  .action(async (peerId: string, channelID: string, message: string) => {
    // 1. Enforce Rate Limit
    const rlState = await nodeStorage.get<any>('isc:ratelimits');
    const limiter = new RateLimiter();
    if (rlState) {
      limiter.loadState(new Map(JSON.parse(rlState)));
    }
    limiter.cleanup();

    if (!limiter.attempt('local_cli_user', 'CHAT_DIAL', RATE_LIMITS.CHAT_DIAL)) {
      console.error(`Rate limit exceeded for CHAT_DIAL. Please wait before sending more messages.`);
      return;
    }

    // Save updated state
    const newState = JSON.stringify(Array.from(limiter.getState().entries()));
    await nodeStorage.set('isc:ratelimits', newState);

    const node = await initCliNode();

    console.log(`Dialing peer ${peerId}...`);
    try {
      const targetAddr = peerId.includes('/p2p/') ? peerId : `/p2p/${peerId}`;
      const stream = await node.dialProtocol(multiaddr(targetAddr), PROTOCOL_CHAT);
      console.log(`Connected. Sending message...`);
      await sendChatMessage(stream, {
        channelID,
        msg: message,
        ephemeral: false
      });
      console.log(`Message sent successfully.`);
    } catch (e) {
      console.error(`Failed to send message to ${peerId}:`, e);
    }

    await node.stop();
  });

program.parse();
