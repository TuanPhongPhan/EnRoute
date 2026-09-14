import type { TravelDirection } from '@/lib/current-journey';
import type { TransportJourney } from '@/lib/transport-provider';

type MonitorContext = { calendarEventId: string; eventStartsAt: string; direction: TravelDirection };
const storageKey = 'enroute:commute-monitor-context:v1';

export function saveCommuteMonitorContext(context: MonitorContext) {
  if (typeof window === 'undefined') return;
  try {
    const contexts = readContexts();
    window.localStorage.setItem(storageKey, JSON.stringify({ ...contexts, [context.direction]: context }));
  } catch {}
}

export function readCommuteMonitorContext(direction: TravelDirection): MonitorContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = readContexts()[direction];
    return isMonitorContext(value) ? value : null;
  } catch {
    return null;
  }
}

export async function monitorCommute(context: MonitorContext, journey: TransportJourney) {
  saveCommuteMonitorContext(context);
  await fetch('/api/commutes/monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...context,
      departureAt: journey.departure,
      arrivalAt: journey.arrival,
      journey: { departure: journey.departure, arrival: journey.arrival, legs: journey.legs },
    }),
  });
}

function readContexts(): Partial<Record<TravelDirection, MonitorContext>> {
  if (typeof window === 'undefined') return {};
  const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}');
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed as Partial<Record<TravelDirection, MonitorContext>>;
}

function isMonitorContext(value: unknown): value is MonitorContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.calendarEventId === 'string' &&
    typeof candidate.eventStartsAt === 'string' &&
    (candidate.direction === 'outbound' || candidate.direction === 'return')
  );
}
