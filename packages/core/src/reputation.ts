export interface Interaction {
  peerID: string;
  type: 'chat' | 'post_reaction' | 'follow' | 'flag';
  successful: boolean;
  timestamp: number;
}

export interface ReputationScore {
  peerID: string;
  score: number;        // 0.0 - 1.0
  mutualFollows: number;
  interactionHistory: Interaction[];
  halfLifeDays: number; // 30-day decay
}

/**
 * Calculates a time-decayed reputation score based on interaction history.
 *
 * R(t) = R₀ * e^(-λt) + Σ(interaction_delta * e^(-λ(t - t_interaction)))
 *
 * Where:
 * - R₀ = initial reputation (0.5 for new peers)
 * - λ = ln(2) / 30 days = 0.0231 per day (decay constant)
 * - t = time since last activity (days)
 * - interaction_delta = +0.1 for successful interaction, -0.2 for flagged interaction
 */
export function calculateReputation(interactions: Interaction[], now: number): number {
  const lambda = Math.log(2) / 30; // 30-day half-life
  const baseReputation = 0.5;

  let reputation = baseReputation;

  // We decay the base reputation from the oldest interaction (or now if none)
  const oldestTimestamp = interactions.length > 0
    ? Math.min(...interactions.map(i => i.timestamp))
    : now;

  const baseAgeDays = (now - oldestTimestamp) / (1000 * 60 * 60 * 24);
  reputation = baseReputation * Math.exp(-lambda * baseAgeDays);

  for (const interaction of interactions) {
    const ageDays = (now - interaction.timestamp) / (1000 * 60 * 60 * 24);
    // Ignore future timestamps to prevent clock skew attacks
    if (ageDays < 0) continue;

    let delta = 0;
    if (interaction.type === 'flag') {
      delta = -0.2;
    } else {
      delta = interaction.successful ? 0.1 : 0.0;
    }

    reputation += delta * Math.exp(-lambda * ageDays);
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, reputation));
}
