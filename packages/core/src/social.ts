import { Keypair, sign, encodePayload } from './crypto.js';
import { lshHash } from './math.js';

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
