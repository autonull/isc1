export interface Relation {
  tag: string;
  object: string;
  weight?: number;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;
  relations?: Relation[];
}

export interface Distribution {
  mu: number[];
  sigma: number;
  type: 'root' | 'fused';
  tag?: string;
  object?: string;
  weight?: number;
}

/**
 * A fallback embedding method (bag-of-words hash) when the ML model fails to load.
 * It creates a 384-dimensional vector based on the presence of words.
 */
export function wordHashFallbackEmbed(text: string): number[] {
  const vec = new Array(384).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = Math.imul(31, hash) + word.charCodeAt(i) | 0;
    }
    // Map hash to an index in the 384-dim vector
    const index = Math.abs(hash) % 384;
    vec[index] += 1;
  }

  // Normalize
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec; // empty string case
  return vec.map(v => v / norm);
}

/**
 * Computes distributions for a given channel based on root + fused relations.
 */
export async function computeRelationalDistributions(channel: Channel, embedFn: (text: string) => Promise<number[]>, tier: string = 'high'): Promise<Distribution[]> {
  const dists: Distribution[] = [];

  const rootMu = await embedFn(channel.description);
  dists.push({
    mu: rootMu,
    sigma: channel.spread,
    type: 'root'
  });

  if (channel.relations && channel.relations.length > 0) {
    let maxRelations = 5;
    if (tier === 'low' || tier === 'minimal') {
      maxRelations = 0;
    } else if (tier === 'mid') {
      maxRelations = 2;
    }

    const limitedRelations = channel.relations.slice(0, maxRelations);
    for (const rel of limitedRelations) {
      const fusedText = `${channel.description} ${rel.tag} ${rel.object}`;
      const fusedMu = await embedFn(fusedText);
      dists.push({
        mu: fusedMu,
        sigma: channel.spread, // Simplified: use channel spread
        type: 'fused',
        tag: rel.tag,
        object: rel.object
      });
    }
  }

  return dists;
}
