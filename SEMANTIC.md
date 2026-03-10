# ISC Semantic Model Specification

> **Purpose**: Detailed embedding models, relational matching, and semantic geometry specifications.
>
> For an overview, see [README.md](README.md#semantic-model).

---

## Core Concept

ISC's semantic model achieves **full relational semantic expressivity** within browser constraints. Channels form a **relational hypergraph** where optional relation tags bind concepts compositionally into unified embedding manifolds.

**Key insight**: "AI ethics in Neo-Tokyo during 2026" is represented as a single discoverable embedding that differs geometrically from "Neo-Tokyo AI ethics" — the model captures directional binding.

---

## Relation Ontology

A fixed set of 10 predefined relation tags ensures network-wide interoperability:

| Tag | Meaning | Example Object |
|---|---|---|
| `in_location` | Spatiotemporal place | `lat:35.6895, long:139.6917, radius:50km` |
| `during_time` | Temporal window | `start:2026-01-01T00:00:00Z, end:2026-12-31T23:59:59Z` |
| `with_mood` | Emotional or tonal context | `reflective and cautious` |
| `under_domain` | Categorical scope or discipline | `machine learning, philosophy` |
| `causes_effect` | Causal link between subject and outcome | `increased automation → job displacement` |
| `part_of` | Compositional or hierarchical membership | `ethics → philosophy` |
| `similar_to` | Analogical tie | `neural networks → brain synapses` |
| `opposed_to` | Contrastive relation | `centralization ↔ decentralization` |
| `requires` | Dependency or prerequisite | `training → labeled data` |
| `boosted_by` | Amplification or modulation | `community feedback → improved models` |

**Rules**:

- Max 5 relations per channel (UI-enforced)
- Tags must come from the ontology above
- Objects are free-form text or structured strings for spatiotemporal relations
- The ontology is fixed for stability; community forks may extend in future major versions

---

## Compositional Embeddings

### Distribution Computation

For each channel, a set of distributions is computed locally:

```javascript
async function computeRelationalDistributions(channel: Channel): Promise<Distribution[]> {
  const extractor = await pipeline('feature-extraction', MODEL_FOR_TIER);
  
  // 1. Root distribution
  const rootEmb = await extractor(channel.description, { 
    pooling: 'mean', 
    normalize: true 
  });
  const dists: Distribution[] = [{
    type: 'root',
    mu: Array.from(rootEmb.data),
    sigma: channel.spread,
  }];

  // 2. Fused distributions for each relation
  for (const rel of channel.relations ?? []) {
    let obj = rel.object;
    
    // Structured formatting for spatiotemporal relations
    if (['in_location', 'during_time'].includes(rel.tag)) {
      const parsed = parseSpatiotemporal(rel.tag, obj);
      obj = `${obj} (${JSON.stringify(parsed)})`;
    }
    
    // Compose: "description tag object"
    const prompt = `${channel.description} ${rel.tag.replace('_', ' ')} ${obj}`;
    const emb = await extractor(prompt, { 
      pooling: 'mean', 
      normalize: true 
    });
    
    dists.push({
      type: 'fused',
      tag: rel.tag,
      mu: Array.from(emb.data),
      sigma: channel.spread / (rel.weight ?? 1.0),
      weight: rel.weight ?? 1.0,
    });
  }
  
  return dists;
}
```

### Tier Fallback for Relations

| Tier | Relations Announced |
|------|---------------------|
| **High** | All relations (max 5) |
| **Mid** | Root + up to 2 relations (user-selected) |
| **Low** | Root distribution only |
| **Minimal** | Root only (word-hash fallback) |

---

## Relational Matching

Matching uses bipartite alignment across the multi-vector hypergraph, evaluating the expected cosine similarity over Monte Carlo samples to account for distribution spread (σ):

```javascript
function relationalMatch(myDists: Distribution[], peerDists: Distribution[]): number {
  let score = 0;
  let totalWeight = 0;

  // Draw samples for distribution comparison
  const nSamples = TIER_SAMPLES[getTier()];

  // 1. Root alignment
  const myRootSamples = sampleFromDistribution(myDists[0].mu, myDists[0].sigma, nSamples);
  const peerRootSamples = sampleFromDistribution(peerDists[0].mu, peerDists[0].sigma, nSamples);

  let rootScore = 0;
  for (let s = 0; s < nSamples; s++) {
    rootScore += cosineSimilarity(myRootSamples[s], peerRootSamples[s]);
  }
  score += (rootScore / nSamples);
  totalWeight += 1;

  // 2. Fused alignments — best-match bipartite pairing
  for (let i = 1; i < myDists.length; i++) {
    let best = 0;
    const myFusedSamples = sampleFromDistribution(myDists[i].mu, myDists[i].sigma, nSamples);

    for (let j = 1; j < peerDists.length; j++) {
      const peerFusedSamples = sampleFromDistribution(peerDists[j].mu, peerDists[j].sigma, nSamples);

      let sampleSim = 0;
      for (let s = 0; s < nSamples; s++) {
         sampleSim += cosineSimilarity(myFusedSamples[s], peerFusedSamples[s]);
      }
      sampleSim /= nSamples;

      const adjustedSim = sampleSim * (myDists[i].tag === peerDists[j].tag ? 1.2 : 1.0);
      best = Math.max(best, adjustedSim);
    }
    
    // Spatiotemporal domain boost
    if (['in_location', 'during_time'].includes(myDists[i].tag)) {
      best += spatiotemporalSimilarity(myDists[i].tag, myDists[i], peerDists) * 0.5;
    }
    
    score += best * (myDists[i].weight ?? 1.0);
    totalWeight += (myDists[i].weight ?? 1.0);
  }

  return score / totalWeight;  // > 0.75 = match
}
```

### Spatiotemporal Similarity

```javascript
function spatiotemporalSimilarity(
  tag: string, 
  myDist: Distribution, 
  peerDists: Distribution[]
): number {
  const peerRel = peerDists.find(d => d.tag === tag);
  if (!peerRel) return 0;
  
  if (tag === 'in_location') {
    const myLoc = parseLocation(myDist);
    const peerLoc = parseLocation(peerRel);
    return locationOverlap(myLoc, peerLoc);
  }
  
  if (tag === 'during_time') {
    const myTime = parseTime(myDist);
    const peerTime = parseTime(peerRel);
    return timeOverlap(myTime, peerTime);
  }
  
  return 0;
}
```

### Monte Carlo Sampling

For High/Mid tier, distributions are sampled before scoring:

```javascript
function sampleFromDistribution(
  mu: number[],
  sigma: number,
  n: number,
  rng: () => number = Math.random
): number[][] {
  const samples: number[][] = [];
  for (let i = 0; i < n; i++) {
    const sample = mu.map(v => v + (rng() * 2 - 1) * sigma);
    // Normalize
    const norm = Math.sqrt(sample.reduce((sum, v) => sum + v * v, 0));
    samples.push(sample.map(v => v / norm));
  }
  return samples;
}

// Tier-specific sample counts
const TIER_SAMPLES = {
  high: 100,
  mid: 20,
  low: 1,      // Point match only
  minimal: 1,
};
```

---

## Embedding Standards

### Canonical Model Ladder

All models are available via `@xenova/transformers.js` / ONNX-WASM:

| Model (Xenova ID) | Dims | Size | Tier | Notes |
|---|---|---|---|---|
| `all-MiniLM-L6-v2` | 384 | 22 MB | **High (default)** | Best balance of speed, quality, consistency |
| `bge-small-en-v1.5` | 384 | 18 MB | High (alt) | Top retrieval benchmarks |
| `paraphrase-MiniLM-L3-v3` | 384 | 8 MB | **Mid** | Lighter, aligned with MiniLM family |
| `gte-tiny` | 384 | 4 MB | **Low** | Minimal compute fallback |
| Word-hash fallback | — | 0 MB | **Minimal** | No model; Hamming distance |

### Word-Hash Fallback Specification

For Minimal tier (no model download):

```javascript
const VOCABULARY = [
  'ai', 'ethics', 'technology', 'philosophy', 'science',
  // ... 500 common words total
];

function wordHash(text: string): Uint8Array {
  const words = text.toLowerCase().match(/\w+/g) ?? [];
  const bitmap = new Uint8Array(500);
  for (const word of words) {
    const idx = VOCABULARY.indexOf(word);
    if (idx !== -1) bitmap[idx] = 1;
  }
  return bitmap;
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    distance += a[i] ^ b[i];
  }
  return 1 - (distance / a.length);  // Normalize to [0, 1]
}
```

**Limitations**: English-only, no semantic nuance (synonyms not recognized).

---

## Model Version Negotiation

### Problem

Embedding spaces from different models are not directly comparable, even at identical dimensionality. Cross-model cosine scores are often arbitrary or near-random — matching degrades to noise.

### Solution

1. **Announcement field**: Every DHT entry includes model version with hash:

   ```json
   "model": "Xenova/all-MiniLM-L6-v2 @sha256:abc123def456"
   ```

2. **Compatibility groups**: Clients maintain a `supported_models` list. During query refinement, candidates with unsupported models are silently filtered.

3. **Graceful migration**: When a new canonical model is adopted:
   - Old-model peers continue operating in a "compatibility shard" (separate LSH bucket prefixes)
   - Dual-announcement mode (optional, High-tier only) allows peers to announce in both old and new spaces for 90 days
   - After 90 days, old-model announcements expire naturally via TTL
   - Clients show migration prompt when >50% of matches use newer model

4. **Community model registry**: A signed, DHT-hosted manifest lists approved model versions:

   ```json
   {
     "type": "model_registry",
     "canonical": "Xenova/all-MiniLM-L6-v2 @sha256:abc123",
     "deprecated": ["Xenova/all-MiniLM-L6-v2 @sha256:old456"],
     "migrationDeadline": 1772936000,
     "signature": "community_multisig_here"
   }
   ```

5. **Never mix models**: Cosine similarity is only meaningful within the same embedding space. Clients must never compute similarity across different model versions.

### Model Update Process

```
Community proposes new model
    ↓
30-day comment period
    ↓
Multisig signing by maintainers
    ↓
DHT registry update
    ↓
Clients auto-fetch on next launch
```

---

## Matching Continuity

ISC uses **approximate, ranked matching** — not discrete rooms:

| Aspect | How ISC Handles It | Degree of Continuity |
|---|---|---|
| Single vs. group chat | Starts 1:1; groups auto-form on density | High — can stay 1:1 forever |
| Match discovery | Ranked list from ANN re-rank | Very high — full gradient of proximity |
| Joining conversations | Direct dial or centroid-based room join | Medium-high — rooms are opt-in |
| Seeing loose neighbors | Yes, via ranked candidates (top-k beyond groups) | High — explicit support for approximates |
| Dynamic repositioning | Edit channel → instant re-query/announce | Very high — thoughts aren't locked |
| Cross-topic serendipity | Chaos mode + spread slider + distribution matching | High — encourages fuzzy orbits |

### Similarity Thresholds

Configurable thresholds:

| Range | Label | UI Treatment |
|---|---|---|
| 0.85+ | Very Close | Highlighted; auto-dial enabled |
| 0.70–0.85 | Nearby | Standard list entry |
| 0.55–0.70 | Orbiting | Dimmed; manual dial required |
| <0.55 | Distant | Filtered out by default |

---

## Cosine Similarity

```javascript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dot / denominator;
}
```

**Properties**:

- Range: [-1, 1] (1 = identical direction, 0 = orthogonal, -1 = opposite)
- Invariant to vector magnitude (only direction matters)
- Standard metric for embedding similarity

---

## ANN (Approximate Nearest Neighbor) Index

### HNSW via usearch (High Tier / Supernodes)

High-tier peers and Supernodes maintain a persistent, continuously-updated HNSW index of the global network state observed via the DHT. This allows them to perform extremely fast, broad queries for themselves and delegating peers.

```javascript
import { Index } from 'usearch-wasm';

// Initialized at startup and persisted/updated as DHT announcements arrive
const globalHNSWIndex = await Index({
  metric: 'cos',
  ndim: 384,
  connectivity: 16,
  expansionAdd: 200,
  expansionSearch: 50,
});

async function queryIndex(query: number[], k: number): Promise<number[]> {
  const results = globalHNSWIndex.search(query, k);
  return results.map(r => r.key);
}
```

### Linear Scan (Mid/Low/Minimal Tier)

```javascript
function linearScan(candidates: PeerInfo[], query: number[], k: number): number[] {
  const scored = candidates.map(peer => ({
    peer,
    score: cosineSimilarity(query, peer.vec),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(s => s.peer);
}
```

---

## Spatiotemporal Parsing

### Location Parsing

```javascript
interface Location {
  lat: number;
  long: number;
  radius: number;  // in km
}

function parseLocation(dist: Distribution): Location {
  const match = dist.mu.match(/lat:([-\d.]+),\s*long:([-\d.]+),\s*radius:(\d+)km/);
  if (!match) throw new Error('Invalid location format');
  return {
    lat: parseFloat(match[1]),
    long: parseFloat(match[2]),
    radius: parseInt(match[3]),
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function locationOverlap(a: Location, b: Location): number {
  const distance = haversineDistance(a.lat, a.long, b.lat, b.long);
  const maxRadius = Math.max(a.radius, b.radius);
  return Math.max(0, 1 - (distance / (maxRadius * 2)));
}
```

### Time Parsing

```javascript
interface TimeWindow {
  start: Date;
  end: Date;
}

function parseTime(dist: Distribution): TimeWindow {
  const match = dist.mu.match(/start:([^,]+),\s*end:([^)]+)/);
  if (!match) throw new Error('Invalid time format');
  return {
    start: new Date(match[1]),
    end: new Date(match[2]),
  };
}

function timeOverlap(a: TimeWindow, b: TimeWindow): number {
  const overlap = Math.max(0, Math.min(a.end.getTime(), b.end.getTime()) 
                         - Math.max(a.start.getTime(), b.start.getTime()));
  const total = Math.max(a.end.getTime(), b.end.getTime()) 
              - Math.min(a.start.getTime(), b.start.getTime());
  return total > 0 ? overlap / total : 0;
}
```
