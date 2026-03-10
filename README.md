# ISC — Internet Semantic Chat

> **Meet your thought neighbors.**

A fully decentralized, browser-only social platform that uses in-browser LLM embeddings to place ideas in a shared vector space — then serendipitously connects you with peers whose mental distributions are closest to yours.

**Minimal servers. No accounts. No surveillance. Just thought and conversation.**

---

## Quick Start

```bash
git clone https://github.com/yourname/isc.git
cd isc
npx serve .
# Open http://localhost:8080 in two browser tabs
```

See [PROTOCOL.md](PROTOCOL.md) for complete protocol specification.

---

## Core Properties

| Property | Description |
|---|---|
| **Fully browser-native** | Minimal server-side compute; all embedding and routing runs in-browser |
| **Serverless P2P** | Kademlia DHT for discovery, WebRTC DataChannels for chat |
| **Channels** | Multiple named presence contexts with optional relational semantics |
| **Adaptive by device** | Model size, worker concurrency, and matching depth auto-scale to device capability |
| **Fuzzy identity** | Users represented as distributions in embedding space, not fixed points |
| **Relational hypergraph** | Optional relation tags compose subjects with context into unified embedding manifolds |
| **Ephemeral by default** | Announcements expire (TTL-based); no persistent profile |
| **E2E encrypted** | WebRTC DTLS + keypair signing secures all streams |

---

## How It Works

### 1. Describe Your Thoughts

Create a channel with a description of what you're thinking about:

> "Distributed systems, consensus algorithms, and the CAP theorem"

### 2. Embedding Computed Locally

Your browser runs an LLM embedding model (4-22 MB depending on device tier) to produce a 384-dimensional vector representing your thoughts.

### 3. Announce to DHT

The vector is hashed via Locality-Sensitive Hashing (LSH) and announced to the Kademlia DHT with a tier-dependent TTL.

### 4. Discover Proximal Peers

Your client queries the DHT for candidates with similar LSH keys, then refines matches locally using cosine similarity.

### 5. Form Chats

Click a match to open a 1:1 WebRTC chat. Dense clusters can auto-form group chats.

