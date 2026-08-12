import type { TransportJourney, TransportJourneyLeg } from '@/lib/transport-provider';

// Bump this key whenever the persisted Journey shape changes; stale journeys must never be presented as live.
const storageKey = 'enroute:current-journey:v3';

export type CurrentJourney = { journeys: TransportJourney[]; selectedJourneyId: string };

export function readCurrentJourney(storage = browserStorage()): CurrentJourney | null {
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? 'null');
    if (!isCurrentJourney(parsed)) return null;
    // The cached route is an offline fallback only until its selected arrival time has passed.
    if (Date.parse(selectedJourney(parsed)?.arrival ?? '') <= Date.now()) { storage.removeItem(storageKey); return null; }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCurrentJourneys(journeys: TransportJourney[], storage = browserStorage(), preferredJourneyId?: string): CurrentJourney | null {
  const selectedJourneyId = journeys.some((journey) => journey.id === preferredJourneyId) ? preferredJourneyId : journeys[0]?.id;
  if (!storage || !selectedJourneyId) return null;
  const current = { journeys, selectedJourneyId };
  storage.setItem(storageKey, JSON.stringify(current));
  return current;
}

export function selectCurrentJourney(id: string, storage = browserStorage()): CurrentJourney | null {
  const current = readCurrentJourney(storage);
  if (!current || !current.journeys.some((journey) => journey.id === id)) return null;
  const next = { ...current, selectedJourneyId: id };
  storage?.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function selectedJourney(current: CurrentJourney | null) {
  return current?.journeys.find((journey) => journey.id === current.selectedJourneyId) ?? null;
}

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function isCurrentJourney(value: unknown): value is CurrentJourney {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.selectedJourneyId === 'string'
    && Array.isArray(candidate.journeys)
    && candidate.journeys.every(isTransportJourney)
    && candidate.journeys.some((journey) => journey.id === candidate.selectedJourneyId);
}

function isTransportJourney(value: unknown): value is TransportJourney {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.departure === 'string'
    && typeof candidate.arrival === 'string'
    && typeof candidate.durationMinutes === 'number'
    && typeof candidate.transfers === 'number'
    && typeof candidate.hasDelays === 'boolean'
    && Array.isArray(candidate.legs)
    && candidate.legs.every(isTransportJourneyLeg);
}

function isTransportJourneyLeg(value: unknown): value is TransportJourneyLeg {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.mode === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.origin === 'string'
    && typeof candidate.destination === 'string'
    && typeof candidate.actualDeparture === 'string'
    && typeof candidate.actualArrival === 'string';
}
