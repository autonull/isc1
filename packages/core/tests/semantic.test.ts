import { describe, it, expect } from 'vitest';
import { computeRelationalDistributions } from '../src/semantic';

describe('computeRelationalDistributions', () => {
  it('computes only root distribution when no relations exist', async () => {
    const dists = await computeRelationalDistributions({
      id: 'ch_test',
      name: 'Test',
      description: 'Distributed systems consensus',
      spread: 0.1
    });

    expect(dists).toHaveLength(1);
    expect(dists[0].type).toBe('root');
  });

  it('computes fused distributions up to a max of 5', async () => {
    const channel = {
      id: 'ch_ai',
      name: 'AI Ethics',
      description: 'Ethical implications',
      spread: 0.2,
      relations: [
        { tag: 'in_location', object: 'Tokyo' },
        { tag: 'during_time', object: '2026' },
        { tag: 'with_mood', object: 'Reflective' },
        { tag: 'under_domain', object: 'Tech' },
        { tag: 'part_of', object: 'Philosophy' },
        { tag: 'similar_to', object: 'Brain synapses' }, // Should be ignored (6th)
      ]
    };

    const dists = await computeRelationalDistributions(channel);
    expect(dists).toHaveLength(6); // 1 root + 5 fused
    expect(dists[0].type).toBe('root');
    expect(dists[1].type).toBe('fused');
    expect(dists[5].type).toBe('fused');
    expect(dists.some(d => d.tag === 'similar_to')).toBe(false);
  });
});
