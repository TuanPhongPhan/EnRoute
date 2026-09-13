import { rankFeasibleJourneys } from '@/lib/commute-engine';
import { clientCache } from '@/lib/client-cache';
import { readCommutePreferences, type CommutePreferences } from '@/lib/commute-preferences';
import type { TransportJourney } from '@/lib/transport-provider';

export type WeekEvent = { id: string; title: string; startsAt: string; endsAt: string };
export type WeekJourneyState = 'idle' | 'loading' | 'ready' | 'unavailable';
export type WeekPlanDay = {
  key: string;
  events: WeekEvent[];
  journey?: TransportJourney;
  journeyState: WeekJourneyState;
};

export type WeekMetrics = {
  trainMinutes: number;
  travelMinutes: number;
  universityMinutes: number;
};

const weekPlanCacheTtlMs = 5 * 60_000;
const routeConcurrency = 2;

export function readCachedWeekPlan() {
  return clientCache.read<WeekPlanDay[]>(weekPlanCacheKey())?.value ?? null;
}

export function readCachedWeekSchedule() {
  return clientCache.read<WeekPlanDay[]>(weekScheduleCacheKey())?.value ?? null;
}

export function loadCachedWeekPlan() {
  return clientCache.load(weekPlanCacheKey(), weekPlanCacheTtlMs, loadWeekPlan);
}

export function loadCachedWeekSchedule() {
  return clientCache.load(weekScheduleCacheKey(), weekPlanCacheTtlMs, loadWeekSchedule);
}

export function hasFreshCachedWeekPlan() {
  return clientCache.isFresh(weekPlanCacheKey(), weekPlanCacheTtlMs);
}

export function invalidateWeekPlanCache() {
  clientCache.invalidateMatching('week-plan:');
  clientCache.invalidateMatching('week-schedule:');
}

/** Fetch calendar data first so the weekly timetable is useful before Transitous replies. */
export async function loadWeekSchedule(): Promise<WeekPlanDay[]> {
  const preferences = readCommutePreferences();
  const { start, end } = weekRange();
  const response = await fetch(
    `/api/google/calendar/week-events?calendarId=${encodeURIComponent(preferences.calendarId)}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
  );
  if (!response.ok) throw new Error('week_events_unavailable');

  const events = ((await response.json()) as { events: WeekEvent[] }).events;
  const groups = new Map<string, WeekEvent[]>();
  events.forEach((event) => groups.set(dayKey(event.startsAt), [...(groups.get(dayKey(event.startsAt)) ?? []), event]));

  const now = Date.now();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dayEvents = (groups.get(dayKey(date.toISOString())) ?? []).sort(
      (first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt),
    );
    const firstClass = dayEvents[0];
    return {
      key: dayKey(date.toISOString()),
      events: dayEvents,
      journeyState: firstClass && Date.parse(firstClass.startsAt) > now ? 'loading' : 'idle',
    };
  });
}

/**
 * Enrich future class days without blocking the timetable. The limit protects Transitous
 * while letting multiple recommendations arrive independently.
 */
export async function loadWeekJourneys(
  days: WeekPlanDay[],
  onDayUpdated?: (day: WeekPlanDay) => void,
): Promise<WeekPlanDay[]> {
  const preferences = readCommutePreferences();
  const updatedDays = days.map((day) => ({ ...day }));
  const pending = updatedDays.map((day, index) => ({ day, index })).filter(({ day }) => day.journeyState === 'loading');

  await mapWithConcurrency(pending, routeConcurrency, async ({ day, index }) => {
    const updated = await loadDayJourney(day, preferences);
    updatedDays[index] = updated;
    onDayUpdated?.(updated);
    return updated;
  });

  clientCache.set(weekPlanCacheKey(), updatedDays);
  return updatedDays;
}

export async function loadWeekPlan(): Promise<WeekPlanDay[]> {
  const schedule = await loadCachedWeekSchedule();
  return loadWeekJourneys(schedule);
}

export async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  limit: number,
  mapper: (input: Input) => Promise<Output>,
): Promise<Output[]> {
  const results = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex++;
      results[index] = await mapper(inputs[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), inputs.length) }, worker));
  return results;
}

async function loadDayJourney(day: WeekPlanDay, preferences: CommutePreferences): Promise<WeekPlanDay> {
  const firstClass = day.events[0];
  if (!firstClass) return { ...day, journeyState: 'idle' };

  try {
    const target = new Date(Date.parse(firstClass.startsAt) - preferences.arrivalBufferMinutes * 60_000);
    const response = await fetch(
      `/api/transport/journeys?${new URLSearchParams({
        from: preferences.homeAddress,
        to: preferences.universityAddress,
        time: target.toISOString(),
        arriveBy: 'true',
      })}`,
    );
    if (!response.ok) return { ...day, journeyState: 'unavailable' };

    const journey = rankFeasibleJourneys(
      ((await response.json()) as { journeys: TransportJourney[] }).journeys,
      firstClass.startsAt,
      preferences.arrivalBufferMinutes,
    )[0];
    return journey ? { ...day, journey, journeyState: 'ready' } : { ...day, journeyState: 'unavailable' };
  } catch {
    return { ...day, journeyState: 'unavailable' };
  }
}

function weekPlanCacheKey() {
  const preferences = readCommutePreferences();
  return `week-plan:${weekCacheIdentity(preferences)}`;
}

function weekScheduleCacheKey() {
  const preferences = readCommutePreferences();
  return `week-schedule:${weekCacheIdentity(preferences)}`;
}

function weekCacheIdentity(preferences: CommutePreferences) {
  const { start } = weekRange();
  return `${start.toISOString()}:${preferences.calendarId}:${preferences.homeAddress}:${preferences.universityAddress}:${preferences.arrivalBufferMinutes}`;
}

export function calculateWeekMetrics(days: WeekPlanDay[]): WeekMetrics {
  const universityMinutes = days
    .flatMap((day) => day.events)
    .reduce((sum, event) => sum + (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60_000, 0);
  const travelMinutes = days.reduce((sum, day) => sum + (day.journey?.durationMinutes ?? 0), 0);
  const trainMinutes = days.reduce(
    (sum, day) =>
      sum +
      (day.journey?.legs
        .filter((leg) => leg.mode === 'regional_train')
        .reduce(
          (total, leg) => total + (Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60_000,
          0,
        ) ?? 0),
    0,
  );

  return { universityMinutes, travelMinutes, trainMinutes };
}

function weekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(value));
}
