import { TierDetector } from '../interfaces/index.js';

export const browserTierDetector: TierDetector = {
  async detect(): Promise<'minimal' | 'low' | 'mid' | 'high'> {
    // navigator APIs might not exist in all environments (e.g. strict iframes, old browsers)

    // Default to 'low' as a safe, conservative fallback
    if (typeof navigator === 'undefined') {
      return 'low';
    }

    const cores = navigator.hardwareConcurrency ?? 4;
    // deviceMemory is standard on Chromium, undefined on Safari/Firefox
    const mem = (navigator as any).deviceMemory ?? 4;

    // Check connection type if available
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType;
    const saveData = connection?.saveData;

    // Strict minimal conditions (2g, save-data on, < 2 cores)
    if (effectiveType === '2g' || saveData || cores < 2 || mem < 2) {
      return 'minimal';
    }

    // High tier: >= 8 cores, >= 8GB RAM, good connection
    if (cores >= 8 && mem >= 8 && effectiveType !== '3g') {
      return 'high';
    }

    // Mid tier: 4-6 cores, >= 4GB RAM
    if (cores >= 4 && mem >= 4) {
      return 'mid';
    }

    // Default fallback
    return 'low';
  }
};
