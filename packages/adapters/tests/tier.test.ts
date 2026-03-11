import { describe, it, expect, vi } from 'vitest';
import { browserTierDetector } from '../src/browser/tier';

describe('browserTierDetector', () => {
  it('detects minimal tier correctly', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 1,
        deviceMemory: 1,
        connection: {
          effectiveType: '2g',
          saveData: true
        }
      },
      configurable: true
    });

    const tier = await browserTierDetector.detect();
    expect(tier).toBe('minimal');
  });

  it('detects high tier on powerful devices', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 8,
        deviceMemory: 8,
        connection: {
          effectiveType: '4g',
          saveData: false
        }
      },
      configurable: true
    });

    const tier = await browserTierDetector.detect();
    expect(tier).toBe('high');
  });

  it('defaults to low if navigator is undefined', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true
    });

    const tier = await browserTierDetector.detect();
    expect(tier).toBe('low');
  });
});
