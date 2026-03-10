# ISC Protocol Specification

> **Purpose**: Detailed P2P networking, DHT, and communication protocol specifications.

---

## Protocol Constants

```typescript
const PROTOCOL_CHAT = '/isc/chat/1.0';
const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';
const PROTOCOL_POST = '/isc/post/1.0';
const PROTOCOL_FOLLOW = '/isc/follow/1.0';
const PROTOCOL_DM = '/isc/dm/1.0';
```

---

## Device Tiers

ISC adapts protocol behavior based on device capability:

| Tier | Target | Model | Relations | ANN | Delegation |
|------|--------|-------|-----------|-----|------------|
| **High** | Desktop/laptop | `all-MiniLM-L6-v2` (22 MB) | All (max 5) | HNSW | Can serve |
| **Mid** | Mid-range phone | `paraphrase-MiniLM-L3-v3` (8 MB) | Root + 2 | HNSW lite | Limited serve |
| **Low** | Budget phone | `gte-tiny` (4 MB) | Root only | Linear scan | Can request |
| **Minimal** | Constrained | Word-hash fallback | Root only | Hamming | Can request |

### Tier Detection

```javascript
async function detectTier() {
  const cores = navigator.hardwareConcurrency ?? 2;
  const mem = navigator.deviceMemory ?? 1;
  const conn = navigator.connection?.effectiveType ?? '4g';

  if (cores >= 4 && mem >= 4 && conn !== '2g') return 'high';
  if (cores >= 2 && mem >= 2) return 'mid';
  if (conn === '2g' || mem < 1) return 'minimal';
  return 'low';
}
```

### Tier-Specific Protocol Parameters

| Tier | numHashes | candidateCap | refreshInterval |
|------|-----------|--------------|-----------------|
| High | 20 | 100 | 5 min |
| Mid | 12 | 50 | 8 min |
| Low | 8 | 20 | 15 min |
| Minimal | 6 | 10 | 20 min |

---

## Libp2p Configuration

### Transports

```javascript
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';

const node = await createLibp2p({
  transports: [webSockets(), webRTC()],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  peerDiscovery: [bootstrap({ 
    list: [
      '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SznbYGzPwpkqDrqEf',
      '/ip4/104.131.131.82/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT5887gRqQofnZ6Gqiq5KhCvv6ip',
    ] 
  })],
  services: { dht: kadDHT({ kBucketSize: 20 }) },
});
await node.start();
```

### Connection Handling

- **Inbound connections**: Accepted from any peer; rate-limited to 20 concurrent
- **Outbound connections**: Dialed on match; max 50 concurrent dials
- **Keepalive**: Heartbeat ping every 30s; drop after 90s silence
- **Reconnect**: On stream drop, wait 5s then attempt one reconnect dial

---

## DHT Protocol

### Channel Schema

```typescript
interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;           // 0.0-1.0, distribution fuzziness
  relations: Relation[];    // max 5
  createdAt: number;
  updatedAt: number;
}

interface Relation {
  tag: string;              // From ontology below
  object: string;           // Free-form or structured
  weight?: number;          // Default 1.0
}
```

### Relation Ontology

