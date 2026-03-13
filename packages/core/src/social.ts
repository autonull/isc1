import { Keypair, sign, encodePayload, verify } from './crypto.js';
import { cosineSimilarity, lshHash, meanVector } from './math.js';
import { Distribution } from './semantic.js';

export interface ChannelSummary {
  channelID: string;
  name: string;
  description: string;
  embedding: number[];
  postCount: number;
  latestEmbedding: number[];
}

export interface Profile {
  peerID: string;
  bio?: string;
  bioEmbedding?: number[];  // Computed: mean(channelEmbeddings)
  channels: ChannelSummary[];
  followerCount: number;
  followingCount: number;
  joinedAt: number;
}

export interface SignedProfile extends Profile {
  signature: Uint8Array;
}

export interface FollowEvent {
  type: 'follow' | 'unfollow';
  follower: string;
  followee: string;
  timestamp: number;
  signature: Uint8Array;
}

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

  // Reactions arrays (populated locally or via network)
  likes?: string[]; // Array of peer IDs
  reposts?: string[]; // Array of peer IDs
  replies?: SignedPost[]; // Array of reply posts

  // Optional Quote references
  quoteOf?: string; // targetPostID

  // Optional Reply reference
  replyTo?: string; // targetPostID
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
  quoteOf?: string;
  replyTo?: string;
}

export interface ReactionPayload {
  type: 'like' | 'repost';
  targetPostID: string;
  author: string;
  timestamp: number;
}

export interface SignedReaction extends ReactionPayload {
  signature: Uint8Array;
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
  ttl: number = 86400000, // default 24h
  quoteOf?: string,
  replyTo?: string
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
    ...(quoteOf ? { quoteOf } : {}),
    ...(replyTo ? { replyTo } : {})
  };

  const encoded = encodePayload(payload);
  const signature = await sign(encoded, keypair);

  return {
    ...payload,
    signature,
    likes: [],
    reposts: [],
    replies: []
  };
}

export async function createSignedReaction(
  keypair: Keypair,
  peerID: string,
  targetPostID: string,
  type: 'like' | 'repost'
): Promise<SignedReaction> {
  const payload: ReactionPayload = {
    type,
    targetPostID,
    author: peerID,
    timestamp: Date.now()
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
    ttl: post.ttl,
    ...(post.quoteOf ? { quoteOf: post.quoteOf } : {}),
    ...(post.replyTo ? { replyTo: post.replyTo } : {})
  };
  const encoded = encodePayload(payload);
  return await verify(encoded, post.signature, publicKey);
}

/**
 * Computes the mean bio embedding from a profile's channels.
 */
export function computeBioEmbedding(profile: Profile): number[] {
  if (profile.channels.length === 0) return [];
  const embeddings = profile.channels.map(c => c.latestEmbedding).filter(e => e.length > 0);
  if (embeddings.length === 0) return [];
  return meanVector(embeddings);
}
