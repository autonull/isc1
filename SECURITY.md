# ISC Security Specification

> **Purpose**: Detailed threat model, safety mechanisms, privacy guarantees, and authenticity protocols.
>
> For an overview, see [README.md](README.md#security--safety).

---

## Overview

ISC achieves strong authenticity, safety, and privacy properties by building on its fully browser-based, P2P architecture. It starts with structural advantages over centralized platforms:

- No central server collecting data
- No persistent profiles beyond user-controlled local storage
- Ephemeral announcements (TTLs prevent long-term tracking)
- E2E encryption for all communications

The design is inspired by **Nostr** (cryptographic authenticity, censorship resistance, relay resilience), adopting its best elements while extending them with ISC's vector-space primitives.

---

## Authenticity

### Built-in (Libp2p Baseline)

- **Libp2p peer IDs**: Cryptographic identity via Noise protocol + ed25519 keys
- **Authenticated announcements**: All DHT announcements signed with private key
- **Encrypted streams**: WebRTC DTLS secures all chat communications

### User Keypairs

On first launch:

```javascript
import { generateKeypair } from '@isc/core';

// Generate ed25519 keypair via Web Crypto API
const keypair = await generateKeypair();

// Public key = user's persistent "ISC identity" (like Nostr's npub)
const userID = await toBase58(keypair.publicKey);

// Private key stored in IndexedDB, optionally encrypted with passphrase
await storage.set('keypair', {
  publicKey: keypair.publicKey,
  privateKey: await encryptPrivateKey(keypair.privateKey, passphrase),
});
```

### Signed Announcements

Every DHT announcement is signed. See [PROTOCOL.md](PROTOCOL.md#announcement-payload) for the complete `SignedAnnouncement` interface.

### Signed Posts

All social-layer content carries signatures. See [SOCIAL.md](SOCIAL.md#post-schema) for the complete `SignedPost` interface.

---

## Safety

### Structural Baseline

| Property | Benefit |
|---|---|
| **Ephemeral TTLs** | Announcements expire; no long-term tracking |
| **No persistent profiles** | Nothing to scrape or dox |
| **WebRTC DTLS** | E2E encryption for all chat streams |

### Deployment Modes

ISC supports three deployment modes with different safety assumptions. See [README.md](README.md#deployment-modes) for the complete specification.

**Trusted Network (Phase 1):** Pre-existing social trust, rate limiting + mute/block + semantic filters

**Federated Networks (Phase 2):** Interconnected communities; reputation bridges

**Public Network (Phase 2+):** Open participation, reputation weighting + stake signaling + coherence checks + decentralized moderation

---

## Implemented Mechanisms (Trusted Network Mode)

### Rate Limiting

Rate limits prevent spam and abuse. See [PROTOCOL.md](PROTOCOL.md#rate-limits) for the complete specification of layered bounds on DHT activity and WebRTC connections.

### Mute / Block Lists

See [PROTOCOL.md](PROTOCOL.md#moderation-protocol) for the `MuteEvent` interface.

Signed mute events stored in DHT at `/isc/mute/<peerID>`. Clients fetch and cache muted peers locally. Auto-filter flagged peers from match results.

### Semantic Filters

- **Minimum similarity threshold**: Default 0.55 cosine similarity
- **Per-channel controls**: Users define their own "safe zone"
- **Announcements below threshold**: Not returned to users

### Harassment Exit

- **Auto-decay**: Chats exit naturally when similarity drops below threshold (thought drift)
- **One-click mute**: With propagation to connected peers
- **No forced interactions**: Users always control who can contact them

---

## Planned Mechanisms (Public Network Mode — Phase 2)

### Reputation Weighting

See [SOCIAL.md](SOCIAL.md#web-of-trust) for the `ReputationScore` interface.

Peers accumulate reputation via successful interactions. Low-rep announcements deprioritized in ANN results. Reputation decays with 30-day half-life.

**Sybil resistance**:

- Mutual signing requirement (both parties confirm interaction)
- Time-weighted decay
- 7-day bootstrapping period for new peers

### Reputation Score Calculation

**Formula**:

```
R(t) = R₀ × e^(-λt) + Σ(interaction_delta × e^(-λ(t - t_interaction)))

Where:
- R(t) = reputation at time t
- R₀ = initial reputation (0.5 for new peers)
- λ = ln(2) / 30 days = 0.0231 per day (decay constant)
- t = time since last activity (days)
- interaction_delta = +0.1 for successful interaction, -0.2 for flagged interaction
```

**Implementation**:

```javascript
function calculateReputation(interactions: Interaction[], now: number): number {
  const lambda = Math.log(2) / 30;  // 30-day half-life
  const baseReputation = 0.5;

  let reputation = baseReputation;
  for (const interaction of interactions) {
    const ageDays = (now - interaction.timestamp) / (1000 * 60 * 60 * 24);
    const delta = interaction.successful ? 0.1 : -0.2;
    reputation += delta * Math.exp(-lambda * ageDays);
  }

  return Math.max(0, Math.min(1, reputation));  // Clamp to [0, 1]
}
```

**Decay Calculation**: Run every 24 hours for all active peers.

### Stake-Based Signaling (Opt-In)

See [SOCIAL.md](SOCIAL.md) for complete stake-based signaling specification.

Users may lock Lightning satoshis as sybil-resistance signal. Slashed on verified abuse. Never required for basic use.

### Semantic Coherence Checks

```javascript
function checkCoherence(announcement: SignedAnnouncement): boolean {
  const descriptionEmbed = await embed(announcement.channelDescription);
  const vecDistance = cosineSimilarity(descriptionEmbed, announcement.vec);
  
  // Announcements with embeddings far from stated description are flagged
  return vecDistance > 0.4;  // Threshold configurable
}

// Flagged announcements reviewed by high-rep supernodes
```

### Decentralized Moderation

See [PROTOCOL.md](PROTOCOL.md#moderation-protocol) for the `ReportEvent` and `MuteEvent` interfaces.

Signed reports stored in DHT. Clients weight reports by reporter reputation. No central moderation team; safety emerges from network geometry.

---

## Privacy

### Built-in Baseline

| Property | Implementation |
|---|---|
| **No central servers** | All data lives locally or traverses P2P |
| **Vector-only announcements** | Only vectors + peerID announced publicly |
| **Raw text never broadcast** | Unless user explicitly posts |
| **E2E encrypted chats** | WebRTC DTLS + Noise protocol |
| **Sealed Box Encryption** | Libsodium `crypto_box_seal` (requires converting Web Crypto `ed25519` keys to `x25519` using `crypto_sign_ed25519_pk_to_curve25519`) |

### Enhanced Capabilities

#### Ephemeral Keys

```javascript
// Optional throwaway keypairs per session or channel
async function createEphemeralIdentity(): Promise<Keypair> {
  const keypair = await generateKeypair();
  // No persistent npub linkage
  return keypair;
}
```

#### IP Protection

- **Libp2p circuit relays**: Obfuscate direct IPs
- **Public STUN/TURN fallbacks**: NAT traversal without IP leakage
- **Optional Tor / I2P routing**: Community libp2p transport plugins for high-privacy users

#### Metadata Minimization

- **Vector-only announcements**: Raw text revealed only in direct WebRTC chats
- **No cross-session tracking**: Without explicit follows
- **Plausible deniability**: Channel spread (σ) adds deliberate fuzz to announced position

#### Data Sovereignty

```javascript
// Users control full export/delete of all local data
async function exportUserData(): Promise<UserDataExport> {
  return {
    keypair: await storage.get('keypair'),
    channels: await storage.get('channels'),
    history: await storage.get('chat_history'),
    follows: await storage.get('follows'),
  };
}

async function deleteAllData(): Promise<void> {
  await indexedDB.deleteDatabase('isc');
  localStorage.clear();
}
```

### Key Backup & Recovery

**Social Recovery (Shamir's Secret Sharing)**:

1. Split private key into N shards (threshold K required)
2. Distribute shards to trusted peers
3. Recovery: Collect K shards, reconstruct key
4. Parameters: N=5, K=3 (any 3 of 5 friends can recover)

**Encrypted Cloud Backup**:

1. Encrypt private key with user passphrase (PBKDF2, 100k iterations)
2. Upload to user's cloud storage (iCloud, Google Drive, Dropbox)
3. Recovery: Download, decrypt with passphrase

**Hardware Key Support**:

1. Store private key on YubiKey / hardware wallet
2. Sign operations via hardware key API
3. Key never leaves hardware device

**Key Rotation**:

1. Generate new keypair
2. Re-encrypt all stored data with new key
3. Re-sign all announcements with new key
4. Announce key rotation to DHT (signed by old key)
5. Grace period: 30 days (both keys accepted)

#### Delegation Privacy

| Guarantee | Implementation |
|---|---|
| **Request encryption** | Encrypted with supernode's public key |
| **Minimal exposure** | Only channel descriptions delegated (never chat messages) |
| **Per-channel control** | Users can disable delegation via Settings |
| **No logging policy** | Supernodes expected to discard request contents after computation |
| **Future: ZK proofs** | Verification without revealing inputs |

---

## Analytics & Monitoring

**Optional Telemetry** (opt-in, privacy-preserving):

- Metrics: Time-to-first-match, connection success rate, delegation latency
- Aggregation: Daily aggregates, no individual tracking
- Anonymization: Differential privacy (ε=1.0)
- Export: Public dashboard (metrics.isc.network)

**Performance Metrics** (local, always-on):

- Model load time
- DHT query latency
- Match quality (similarity distribution)
- Available in DevTools Console

**Error Reporting** (opt-in):

- Stack traces (no PII)
- Context: Browser version, device tier, network state
- Aggregation: Frequency analysis, no individual tracking
- Export: GitHub Issues auto-filing for critical errors

**Privacy Guarantees**:

- No raw text or vectors transmitted
- No peer IDs in telemetry (hashed with daily salt)
- User can export/delete telemetry data
- User can disable telemetry at any time

## Threat Model

ISC operates under the following security assumptions:

| Threat | Assumption | Mitigation (Phase 1: Trusted) | Mitigation (Phase 2+: Public) |
|--------|------------|-------------------------------|-------------------------------|
| **Malicious supernodes** | Honest-but-curious; may log requests or return incorrect embeddings | Local sanity checks + trusted operator selection | + Reputation weighting + optional SNARK proofs (future) |
| **DHT bootstrap peers** | Not actively adversarial; may go offline | Multiple bootstrap peers; graceful reconnect | Same |
| **Sybil attackers** | Can create many identities | Social trust barrier (invite-only) | Reputation decay + uptime history + opt-in stake |
| **Network eavesdroppers** | Can observe traffic patterns but not decrypt content | WebRTC DTLS + Noise protocol + E2E encryption | Same |
| **Browser compromise** | XSS vulnerabilities possible; IndexedDB accessible | Passphrase encryption for private keys (optional) | Same + hardware wallet integration (future) |
| **Model poisoning** | Attacker distributes malicious embedding model | Canonical model registry (DHT-hosted, signed) | Same |
| **Reputation gaming** | Attacker creates fake positive interactions | N/A (reputation not yet enabled) | Mutual signing + time-weighted decay |

---

## Explicitly Out of Scope

| Threat | Rationale |
|---|---|
| **Browser zero-day exploits** | Mitigated by regular dependency updates |
| **User key compromise without passphrase** | Mitigated by optional passphrase encryption |
| **Physical device theft** | User responsibility; future: hardware key support |
| **Government-level traffic correlation** | Tor/I2P integration mitigates but doesn't eliminate |

---

## Security Review Checklist

Before merging delegation-related or cryptographic PRs, ensure:

- [ ] All delegated responses are cryptographically signed (ed25519)
- [ ] Local verification logic has unit tests for edge cases (invalid sigs, malformed embeddings, timeout)
- [ ] Rate limiting is enforced on both request and response paths
- [ ] Fallback behavior is tested (no supernodes available, network partition)
- [ ] Memory usage is bounded (no unbounded request queues; max 100 pending delegations)
- [ ] Encryption keys are never logged or exposed in DevTools
- [ ] Model version checks prevent cross-model similarity computation
- [ ] Reputation system (if applicable) resists Sybil attacks (mutual signing, decay)
- [ ] DHT announcements include TTL and are signed
- [ ] WebRTC streams use DTLS encryption (verify via browser DevTools)
- [ ] Accessibility audit (NVDA, VoiceOver) completed
- [ ] Browser compromise mitigations: XSS testing completed; passphrase encryption recommended for high-risk users

**PRs failing any checklist item will be rejected without review.**

---

## Comparison with Other Platforms

| Aspect | ISC | Nostr | X (Centralized) |
|---|---|---|---|
| **Authenticity** | Keypair signing + libp2p | Keypair signing | Platform verification |
| **Safety** | Layered anti-spam + semantic filters + mutes | Client-side + propagation | Central bans + biases |
| **Privacy** | No servers; optional Tor; ephemeral keys | Public-by-default; Tor mitigable | Full surveillance |
| **Censorship resistance** | DHT + WebRTC; no deplatforming | Relay-based; resilient | Platform-controlled |

---

## Key Management Best Practices

### For Users

1. **Enable passphrase encryption** in Settings (high-risk users)
2. **Backup your keypair** via Settings → Export
3. **Use ephemeral keys** for sensitive channels
4. **Rotate keys periodically** if concerned about compromise

### For Developers

1. **Never log private keys** or raw encryption material
2. **Use Web Crypto API** for all cryptographic operations
3. **Clear sensitive data** from memory after use
4. **Implement secure key derivation** for passphrase encryption
5. **Test XSS vectors** thoroughly; IndexedDB is accessible to malicious scripts

---

## Incident Response

### Key Compromise

1. User generates new keypair
2. User announces key rotation via signed message from old key (if possible)
3. User updates follows/mutes under new identity
4. Old key is marked as compromised in local cache

### Supernode Misbehavior

1. Peer detects invalid/malicious response
2. Peer blocks supernode locally
3. Peer broadcasts signed report to DHT
4. High-rep peers review; if confirmed, supernode is deprioritized network-wide

### Model Poisoning Attempt

1. Client detects unknown model hash in announcement
2. Client discards announcement; logs for analytics
3. If widespread, community proposes model registry update
4. Clients auto-update on next launch
