import { Keypair, sign, encodePayload, verify } from './crypto.js';
import { cosineSimilarity, lshHash } from './math.js';
import { Distribution } from './semantic.js';

export interface SignedPost {
  type: 'post';
  postID: string;
  author: string;
  content: string;
  channelID: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
  signature: Uint8Array;
  isPending?: boolean;
}

export interface PostPayload {
  type: 'post';
  postID: string;
  author: string;
  content: string;
  channelID: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
}

export interface CommunityReport {
  reporter: string;
  targetPostID: string;
  reason: 'off-topic' | 'spam' | 'harassment';
  evidence: string;
  signature: Uint8Array;
}

export async function createCommunityReport(
  keypair: Keypair,
  reporter: string,
  targetPostID: string,
  reason: 'off-topic' | 'spam' | 'harassment',
  evidence: string
): Promise<CommunityReport> {
  const payload = { reporter, targetPostID, reason, evidence };
  const encoded = encodePayload(payload);
  const signature = await sign(encoded, keypair);
  return { ...payload, signature };
}

export async function createSignedPost(
  keypair: Keypair,
  peerID: string,
  content: string,
  channelID: string,
  embedding: number[],
  ttl: number = 86400000 // default 24h
): Promise<SignedPost> {
  const payload: PostPayload = {
    type: 'post',
    postID: Math.random().toString(36).substring(2, 10),
    author: peerID,
    content,
    channelID,
    embedding,
    timestamp: Date.now(),
    ttl,
  };

  const encoded = encodePayload(payload);
  const signature = await sign(encoded, keypair);

  return {
    ...payload,
    signature
  };
}

/**
 * Checks if a post is coherent with a channel's semantic space.
 * Off-vector posts can be naturally deprioritized.
 */
export function checkPostCoherence(post: SignedPost, channelDistributions: Distribution[]): number {
  if (!channelDistributions || channelDistributions.length === 0) {
    return 0; // Or some default, but distributions should be computed
  }
  const channelEmbedding = channelDistributions[0].mu;
  return cosineSimilarity(channelEmbedding, post.embedding);
}

/**
 * Generates the DHT keys for a given post embedding.
 */
export function getPostDHTKeys(embedding: number[], modelHash: string, numHashes: number = 5): string[] {
  const hashes = lshHash(embedding, modelHash, numHashes);
  return hashes.map(hash => `/isc/post/${modelHash.replace(/\//g, '_')}/${hash}`);
}

/**
 * Validates a signed post.
 */
export async function verifyPost(post: SignedPost, publicKey: CryptoKey): Promise<boolean> {
  const payload: PostPayload = {
    type: post.type,
    postID: post.postID,
    author: post.author,
    content: post.content,
    channelID: post.channelID,
    embedding: post.embedding,
    timestamp: post.timestamp,
    ttl: post.ttl
  };
  const encoded = encodePayload(payload);
  return await verify(encoded, post.signature, publicKey);
}