See [SEMANTIC.md](SEMANTIC.md#relation-ontology) for the complete relation ontology with examples and rules.

**Tags:** `in_location`, `during_time`, `with_mood`, `under_domain`, `causes_effect`, `part_of`, `similar_to`, `opposed_to`, `requires`, `boosted_by`

### Key Schema (DHT Key Registry)

All DHT keys are prefixed by type for namespace isolation. This serves as the single source of truth for network data structures and their ephemeral lifespans:

| Data Type | DHT Key Pattern | TTL |
|---|---|---|
| **Announcements** | `/isc/announce/<modelHash>/<lsh_hash>` | Tier-dependent (5-20 min) |
| **Delegation** | `/isc/delegate/<peerID>` | 5 minutes |
| **Mutes** | `/isc/mute/<peerID>` | No expiry (manual unmute) |
| **Model Registry** | `/isc/model_registry` | 14 days (signed manifest) |
| **Posts** | `/isc/post/<modelHash>/<lsh_hash>` | 86400 (1 day) |
| **Likes** | `/isc/likes/<postID>` | 604800 (7 days) |
| **Reposts** | `/isc/reposts/<postID>` | 604800 (7 days) |
| **Replies** | `/isc/replies/<postID>` | 604800 (7 days) |
| **Profiles** | `/isc/profile/channels/<peerID>` | 2592000 (30 days) |
| **Follows** | `/isc/follow/<peerID>` | No expiry (manual unfollow) |
| **Trending** | `/isc/trending/<modelHash>` | 3600 (1 hour) |

> **Note**: Routing uses the `modelHash` (e.g., `abc123def456` for `all-MiniLM-L6-v2`) rather than `channelID` to ensure that identical thoughts in completely different channels naturally map to the same DHT space, enabling cross-topic serendipity.

### LSH (Locality-Sensitive Hashing)

Vectors are mapped to DHT keys via seeded random-projection LSH:

```javascript
function seededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let state = Math.abs(hash);
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function lshHash(vec: number[], seed: string, numHashes: number = 20, hashLen: number = 32): string[] {
  const rng = seededRng(seed);
  const hashes: string[] = [];

  for (let i = 0; i < numHashes; i++) {
    let hashBits = '';

    // Each hash requires hashLen projections
    for (let h = 0; h < hashLen; h++) {
      // Generate projection vector
      const proj = Array.from({ length: vec.length }, () => rng() * 2 - 1);

      // Project vector onto random hyperplane using dot product
      let dotProduct = 0;
      for (let j = 0; j < vec.length; j++) {
        dotProduct += vec[j] * proj[j];
      }

      // 1 if positive, 0 if negative
      hashBits += dotProduct > 0 ? '1' : '0';
    }

    hashes.push(hashBits);
  }

  return hashes;
}
```

**Tier-specific parameters:**

| Tier | numHashes | candidateCap |
|------|-----------|--------------|
| High | 20 | 100 |
| Mid | 12 | 50 |
| Low | 8 | 20 |
| Minimal | 6 | 10 |

### Announcement Payload

```typescript
interface SignedAnnouncement {
  peerID: string;           // libp2p peer ID (base58btc)
  channelID: string;        // channel identifier
  model: string;            // "Xenova/all-MiniLM-L6-v2 @sha256:abc123"
  vec: number[];            // 384-dim embedding vector
  relTag?: string;          // optional relation tag for fused distributions
  ttl: number;              // seconds until expiry (default 300)
  updatedAt: number;        // Unix timestamp (ms)
  signature: Uint8Array;    // ed25519 signature
}
```

### Announcement Loop

```javascript
async function announceChannel(channel: Channel, dists: Distribution[], modelHash: string) {
  const hashes = lshHash(dists[0].mu, modelHash, TIER.numHashes);
  
  for (let i = 0; i < Math.min(hashes.length, dists.length); i++) {
    const payload: SignedAnnouncement = {
      peerID: node.peerId.toString(),
      channelID: channel.id,
      model: LOCAL_MODEL,
      vec: dists[i].mu,
      relTag: dists[i].tag,
      ttl: TIER.refreshInterval * 2,
      updatedAt: Date.now(),
      signature: await sign(encode(payload), keypair.privateKey),
    };
    
    const key = `/isc/announce/${modelHash}/${hashes[i]}`;
    await node.contentRouting.put(key, encode(payload), { ttl: payload.ttl });
  }
}
```

### Query Protocol

```javascript
async function queryProximals(sample: number[], modelHash: string): Promise<PeerInfo[]> {
  const seen = new Set<string>();
  const candidates: PeerInfo[] = [];
  const hashes = lshHash(sample, modelHash, TIER.numHashes);

  for (const key of hashes) {
    const values = await node.contentRouting.getMany(`/isc/announce/${modelHash}/${key}`, {
      count: TIER.candidateCap,
    });
    
    for (const v of values) {
      const peer = decode(v);
      if (peer.peerID === node.peerId.toString()) continue;
      if (peer.model !== LOCAL_MODEL) continue;
      if (!await verify(peer)) continue;
      if (seen.has(peer.peerID)) continue;
      
      seen.add(peer.peerID);
      candidates.push(peer);
    }
  }

  return candidates;
}
```

### TTL & Expiry

- **Default TTL**: 300 seconds (5 minutes)
- **Refresh interval**: Tier-dependent (High: 5 min, Mid: 8 min, Low: 15 min, Minimal: 20 min)
- **Expiry handling**: Clients discard entries where `updatedAt + ttl < Date.now()`
- **Grace period**: Entries within 60s of expiry are still returned but marked stale

---

## Chat Protocol

### Stream Handler

```typescript
interface ChatMessage {
  channelID: string;
  msg: string;
  timestamp: number;
  signature: Uint8Array;
}

async function handleChatStream(stream: Stream) {
  for await (const chunk of stream.source) {
    const msg: ChatMessage = JSON.parse(decode(chunk));
    if (!await verify(msg)) continue;
    displayMessage(msg);
    stream.sink(encode({ ack: msg.timestamp }));
  }
}
```

### Dial Protocol

```javascript
async function initiateChat(peerID: string, channel: Channel): Promise<Stream> {
  const stream = await node.dialProtocol(peerID, PROTOCOL_CHAT);
  
  const greeting: ChatMessage = {
    channelID: channel.id,
    msg: 'Hey, our thoughts are proximal!',
    timestamp: Date.now(),
    signature: await sign(encode(greeting), keypair.privateKey),
  };
  
  await stream.sink(encode(greeting));
  return stream;
}
```

### Group Chat Formation

**Density Threshold**: 3+ peers within mutually dense proximity (all pairwise similarities > 0.85).

**Maximum Group Size**: 8 peers (WebRTC connection limit consideration).

**Formation Protocol**:

1. **Detection & Initiation**:
   - When a peer detects 3+ peers (including itself) forming a complete graph where all edge weights > 0.85 similarity.
   - To prevent race conditions, only the peer with the lexicographically **highest** `peerID` in the cluster initiates the group.

2. **Invitation**:
   - The initiator generates a deterministic `roomID` (`uuid_v4()`).
   - Initiator dials all members via `/isc/chat/1.0` and sends a `GroupInvite` message.

3. **Mesh Formation**:
   - Members receive the invite, announce their membership to the DHT at `/isc/group/<roomID>`, and dial all other listed members to form a full mesh.

4. **Group Maintenance**:
   - Heartbeat every 30 seconds.
   - If a member drifts and their pairwise similarities with the group drop below 0.55, they receive a graceful exit prompt.
   - If the initiator leaves, the next highest `peerID` becomes the nominal state coordinator.

```typescript
interface GroupInvite {
  type: 'group_invite';
  roomID: string;     // UUID
  members: string[];  // peerIDs of all invited participants
  timestamp: number;
  signature: Uint8Array; // Signed by initiator
}

interface GroupRoom {
  roomID: string;
  members: string[];  // peerIDs
  createdAt: number;
}
```

---

## Delegation Protocol

See [DELEGATION.md](DELEGATION.md) for the complete specification including request encryption, verification, and trust mechanisms.

**Protocol**: `/isc/delegate/1.0`

---

## Social Layer Protocol

See [SOCIAL.md](SOCIAL.md) for complete social layer protocol specification.

---

## Moderation Protocol

### Mute/Block Events

```typescript
interface MuteEvent {
  type: 'mute';
  muter: string;
  muted: string;
  reason?: string;
  timestamp: number;
  signature: Uint8Array;
}

// Stored in DHT at: /isc/mute/<peerID>
// Clients fetch and cache muted peers locally
```

### Report Events (Phase 2+)

```typescript
interface ReportEvent {
  type: 'report';
  reporter: string;
  reported: string;
  targetPostID?: string;
  reason: 'spam' | 'harassment' | 'impersonation' | 'other';
  description: string;
  timestamp: number;
  signature: Uint8Array;
}
```

---

## Model Registry Protocol

### Registry Entry

```typescript
interface ModelRegistry {
  type: 'model_registry';
  canonical: string;  // "Xenova/all-MiniLM-L6-v2 @sha256:abc123"
  deprecated: string[];
  migrationDeadline: number;  // Unix timestamp
  signature: Uint8Array;  // multisig from maintainers
}
```

### Compatibility Shards

Each model version uses a unique LSH key prefix:

```
v1:abc123:<hash>  // Old model shard
v2:def456:<hash>  // New model shard
```

Clients only query shards matching their loaded model.

---

## Data Management & Synchronization

### Conflict-Free Replicated Data Types (CRDTs)

**Channel Edits (LWW-Map)**:

- Each field has (value, timestamp, peerID) tuple
- On conflict: highest timestamp wins; peerID as tiebreaker
- Merge: element-wise max of (timestamp, peerID)

**Follow Relationships (OR-Set)**:

- Add: `{follower, followee, timestamp}`
- Remove: `{follower, followee, timestamp, tombstone: true}`
- Merge: union of all adds and removes
- Query: exists if add present without matching remove

**Reputation Scores (LWW-Register)**:

- Single value with (value, timestamp) tuple
- On conflict: highest timestamp wins
- Updated only by mutual interaction confirmation

**Conflict Detection**:

- Vector clock per peer: `{peerID: sequenceNumber}`
- Include vector clock in all announcements
- Detect concurrent operations: neither clock dominates

### Pagination Protocol

**Cursor Format**:

```typescript
interface QueryCursor {
  lastKey: string;      // Last DHT key returned
  lastValue: string;    // Last value hash (for consistency)
  timestamp: number;    // Cursor creation time
  signature: Uint8Array; // Signed by requesting peer
}
```

**Page Size Limits**:

| Tier | Max Page Size | Default |
|------|---------------|---------|
| High | 100 | 50 |
| Mid | 50 | 20 |
| Low | 20 | 10 |
| Minimal | 10 | 5 |

**Query Flow**:

1. Initial query: `getMany(key, { count: pageSize })`
2. If more results available, return cursor in response
3. Subsequent query: `getMany(key, { count: pageSize, cursor: <cursor> })`
4. Cursor expires after 5 minutes

**Response Format**:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  cursor?: QueryCursor;  // Omitted if no more results
  hasMore: boolean;
}
```

### Caching Strategy

**Cache Layers**:

1. **L1 (In-Memory)**: Hot data (active channels, recent matches)
2. **L2 (IndexedDB)**: Warm data (all channels, match history)
3. **L3 (DHT)**: Cold data (network-wide announcements)

**TTL by Data Type**:

| Data Type | L1 TTL | L2 TTL | Source of Truth |
|-----------|--------|--------|-----------------|
| Active channel distributions | 30s | 5min | Local compute |
| Match results | 60s | 10min | DHT query |
| Peer profiles | 5min | 1hr | DHT query |
| Mute lists | 1min | 10min | DHT query |
| Model registry | 1hr | 24hr | DHT query |

**Memory Budget**:

| Tier | L1 Budget | L2 Budget |
|------|-----------|-----------|
| High | 500MB | 2GB |
| Mid | 200MB | 1GB |
| Low | 100MB | 500MB |
| Minimal | 50MB | 200MB |

**Invalidation**:

- L1: Time-based expiry + LRU eviction
- L2: Time-based expiry + quota-based eviction
- DHT: TTL-based (enforced by DHT)

**Cache Warming**:

On reconnect after >5min offline:

1. Re-announce own channels
2. Re-query active channel matches
3. Refresh mute lists
4. Update model registry if >1hr old

---

## Error Handling

### Circuit Relay Protocol

**Relay Discovery**:

1. Query DHT for peers advertising `/isc/relay/1.0` protocol
2. Maintain list of 10 known relays with latency measurements
3. Refresh list every 5 minutes

**Relay Selection**:

- Rank by: latency (60%), uptime (30%), geographic diversity (10%)
- Select top 3 relays for connection attempt

**Connection Flow**:

```
Peer A (behind NAT)          Relay              Peer B (behind NAT)
      │                        │                       │
      │─── Reserve Slot ──────▶│                       │
      │◀── Slot ID: abc ──────│                       │
      │                        │─── Reserve Slot ─────▶│
      │                        │◀── Slot ID: xyz ─────│
      │─── Connect abc ──────▶│                       │
      │                        │─── Connect xyz ─────▶│
      │◀═══════════════════════│══════════════════════▶│
      │                    Direct P2P Connection        │
