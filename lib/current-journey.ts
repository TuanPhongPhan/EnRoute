import type { TransportJourney, TransportJourneyLeg } from '@/lib/transport-provider';

// Directional storage keeps a chosen trip home from replacing the morning commute.
const storageKey = 'enroute:current-journey:v5';

export type TravelDirection = 'outbound' | 'return';
export type CurrentJourney = { journeys: TransportJourney[]; selectedJourneyId: string; fetchedAt: string };
type CurrentJourneys = Partial<Record<TravelDirection, CurrentJourney>>;

export function travelDirection(value: string | null | undefined): TravelDirection {
  return value === 'return' ? 'return' : 'outbound';
}

export function readCurrentJourney(
  directionOrStorage: TravelDirection | Storage = 'outbound',
  providedStorage = browserStorage(),
): CurrentJourney | null {
  const direction = typeof directionOrStorage === 'string' ? directionOrStorage : 'outbound';
  const storage = typeof directionOrStorage === 'string' ? providedStorage : directionOrStorage;
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? 'null');
    if (!isCurrentJourneys(parsed)) return null;
    const current = parsed[direction];
    if (!current) return null;
    // A cached route is an offline fallback only until its selected arrival time has passed.
    if (Date.parse(selectedJourney(current)?.arrival ?? '') <= Date.now()) {
      delete parsed[direction];
      storage.setItem(storageKey, JSON.stringify(parsed));
      return null;
    }
    return current;
  } catch {
    return null;
  }
}

export function saveCurrentJourneys(
  journeys: TransportJourney[],
  storage = browserStorage(),
  preferredJourneyId?: string,
  fetchedAt = new Date().toISOString(),
  direction: TravelDirection = 'outbound',
): CurrentJourney | null {
  const selectedJourneyId = journeys.some((journey) => journey.id === preferredJourneyId)
    ? preferredJourneyId
    : journeys[0]?.id;
  if (!storage || !selectedJourneyId) return null;
  const current = { journeys, selectedJourneyId, fetchedAt };
  const saved = readStoredJourneys(storage);
  storage.setItem(storageKey, JSON.stringify({ ...saved, [direction]: current }));
  return current;
}

export function selectCurrentJourney(
  id: string,
  storage = browserStorage(),
  direction: TravelDirection = 'outbound',
): CurrentJourney | null {
  const current = readCurrentJourney(direction, storage);
  if (!current || !current.journeys.some((journey) => journey.id === id)) return null;
  const next = { ...current, selectedJourneyId: id };
  const saved = readStoredJourneys(storage);
  storage?.setItem(storageKey, JSON.stringify({ ...saved, [direction]: next }));
  return next;
}

export function selectedJourney(current: CurrentJourney | null) {
  return current?.journeys.find((journey) => journey.id === current.selectedJourneyId) ?? null;
}

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readStoredJourneys(storage: Storage | null): CurrentJourneys {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? 'null');
    return isCurrentJourneys(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isCurrentJourneys(value: unknown): value is CurrentJourneys {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['outbound', 'return'].every(
    (direction) => candidate[direction] === undefined || isCurrentJourney(candidate[direction]),
  );
}

function isCurrentJourney(value: unknown): value is CurrentJourney {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.selectedJourneyId === 'string' &&
    typeof candidate.fetchedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.fetchedAt)) &&
    Array.isArray(candidate.journeys) &&
    candidate.journeys.every(isTransportJourney) &&
    candidate.journeys.some((journey) => journey.id === candidate.selectedJourneyId)
  );
}

function isTransportJourney(value: unknown): value is TransportJourney {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.departure === 'string' &&
    typeof candidate.arrival === 'string' &&
    typeof candidate.durationMinutes === 'number' &&
    typeof candidate.transfers === 'number' &&
    typeof candidate.hasDelays === 'boolean' &&
    Array.isArray(candidate.legs) &&
    candidate.legs.every(isTransportJourneyLeg)
  );
}

function isTransportJourneyLeg(value: unknown): value is TransportJourneyLeg {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.mode === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.origin === 'string' &&
    typeof candidate.destination === 'string' &&
    typeof candidate.actualDeparture === 'string' &&
    typeof candidate.actualArrival === 'string'
  );
}
