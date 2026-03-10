# ISC Development Roadmap

> **Purpose**: Development phases, timelines, and success criteria.
>
> For architectural overview, see [README.md](README.md#roadmap).

---

## Overview

ISC is being developed in phases, starting with core reliability in trusted networks and evolving toward a full-featured decentralized social platform for public participation.

---

## Phase 1: Core Reliability (Q1–Q2 2026)

**Target deployment**: Trusted Networks (invite-only, private communities)

**Goal**: Foundation — semantic matching + peer discovery + delegation infrastructure.

### Deliverables

| Feature | Status | Priority |
|---|---|---|
| MVP — single-channel semantic matching + 1:1 WebRTC chat | 🔲 | P0 |
| Basic multi-channel UI — create, switch, manage multiple channels | 🔲 | P0 |
| Supernode delegation protocol + capability advertisement | 🔲 | P0 |
| Layered anti-spam (rate limits only) | 🔲 | P0 |
| Model version negotiation + compatibility shards | 🔲 | P1 |
| Device tier auto-detection + delegate mode UI | 🔲 | P1 |
| Threat model validation + security audit (community) | 🔲 | P1 |
| NAT traversal improvements (circuit relay pool) | 🔲 | P2 |

### Success Criteria

| Metric | Target |
|---|---|
| Concurrent users | 50+ |
| Connection failure rate | <15% |
| Time-to-first-match (High tier) | <15s |
| Time-to-first-match (Low tier) | <30s |
| Delegation avg latency | <1000ms |

### Timeline

| Week | Milestone |
|---|---|
| 1-4 | Core extraction + unit tests |
| 5-8 | Browser app + adapters |
| 9-12 | Supernode delegation + testing |
| 13-16 | Security audit + threat model validation |
| 17-20 | NAT traversal + polish |
| 21-24 | Beta launch (trusted networks) |

---

## Phase 2: Scale & Safety (Q3–Q4 2026)

**Target deployment**: Federated Networks → Public Networks

**Goal**: Hardening — relational embeddings + reputation system + moderation primitives.

### Deliverables

| Feature | Status | Priority |
|---|---|---|
| Relational embeddings — cross-channel semantic composition | 🔲 | P0 |
| Reputation system + signed moderation events | 🔲 | P0 |
| Offline-first: queue + background sync | 🔲 | P1 |
| Delegation health metrics + supernode ranking | 🔲 | P1 |
| PWA — installable on mobile, offline-capable shell | 🔲 | P1 |
| IPFS deployment — zero-infra hosting | 🔲 | P2 |
| Community model registry + migration tooling | 🔲 | P2 |

### Success Criteria

| Metric | Target |
|---|---|
| Daily active users (DAU) | 1,000+ |
| Delegation failure rate | <10% |
| Supernode participation | 10% of High-tier peers |

### Timeline

| Week | Milestone |
|---|---|
| 1-6 | Relational embeddings implementation |
| 7-12 | Reputation system design + implementation |
| 13-18 | Offline-first architecture |
| 19-22 | PWA + mobile optimization |
| 23-26 | IPFS deployment + community testing |

---

## Phase 3: Social Layer (2027)

**Target deployment**: Public Networks (open participation)

**Goal**: Features — posts, feeds, communities — built on reliable foundation.

### Deliverables

| Feature | Status | Priority |
|---|---|---|
| Posts & semantic feeds ("For You" + "Following") | 🔲 | P0 |
| Reactions (likes, reposts, replies, quotes) | 🔲 | P0 |
| Profiles & follow / Web of Trust | 🔲 | P0 |
| Communities — shared channel distributions | 🔲 | P1 |
| Audio Spaces (WebRTC mesh audio) | 🔲 | P1 |
| Video calls (WebRTC, parity with X) | 🔲 | P1 |
| Chaos mode — random perturbation for serendipity | 🔲 | P2 |
| Crypto tipping / Lightning Network (opt-in) | 🔲 | P2 |
| Optional vector reveal — user can consent to reveal vector for enhanced matching | 🔲 | P3 |

### Success Criteria

| Metric | Target |
|---|---|
| Daily active users (DAU) | 10,000+ |
| Critical error rate | <1% |
| Supernode economics | Tips cover infrastructure for 5% of supernodes |

### Timeline

| Quarter | Focus |
|---|---|
| Q1 2027 | Posts & feeds |
| Q2 2027 | Interactions (likes, reposts, replies) |
| Q3 2027 | Profiles, communities, Audio Spaces |
| Q4 2027 | Video calls, Chaos mode, Lightning tips |

---

## Phase 4: Ecosystem (2028+)

**Target deployment**: Multi-platform ecosystem

**Goal**: Expansion — interop, innovation, sustainability.

### Deliverables

| Feature | Status | Priority |
|---|---|---|
| AT Protocol / Bluesky interop | 🔲 | P1 |
| Mobile native apps (React Native / Flutter) | 🔲 | P1 |
| Advanced moderation tools (community courts) | 🔲 | P2 |
| DAO governance for protocol upgrades | 🔲 | P2 |
| ZK proximity proofs — prove sim > threshold without revealing vector | 🔲 | P3 |
| Enterprise deployment options (private instances) | 🔲 | P3 |

### Success Criteria

| Metric | Target |
|---|---|
| Platform diversity | 3+ form factors (browser, mobile, desktop) |
| Interoperability | 2+ external protocol bridges |
| Governance | Community-led protocol upgrades |

---

## Feature Details

### Phase 1: Core Features

#### Single-Channel Semantic Matching

- User enters text description
- Embedding computed locally via `@xenova/transformers.js`
- LSH hashes generated for DHT key mapping
- Candidates fetched and ranked by cosine similarity
- Top-k matches displayed with similarity scores

#### Multi-Channel UI

- Create, name, and describe multiple channels
- Switch between channels instantly
- Each channel maintains independent match history
- Edit channel descriptions and relations
- Archive or delete channels

#### Supernode Delegation

- High-tier peers advertise delegation capabilities
- Low-tier peers request embedding/ANN assistance
- All requests encrypted; responses signed
- Local verification prevents blind trust
- Graceful fallback when no supernodes available

#### Anti-Spam (Rate Limits)

Rate limits enforced at client and supernode level. See [PROTOCOL.md](PROTOCOL.md#rate-limits) for specification.

### Phase 2: Scale Features

#### Relational Embeddings

- Full support for all 10 relation tags
- Compositional embedding manifolds
- Bipartite matching across fused distributions
- Spatiotemporal domain boosts

#### Reputation System

- Mutual signing for interaction confirmation
- Time-weighted decay (30-day half-life)
- 7-day bootstrapping for new peers
- Reputation-weighted ANN results

#### Offline-First

- Queue actions when offline
- Background sync on reconnect
- Conflict resolution for concurrent edits
- Optimistic UI updates

### Phase 3: Social Features

#### Posts & Feeds

- 280-char short posts
- Long-form articles (no character limit)
- Media attachments via IPFS
- "For You" feed (semantic proximity)
- "Following" feed (explicit follows)
- Explainability: similarity scores visible

#### Reactions

- **Like**: Lightweight DHT announcement
- **Repost**: Re-announce with your vector
- **Reply**: Threaded responses
- **Quote**: Embed original + commentary

#### Profiles

- Aggregated channel distributions
- Bio as mean vector
- Follow/unfollow via libp2p pubsub
- Suggested follows via ANN

#### Communities

- Shared channel distributions
- Co-edit permissions
- Audio Spaces (WebRTC mesh)
- Semantic moderation

### Phase 4: Ecosystem Features

#### AT Protocol Interop

- Bridge to Bluesky for cross-posting
- Import/export follows
- Shared semantic embeddings

#### Mobile Native Apps

- React Native or Flutter
- Native model inference (faster than WASM)
- Push notifications
- Background sync

#### DAO Governance

- Community-proposed protocol upgrades
- Multisig signing for model registry
- Reputation-weighted voting
- Transparent treasury management

### Economic Sustainability

**Development Costs** (annual):

- 3 developers × $100k = $300k
- Infrastructure (bootstrap, TURN) = $10k
- Legal, accounting, compliance = $40k
- Total: ~$350k/year

**Tip Volume Projection** (based on Nostr, Mastodon):

- Conversion rate: 2-5% of users tip
- Average tip: $5-10/month
- At 10k DAU: 200-500 tippers × $7.50 = $1.5k-3.75k/month
- Coverage: <5% of development costs

**Alternative Revenue**:

1. **Grants**: Protocol Labs, Ethereum Foundation, Mozilla ($50-200k/year)
2. **Enterprise Support**: Private deployments, SLA ($100-500k/year)
3. **Donations**: GitHub Sponsors, Open Collective ($10-50k/year)
4. **Supernode Hosting**: Managed supernode service ($5-20/month, 100 users = $6-24k/year)

**Phase 1-2 Strategy**: Grants + donations (community-funded)
**Phase 3+ Strategy**: Enterprise support + managed services (self-sustaining)

### Supernode Economics

**Supernode Costs** (per month):

- Bandwidth: 50 Mbps up × 24/7 × $0.01/GB = ~$150/month
- Compute: 8-core server = ~$100/month
- Total: ~$250/month per supernode

**Tip Distribution**:

- 100% of tips go to supernode operators
- Platform takes 0% cut (Phase 1-3)
- Distribution: Proportional to uptime + requests served

**Sustainability Analysis**:

- At 10k DAU, 2% tip rate, $7.50 avg tip: $1.5k/month total
- Supports: $1.5k / $250 = 6 supernodes (3% of 200 supernodes)
- Gap: Tips cover 3%, not 20%

**Revised Target**:

- Phase 3: Tips cover 5% of supernode costs (realistic)
- Phase 4+: Enterprise support covers 50%+ of costs

**Alternative Incentives** (non-monetary):

- Reputation badges ("Trusted Supernode")
- Priority support (faster delegation responses)
- Governance rights (protocol upgrade voting)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Browser performance limits** | Medium | High | Tier-based fallback; delegation |
| **Sybil attacks in public mode** | High | High | Reputation + stake + mutual signing |
| **Model fragmentation** | Medium | Medium | Compatibility shards; migration tooling |
| **NAT traversal failures** | Low | Medium | Circuit relay pool; TURN servers |
| **Low supernode participation** | Medium | Medium | Incentives (reputation, tips) |
| **Regulatory scrutiny** | Low | High | Decentralized architecture; no central entity |

---

## Open Questions

| Question | Phase | Owner |
|---|---|---|
| What stake amount balances Sybil resistance vs. accessibility? | Phase 2 | Community |
| How to prevent reputation gaming in Web of Trust? | Phase 2 | Security team |
| Should ZK proofs be mandatory or optional? | Phase 3 | Protocol team |
| What percentage of supernodes should be incentivized? | Phase 3 | Economics team |
| How to handle cross-protocol identity mapping? | Phase 4 | Interop team |

---

## Document History

| Date | Change |
|---|---|
| 2026-03-09 | Initial roadmap created |
| TBD | Phase 1 complete |
| TBD | Phase 2 complete |
| TBD | Phase 3 complete |
