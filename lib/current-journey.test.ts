import { describe, expect, it } from 'vitest';
import { readCurrentJourney, saveCurrentJourneys, selectCurrentJourney, selectedJourney } from '@/lib/current-journey';
import type { TransportJourney } from '@/lib/transport-provider';

const firstJourney: TransportJourney = {
  id: 'first',
  departure: '2030-08-10T06:00:00Z',
  arrival: '2030-08-10T08:00:00Z',
  durationMinutes: 120,
  transfers: 1,
  hasDelays: false,
  legs: [
    {
      mode: 'subway',
      label: 'U2',
      origin: 'A',
      destination: 'B',
      scheduledDeparture: '2030-08-10T06:00:00Z',
      actualDeparture: '2030-08-10T06:00:00Z',
      scheduledArrival: '2030-08-10T06:20:00Z',
      actualArrival: '2030-08-10T06:20:00Z',
      delayMinutes: 0,
    },
  ],
};
const secondJourney: TransportJourney = { ...firstJourney, id: 'second', arrival: '2030-08-10T08:10:00Z' };

describe('current journey session', () => {
  it('defaults to the recommended first route and keeps a user choice until refresh', () => {
    const storage = new MemoryStorage();
    const initial = saveCurrentJourneys([firstJourney, secondJourney], storage);
    expect(selectedJourney(initial)?.id).toBe('first');

    const chosen = selectCurrentJourney('second', storage);
    expect(selectedJourney(chosen)?.id).toBe('second');

    const refreshed = saveCurrentJourneys([firstJourney], storage);
    expect(selectedJourney(refreshed)?.id).toBe('first');
  });

  it('ignores malformed session data safely', () => {
    const storage = new MemoryStorage();
    storage.setItem('enroute:current-journey:v2', '{bad json');
    expect(readCurrentJourney(storage)).toBeNull();
  });

  it('keeps a matching manual selection when refreshed routes still include it', () => {
    const storage = new MemoryStorage();
    const current = saveCurrentJourneys([firstJourney, secondJourney], storage);
    const chosen = selectCurrentJourney('second', storage);
    const refreshed = saveCurrentJourneys([firstJourney, secondJourney], storage, selectedJourney(chosen)?.id);
    expect(selectedJourney(current)?.id).toBe('first');
    expect(selectedJourney(refreshed)?.id).toBe('second');
  });

  it('preserves the successful Transitous fetch time when selecting a route', () => {
    const storage = new MemoryStorage();
    const fetchedAt = '2030-08-10T05:55:00Z';
    saveCurrentJourneys([firstJourney, secondJourney], storage, undefined, fetchedAt);

    expect(selectCurrentJourney('second', storage)?.fetchedAt).toBe(fetchedAt);
  });

  it('keeps outbound and return journey choices separate', () => {
    const storage = new MemoryStorage();
    saveCurrentJourneys([firstJourney, secondJourney], storage);
    saveCurrentJourneys([secondJourney], storage, undefined, '2030-08-10T06:00:00Z', 'return');

    expect(selectedJourney(readCurrentJourney(storage))?.id).toBe('first');
    expect(selectedJourney(readCurrentJourney('return', storage))?.id).toBe('second');
  });
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