```

**Fallback Chain**:

1. Direct WebRTC connection
2. Circuit relay via relay #1
3. Circuit relay via relay #2
4. Circuit relay via relay #3
5. Display error: "Cannot connect to peer (NAT traversal failed)"

### Matching Thresholds

| Range | Label | Protocol Behavior |
|---|---|---|
| 0.85+ | Very Close | Auto-dial enabled |
| 0.70–0.85 | Nearby | Standard candidate |
| 0.55–0.70 | Orbiting | Manual dial required |
| <0.55 | Distant | Filtered out |

### Stream Errors

```typescript
enum StreamError {
  TIMEOUT = 'TIMEOUT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MODEL_MISMATCH = 'MODEL_MISMATCH',
  RATE_LIMITED = 'RATE_LIMITED',
  NAT_UNREACHABLE = 'NAT_UNREACHABLE',
}

async function handleStreamError(err: StreamError, peerID: string) {
  switch (err) {
    case StreamError.INVALID_SIGNATURE:
    case StreamError.MODEL_MISMATCH:
      await blockPeer(peerID);
      break;
    case StreamError.RATE_LIMITED:
      await backoff(60000);
      break;
    case StreamError.NAT_UNREACHABLE:
      await tryCircuitRelay(peerID);
      break;
  }
}
```

### DHT Errors

| Error | Handling |
|---|---|
| `KEY_NOT_FOUND` | Retry with exponential backoff (max 3 attempts) |
| `QUOTA_EXCEEDED` | Reduce announcement frequency; notify user |
| `CONNECTION_CLOSED` | Reconnect to bootstrap; resume announcements |
| `INVALID_VALUE` | Discard; log for analytics |

---

## Rate Limits

| Operation | Scope | Limit | Enforcement |
|---|---|---|---|
| DHT Announce | per peer / min | 5 | Client + supernode |
| Delegation Request | per peer / min | 3 | Supernode |
| Delegation Response | per supernode concurrent | 10 | Supernode |
| Chat Dial | per peer / hr | 20 | Client |
| DHT Query | per peer / min | 30 | Bootstrap relay |

---

## Message Encoding

All messages use **CBOR** for compact binary encoding:

```javascript
import * as cbor from 'cbor-x';

