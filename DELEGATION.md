# ISC Supernode Delegation Specification

> **Purpose**: Detailed supernode architecture and delegation protocol.
>
> For an overview, see [README.md](README.md#supernode-delegation).

---

## Overview

ISC supports **capability-aware delegation**: high-tier peers optionally act as *supernodes* to assist Low/Minimal-tier peers with computationally expensive operations—without compromising decentralization or privacy.

### Delegation Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Low-Tier Peer  │────▶│   Supernode     │────▶│  DHT / Network  │
│  (Mobile)       │     │  (Desktop)      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ 1. Request assistance │                       │
        │    - Embed text       │                       │
        │    - Run ANN query    │                       │
        │    - Verify sigs      │                       │
        │◀──────────────────────│                       │
        │ 2. Receive results    │                       │
        │    - Encrypted        │                       │
        │    - Signed           │                       │
        │    - Locally verified │                       │
        ▼                       ▼                       ▼
```

---

## Supernode Requirements

### Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Bandwidth** | 10 Mbps up | 50+ Mbps up |
| **Uptime** | 4 hours/day | 12+ hours/day |
| **Storage** | 2 GB (model cache) | 10+ GB |

### Capability Advertisement

Supernodes broadcast signed `delegate_capability` announcements to DHT:

```json
{
  "type": "delegate_capability",
  "peerID": "12D3KooW...",
  "services": ["embed", "ann_query", "sig_verify"],
  "rateLimit": {
    "requestsPerMinute": 10,
    "maxConcurrent": 5
  },
  "model": "Xenova/all-MiniLM-L6-v2 @sha256:abc123",
  "uptime": 0.95,
  "signature": "ed25519_signature_here"
}
```

**Services**:

- `embed`: Compute embeddings for text
- `ann_query`: Run approximate nearest neighbor queries
- `sig_verify`: Verify signatures on behalf of low-tier peers

---

## Delegation Protocol

### 1. Secure Request

Low-tier peers encrypt requests with supernode's public key and sign with their own key:

```typescript
interface DelegateRequest {
  type: 'delegate_request';
  requestID: string;           // UUID v4
  service: 'embed' | 'ann_query' | 'sig_verify';
  payload: Uint8Array;         // Encrypted with supernode's public key
  requesterPubKey: Uint8Array; // Requester's ed25519 public key
  timestamp: number;
  signature: Uint8Array;       // Signed by requester
}
```

**Request encryption**:

```javascript
import sodium from 'libsodium-wrappers';

async function encryptForSupernode(
  plaintext: Uint8Array,
  supernodeEd25519PubKey: Uint8Array
): Promise<Uint8Array> {
  await sodium.ready;
  // Convert ed25519 signing key to x25519 encryption key
  const x25519PubKey = sodium.crypto_sign_ed25519_pk_to_curve25519(supernodeEd25519PubKey);
  return sodium.crypto_box_seal(plaintext, x25519PubKey);
}
```

*Note: Signatures use Web Crypto API (ed25519), while encryption uses libsodium-wrappers (sealed boxes). The ed25519 public key must be converted to x25519 before encryption.*

### 2. Verifiable Response

Supernodes return results with cryptographic proof:

```typescript
interface DelegateResponse {
  type: 'delegate_response';
  requestID: string;
  result: {
    embedding?: number[];
    matches?: PeerInfo[];
    valid?: boolean;
    model?: string;
    norm?: number;
  };
  supernodePubKey: Uint8Array;
  timestamp: number;
  signature: Uint8Array;  // Signed by supernode
}
```

### 3. Local Verification

Requesting peer verifies:

1. **Signature check**: Supernode signature matches advertised public key (via Web Crypto API)
2. **Embedding norm**: ‖embedding‖ ≈ 1.0 (±0.01 tolerance)
3. **Model version**: Matches expected canonical model
4. **Request ID**: Matches original request
5. **Optional cross-check**: Verify subset with local minimal model

```javascript
async function verifyDelegationResponse(
  response: DelegateResponse,
  expectedRequestID: string,
  expectedModel: string
): Promise<boolean> {
  // 1. Verify signature
  const validSig = await verify(
    encode(response.result),
    response.signature,
    response.supernodePubKey
  );
  if (!validSig) return false;

  // 2. Check request ID
  if (response.requestID !== expectedRequestID) return false;

  // 3. Verify embedding norm
  if (response.result.embedding) {
    const norm = Math.sqrt(
      response.result.embedding.reduce((sum, v) => sum + v * v, 0)
    );
    if (Math.abs(norm - 1.0) > 0.01) return false;
  }

  // 4. Check model version
  if (response.result.model !== expectedModel) return false;

  return true;
}
```

---

## Trust & Safety

### No Blind Trust

All delegated results are cryptographically signed and locally sanity-checked:

| Check | Purpose | Implementation |
|---|---|---|
| Signature verification | Prevent tampering | ed25519 verify |
| Norm check | Detect malformed embeddings | ‖v‖ ≈ 1.0 |
| Model match | Ensure compatibility | String comparison |
| Request ID match | Prevent replay attacks | UUID comparison |
| Cross-check (optional) | Catch malicious supernodes | Local minimal model |

### Reputation-Weighted Selection

Peers prefer supernodes with high `uptime` and positive interaction history:

```javascript
function scoreSupernode(cap: DelegateCapability, stats: SupernodeStats): number {
  return (
    cap.uptime * 0.4 +
    stats.successRate * 0.3 +
    stats.requestsServed24h / 1000 * 0.2 +
    (1 - cap.rateLimit.requestsPerMinute / 30) * 0.1
  );
}
```

### Sybil Resistance

- **7-day uptime history**: Supernodes must maintain 7-day uptime to be highly ranked
- **Opt-in stake**: Boosts visibility (Phase 2+)
- **Community flagging**: Anomalous behavior can be flagged by other peers

### Privacy Preserved

- **E2E encryption**: Requests encrypted with supernode's public key
- **Minimal exposure**: Only channel descriptions delegated—never raw chat content
- **No logging policy**: Supernodes expected to discard request contents after computing results

---

## Delegation Services

### Embed Service

Compute embedding for text:

```typescript
interface EmbedRequest {
  text: string;
  model: string;
}

interface EmbedResponse {
  embedding: number[];
  model: string;
  norm: number;
}

async function handleEmbedRequest(req: EmbedRequest): Promise<EmbedResponse> {
  const extractor = await pipeline('feature-extraction', req.model);
  const emb = await extractor(req.text, { pooling: 'mean', normalize: true });
  const embedding = Array.from(emb.data);
  
  return {
    embedding,
    model: req.model,
    norm: Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)),
  };
}
```

### ANN Query Service

Run approximate nearest neighbor search over the supernode's persistent, globally-updated HNSW index:

```typescript
interface ANNQueryRequest {
  query: number[];
  k: number;
  modelHash: string; // Ensure namespace isolation
}

