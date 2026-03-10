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
}

/**
 * Mocks the embedding model for tests without loading real weights.
 */
export async function mockEmbed(text: string): Promise<number[]> {
  const vec = new Array(384).fill(0).map((_, i) => Math.sin(text.length * i));
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / (norm || 1));
}

/**
 * Computes distributions for a given channel based on root + fused relations.
 */
export async function computeRelationalDistributions(channel: Channel, embedFn: (text: string) => Promise<number[]> = mockEmbed): Promise<Distribution[]> {
  const dists: Distribution[] = [];

  const rootMu = await embedFn(channel.description);
  dists.push({
    mu: rootMu,
    sigma: channel.spread,
    type: 'root'
  });

  if (channel.relations && channel.relations.length > 0) {
    const limitedRelations = channel.relations.slice(0, 5); // Max 5 relations
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