```
┌─────────────────────────────────────────────────────────────┐
│  Your Channel: "AI Ethics"                                  │
│  Description: "Ethical implications of machine learning"    │
│                                                             │
│  Matches Found:                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ● Peer QmX...  (0.87 similarity)  [Dial] [Profile]   │  │
│  │ ○ Peer QmY...  (0.79 similarity)  [Dial] [Profile]   │  │
│  │ ○ Peer QmZ...  (0.72 similarity)  [Dial] [Profile]   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## System Architecture

### Peer Initialization

When a user loads the app:

1. **Capability probe** → selects device tier (High/Mid/Low/Minimal)
2. **Keypair generation** → ed25519 via Web Crypto API for signing
3. **Model loading** → appropriate embedding model cached in IndexedDB
4. **Channel restoration** → saved channels loaded from localStorage
5. **Libp2p node startup** → connects to bootstrap peers

### Channels & Distributions

A **channel** is a named presence context representing current thoughts:

```json
{
  "id": "ch_ai_ethics_9b2f",
  "name": "AI Ethics",
  "description": "Ethical implications of machine learning and autonomy",
  "spread": 0.15,
  "relations": [
    { "tag": "in_location", "object": "lat:35.6895, long:139.6917, radius:50km", "weight": 1.2 },
    { "tag": "during_time", "object": "start:2026-01-01T00:00:00Z, end:2026-12-31T23:59:59Z" },
    { "tag": "with_mood", "object": "reflective and cautious" }
  ]
}
```

Each channel produces a set of **distributions**:

- **Root distribution**: `Embed(description)` → μ_root, σ = channel.spread
- **Fused distributions**: For each relation, `Embed("description tag object")` → μ_fused, σ_fused

### DHT Announcement

Vectors are mapped to DHT keys via **seeded Locality-Sensitive Hashing (LSH)** using the embedding model hash to ensure global semantic routing. See [PROTOCOL.md](PROTOCOL.md#lsh-locality-sensitive-hashing) for the complete LSH specification.

Announcement payload:

```json
{
  "peerID": "12D3KooW...",
  "channelID": "ch_ai_ethics_9b2f",
  "model": "Xenova/all-MiniLM-L6-v2",
  "vec": [0.12, -0.07, ...],
  "relTag": "in_location",
  "ttl": 300,
  "signature": "ed25519_signature"
}
```

### Querying for Proximals

Clients query DHT for candidates with matching LSH keys within the same model's embedding space, then refine locally:

```javascript
const candidates = [];
for (const key of lshHash(currentSample, modelHash, TIER.numHashes)) {
  const values = await node.contentRouting.getMany(key, { count: TIER.candidateCap });
  for (const v of values) {
    const peer = JSON.parse(v);
    if (peer.peerID === node.peerId.toString()) continue;
    if (peer.model !== LOCAL_MODEL) continue;
    if (!verifySignature(peer)) continue;
    candidates.push(peer);
  }
}
```

Candidates are ranked by relational similarity (filtered out by default below 0.55), top-k displayed.

### Forming Chats

Top matches are dialed directly over **WebRTC** via libp2p protocol `/isc/chat/1.0`:

```javascript
const stream = await node.dialProtocol(peerID, '/isc/chat/1.0');
stream.write(JSON.stringify({
  channelID: channel.id,
  msg: 'Hey, our thoughts are proximal!',
}));
```

**Group chats**: 3+ peers matching within same channel form a mesh; rooms identified by hashing the group's shared vector centroid.

### Handling Dynamics

| Challenge | Approach |
|---|---|
| **Peer churn** | DHT naturally handles leaves; heartbeat pings every 30s |
| **Cold start** | Bootstrap via public libp2p relays; "seed tab" pattern |
| **Scale (1k+ peers)** | LSH + DHT approximates well; gossip for >10k |
| **Thought drift** | Edit channel → new embedding pushed to DHT within seconds |
| **NAT traversal** | Public STUN/TURN servers; libp2p circuit relays for hard NATs |
| **Model fragmentation** | `model` field in payload; clients discard mismatched candidates |

---

## Deployment Modes

ISC supports progressive decentralization:

| Mode | Phase | Use Case | Trust Assumptions |
|------|-------|----------|-------------------|
| **Trusted Network** | Phase 1 | Private communities, invite-only groups | Pre-existing social trust |
| **Federated Networks** | Phase 2 | Interconnected communities; reputation bridges | Trust within communities |
| **Public Network** | Phase 2+ | Open participation | Potential adversaries |

---

## Device Tiers

ISC adapts to device capability at startup. See [PROTOCOL.md](PROTOCOL.md#device-tiers) for the complete tier specification.

**Tiers:** High (desktop), Mid (mid-range phone), Low (budget phone), Minimal (constrained)

---

## Semantic Model

### Relation Ontology

A fixed set of 10 predefined relation tags ensures network-wide interoperability. See [SEMANTIC.md](SEMANTIC.md#relation-ontology) for the complete ontology.

**Tags:** `in_location`, `during_time`, `with_mood`, `under_domain`, `causes_effect`, `part_of`, `similar_to`, `opposed_to`, `requires`, `boosted_by`

### Compositional Embeddings

For each channel, distributions are computed locally. See [SEMANTIC.md](SEMANTIC.md#compositional-embeddings) for the complete implementation.

### Relational Matching

Matching uses bipartite alignment across the multi-vector hypergraph. See [SEMANTIC.md](SEMANTIC.md#relational-matching) for the complete specification.

### Model Version Negotiation

Embedding spaces from different models are not comparable. Every DHT entry includes:

```json
"model": "Xenova/all-MiniLM-L6-v2 @sha256:abc123def456"
```

Clients silently filter candidates with unsupported models. The network self-partitions by model version without fully breaking.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Embedding** | `@xenova/transformers.js` (ONNX/WASM) |
| **P2P network** | `js-libp2p` (WebSockets + WebRTC, Noise, Yamux) |
| **DHT** | `@libp2p/kad-dht` |
| **ANN index** | `usearch` (WASM HNSW) |
| **Crypto** | Web Crypto API (ed25519) for signing, `libsodium-wrappers` for encryption (via `x25519` conversion) |
| **Storage** | localStorage + IndexedDB |
| **UI** | Vanilla HTML/JS (no framework dependencies) |

---

## Key Design Decisions

### Why DHT + LSH?

- **Scalability**: O(log n) lookup without central index
- **Privacy**: Only vectors announced, not raw text
- **Censorship resistance**: No single point of failure

### Why Distributions Instead of Points?

- **Fuzzy identity**: Thoughts are inherently uncertain
- **Serendipity**: Overlapping distributions enable cross-topic discovery
- **Natural drift**: Editing a channel shifts the distribution smoothly

### Why Relational Embeddings?

- **Contextual binding**: "AI ethics in Neo-Tokyo during 2026" differs from "Neo-Tokyo AI ethics"
- **Compositional semantics**: Relations form a hypergraph, not flat vector space
- **Expressivity**: Full relational logic within browser constraints

### Why Browser-Only?

- **Privacy**: No server sees raw text or chat content
- **Censorship resistance**: No central infrastructure to shut down
- **Infrastructure**:
  - Bootstrap peers: 5-10 community-run libp2p relays (required)
  - STUN servers: Public (Google, Cloudflare) — free
  - TURN servers: Community-run (optional, for hard NATs)
  - Circuit relays: Community-run (optional, for fallback)
- **Server-Side Compute**: Minimal — only relay traffic, no application logic.
- **Cost**: ~$50-200/month for bootstrap peer bandwidth at 10k users.
- **Scale**: DHT provides O(log n) lookup; practical limits:
  - Browser memory: ~10k ANN index entries (HNSW)
  - WebRTC connections: ~50 concurrent per browser
  - Bootstrap bandwidth: Bottleneck at >100k concurrent users
  - **Mitigation**: Hierarchical DHT, community relays, federation (Phase 2+)

---

## Security & Safety

### Authenticity

- **User keypairs**: ed25519 generated via Web Crypto API on first launch
- **Signed announcements**: All DHT puts signed; recipients verify and discard invalid
- **Signed posts**: All social content tamperproof by design

### Safety Mechanisms (Trusted Network Mode)

| Mechanism | Implementation |
|---|---|
| **Rate limiting** | DHT Announce: 5/min, Chat Dial: 20/hr, DHT Query: 30/min |
| **Mute/block** | Signed mute events stored in DHT; clients auto-filter |
| **Semantic filters** | Minimum 0.55 similarity threshold; per-channel controls |
| **Harassment exit** | Auto-decay when similarity drops; one-click mute |

### Privacy Guarantees

- No central servers; all data lives locally or traverses P2P
- Only vectors + peerID announced publicly; raw text never broadcast unless explicitly posted
- E2E encrypted chats via WebRTC DTLS
- Optional ephemeral keys per session/channel
- Optional Tor/I2P routing via community transport plugins

### Threat Model

| Threat | Mitigation (Phase 1) | Mitigation (Phase 2+) |
|--------|---------------------|----------------------|
| **Malicious supernodes** | Local sanity checks + trusted selection | + Reputation weighting |
| **Sybil attackers** | Social trust barrier (invite-only) | + Reputation decay + uptime history |
| **Network eavesdroppers** | WebRTC DTLS + Noise protocol | Same |
| **Model poisoning** | Canonical model registry (DHT-hosted, signed) | Same |

See [SECURITY.md](SECURITY.md) for the complete threat model and security specification.

---

## Supernode Delegation

High-tier peers optionally act as **supernodes** to assist Low/Minimal-tier peers with computationally expensive operations. See [DELEGATION.md](DELEGATION.md) for the complete delegation protocol specification.

### Trust & Safety

- **No blind trust**: All delegated results cryptographically signed and locally verified
- **Reputation-weighted selection**: Peers prefer supernodes with high uptime
- **Privacy preserved**: Requests E2E encrypted; only channel descriptions delegated

---

## Social Network Layer

ISC's P2P and semantic foundations support a full decentralized social network:

### Posts & Feeds

- **Posts**: Embed text/media into the space, announce via LSH-hashed keys in DHT
- **For You feed**: Semantic proximity — ranked ANN queries surface nearby posts
- **Following feed**: Posts from explicitly followed peers
- **Explainability**: Every ranked post shows similarity score and matched channel

### Interactions

- **Likes**: Lightweight DHT announcements
- **Reposts**: Re-announce with your vector — shifts propagation toward your distribution
- **Replies**: Threaded WebRTC streams or DHT-linked posts
- **Quotes**: Embed original + commentary as fused vector

### Profiles & Follows

- **Profile**: Aggregated message of peer's channel distributions (bio as mean vector)
- **Follow**: Subscribe via libp2p pubsub
- **Suggested follows**: Ranked by ANN queries on your active channels

### Communities

- **Shared channels**: Groups co-edit a channel's mean/spread, creating semantic neighborhoods
- **Audio Spaces**: Mesh broadcast within dense channel clusters
- **DMs**: 1:1 or group WebRTC streams, E2E encrypted

See [SOCIAL.md](SOCIAL.md) for the complete social layer specification.

---

## Protocol Specifications

Protocol constants, message formats, DHT key schemas, and rate limits are defined in [PROTOCOL.md](PROTOCOL.md).

**Key protocols:** `/isc/chat/1.0`, `/isc/delegate/1.0`, `/isc/announce/1.0`, `/isc/post/1.0`

**Rate limits:** DHT Announce: 5/min, Chat Dial: 20/hr, DHT Query: 30/min (see [PROTOCOL.md](PROTOCOL.md#rate-limits))

---

## Modular Architecture

ISC uses a monorepo structure to maximize code sharing across form factors. See [CODE.md](CODE.md) for the complete architecture specification.

**Packages:** `@isc/core` (environment-agnostic), `@isc/adapters` (browser/node/cli), `@isc/protocol` (libp2p handlers), `@isc/apps/*` (form factors)

---

## Roadmap

Development proceeds in phases. See [ROADMAP.md](ROADMAP.md) for the complete timeline with feature details and risk assessment.

**Phase 1 (Q1-Q2 2026):** Core reliability — MVP, multi-channel UI, supernode delegation, rate limits

**Phase 2 (Q3-Q4 2026):** Scale & safety — relational embeddings, reputation system, offline-first, PWA

**Phase 3 (2027):** Social layer — posts & feeds, reactions, profiles, communities, Lightning tips

---

## Documentation

| Document | Purpose |
|---|---|
| [**README.md**](README.md) | Complete architectural and protocol overview |
| [**ACCESSIBILITY.md**](ACCESSIBILITY.md) | Accessibility (WCAG 2.1 AA) specification |
| [**PROTOCOL.md**](PROTOCOL.md) | P2P networking, DHT, communication protocols |
| [**SEMANTIC.md**](SEMANTIC.md) | Embedding models, relational matching, semantic geometry |
| [**DELEGATION.md**](DELEGATION.md) | Supernode architecture and delegation protocol |
| [**SECURITY.md**](SECURITY.md) | Threat model, safety, privacy, authenticity |
| [**SOCIAL.md**](SOCIAL.md) | Social network layer (posts, feeds, communities) |
| [**CODE.md**](CODE.md) | Modular architecture and package structure |
| [**ROADMAP.md**](ROADMAP.md) | Development phases and timeline |
| [**test.md**](test.md) | Test specifications |
| [**ui.md**](ui.md) | UI specifications |

---

## Contributing

Pull requests, ideas, and experiments welcome. This is an early-stage prototype — the goal is to learn what emerges when people navigate by thought rather than by URL.

### Security Review

Before merging PRs, ensure:

- [ ] All delegated responses are cryptographically signed
- [ ] Local verification logic has unit tests
- [ ] Rate limiting is enforced
- [ ] Encryption keys are never logged
- [ ] Model version checks prevent cross-model computation

See [SECURITY.md](SECURITY.md#security-review-checklist) for full checklist.

### How to Contribute

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-idea`
3. Commit your changes: `git commit -m 'Add my idea'`
4. Push and open a PR

---

## Community

- **GitHub**: [github.com/yourname/isc](https://github.com/yourname/isc)
- **Issues**: Report bugs and feature requests
- **Discussions**: Share ideas and experiments
- **Security**: Report vulnerabilities via <security@isc.example>

---

## License

MIT © 2025 ISC Contributors

---

*ISC routes by semantic geometry, not topic labels. Two people thinking about "the ethics of AI art" and "copyright in machine creativity" will find each other even if they used completely different words.*