function encode(obj: any): Uint8Array {
  return cbor.encode(obj);
}

function decode(data: Uint8Array): any {
  return cbor.decode(data);
}
```

Fallback: JSON for debugging.

---

## Bootstrap Peers

Default public libp2p relays:

```
/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SznbYGzPwpkqDrqEf
/ip4/104.131.131.82/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT5887gRqQofnZ6Gqiq5KhCvv6ip
```

### Bootstrap Peer Operations

**Selection Criteria**:

- Uptime: >95% over 30 days
- Bandwidth: >100 Mbps up
- Geographic diversity: At least 3 continents
- Operator diversity: At least 3 independent operators

**Rotation**:

- Review bootstrap list quarterly
- Add 1 new peer, remove lowest-performing peer
- Announce changes 30 days in advance

**Health Monitoring**:

- Heartbeat: Every 60 seconds
- Metrics: Latency, packet loss, connection success rate
- Alert threshold: >5% failure rate over 1 hour

**Community Bootstrap Program**:

1. Apply: Submit peer info + metrics endpoint
2. Review: Community reviews application (GitHub PR)
3. Onboard: Added to bootstrap list for 30-day trial
4. Graduate: After 30 days with >95% uptime, permanent addition

### Cold Start Protocol

1. **Empty DHT Handling**:
   - If DHT query returns 0 results after 3 attempts, trigger cold start
   - Display message: "No peers online. Waiting for connections..."
   - Continue announcing own presence every 30 seconds

2. **Bootstrap Peer Discovery**:
   - Primary: Hardcoded bootstrap peers (see Bootstrap Peers section)
   - Secondary: DNS-based discovery (`_isc._tcp.bootstrap.isc.network`)
   - Tertiary: Community-maintained peer list (HTTPS endpoint)

3. **Seed Tab Pattern**:
   - User can open "seed tab" that remains open
   - Seed tab acts as local bootstrap peer for other tabs
   - Uses WebRTC + libp2p in-browser relay

4. **Direct Connection Mechanisms**:
   - QR code containing peer ID + signaling URL
   - Invite link: `https://isc.network/?peer=<peerID>&relay=<relayURL>`
   - Manual peer ID entry with "Dial" button

