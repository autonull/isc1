# ISC Social Network Layer Specification

> **Purpose**: Detailed social network layer — posts, feeds, interactions, profiles, and communities.
>
> For an overview, see [README.md](README.md#social-network-layer).

---

## Overview

ISC's P2P and semantic foundations support a full decentralized social network — achieving parity with X (Twitter) while exceeding it through geometry-native interactions. All data (posts, profiles, reactions) is stored and queried via DHT with TTLs for ephemerality; embeddings make feeds explainable and serendipitous by design.

**Indicative timeline**: Q1-Q2 2027 — Posts & feeds · Interactions & DMs · Profiles & communities · Semantic innovations.

---

## Posts & Feeds

### Post Schema

```typescript
interface SignedPost {
  type: 'post';
  postID: string;
  author: string;
  content: string;
  channelID: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
  signature: Uint8Array;  // Signature of fields below
}

interface PostPayload {
  type: 'post';
  postID: string;
  author: string;
  content: string;
  channelID: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
}
```

### Post Announcement

```javascript
async function createPost(content: string, channelID: string): Promise<SignedPost> {
  const model = await loadEmbeddingModel();
  const embedding = await model.embed(content);

  const payload: PostPayload = {
    type: 'post',
    postID: generateUUID(),
    author: await getPeerID(),
    content,
    channelID,
    embedding,
    timestamp: Date.now(),
    ttl: 86400,
  };

  const signature = await sign(encode(payload), keypair.privateKey);

  const post = { ...payload, signature };

  // Announce to DHT with LSH key
  const hashes = lshHash(embedding, modelHash, TIER.numHashes);
  for (const hash of hashes) {
    const key = `/isc/post/${modelHash}/${hash}`;
    await node.contentRouting.put(key, encode(post), { ttl: post.ttl });
  }

  return post;
}
```

### For You Feed

Semantic proximity feed — ranked ANN queries on active channels:

```javascript
async function getForYouFeed(channel: Channel, limit: number = 50): Promise<SignedPost[]> {
  const sample = sampleFromDistribution(channel.distributions[0].mu, channel.distributions[0].sigma, 1)[0];
  const candidates = await queryPosts(sample, modelHash, 200);
  
  // Rank by similarity to user's channel
  const scored = candidates.map(post => ({
    post,
    score: cosineSimilarity(sample, post.embedding),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  // Filter by minimum similarity threshold
  return scored
    .filter(s => s.score > 0.6)
    .slice(0, limit)
    .map(s => ({ ...s.post, similarityScore: s.score }));
}
```

**Explainability**: Every ranked post shows its similarity score and which channel it matched:
> "This post is 0.82 similar to your 'AI ethics' channel"

### Following Feed

Posts from explicitly followed peers, tracked in local IndexedDB:

```typescript
interface FollowSubscription {
  followee: string;  // peerID
  channelID?: string;  // Optional: follow specific channel
  since: number;
}

async function getFollowingFeed(subscriptions: FollowSubscription[], limit: number = 50): Promise<SignedPost[]> {
  const posts: SignedPost[] = [];
  
  for (const sub of subscriptions) {
    const key = `/isc/posts/author/${sub.followee}`;
    const authorPosts = await node.contentRouting.getMany(key, { count: limit });
    posts.push(...authorPosts.map(decode));
  }
  
  posts.sort((a, b) => b.timestamp - a.timestamp);
  return posts.slice(0, limit);
}
```

### Global Explore

Aggregate high-engagement clusters surface trending vector clouds:

```javascript
async function getTrendingPosts(modelHash: string, timeWindow: number = 3600000): Promise<SignedPost[]> {
  // Query DHT for posts with high engagement in time window
  const key = `/isc/trending/${modelHash}`;
  const trending = await node.contentRouting.getMany(key, { count: 20 });
  
  return trending.map(decode).filter(p => p.timestamp > Date.now() - timeWindow);
}
```

---

## Interactions

### Likes

```typescript
interface LikeEvent {
  type: 'like';
  reactor: string;      // peerID
  targetPostID: string;
  timestamp: number;
  signature: Uint8Array;
}

// Lightweight DHT announcement
async function likePost(postID: string): Promise<LikeEvent> {
  const event: LikeEvent = {
    type: 'like',
    reactor: await getPeerID(),
    targetPostID: postID,
    timestamp: Date.now(),
    signature: await sign(encode(event), keypair.privateKey),
  };
  
  const key = `/isc/likes/${postID}`;
  await node.contentRouting.put(key, encode(event), { ttl: 86400 });
  
  return event;
}
```

### Reposts

Re-announce with your own vector — shifts propagation toward your distribution:

```typescript
interface RepostEvent {
  type: 'repost';
  reactor: string;
  targetPostID: string;
  channelID: string;
  embedding: number[];  // Reposter's channel embedding
  timestamp: number;
  signature: Uint8Array;
}

// Hybrid reach: original content + reposter's semantic distribution
async function repostPost(postID: string, channelID: string): Promise<RepostEvent> {
  const channel = await getChannel(channelID);
  const embedding = channel.distributions[0].mu;
  
  const event: RepostEvent = {
    type: 'repost',
    reactor: await getPeerID(),
    targetPostID: postID,
    channelID,
    embedding,
    timestamp: Date.now(),
    signature: await sign(encode(event), keypair.privateKey),
  };
  
  const key = `/isc/reposts/${postID}`;
  await node.contentRouting.put(key, encode(event), { ttl: 86400 });
  
  return event;
}
```

### Replies

```typescript
interface ReplyEvent {
  type: 'reply';
  reactor: string;
  targetPostID: string;
  content: string;
  embedding: number[];
  timestamp: number;
  signature: Uint8Array;
}

// Threaded WebRTC streams or DHT-linked posts
async function replyToPost(postID: string, content: string): Promise<ReplyEvent> {
  const model = await loadEmbeddingModel();
  const embedding = await model.embed(content);
  
  const event: ReplyEvent = {
    type: 'reply',
    reactor: await getPeerID(),
    targetPostID: postID,
    content,
    embedding,
    timestamp: Date.now(),
    signature: await sign(encode(event), keypair.privateKey),
  };
  
  const key = `/isc/replies/${postID}`;
  await node.contentRouting.put(key, encode(event), { ttl: 86400 });
  
  return event;
}
```

### Quotes

Embed original + commentary as a fused vector:

```typescript
interface QuoteEvent {
  type: 'quote';
  reactor: string;
  targetPostID: string;
  originalContent: string;
  commentary: string;
  fusedEmbedding: number[];  // Embed("original + commentary")
  timestamp: number;
  signature: Uint8Array;
}
```

### Trending Detection

Aggregate engagement counts via PubSub:

```javascript
async function computeTrendingScore(postID: string): Promise<number> {
  const [likes, reposts, replies] = await Promise.all([
    node.contentRouting.getMany(`/isc/likes/${postID}`, { count: 1000 }),
    node.contentRouting.getMany(`/isc/reposts/${postID}`, { count: 1000 }),
    node.contentRouting.getMany(`/isc/replies/${postID}`, { count: 1000 }),
  ]);
  
  // Weighted score: replies > reposts > likes
  return replies.length * 3 + reposts.length * 2 + likes.length;
}
```

---

## Profiles & Follows

### Profile Schema

```typescript
interface Profile {
  peerID: string;
  bio?: string;
  bioEmbedding?: number[];  // Computed: mean(channelEmbeddings)
  channels: ChannelSummary[];
  followerCount: number;
  followingCount: number;
  joinedAt: number;
}

interface ChannelSummary {
  channelID: string;
  name: string;
  description: string;
  embedding: number[];
  postCount: number;
  latestEmbedding: number[];
}
```

### Profile Aggregation

Aggregated message of a peer's channel distributions:

```javascript
async function computeBioEmbedding(profile: Profile): Promise<number[]> {
  if (profile.channels.length === 0) return [];
  const embeddings = profile.channels.map(c => c.latestEmbedding);
  return meanVector(embeddings);  // Element-wise mean
}

async function getProfile(peerID: string): Promise<Profile> {
  // Aggregate channel distributions
  const channelsKey = `/isc/profile/channels/${peerID}`;
  const channels = await node.contentRouting.getMany(channelsKey, { count: 10 });
  
  // Compute mean vector (bio as mean vector)
  const allEmbeddings = channels.flatMap(c => decode(c).embedding);
  const bioEmbedding = allEmbeddings.length > 0
    ? meanVector(allEmbeddings)
    : undefined;
  
  const profile: Profile = {
    peerID,
    channels: channels.map(decode),
    bioEmbedding,
    followerCount: 0,
    followingCount: 0,
    joinedAt: getFirstSeen(peerID),
  };

  const signature = await sign(encode(profile), keypair.privateKey);
  return { ...profile, signature };
}
```

### Follow/Unfollow

```typescript
interface FollowEvent {
  type: 'follow' | 'unfollow';
  follower: string;
  followee: string;
  timestamp: number;
  signature: Uint8Array;
}

async function followPeer(followee: string): Promise<FollowEvent> {
  const event: FollowEvent = {
    type: 'follow',
    follower: await getPeerID(),
    followee,
    timestamp: Date.now(),
    signature: await sign(encode(event), keypair.privateKey),
  };
  
  // Announce via libp2p pubsub to followee
  const topic = `/isc/follow/${followee}`;
  await node.pubsub.publish(topic, encode(event));
  
  // Store locally
  await storage.set(`follows/${followee}`, event);
  
  return event;
}
```

### Suggested Follows

Ranked by ANN queries on your active channels:

```javascript
async function getSuggestedFollows(channel: Channel, limit: number = 10): Promise<string[]> {
  const sample = channel.distributions[0].mu;
  const candidates = await queryProximals(sample, modelHash);
  
  // Rank by similarity; exclude already following
  const following = await getFollowingList();
  const suggestions = candidates
    .filter(c => !following.includes(c.peerID))
    .slice(0, limit);
  
  return suggestions.map(c => c.peerID);
}
```

### Web of Trust

```typescript
interface ReputationScore {
  peerID: string;
  score: number;        // 0.0 - 1.0
  mutualFollows: number;
  interactionHistory: Interaction[];
  halfLifeDays: number; // 30-day decay
}

// Mutual follows accumulate reputation scores
// High-rep peers carry more weight in mute/flag propagation
```

---

## Communities

### Shared Channels

```typescript
interface CommunityChannel {
  channelID: string;
  name: string;
  description: string;
  members: string[];    // peerIDs
  coEditors: string[];  // peerIDs with edit permissions
  embedding: number[];  // Aggregated mean vector
  createdAt: number;
  signature: Uint8Array;
}

// Groups of peers co-edit a channel's mean/spread
// Creates semantic "neighborhoods" announced via DHT
```

### Audio Spaces

```javascript
// Mesh broadcast within a dense channel cluster (WebRTC audio)
async function createAudioSpace(channelID: string): Promise<AudioSpace> {
  const channel = await getChannel(channelID);
  const matches = await queryProximals(channel.distributions[0].mu, modelHash);
  
  // Form mesh with top matches
  const mesh = await formWebRTCMesh(matches.slice(0, 10));
  
  return {
    channelID,
    participants: mesh.peers,
    streams: mesh.audioStreams,
  };
}
```

### DMs (Direct Messages)

```typescript
interface DirectMessage {
  type: 'dm';
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  signature: Uint8Array;
  encrypted: Uint8Array;  // E2E encrypted payload
}

// 1:1 or group WebRTC streams, E2E encrypted via libsodium
async function sendDM(recipient: string, content: string): Promise<DirectMessage> {
  const encrypted = await encrypt(content, recipientPublicKey);
  
  const dm: DirectMessage = {
    type: 'dm',
    sender: await getPeerID(),
    recipient,
    content: '',  // Encrypted; content in encrypted field
    encrypted,
    timestamp: Date.now(),
    signature: await sign(encode(dm), keypair.privateKey),
  };
  
  // Dial recipient directly
  const stream = await node.dialProtocol(recipient, '/isc/dm/1.0');
  await stream.sink(encode(dm));
  
  return dm;
}
```

### Semantic Moderation

```javascript
// Off-vector posts are naturally deprioritized
async function checkPostCoherence(post: SignedPost, channel: Channel): Promise<number> {
  const channelEmbedding = channel.distributions[0].mu;
  return cosineSimilarity(channelEmbedding, post.embedding);
}

// Signed reports route to community moderators
interface CommunityReport {
  reporter: string;
  targetPostID: string;
  reason: 'off-topic' | 'spam' | 'harassment';
  evidence: string;
  signature: Uint8Array;
}
```

---

## Exceeding Centralized Platforms

| Feature | ISC Advantage |
|---|---|
| **Explainable feeds** | Similarity scores visible; no opaque algorithm |
| **Echo chamber mitigation** | Chaos mode perturbs distribution for cross-topic serendipity |
| **Thought bridging** | Local AI suggests replies that geometrically bridge two vectors |
| **Vibe rooms** | Proximity chats auto-form without invites; exit naturally as you drift |
| **Places** | Idea boards where posts evolve into projects — vectors as editable graph nodes |
| **Fuzzy anonymity** | Match on vectors without revealing peerID |
| **No ads** | Monetization via crypto micropayments / Lightning Network tips (opt-in) |
| **Portability** | Export distributions; interop with Bluesky / AT Protocol |
| **Resilience** | No deplatforming; self-healing peer-relay for temporarily offline users |

---

## Chaos Mode

For serendipitous cross-topic discovery:

```javascript
function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  // Perturb distribution for cross-topic serendipity
  const noise = embedding.map(() => (Math.random() * 2 - 1) * chaosLevel);
  const perturbed = embedding.map((v, i) => v + noise[i]);
  
  // Normalize
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  return perturbed.map(v => v / norm);
}

// User-controlled: 0.0 (no chaos) to 0.3 (high serendipity)
```

---

## Data Storage

### DHT Keys

For the complete network-wide DHT key schema and TTL specifications, see the [DHT Key Registry in PROTOCOL.md](PROTOCOL.md#key-schema-dht-key-registry).

### Local Storage (IndexedDB)

| Data | Purpose |
|---|---|
| `keypair` | User's ed25519 keypair |
| `channels` | User's channel definitions |
| `follows` | Following list |
| `mutes` | Muted peers |
| `chat_history` | Local chat logs (optional) |
| `drafts` | Unsent post drafts |
