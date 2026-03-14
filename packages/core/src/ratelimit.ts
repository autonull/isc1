export interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  ANNOUNCE: { maxRequests: 5, windowMs: 60 * 1000 },
  DELEGATE_REQUEST: { maxRequests: 3, windowMs: 60 * 1000 },
  DELEGATE_RESPONSE_CONCURRENT: { maxRequests: 10, windowMs: 0 },
  CHAT_DIAL: { maxRequests: 20, windowMs: 60 * 60 * 1000 },
  DHT_QUERY: { maxRequests: 30, windowMs: 60 * 1000 }
};

export class RateLimiter {
  private limits: Map<string, Map<string, RateLimitInfo>> = new Map();

  /**
   * Loads state, useful for ephemeral CLI runs.
   */
  public loadState(state: Map<string, Map<string, RateLimitInfo>>) {
    this.limits = state;
  }

  /**
   * Gets state, useful for ephemeral CLI runs.
   */
  public getState(): Map<string, Map<string, RateLimitInfo>> {
    return this.limits;
  }

  /**
   * Checks if an action is allowed for a given peer and increments the counter.
   * @param peerId The ID of the peer performing the action
   * @param action The name of the action (e.g., 'announce', 'chat')
   * @param config The rate limit configuration
   * @returns true if allowed, false if rate limited
   */
  public attempt(peerId: string, action: string, config: RateLimitConfig): boolean {
    if (!this.limits.has(peerId)) {
      this.limits.set(peerId, new Map());
    }

    const peerLimits = this.limits.get(peerId)!;
    const now = Date.now();

    if (!peerLimits.has(action)) {
      peerLimits.set(action, { count: 1, resetTime: now + config.windowMs });
      return true;
    }

    const info = peerLimits.get(action)!;

    if (now > info.resetTime) {
      // Window expired, reset counter
      info.count = 1;
      info.resetTime = now + config.windowMs;
      return true;
    }

    if (info.count >= config.maxRequests) {
      // Limit exceeded
      return false;
    }

    // Allowed, increment counter
    info.count += 1;
    return true;
  }

  /**
   * Helper to manually clear expired limits to prevent memory leaks
   */
  public cleanup() {
    const now = Date.now();
    for (const [peerId, peerLimits] of this.limits.entries()) {
      for (const [action, info] of peerLimits.entries()) {
        if (now > info.resetTime) {
          peerLimits.delete(action);
        }
      }
      if (peerLimits.size === 0) {
        this.limits.delete(peerId);
      }
    }
  }
}
