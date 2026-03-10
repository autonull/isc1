# ISC — Test & Simulation Plan

> **Purpose**: Build a solid testing foundation quickly, then grow into a full network simulation and optimization toolset across all roadmap phases.

---

## Guiding Principles

- **Test the physics first** — the semantic matching math is the heart of ISC. Any bug here poisons everything downstream.
- **Simulate before you scale** — run a thousand virtual peers in-process before you run ten real browsers.
- **Degrade gracefully and verify it** — every tier, every fallback path, every failure mode must have a test.
- **Determinism is a first-class requirement** — seeded RNGs, fixed model weights, and reproducible DHT state make failures debuggable.

---

## Overview: Test Layers

```
┌────────────────────────────────────────────────────────┐
│  Layer 5 — Network Simulation (virtual peer swarms)    │
├────────────────────────────────────────────────────────┤
│  Layer 4 — Integration (multi-component flows)         │
├────────────────────────────────────────────────────────┤
│  Layer 3 — Protocol (DHT, WebRTC, delegation messages) │
├────────────────────────────────────────────────────────┤
│  Layer 2 — Component (embedding, LSH, ANN, crypto)     │
├────────────────────────────────────────────────────────┤
│  Layer 1 — Unit (pure functions: cosine, LSH, scoring) │
├────────────────────────────────────────────────────────┤
│  Layer 0 — Browser Compatibility (WebCrypto, IndexedDB)│
└────────────────────────────────────────────────────────┘
```

Layers 0–2 ship in Phase 1. Layers 3–5 grow progressively through Phases 2–4.

---

## Key Metrics & KPIs

**Time-to-First-Match Definition**: Time from channel activation (embedding complete) to first match displayed in UI with similarity ≥ 0.70. Excludes model download time; includes DHT announce + query cycle.

| Category | Metric | Target (Phase 1) | Target (Phase 2) |
| :--- | :--- | :--- | :--- |
| **Matching** | Time-to-First-Match | <10s | <5s |
| **Matching** | Precision@10 (Semantic) | >0.7 | >0.85 |
| **Network** | Connection Success Rate | >90% | >95% |
| **Delegation** | Avg Response Latency | <1000ms | <500ms |
| **Delegation** | Verification Failure Rate | 0% | <1% (false positives) |
| **Resource** | Model Load Time (High Tier) | <3s | <2s |
| **Resource** | Memory Footprint (Idle) | <200MB | <150MB |
| **Safety** | Spam Announcement Rate | <5/hr | <1/hr (with rep) |

---

## Rate Limits

