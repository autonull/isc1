import { Distribution } from './semantic.js';
import { sampleFromDistribution, analyticDistributionMatch } from './sampling.js';
import { cosineSimilarity } from './math.js';

// Tier-specific sample counts
const TIER_SAMPLES = {
  high: 100,
  mid: 20,
  low: 1,      // Point match only
  minimal: 1,
};

/**
 * Parses spatiotemporal location string into a structured object.
 * e.g., "lat:35.6895, long:139.6917, radius:50km"
 */
export interface Location {
  lat: number;
  long: number;
  radius: number; // in km
}

export function parseLocation(objectStr: string): Location | null {
  const match = objectStr.match(/lat:([-\d.]+),\s*long:([-\d.]+),\s*radius:(\d+)km/);
  if (!match) return null;
  return {
    lat: parseFloat(match[1]),
    long: parseFloat(match[2]),
    radius: parseInt(match[3], 10),
  };
}

/**
 * Calculates Haversine distance between two coordinates in km.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function locationOverlap(a: Location, b: Location): number {
  const distance = haversineDistance(a.lat, a.long, b.lat, b.long);
  const maxRadius = Math.max(a.radius, b.radius);
  if (maxRadius === 0) return distance === 0 ? 1 : 0;
  return Math.max(0, 1 - (distance / (maxRadius * 2)));
}

/**
 * Parses spatiotemporal time string into a structured object.
 * e.g., "start:2026-01-01T00:00:00Z, end:2026-12-31T23:59:59Z"
 */
export interface TimeWindow {
  start: Date;
  end: Date;
}

export function parseTime(objectStr: string): TimeWindow | null {
  const match = objectStr.match(/start:([^,]+),\s*end:([^)]+)/);
  if (!match) return null;
  return {
    start: new Date(match[1]),
    end: new Date(match[2]),
  };
}

export function timeOverlap(a: TimeWindow, b: TimeWindow): number {
  const startA = a.start.getTime();
  const endA = a.end.getTime();
  const startB = b.start.getTime();
  const endB = b.end.getTime();

  const overlap = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  const total = Math.max(endA, endB) - Math.min(startA, startB);

  if (total <= 0) return 0;
  return overlap / total;
}

/**
 * Calculates a spatiotemporal similarity boost (0.0 to 1.0)
 */
export function spatiotemporalSimilarity(
  tag: string,
  myDist: Distribution,
  peerDists: Distribution[]
): number {
  if (!myDist.object) return 0;

  const peerRel = peerDists.find(d => d.tag === tag);
  if (!peerRel || !peerRel.object) return 0;

  if (tag === 'in_location') {
    const myLoc = parseLocation(myDist.object);
    const peerLoc = parseLocation(peerRel.object);
    if (myLoc && peerLoc) {
      return locationOverlap(myLoc, peerLoc);
    }
  }

  if (tag === 'during_time') {
    const myTime = parseTime(myDist.object);
    const peerTime = parseTime(peerRel.object);
    if (myTime && peerTime) {
      return timeOverlap(myTime, peerTime);
    }
  }

  return 0;
}

/**
 * Computes a bipartite relational matching score between two sets of channel distributions.
 * Evaluates the expected cosine similarity over Monte Carlo samples to account for distribution spread.
 *
 * @param myDists User's channel distributions (index 0 is root)
 * @param peerDists Peer's channel distributions (index 0 is root)
 * @param tier Device tier (defaults to 'high')
 * @param mode Evaluation mode (defaults to 'monte_carlo')
 * @returns Score between 0.0 and 1.0
 */
export function relationalMatch(
  myDists: Distribution[],
  peerDists: Distribution[],
  tier: 'minimal' | 'low' | 'mid' | 'high' = 'high',
  mode: 'monte_carlo' | 'analytic' = 'monte_carlo'
): number {
  if (!myDists.length || !peerDists.length) return 0;

  let score = 0;
  let totalWeight = 0;

  // 1. Root alignment (Required)
  let rootScore = 0;
  if (mode === 'analytic') {
    rootScore = analyticDistributionMatch(
      myDists[0].mu, myDists[0].sigma,
      peerDists[0].mu, peerDists[0].sigma
    );
  } else {
    const nSamples = TIER_SAMPLES[tier];
    const myRootSamples = sampleFromDistribution(myDists[0].mu, myDists[0].sigma, nSamples);
    const peerRootSamples = sampleFromDistribution(peerDists[0].mu, peerDists[0].sigma, nSamples);

    for (let s = 0; s < nSamples; s++) {
      rootScore += cosineSimilarity(myRootSamples[s], peerRootSamples[s]);
    }
    rootScore /= nSamples;
  }

  score += rootScore;
  totalWeight += 1;

  // 2. Fused alignments — best-match bipartite pairing
  // Compare each of our relations against all of their relations
  const nSamples = TIER_SAMPLES[tier];
  for (let i = 1; i < myDists.length; i++) {
    let best = 0;

    let myFusedSamples: number[][] = [];
    if (mode === 'monte_carlo') {
      myFusedSamples = sampleFromDistribution(myDists[i].mu, myDists[i].sigma, nSamples);
    }

    for (let j = 1; j < peerDists.length; j++) {
      let sampleSim = 0;

      if (mode === 'analytic') {
        sampleSim = analyticDistributionMatch(
          myDists[i].mu, myDists[i].sigma,
          peerDists[j].mu, peerDists[j].sigma
        );
      } else {
        const peerFusedSamples = sampleFromDistribution(peerDists[j].mu, peerDists[j].sigma, nSamples);
        for (let s = 0; s < nSamples; s++) {
           sampleSim += cosineSimilarity(myFusedSamples[s], peerFusedSamples[s]);
        }
        sampleSim /= nSamples;
      }

      // Apply tag-match bonus if tags align
      const adjustedSim = sampleSim * (myDists[i].tag === peerDists[j].tag ? 1.2 : 1.0);
      best = Math.max(best, adjustedSim);
    }

    // Spatiotemporal domain boost
    const tag = myDists[i].tag;
    if (tag && ['in_location', 'during_time'].includes(tag)) {
      best += spatiotemporalSimilarity(tag, myDists[i], peerDists) * 0.5;
    }

    // Weight scaling (defaults to 1.0)
    const weight = myDists[i].weight ?? 1.0;
    score += best * weight;
    totalWeight += weight;
  }

  // If peer had relations and we only had a root, we only evaluate root.
  // The algorithm ensures we normalize correctly.
  const finalScore = score / totalWeight;

  // Normalize score bounds (can occasionally exceed 1.0 due to bonuses)
  return Math.max(0, Math.min(1, finalScore));
}