### TURN Server Infrastructure

**Deployment**:

- Software: coturn (open source)
- Ports: 3478 (STUN/TURN), 5349 (TLS), 49152-65535 (relay ports)
- Bandwidth: 1 Gbps up minimum
- Regions: US-East, EU-West, Asia-Pacific (3 regions minimum)

**Cost Model** (at 10k users, 10% require TURN):

- Bandwidth: 100 users × 1 Mbps × 24/7 = 100 Gbps-month ≈ $500/month
- Compute: 3 servers × $50/month = $150/month
- Total: ~$650/month

**Community TURN Program**:

1. Deploy: Operator deploys coturn with ISC config
2. Register: Submit endpoint + capacity
3. Verify: Community verifies uptime + latency
4. Compensate: Optional donations from tip jar

**Credential Rotation**:

- Short-term credentials (RFC 8656)
- Validity: 6 hours
- Generated by: Any bootstrap peer
- Verified by: TURN server via shared secret

---

## Testing

### Local Supernode Testing

```bash
# Terminal 1: Supernode
npx serve . --port 8080
# Open http://localhost:8080?tier=high&supernode=true

# Terminal 2: Low-tier client
npx serve . --port 8081
# Open http://localhost:8081?tier=low&delegate=true
```

Verify in DevTools:

- Console: `peer.delegation.stats`
- Network: Encrypted messages on `/isc/delegate/1.0`
- Match forms within 30 seconds

### Debug Logging

```
Settings → Developer → Enable Debug Logging
```

Outputs: DHT announcements, match queries, delegation, WebRTC events.

---

## Version Negotiation

Protocol versions are negotiated via libp2p multiselect:

```
/isc/chat/1.0
/isc/delegate/1.0
/isc/announce/1.0
/isc/post/1.0
```

Future versions: `/isc/chat/2.0`, etc. Clients support backward compatibility within major versions.
