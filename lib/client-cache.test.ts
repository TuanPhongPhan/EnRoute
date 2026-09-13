import { describe, expect, it, vi } from 'vitest';
import { createClientCache } from '@/lib/client-cache';

describe('client cache', () => {
  it('returns a fresh value without loading again', async () => {
    let now = 1_000;
    const cache = createClientCache(() => now);
    const loader = vi.fn().mockResolvedValue('first');

    await expect(cache.load('week', 5_000, loader)).resolves.toBe('first');
    now += 1_000;
    await expect(cache.load('week', 5_000, loader)).resolves.toBe('first');

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests and refreshes expired values', async () => {
    let now = 1_000;
    const cache = createClientCache(() => now);
    let resolve: ((value: string) => void) | undefined;
    const loader = vi.fn(() => new Promise<string>((complete) => (resolve = complete)));

    const first = cache.fetch('week', loader);
    const second = cache.fetch('week', loader);
    resolve?.('first');
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'first']);

    now += 6_000;
    const refresh = vi.fn().mockResolvedValue('second');
    await expect(cache.load('week', 5_000, refresh)).resolves.toBe('second');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache groups by prefix', () => {
    const cache = createClientCache();
    cache.set('week-plan:primary', 'week');
    cache.set('calendar-options', 'calendars');
    cache.invalidateMatching('week-plan:');

    expect(cache.read('week-plan:primary')).toBeNull();
    expect(cache.read('calendar-options')?.value).toBe('calendars');
  });
});