interface ANNQueryResponse {
  matches: PeerInfo[];
  scores: number[];
}

// Supernodes continuously map DHT announcements into their local `globalHNSWIndex`
async function handleANNQueryRequest(req: ANNQueryRequest): Promise<ANNQueryResponse> {
  // Query against the supernode's pre-built view of the network
  const index = globalHNSWIndex.get(req.modelHash);
  const resultIndices = await queryIndex(index, req.query, req.k);

  const matches = resultIndices.map(i => index.getPeerInfo(i));
  
  return {
    matches,
    scores: matches.map(peer => relationalMatch(
      [{ type: 'root', mu: req.query, sigma: 0.1 }],
      [{ type: 'root', mu: peer.vec, sigma: 0.1 }]
    )),
  };
}
```

### Signature Verification Service

Verify signatures on behalf of low-tier peers:

```typescript
interface SigVerifyRequest {
  payload: Uint8Array;
  signature: Uint8Array;
  publicKey: Uint8Array;
}

interface SigVerifyResponse {
  valid: boolean;
}

async function handleSigVerifyRequest(req: SigVerifyRequest): Promise<SigVerifyResponse> {
  const valid = await verify(req.payload, req.signature, req.publicKey);
  return { valid };
}
```

---

## Configuration

### Peer Configuration

```javascript
const peerConfig = {
  tier: 'low',
  delegation: {
    enabled: true,
    preferLocal: true,         // Try local first, delegate only if needed
    trustedSupernodes: [],     // Optional: manually pinned supernode peerIDs
    maxDelegationsPerMinute: 3,
    maxResponseLatencyMs: 5000,
  },
  supernode: {
    enabled: false,            // Set true to serve others
    maxConcurrentRequests: 5,
    advertiseUptime: true,
  },
};
```

### Supernode Configuration

```javascript
const supernodeConfig = {
  services: ['embed', 'ann_query', 'sig_verify'],
  rateLimit: {
    requestsPerMinute: 10,
    maxConcurrent: 5,
  },
  resources: {
    maxMemoryMB: 4096,
    maxCpuPercent: 80,
  },
  incentives: {
    acceptTips: true,
    lightningAddress: 'supernode@getalby.com',
  },
};
```

---

## Delegation Health Metrics

Supernodes announce a `delegation_health` signal every 5 minutes:

```json
{
  "type": "delegation_health",
  "peerID": "12D3KooW...",
  "successRate": 0.98,
  "avgLatencyMs": 250,
  "requestsServed24h": 142,
  "timestamp": 1741400000,
  "signature": "ed25519_signature_here"
}
```

**Metrics**:

- `successRate`: Fraction of requests completed successfully (target: >0.95)
- `avgLatencyMs`: Average response latency (target: <500ms)
- `requestsServed24h`: Total requests served in last 24 hours

Peers use `successRate` and `avgLatencyMs` to select reliable supernodes. Metrics below 0.85 success rate trigger automatic deprioritization.

---

## Supernode Incentives

| Incentive Type | Description | Phase |
|----------------|-------------|-------|
| **Reputation badges** | Visible "Trusted Supernode" badge; boosts match priority | Phase 1 |
| **Priority queuing** | Supernodes receive faster ANN results from other supernodes | Phase 2 |
| **Optional tips** | Lightning Network micropayments for verified assistance | Phase 3 |
| **Governance weight** | High-rep supernodes carry more weight in moderation | Phase 2 |
| **Early feature access** | Beta features rolled out to active supernodes first | Phase 2 |

**Phase 1 note**: Initial deployment relies on **voluntary participation**. Community members running supernodes are motivated by altruism and improved match priority. Reputation badges provide social recognition.

---

## Error Handling

### Request Errors

| Error | Cause | Handling |
|---|---|---|
| `TIMEOUT` | Supernode unresponsive for >5s | Retry with different supernode |
| `INVALID_SIGNATURE` | Response signature invalid | Block supernode; report to network |
| `MODEL_MISMATCH` | Response uses wrong model | Discard; log for analytics |
| `RATE_LIMITED` | Exceeded supernode rate limit | Backoff; retry after 60s |
| `NO_SUPER NODES` | No supernodes available | Graceful degradation to local minimal model |

### Graceful Degradation

```javascript
async function delegateWithFallback(request: DelegateRequest): Promise<DelegateResponse> {
  const supernodes = await discoverSupernodes();
  
  for (const sn of supernodes.slice(0, 3)) {
    try {
      const response = await sendDelegationRequest(sn, request);
      if (await verifyDelegationResponse(response, request.requestID, LOCAL_MODEL)) {
        return response;
      }
    } catch (err) {
      console.warn(`Supernode ${sn.peerID} failed:`, err);
    }
  }
  
  // Fallback: use local minimal model
  return await handleLocally(request);
}
```

---

## Testing Supernode Delegation Locally

### Setup

1. **Start a supernode**:

   ```bash
   npx serve . --port 8080
   # Open http://localhost:8080?tier=high&supernode=true
   # Enable "Supernode Mode" in Settings → Delegation
   ```

2. **Start a low-tier client**:

   ```bash
   npx serve . --port 8081
   # Open http://localhost:8081?tier=low&delegate=true
   # Enable "Use Delegation" in Settings → Delegation
   ```

3. **Observe delegation**:
   - Low-tier client requests embedding assistance
   - Browser DevTools → Network tab shows encrypted delegation messages
   - Both peers should match semantically within 30 seconds
   - Verify in DevTools Console: `peer.delegation.stats`

4. **Test fallback**:
   - Close the supernode tab
   - Low-tier client should gracefully degrade to local minimal model

---

## Future Work

### ZK Proofs of Correct Computation

Future work: Zero-knowledge proofs enable supernodes to prove correct computation without revealing inputs:

```
Supernode computes: embedding = Model(text)
ZK proof proves: embedding was computed correctly
Verifier learns: nothing about text content
```

### Federated Learning

Supernodes could collaboratively fine-tune models on domain-specific data while preserving privacy via federated learning.

### Reputation Markets

Phase 3: Lightning Network integration enables micropayment markets for delegation services, creating economic incentives for high-quality supernode operation.