See [PROTOCOL.md](PROTOCOL.md#rate-limits) for the complete rate limit specification.

Test verification:

- DHT Announce: 5/min per peer
- Delegation Request: 3/min per peer
- Delegation Response: 10 concurrent per supernode
- Chat Dial: 20/hr per peer
- DHT Query: 30/min per peer

---

## Phase 0 — Browser Compatibility (Pre-Phase 1)

### 0.1 Web Crypto API Compatibility

| Browser | Test | Expected |
|---------|------|----------|
| Chrome 120+ | `crypto.subtle.generateKey('Ed25519')` | Success |
| Firefox 120+ | Same as above | Success |
| Safari 17+ | Same as above | Success |
| Chrome Android | Same as above | Success |
| Safari iOS 17+ | Same as above | Success |
| Firefox Private Browsing | Key generation + IndexedDB write | Fallback to sessionStorage with warning |
| Safari ITP | Key persistence across 7 days | Keys persist (first-party data exempt) |

### 0.2 IndexedDB Quirks

| Browser | Test | Expected |
|---------|------|----------|
| Chrome | Open DB, store embedding, retrieve after reload | Success |
| Firefox | Same as Chrome | Success |
| Safari | Same as Chrome | Success; handle `QuotaExceededError` gracefully |
| All browsers | DB version upgrade (v1 → v2) | Migration runs, data preserved |
| All browsers | Disk full scenario | Graceful degradation to in-memory cache only |

### 0.3 Navigator API Availability

| API | Test | Fallback |
|-----|------|----------|
| `navigator.hardwareConcurrency` | Undefined → default to 4 cores | Conservative tier assignment |
| `navigator.deviceMemory` | Undefined → default to 4GB | Conservative tier assignment |
| `navigator.connection` | Undefined or no `effectiveType` | Skip connection-based tier adjustment |
| `navigator.connection.saveData` | `true` detected | Defer model download until user action |

### 0.4 WebRTC NAT Type Detection

| NAT Type | Test Scenario | Expected |
|----------|---------------|----------|
| Full Cone | Direct P2P with STUN only | Connection succeeds |
| Restricted Cone | Direct P2P with STUN only | Connection succeeds |
| Port Restricted | Direct P2P with STUN only | Connection succeeds |
| Symmetric | P2P with STUN, then TURN fallback | TURN relay used; latency ≤ 200ms added |
| Corporate Firewall | Outbound WebRTC blocked | Graceful degradation: no P2P, local-only mode |
| Cellular (4G/5G) | NAT + high latency | Connection succeeds; adjust timeout expectations |

### 0.5 Web Worker Isolation

| Test | Scenario | Expected |
|------|----------|----------|
| Worker spawn | Embedding worker starts | No main thread jank (>16ms frame) |
| Worker termination | Channel deactivated | Worker terminated, memory released |
| Worker error | Model throws exception | Error caught, fallback triggered, no crash |
| Cross-origin worker | Worker loaded from CDN | Works with proper CORS headers |

---

## Phase 1 — Foundation (Q1–Q2 2026)

### 1.1 Unit Tests — Pure Math & Utilities

Zero-dependency, run instantly, form the immune system for the matching core.

#### Cosine Similarity

| Test | Input | Expected |
|------|-------|----------|
| Identical vectors | `[1,0,0]`, `[1,0,0]` | `1.0` |
| Orthogonal vectors | `[1,0,0]`, `[0,1,0]` | `0.0` |
| Opposite vectors | `[1,0,0]`, `[-1,0,0]` | `-1.0` |
| Near-zero vector | `[0,0,0.00001]`, `[1,0,0]` | graceful NaN/0 (no divide-by-zero crash) |
| 384-dim random unit vectors | seeded random pairs | score in `[-1, 1]` always |
| Batch consistency | `sim(a,b) === sim(b,a)` | symmetric |

#### LSH Hashing

**Ground Truth**: Use pre-computed vector fixtures from `tests/fixtures/embeddings/` for reproducibility.

| Test | Scenario | Expected |
|------|----------|----------|
| Determinism | Same `(vec, seed)` called twice | Identical hash string |
| Semantic space isolation | Same vec, different `modelHash` (seed) | Different hash (seeded RNG diverges) |
| Bucket proximity | Two similar vectors (cosine > 0.9) | Collision rate ≥ 0.7 across 20 hashes (95% CI) |
| Dissimilar vectors | Cosine ≈ 0.1 | Collision rate ≤ 0.2 across 20 hashes (95% CI) |
| Hash length | Any input | Output exactly 32 chars per hash |
| Relation prefix | `"in_location:<hash>"` | Prefix correctly prepended |
| Bucket distribution | 10,000 random vectors | Uniform distribution across hash space (χ² test p > 0.05) |
| Dot-product projection | Fixed input vector and seed | Bit string correctly reflects the sign of the dot product (mathematically verified) |
| Multiple Hashes | Multiple hashes requested | Function returns an array of unique string hashes of correct length |

#### Relational Matching Scorer

| Test | Scenario | Expected |
|------|----------|----------|
| Root-only alignment | No fused dists on either side | Returns root cosine score |
| Tag-match bonus | Matching `in_location` tags | Score ≥ equivalent score without tag bonus |
| Tag-mismatch | Different tags, similar vectors | Score = no bonus path |
| Weight scaling | Relation weight `2.0` vs `1.0` | Weighted score proportionally higher |
| Empty peer dists | Peer announces root only | Falls back to root-only comparison cleanly |
| Score normalization | Any valid input | Score always in `[0, 1]` |
| Spatiotemporal overlap | Two overlapping lat/long windows | Spatiotemporal bonus applied |
| No spatiotemporal overlap | 10,000 km apart | No bonus, no crash |

#### Monte Carlo Sampling

| Test | Scenario | Expected |
|------|----------|----------|
| Reproducibility | Seeded samples from `(μ, σ=0.1)` | Identical output given same seed |
| Spread = 0 | σ = 0 | All samples = μ (point distribution) |
| Large spread | σ = 1.0 | Sample mean ≈ μ within tolerance after 100 draws |
| High tier (100 samples) vs Low tier (20 samples) | Same distributions | Both converge; High tier closer to true score |

#### Signature Verification

| Test | Scenario | Expected |
|------|----------|----------|
| Valid signature | Correctly signed payload | `verifySignature()` returns `true` |
| Tampered payload | Bit-flip in `vec[0]` | `verifySignature()` returns `false` |
| Missing signature field | No `signature` key | Returns `false`, no crash |
| Wrong key | Payload signed by peer A, verified against peer B's key | Returns `false` |
| Replay detection | Same `requestID` seen twice | Second verification returns `false` |

---

### 1.2 Component Tests — Subsystems in Isolation

Each component runs with mocked I/O (no real network, no real model inference).

#### Embedding Pipeline (Stub Model)

Use a deterministic stub: map text → SHA-256 → reshape into 384-dim unit vector.

| Test | Scenario | Expected |
|------|----------|----------|
| Single embed | Text string → embedding | Shape `[384]`, L2 norm ≈ 1.0 (±0.01) |
| Relational composition | `computeRelationalDistributions(channel)` with 3 relations | Returns array of 4 distributions: 1 root + 3 fused |
| Max relations enforced | Channel with 6 relations | Throws or silently caps at 5 |
| Missing model | Model load fails | Graceful fallback to word-hash mode (bag-of-words hash) |
| Worker isolation | Embed called from Web Worker | No crash, correct result posted back |
| Caching | Same text embedded twice | Second call hits cache (IndexedDB stub), no recompute |
| Tier detection | `hardwareConcurrency=8, deviceMemory=8, connection='4g'` | `'high'` |
| Minimal trigger | `connection='2g'` | `'minimal'` |
| API unavailable | All navigator fields undefined | Defaults to `'low'` (conservative) |
| Manual override | User sets tier in Settings | Override persists across refresh |

#### Channel State Machine

| Test | Scenario | Expected |
|------|----------|----------|
| Create channel | `POST /channels` (or local API) | Saved to localStorage; `id` matches schema format `ch_*` |
| Activate channel | Set channel active | Announce loop starts; DHT put called |
| Deactivate channel | Set channel inactive | Announce loop stops; TTL expires naturally |
| Edit while active | Change description mid-announce | Recompute embedding; new DHT put within 5 s |
| Duplicate channel | Fork a channel | New `id`, same description/relations, independent announce loop |
| Archive channel | Archive an active channel | DHT entry withdrawn; channel persists in localStorage |
| 5-channel limit (UI) | Attempt to add 6th active channel | UI blocks; warning shown |
| Schema migration v1→v2 | Existing channels in old format | Migration runs, all fields preserved |

#### Rate Limiter

| Test | Scenario | Expected |
|------|----------|----------|
| Under limit | 4 DHT puts in 60 s | All pass |
| At limit | Exactly 5 DHT puts in 60 s | 5th passes; counter saturated |
| Over limit | 6th put in same minute | Blocked; logged |
| Window reset | 61 s after first put | Counter resets; next put passes |
| Supernode enforcement | Low-tier peer sends 11 requests/min to supernode | Supernode rejects excess |

---

### 1.3 Integration Tests — End-to-End Flows (Two-Peer Local)

Use **Playwright** to spin up multiple isolated browser contexts with real libp2p nodes on localhost.

#### Happy Path: Match and Chat

```
Peer A (High tier)  ─── embed "distributed systems, consensus" ───▶
Peer B (High tier)  ─── embed "Byzantine fault tolerance, Paxos" ──▶
                    ─── Both announce to shared in-memory DHT ─────▶
                    ─── A queries → B appears in ranked list ──────▶
                    ─── A dials B via /isc/chat/1.0 ────────────────▶
                    ─── Message exchange, delivery confirmed ────────▶
```

| Assertion | Expected |
|-----------|----------|
| Cosine sim(A, B) | ≥ 0.70 threshold |
| B in A's candidate list | Within first refresh cycle (≤ 30 s) |
| Chat message round-trip latency | ≤ 2 s (localhost) |
| No self-match | A never sees its own peerID |

#### Dissimilar Peers (No Match)

Peer A: "ceramics, fermentation" vs. Peer B: "high-frequency trading algorithms"

| Assertion | Expected |
|-----------|----------|
| Cosine sim | ≤ 0.55 |
| B not in A's match list | Filtered below threshold |
| No unsolicited chat dial | Neither peer dials the other |

#### Model Mismatch Rejection

Peer A announces with `model: "Xenova/all-MiniLM-L6-v2"`, Peer B with a spoofed `model: "fake-model-v1"`.

| Assertion | Expected |
|-----------|----------|
| B's announcement | Silently discarded at query refinement |
| A's match list | Empty (or only same-model peers) |
| No crash | True |

#### Signature Rejection

Peer A announces a tampered payload (valid structure, invalid signature).

| Assertion | Expected |
|-----------|----------|
| Peer B discards A's announcement | True |
| No error propagation | No crash in querying peer |

#### Group Chat Formation

Three peers (A, B, C) all embed semantically similar text.

| Assertion | Expected |
|-----------|----------|
| Each peer sees the others in ranked list | True |
| Mesh formed | All three dialed into group |
| Centroid key announced to DHT | True |
| Latecomer peer D (similar embedding) | Finds centroid key, joins group |

#### NAT Traversal Scenarios

| Test | Network Condition | Expected |
|------|-------------------|----------|
| Direct connection | Both peers on same LAN | P2P via local IPs |
| STUN only | Both peers behind residential NAT | P2P via STUN-discovered public IPs |
| TURN required | One peer behind symmetric NAT | Relay via TURN; latency ≤ 200ms added |
| Firewall blocked | Corporate network blocking WebRTC | Graceful degradation; queue messages for later |

---

### 1.4 Supernode Delegation Tests

#### Delegation Happy Path

Low-tier peer requests embedding from High-tier supernode.

| Step | Assertion |
|------|-----------|
| Low tier sends encrypted `delegate_request` | Request reaches supernode |
| Supernode returns signed `delegate_response` | Signature valid |
| Embedding norm | ≈ 1.0 (±0.01) |
| Model version in response | Matches canonical |
| Request ID matches | True |
| End-to-end latency | ≤ 5,000 ms |

#### Fallback Chain

| Scenario | Expected Behavior |
|----------|-------------------|
| No supernodes in DHT | Low tier falls back to `gte-tiny` locally |
| Supernode times out (5,001 ms) | Request aborted; local fallback triggered |
| Supernode returns invalid signature | Result discarded; local fallback triggered |
| Supernode returns wrong model hash | Result discarded; local fallback triggered |
| Supernode crashes mid-request | Reconnect attempted once; then local fallback |

#### Rate Limit Enforcement

| Scenario | Expected |
|----------|----------|
| 3 delegation requests/min | All served |
| 4th request within 60 s | Blocked at supernode; HTTP 429 equivalent |
| `maxConcurrent=5` hit | 6th concurrent request queued or rejected |

---

### 1.5 Performance Regression Tests

| Test | Metric | Budget | Fail Threshold |
|------|--------|--------|----------------|
| Model load (High tier) | Time to first embed | <2s | >3s |
| Model load (Low tier) | Time to first embed | <500ms | >1s |
| Memory heap (idle) | JS heap after 1hr | <150MB | >200MB |
| Memory heap (active) | JS heap after 1hr + 5 chats | <250MB | >350MB |
| Bundle size | Main JS bundle (gzipped) | <500KB | >600KB |
| Bundle size | Model file (cached) | <10MB | >12MB |
| IndexedDB growth | After 100 embeddings cached | <50MB | >100MB |

---

## Phase 2 — Scale & Safety (Q3–Q4 2026)

### 2.1 Network Simulation Framework

The simulation harness runs hundreds of virtual peers in a single Node.js process, sharing an in-memory DHT stub and deterministic embedding stubs.

#### Architecture

```javascript
// sim/harness.js
class NetworkSim {
  peers     = new Map();   // peerID → VirtualPeer
  dht       = new InMemoryDHT();
  clock     = new SimClock();  // virtual time; no real setTimeout

  addPeer(config)          // creates VirtualPeer with tier + description
  tick(ms)                 // advances clock; triggers announces, queries, decays
  injectChurn(rate)        // randomly disconnect peers
  injectPartition(peerIds) // isolate a subset
  getMatchGraph()          // returns adjacency matrix of all match scores
  getMetrics()             // returns P50/P95/P99 latency, connection rate, etc.
}
```

**Virtual Time Semantics**:

- Time dilation: 1 real second = 1000 virtual seconds (configurable)
- Async operations: Model inference = 100ms virtual; Network request = 50-500ms virtual (configurable distribution)
- All async operations use `SimClock.setTimeout()` for deterministic replay

#### Baseline Simulation Scenarios

| Scenario | Peers | Duration | Success Criteria |
|----------|-------|----------|-----------------|
| Dense cluster | 50 peers, 5 semantic topics | 10 min virtual | All peers find ≥ 1 match in ≤ 10 s |
| Sparse distribution | 50 peers, 50 unique topics | 10 min virtual | No false matches above 0.75 threshold |
| Mixed tiers | 20 High + 20 Mid + 10 Low | 10 min virtual | Low-tier peers delegated successfully |
| Phase 1 success gate | 50+ concurrent | 30 min virtual | < 5% connection failure; < 10 s median first-match |
| Flash crowd | 500 peers simultaneous | 5 min virtual | DHT stabilizes; bootstrap relay holds |
| LSH bucket overload | 200 peers, identical vector | 5 min virtual | `candidateCap` prevents flooding |

---

### 2.2 Relational Embedding Simulation

Test that compositional embeddings improve match precision over root-only matching.

#### Experiments

**Experiment A: Location Filtering Lift**

- 100 peers, all embedded "machine learning research"
- 50 in Tokyo (`in_location: lat:35.6895, long:139.6917`), 50 in Berlin
- Measure: % of Tokyo peers matched to other Tokyo peers vs. Berlin peers

Expected: Relational matching lifts within-city match rate by ≥ 20% vs root-only.

**Experiment B: Mood Separation**

- 40 peers, same topic "startup strategy"
- 20 with `with_mood: energetic and optimistic`, 20 with `with_mood: cautious and analytical`
- Measure: Intra-mood similarity vs. cross-mood similarity

Expected: Intra-mood score > cross-mood score on average.

**Experiment C: Tag-Match Bonus Calibration**

- Vary the 1.2× tag-match bonus from 1.0 to 2.0
- Measure: precision@5 for the match list
- Expected: Optimal bonus identified empirically; commit as default constant.

---

### 2.3 Reputation System Simulation

**Reputation Definition**: Score in [0, 1] computed from:

- Base score: 0.5 for all new peers
- Positive votes: +0.01 per successful chat (capped at +0.4)
- Negative votes: -0.05 per mute/report (capped at -0.5)
- Decay: 1% per simulated day offline
- Storage: Local IndexedDB + announced in DHT with TTL=24h

| Scenario | Setup | Expected |
|----------|-------|----------|
| Honest network | 100 peers, all normal | Reputation converges to uniform distribution |
| Sybil cluster | 10 sybil peers with fake mutual positive votes | Reputation gaming detected; sybil scores capped at 0.3 |
| Reputation decay | Peer goes offline for 30 simulated days | Score decays to baseline by half-life rule |
| Mute propagation | High-rep peer mutes spammer | Spammer deprioritized for peer's neighbors |

---

### 2.4 DHT Performance Benchmarks

| Benchmark | Metric | Target |
|-----------|--------|--------|
| Put throughput | DHT puts/sec (in-process) | ≥ 1,000 |
| Get latency (cold) | Time to first result | ≤ 50 ms |
| Get latency (warm) | Cached result | ≤ 5 ms |
| Stale entry cleanup | After TTL=300 s | Entries purged within 1 TTL cycle |
| Scale | 10,000 entries in DHT | Get still ≤ 100 ms |

---

### 2.5 Model Version Migration Simulation

Simulate the 90-day dual-announcement migration window.

**Migration Protocol**:

- Days 0-90: Peers announce both v1 and v2 vectors (dual-announce)
- Days 91+: v1 TTLs expire; v1-only peers isolated in compatibility shard

| Phase | Scenario | Expected |
|-------|----------|----------|
| Pre-migration | All peers on v1 | Normal matching |
| Migration start | 10% adopt v2; dual-announce enabled on High tier | v2 peers match each other; v1 peers see v1 peers |
| 50% migration | Clients show migration prompt | Prompt triggered for v1 peers |
| Post-migration (day 91) | v1 TTLs expire | v1 peers isolated in compatibility shard; v2 network intact |

---

### 2.6 Security Simulation

#### Malicious Supernode

A supernode returns plausible-looking but incorrect embeddings (adversarial perturbation).

| Test | Expected |
|------|----------|
| Local sanity check: norm deviation > 0.01 | Result discarded |
| Cross-check via local minimal model (optional flag) | Discrepancy detected; supernode flagged |
| Consistent bad responses (> 3 in a row) | Supernode deprioritized in selection |

#### Sybil Flood

An attacker creates 1,000 sybil peers all announcing proximity to a target peer.

| Test | Expected |
|------|----------|
| Target's match list | Not flooded (candidate cap + dedup enforced) |
| Rate limiter | Sybil announcements throttled at ≤ 5 puts/min per peerID |
| Phase 1 (trusted network) | Social invite barrier prevents most sybils at entry |

#### Replay Attack

Attacker captures a valid `delegate_request` and replays it 60 s later.

| Test | Expected |
|------|----------|
| `timestamp` check | Request older than 30 s rejected |
| `requestID` dedup | Second use of same UUID rejected |

---

### 2.7 Chaos Engineering Scenarios

| Scenario | Injection | Expected Behavior |
|----------|-----------|-------------------|
| Clock skew | Peer clock offset by ±60s | Timestamp validation rejects stale announcements |
| Partial DHT corruption | 10% of DHT entries have invalid hashes | Corrupted entries silently ignored; no crash |
| Model version skew | 50% of peers upgrade mid-simulation | Dual-announce activates; no network split |
| Cascading supernode failure | Kill 80% of supernodes at T+5min | Remaining supernodes absorb load; delegation latency spikes but succeeds |
| Memory pressure | Inject artificial heap limit | GC runs; degraded peers switch to minimal tier |
| Network partition | Isolate 30% of peers for 2min | Partition heals; DHT converges within 1 refresh cycle |

---

### 2.8 Simulation Fidelity Validation

**Purpose**: Validate that stub-based simulations accurately predict real-network behavior.

| Validation Test | Method | Pass Criteria |
|-----------------|--------|---------------|
| Stub vs. real embeddings | Run 20-peer simulation with real `transformers.js`; compare match quality to stub-based run | Match quality delta < 10% |
| Stub vs. real latency | Compare model inference time (stub: 0ms, real: ~100ms); verify timing adjustments compensate | First-match time delta < 20% |
| Stub vs. real memory | Compare heap growth (stub: minimal, real: ~150MB); verify memory budgets account for difference | Memory predictions within 25% of actual |
| Semantic validity | Verify stub vectors preserve relative similarity ordering (if sim(A,B) > sim(A,C) in real, same holds in stub) | Ordering preserved in ≥ 85% of triplets |

**Frequency**: Run weekly and before each Phase 2+ release. Flag divergence > 10% for investigation.

---

### 2.9 Known Gaps & Open Questions

These items are acknowledged as unresolved. Testing proceeds with current assumptions; updates will follow as designs mature.

| Gap | Status | Owner | Target Resolution |
|-----|--------|-------|-------------------|
| **Supernode incentives** | Game-theoretic mechanism TBD; testing assumes voluntary participation | Product/Design | Phase 2 Q3 |
| **Word-hash fallback spec** | Algorithm undefined; testing assumes bag-of-words hash exists | Engineering | Phase 1 Q2 |
| **Compatibility shard mechanics** | Cross-shard matching rules undefined; testing assumes isolation | Engineering | Phase 2 Q3 |
| **Candidate cap scope** | Clarified: per-query, per-channel | Engineering | Documented |
| **Reputation sybil resistance** | Test expects cap at 0.3; mechanism TBD | Product/Design | Phase 2 Q3 |
| **ZK proofs for delegation** | Future work; not required for Phase 2 | Research | Phase 3+ |

---

## Phase 3 — Social Layer (2027)

### 3.1 Feed Quality Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Semantic precision@10 | % of top-10 feed posts with sim ≥ 0.6 to active channel | ≥ 80% |
| Serendipity rate | % of feed posts from non-obvious semantic neighbors (sim 0.55–0.70) | 15–25% |
| Echo chamber score | Mean inter-post similarity within a user's feed | ≤ 0.85 (diversity maintained) |
| Chaos mode lift | Delta serendipity rate when chaos mode enabled | ≥ +10% |

### 3.2 Social Graph Simulation

| Scenario | Peers | Metric |
|----------|-------|--------|
| Organic follow growth | 500 peers, 30-day sim | Follow graph diameter ≤ 6 (small world) |
| Web of Trust convergence | Mutual-follow chains | Rep scores stabilize within 7 simulated days |
| Moderation event propagation | 1 report from high-rep peer | Propagates to ≥ 80% of network within 24 h sim |

### 3.3 Engagement Simulation

Validate that PubSub trending logic surfaces genuine high-engagement clusters.

| Test | Setup | Expected |
|------|-------|----------|
| Organic viral post | 30% of network engages with one post | Surfaces in Global Explore |
| Synthetic bot engagement | 50 sybil likes on a post | Does not surface (rep weighting discounts low-rep peers) |
| TTL expiry | Trending cluster from 48 h ago | No longer in Explore feed |

---

### 3.4 Accessibility Tests

| Test | Tool/Method | Target |
|------|-------------|--------|
| Screen reader navigation | NVDA (Windows), VoiceOver (macOS/iOS), JAWS (Windows) | All core flows navigable without sight |
| Keyboard-only navigation | Tab order, skip links, focus traps | WCAG 2.1 AA compliant |
| Color contrast | Automated (axe) + manual (dark/light themes) | WCAG 2.1 AA (4.5:1 minimum) |
| Focus indicators | Visual focus rings on all interactive elements | Visible at 3px minimum |
| ARIA labels | All icons and buttons have descriptive labels | 100% coverage |
| Dynamic text scaling | Browser zoom 200%, system font scaling | No layout breakage; content reflows |

### 3.5 Internationalization (i18n) Tests

| Test | Script/Locale | Expected |
|------|---------------|----------|
| Non-Latin embeddings | CJK (Chinese, Japanese, Korean) | Embeddings compute correctly; similarity meaningful |
| Non-Latin embeddings | Arabic, Persian | Embeddings compute correctly; RTL UI mirrors |
| Non-Latin embeddings | Cyrillic (Russian, Ukrainian) | Embeddings compute correctly |
| Non-Latin embeddings | Devanagari (Hindi, Marathi) | Embeddings compute correctly |
| RTL layout | Arabic, Hebrew UI | Full interface mirrors correctly |
| Locale formatting | Dates (YYYY-MM-DD vs MM/DD/YYYY) | User's locale respected |
| Locale formatting | Numbers (1,000.5 vs 1.000,5) | User's locale respected |
| Locale formatting | Plurals (1 message vs 2 messages) | Correct plural forms per locale |
| Text expansion | German, Finnish (long words) | UI accommodates 30% text expansion |

---

## Phase 4 — Ecosystem (2028+)

### 4.1 Interoperability Tests

| Test | Scope | Expected |
|------|-------|----------|
| AT Protocol bridge | ISC post → Bluesky DID-linked record | Record valid; resolvable via atproto |
| Vector import/export | Export channel distributions as JSON; re-import | Embeddings match within float precision |
| Cross-instance matching | Two ISC deployments (enterprise + public) | Semantic matching works if same model version |

### 4.2 Enterprise / Private Instance Tests

| Test | Scenario | Expected |
|------|----------|----------|
| Isolated DHT | Private instance has no public bootstrap peers | No leakage to public network |
| Cross-instance federation | Admin explicitly bridges two instances | Federated matching only for allowed channels |

---

### 4.3 Offline-First Tests

| Test | Scenario | Expected |
|------|----------|----------|
| Queue management | User sends 5 messages while offline; reconnects after 24h | All messages delivered in order on reconnect |
| Conflict resolution | Two peers edit same channel while offline; both reconnect | Last-write-wins with user notification; no data loss |
| Service Worker caching | App loaded offline after first visit | Shell loads; cached model available; DHT queries queued |
| IndexedDB resilience | Browser crashes mid-write; reload | Database recovers; no corruption |
| Background sync | User goes offline; returns to app after 1h | Pending announcements auto-retry; UI shows sync status |

### 4.4 Energy & Battery Tests

| Test | Device/Condition | Target |
|------|------------------|--------|
| Battery drain (active) | Mid-tier Android phone; 1hr active use | < 5% per hour |
| Battery drain (idle) | Mid-tier Android phone; background tab | < 1% per hour |
| Data usage (active) | 4G connection; 1hr active use | < 50MB per hour |
| Data usage (model download) | First load on cellular | < 25MB (cached thereafter) |
| Background tab throttling | Chrome/Firefox/Safari | CPU usage < 1% after 5min in background |
| Web Worker cleanup | Close channel; verify memory release | Heap decreases by ≥ 50MB within 30s |

---

## Continuous Optimization Loop

Once the simulation harness is in place (Phase 2), run the following as a scheduled optimization suite:

### Tunable Parameters

| Parameter | Current Default | Simulation Knob |
|-----------|----------------|-----------------|
| Match threshold | 0.75 | Sweep 0.60–0.90 in 0.05 steps |
| Tag-match bonus | 1.2× | Sweep 1.0–2.0 |
| LSH hash count | 20 (High) | Sweep 8–32 |
| Monte Carlo samples | 100 (High) | Sweep 20–200 |
| DHT candidate cap | 100 (High) | Sweep 20–200 |
| Refresh interval | 5 min (High) | Sweep 1–15 min |
| Supernode rate limit | 10 req/min | Sweep 5–30 |
| Spatiotemporal bonus weight | 0.5 | Sweep 0.1–1.0 |

### Optimization Objectives

For each parameter set, simulate 500-peer networks and record:

- **Median time-to-first-match** (minimize)
- **Connection failure rate** (minimize)
- **False-positive match rate** (dissimilar peers matched; minimize)
- **False-negative match rate** (similar peers missed; minimize)
- **DHT put bandwidth** (minimize)
- **Delegation success rate** (maximize)

Use a simple grid search first; add Bayesian optimization in Phase 3 when the search space grows.

---

## Test Infrastructure

### Tooling Recommendations

| Layer | Tool | Notes |
|-------|------|-------|
| Unit / component | Vitest | Fast, ESM-native; ideal for browser-targeted JS |
| Integration | Playwright | Two real browser tabs; real WebRTC |
| Simulation harness | Node.js + in-memory DHT stub | No browser needed; 1,000 virtual peers feasible |
| Coverage | c8 / Istanbul | Track which paths are exercised |
| Benchmarks | `tinybench` | Microbenchmarks for cosine, LSH, ANN |
| CI | GitHub Actions | Run units + component tests on every PR; simulations nightly |
| Network conditions | Toxiproxy | Inject latency/bandwidth limits between peer instances |
| Visualization | Deck.gl / D3 | Vector space and DHT heatmap dashboards |
| Memory profiling | Chrome DevTools Protocol | Heap snapshots in CI for regression detection |

### Directory Layout

```
tests/
├── unit/
│   ├── cosine.test.js
│   ├── lsh.test.js
│   ├── relational-match.test.js
│   ├── monte-carlo.test.js
│   └── signature.test.js
├── component/
│   ├── embedding.test.js
│   ├── tier-detection.test.js
│   ├── channel-state.test.js
│   └── rate-limiter.test.js
├── integration/
│   ├── two-peer-match.test.js
│   ├── group-chat.test.js
│   ├── delegation.test.js
│   └── model-mismatch.test.js
├── browser/
│   ├── webcrypto-compat.test.js
│   ├── indexeddb-quirks.test.js
│   ├── navigator-apis.test.js
│   └── webrtc-nat-types.test.js
├── accessibility/
│   ├── screen-reader.test.js       # NVDA, VoiceOver, JAWS
│   ├── keyboard-nav.test.js        # Tab order, skip links, focus traps
│   ├── color-contrast.test.js      # Automated + manual dark/light
│   └── wcag-audit.md               # Quarterly manual audit checklist
├── i18n/
│   ├── script-coverage.test.js     # CJK, Arabic, Cyrillic, Devanagari
│   ├── rtl-layout.test.js          # Arabic/Hebrew UI mirroring
│   └── locale-formatting.test.js   # Dates, numbers, plurals
├── offline/
│   ├── queue-management.test.js    # Message queuing during offline
│   ├── conflict-resolution.test.js # Reconnection after concurrent edits
│   └── service-worker-caching.test.js
├── simulation/
│   ├── harness/
│   │   ├── NetworkSim.js
│   │   ├── VirtualPeer.js
│   │   ├── InMemoryDHT.js
│   │   └── SimClock.js
│   ├── scenarios/
│   │   ├── dense-cluster.sim.js
│   │   ├── mixed-tiers.sim.js
│   │   ├── sybil-flood.sim.js
│   │   ├── model-migration.sim.js
│   │   └── fidelity-validation.sim.js  # Real embeddings vs stubs comparison
│   └── optimization/
│       └── parameter-sweep.js
├── performance/
│   ├── battery-drain.test.js       # Mobile: <5% per hour active use
│   ├── data-usage.test.js          # Mobile: <50MB per hour active use
│   └── memory-regression.test.js   # Heap snapshots for leak detection
├── fixtures/
│   ├── embeddings/          # pre-computed stub vectors + ground truth similarities
│   ├── channels/            # example channel JSON
│   └── keypairs/            # test ed25519 keypairs (never reuse in prod)
└── reports/
    ├── metrics/             # JSON exports of simulation runs
    └── traces/              # Structured logs with trace IDs
```

### Observability Requirements

**Structured Logging Format**:

```json
{
  "timestamp": "2026-03-09T12:34:56.789Z",
  "traceId": "abc123...",
  "spanId": "def456...",
  "peerId": "16Uiu2HAm...",
  "event": "dht_put",
  "duration_ms": 45,
  "success": true,
  "metadata": { "key": "isc:ch_abc123", "ttl": 300 }
}
```

**Metrics Export**: Prometheus-compatible endpoints for:

- `isc_delegation_latency_seconds` (histogram)
- `isc_match_quality_score` (histogram)
- `isc_dht_operations_total` (counter)
- `isc_memory_heap_bytes` (gauge)

**Trace ID Propagation**: All multi-peer flows carry `traceId` for debugging across simulation logs.

### Test Data Management

**Reproducible Peer IDs**:

```javascript
// Generate deterministic peer IDs for fixtures
const peerId = await generatePeerId(seed: number);
```

**Key Rotation**:

- Test keypairs rotated weekly via CI
- Old keypairs archived in `tests/fixtures/keypairs/archive/`
- Never reuse production key formats in tests

**Log Retention**:

- Simulation logs: 90 days
- CI test logs: 30 days
- Performance regression data: 1 year

---

## CI Pipeline Gates

| Gate | Runs On | Required to Merge |
|------|---------|------------------|
| Unit tests (all pass) | Every PR | ✅ Yes |
| Component tests (all pass) | Every PR | ✅ Yes |
| Browser compatibility (all browsers) | Every PR | ✅ Yes |
| Integration tests (happy path) | Every PR | ✅ Yes |
| Accessibility (keyboard nav, ARIA) | Every PR | ✅ Yes |
| i18n (non-Latin scripts) | Every PR | ✅ Yes |
| Integration tests (all paths) | Nightly | ⚠️ Blocks release |
| Simulation baseline (50 peers) | Nightly | ⚠️ Blocks release |
| Simulation fidelity validation | Weekly | ℹ️ Informational |
| Performance regression (memory, bundle) | Every PR | ✅ Yes |
| Battery/data usage tests | Weekly | ℹ️ Informational |
| Security checklist (manual) | Pre-merge for crypto/delegation PRs | ✅ Yes |
| Parameter sweep optimization | Weekly | ℹ️ Informational |

---

## Phase Exit Criteria

### Phase 1 → Phase 2 Gate

All of the following must pass:

- [ ] All unit tests green
- [ ] All component tests green
- [ ] All browser compatibility tests green (Chrome, Firefox, Safari, iOS, Android)
- [ ] Two-peer integration: happy path, model mismatch, signature rejection
- [ ] Supernode delegation: happy path, all five fallback scenarios
- [ ] Rate limiter: over-limit blocked, window resets correctly
- [ ] 50-peer simulation: < 5% connection failure; < 10 s median first-match
- [ ] Performance budgets met (memory, bundle size, model load time)
- [ ] No private keys logged anywhere in DevTools (manual audit)

### Phase 2 → Phase 3 Gate

All of the following must pass:

- [ ] 500-peer simulation: < 3% connection failure; < 5 s median first-match
- [ ] Sybil attack simulation: attack mitigated within 5 min
- [ ] Model migration simulation: no network split during 90-day window
- [ ] Reputation system: sybil gaming detected and capped
- [ ] Chaos scenarios: all six chaos injections handled gracefully
- [ ] DHT benchmarks: all targets met at 10,000 entry scale

### Phase 3 → Phase 4 Gate

All of the following must pass:

- [ ] Feed quality metrics: precision@10 ≥ 80%, echo chamber ≤ 0.85
- [ ] Social graph: diameter ≤ 6 after 30-day simulation
- [ ] Engagement simulation: bot engagement filtered successfully
- [ ] Interoperability: AT Protocol bridge functional
- [ ] Enterprise isolation: no leakage to public network

---

## Phase 1 Launch Readiness Checklist

Before trusted-network launch, all of the following must pass:

- [ ] All unit tests green
- [ ] All component tests green
- [ ] All browser compatibility tests green
- [ ] Two-peer integration: happy path, model mismatch, signature rejection
- [ ] Supernode delegation: happy path, all five fallback scenarios
- [ ] Rate limiter: over-limit blocked, window resets correctly
- [ ] 50-peer simulation: < 5% connection failure; < 10 s median first-match
- [ ] Performance budgets met
- [ ] Security checklist fully verified
- [ ] Tier detection tested on: Chrome desktop, Chrome Android, Safari iOS, Firefox desktop
- [ ] No private keys logged anywhere in DevTools (manual audit)
- [ ] Accessibility: screen reader navigation tested (NVDA, VoiceOver), keyboard-only flow tested
- [ ] i18n: Non-Latin scripts tested (CJK, Arabic, Cyrillic); RTL layout verified
- [ ] Offline: Queue management tested; reconnection after 24h offline successful
- [ ] Battery: Mobile battery drain < 5% per hour active use (measured on mid-tier device)

---

## Required README.md Updates

The test framework design has identified the following gaps and ambiguities in `README.md` that should be resolved:

### Critical (Block Phase 1 Launch)

| Section | Issue | Required Change |
|---------|-------|-----------------|
| **Device Tiers table** | "Word-hash fallback" undefined | Add spec: bag-of-words with predefined 500-word vocabulary; Hamming distance on word-presence bitmap |
| **Supernode Delegation** | Incentive mechanism vague | Clarify: Phase 1 relies on voluntary participation; Phase 2 adds reputation badges + priority queuing; Lightning tips are optional future work |
| **Model Version Negotiation** | "Compatibility shard" mechanics undefined | Specify: separate LSH bucket prefixes per model version; no cross-shard matching in Phase 1 |
| **Rate Limiting** | Multiple conflicting values | Consolidate into single table (already added to test.md); update README to match |
| **Safety section** | "Semantic filters" undefined | Specify: minimum similarity threshold (default 0.55) below which announcements are not returned |

### Important (Block Phase 2 Launch)

| Section | Issue | Required Change |
|---------|-------|-----------------|
| **Reputation System** | Gaming resistance mechanism TBD | Document: mutual signing requirement + time-weighted decay + 7-day bootstrapping period |
| **Compositional Embeddings** | Tier fallback for relations unclear | Specify: Low tier = root only; Mid tier = root + 2 relations (user-selected); High tier = all 5 |
| **Threat Model** | Browser compromise listed as "out of scope" | Add nuance: test for key extraction via XSS; recommend passphrase encryption for high-risk users |
| **Channel Schema** | No migration strategy | Add: schema version field; migration-on-read pattern for backward compatibility |

### Nice-to-Have (Documentation Improvements)

| Section | Issue | Suggested Change |
|---------|-------|------------------|
| **Getting Started** | No accessibility statement | Add: "ISC is designed for WCAG 2.1 AA compliance; report issues via GitHub" |
| **Tech Stack** | No i18n strategy | Add: "All user-facing strings externalized; community translations welcomed" |
| **Roadmap** | No offline-first mention | Add Phase 2 item: "Offline queue + background sync for intermittent connectivity" |
| **Security Checklist** | No accessibility review | Add: "Accessibility audit (NVDA, VoiceOver) completed" |

---

## Appendix A: Test Fixture Specifications

### A.1 Ground Truth Embeddings Format

```json
// tests/fixtures/embeddings/ground-truth.json
{
  "version": 1,
  "model": "Xenova/all-MiniLM-L6-v2",
  "phrases": [
    {
      "id": "phrase_001",
      "text": "distributed systems consensus",
      "embedding": [0.12, -0.07, 0.34, ...],  // 384 floats
      "norm": 1.0
    },
    {
      "id": "phrase_002",
      "text": "Byzantine fault tolerance",
      "embedding": [0.15, -0.05, 0.31, ...],
      "norm": 1.0
    }
  ],
  "similarity_pairs": [
    {
      "phrase_a": "phrase_001",
      "phrase_b": "phrase_002",
      "expected_cosine": 0.82,
      "tolerance": 0.05
    }
  ]
}
```

**Generation**: Run real `transformers.js` on canonical phrases; store results as reference.

### A.2 Test Keypair Format

```json
// tests/fixtures/keypairs/test-peer-001.json
{
  "peerId": "16Uiu2HAm...",
  "publicKey": "ed25519_pub_base64",
  "privateKey": "ed25519_priv_base64",
  "createdAt": "2026-03-09T00:00:00Z",
  "expiresAt": "2026-04-09T00:00:00Z",
  "note": "Test keypair #001 - rotate weekly"
}
```

**Security**: Never reuse test keypairs in production. Rotate weekly via CI.

### A.3 Keypair Rotation Schedule

```markdown
# Keypair Rotation Schedule

| Week | Keypair IDs | Action |
|------|-------------|--------|
| 2026-W11 | 001-010 | Initial generation |
| 2026-W12 | 011-020 | Archive 001-010; generate new |
| 2026-W13 | 021-030 | Archive 011-020; generate new |

**Archive location**: `tests/fixtures/keypairs/archive/YYYY-MM/`
**Retention**: 90 days
```

---

## Appendix B: WCAG 2.1 AA Audit Checklist

```markdown
# WCAG 2.1 AA Audit Checklist

**Last audit date**: YYYY-MM-DD
**Auditor**: [Name]
**Tools used**: axe-core, WAVE, manual testing

## Perceivable
- [ ] 1.1.1 Non-text Content: All images/icons have alt text
- [ ] 1.2.1 Audio-only: N/A (no audio-only content)
- [ ] 1.3.1 Info and Relationships: Semantic HTML used correctly
- [ ] 1.4.1 Use of Color: Color is not the only visual means of conveying information
- [ ] 1.4.3 Contrast (Minimum): Text has contrast ratio ≥ 4.5:1
- [ ] 1.4.4 Resize Text: Text scales to 200% without loss of content
- [ ] 1.4.10 Reflow: Content reflows at 320px width without horizontal scroll
- [ ] 1.4.11 Non-text Contrast: UI components have contrast ≥ 3:1

## Operable
- [ ] 2.1.1 Keyboard: All functionality available via keyboard
- [ ] 2.1.2 No Keyboard Trap: Focus can be moved away from any component
- [ ] 2.4.1 Bypass Blocks: Skip links provided
- [ ] 2.4.2 Page Titled: Page has descriptive title
- [ ] 2.4.3 Focus Order: Focus order preserves meaning and operability
- [ ] 2.4.4 Link Purpose (In Context): Link purpose can be determined from text
- [ ] 2.4.6 Headings and Labels: Headings and labels are descriptive
- [ ] 2.4.7 Focus Visible: Keyboard focus indicator is visible

## Understandable
- [ ] 3.1.1 Language of Page: Page language declared in HTML
- [ ] 3.1.2 Language of Parts: Language changes are marked
- [ ] 3.2.1 On Focus: No context change on focus
- [ ] 3.2.2 On Input: No context change on input
- [ ] 3.3.1 Error Identification: Input errors are identified and described
- [ ] 3.3.2 Labels or Instructions: Labels/instructions provided for input
- [ ] 3.3.3 Error Suggestion: Error suggestions provided where possible
- [ ] 3.3.4 Error Prevention (Legal, Financial, Data): Reversible submissions

## Robust
- [ ] 4.1.1 Parsing: Valid HTML with unique IDs
- [ ] 4.1.2 Name, Role, Value: ARIA used correctly
- [ ] 4.1.3 Status Messages: Status messages can be programmatically determined

## Screen Reader Testing
- [ ] NVDA (Windows): All core flows navigable
- [ ] VoiceOver (macOS): All core flows navigable
- [ ] VoiceOver (iOS): All core flows navigable
- [ ] JAWS (Windows): All core flows navigable

## Issues Found
| ID | Criterion | Description | Severity | Status |
|----|-----------|-------------|----------|--------|
|    |           |             |          |        |
```

---

## Appendix C: Trace ID Implementation Notes

**Phase 1 (Simulation only)**: Trace IDs used for debugging multi-peer flows in simulation logs.

**Phase 2+ (Real P2P)**: Trace ID propagation across WebRTC connections deferred pending libp2p custom protocol implementation.

**Format**:

```json
{
  "traceId": "abc123def456...",  // 128-bit UUID
  "spanId": "xyz789...",          // 64-bit span identifier
  "parentSpanId": "parent..."     // Optional parent span
}
```

---

## Immediate Next Steps (Week 1)

1. **Initialize Vitest Suite:** Set up unit tests for `computeRelationalDistributions` and `lshHash`.
2. **Build "Peer-in-a-Box":** Create a Node.js script that instantiates a libp2p node + embedding model without the UI, allowing rapid scripting of peer interactions.
3. **Model Hash Locking:** Implement the `model_version` check in the DHT announcement logic to prevent accidental cross-model matching during development.
4. **Security Baseline:** Run a static analysis scan on the Web Crypto API usage to ensure key storage is secure in IndexedDB.
5. **Create `sim-2-peers.spec.js`:** A Playwright script that opens two incognito contexts, navigates to `localhost:8080`, inputs similar text, and asserts a match appears on both screens.
6. **Create Ground Truth Fixtures:** Generate pre-computed embeddings for 50 canonical test phrases with known similarity scores.

---

*This plan is a living document. Each phase should add new scenarios based on what the previous phase reveals. The simulation harness is the most leveraged investment — build it right in Phase 2 and it pays dividends through Phase 4.*
