import type { TransportJourney } from '@/lib/transport-provider';

export const pomodoroMinutes = [25, 50] as const;
export const breakMinutes = 5;

export type FocusPhase = 'focus' | 'break';

export type FocusSession = {
  phase: FocusPhase;
  title: string;
  plannedMinutes: number;
  startedAt: string;
  pausedAt?: string;
  pausedMs: number;
  destination: string;
  clientSessionId: string;
};

export type PendingFocusCompletion = {
  clientSessionId: string;
  title: string;
  plannedMinutes: number;
  startedAt: string;
  destination: string;
};

const sessionKey = 'enroute:focus-session:v2';
const pendingKey = 'enroute:focus-pending-completions:v1';

export function usableLeg(journey: TransportJourney | null) {
  const regionalLegs = journey?.legs.filter((leg) => leg.mode === 'regional_train') ?? [];
  const candidates = regionalLegs.length ? regionalLegs : (journey?.legs.filter((leg) => leg.mode !== 'walk') ?? []);

  return candidates
    .filter((leg) => Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture) >= 20 * 60_000)
    .sort(
      (a, b) =>
        Date.parse(b.actualArrival) -
        Date.parse(b.actualDeparture) -
        (Date.parse(a.actualArrival) - Date.parse(a.actualDeparture)),
    )[0];
}

export function journeyFitMinutes(journey: TransportJourney | null): number | null {
  const leg = usableLeg(journey);
  if (!leg) return null;

  const travelMinutes = Math.floor((Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60_000);
  const usableMinutes = Math.min(50, travelMinutes - breakMinutes);
  return usableMinutes >= 5 ? usableMinutes : null;
}

export function createFocusSession({
  title,
  plannedMinutes,
  destination,
  phase = 'focus',
}: {
  title: string;
  plannedMinutes: number;
  destination: string;
  phase?: FocusPhase;
}): FocusSession {
  return {
    phase,
    title: title.trim() || 'Study session',
    plannedMinutes,
    startedAt: new Date().toISOString(),
    pausedMs: 0,
    destination,
    clientSessionId: crypto.randomUUID(),
  };
}

export function saveFocus(session: FocusSession) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function readFocus(): FocusSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Partial<FocusSession> | null;
    if (
      !value ||
      (value.phase !== 'focus' && value.phase !== 'break') ||
      typeof value.title !== 'string' ||
      typeof value.plannedMinutes !== 'number' ||
      !Number.isInteger(value.plannedMinutes) ||
      value.plannedMinutes < 1 ||
      typeof value.startedAt !== 'string' ||
      typeof value.pausedMs !== 'number' ||
      typeof value.destination !== 'string' ||
      typeof value.clientSessionId !== 'string'
    ) {
      return null;
    }

    return value as FocusSession;
  } catch {
    return null;
  }
}

export function clearFocus() {
  localStorage.removeItem(sessionKey);
}

export function remainingSeconds(session: FocusSession, now = Date.now()) {
  const elapsed = session.pausedAt
    ? Date.parse(session.pausedAt) - Date.parse(session.startedAt) - session.pausedMs
    : now - Date.parse(session.startedAt) - session.pausedMs;

  return Math.max(0, session.plannedMinutes * 60 - Math.floor(elapsed / 1000));
}

export function readPendingFocusCompletions(): PendingFocusCompletion[] {
  try {
    const value = JSON.parse(localStorage.getItem(pendingKey) ?? '[]') as PendingFocusCompletion[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePendingFocusCompletion(completion: PendingFocusCompletion) {
  const existing = readPendingFocusCompletions();
  if (existing.some((item) => item.clientSessionId === completion.clientSessionId)) return;
  localStorage.setItem(pendingKey, JSON.stringify([...existing, completion]));
}

export function removePendingFocusCompletion(clientSessionId: string) {
  const remaining = readPendingFocusCompletions().filter((item) => item.clientSessionId !== clientSessionId);
  localStorage.setItem(pendingKey, JSON.stringify(remaining));
}
