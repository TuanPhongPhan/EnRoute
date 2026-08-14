'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, TrainFront } from 'lucide-react';
import { readCommutePreferences } from '@/lib/commute-preferences';
import { rankFeasibleJourneys } from '@/lib/commute-engine';
import type { TransportJourney } from '@/lib/transport-provider';
type Event = { id: string; title: string; startsAt: string; endsAt: string };
type Day = { key: string; events: Event[]; journey?: TransportJourney; error?: boolean };
export function WeekDashboard() {
  const [days, setDays] = useState<Day[] | null>(null);
  useEffect(() => {
    void loadWeek()
      .then(setDays)
      .catch(() => setDays([]));
  }, []);
  if (!days)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-56 rounded bg-primary-100" />
        <div className="h-72 rounded-3xl bg-primary-100" />
      </div>
    );
  const uni = days
    .flatMap((day) => day.events)
    .reduce((sum, event) => sum + (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000, 0);
  const travel = days.reduce((sum, day) => sum + (day.journey?.durationMinutes ?? 0), 0);
  const train = days.reduce(
    (sum, day) =>
      sum +
      (day.journey?.legs
        .filter((leg) => leg.mode === 'regional_train')
        .reduce((total, leg) => total + (Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60000, 0) ??
        0),
    0,
  );
  return (
    <div>
      <header>
        <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Week</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">Your HNU week.</h1>
        <p className="mt-3 text-muted">Classes and planned morning commutes, Monday to Sunday.</p>
      </header>
      <section className="mt-7 grid gap-4 md:grid-cols-3">
        <Metric icon={CalendarDays} label="University" value={hours(uni)} />
        <Metric icon={TrainFront} label="Travel" value={hours(travel)} />
        <Metric icon={Clock3} label="Train study time" value={hours(train)} />
      </section>
      <section className="mt-7 grid gap-4 lg:grid-cols-2">
        {days.map((day) => (
          <DayCard day={day} key={day.key} />
        ))}
      </section>
    </div>
  );
}
async function loadWeek(): Promise<Day[]> {
  const p = readCommutePreferences();
  const { start, end } = weekRange();
  const response = await fetch(
    `/api/google/calendar/week-events?calendarId=${encodeURIComponent(p.calendarId)}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
  );
  if (!response.ok) throw new Error();
  const events = ((await response.json()) as { events: Event[] }).events;
  const groups = new Map<string, Event[]>();
  events.forEach((event) => groups.set(key(event.startsAt), [...(groups.get(key(event.startsAt)) ?? []), event]));
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    return { key: key(date.toISOString()), events: groups.get(key(date.toISOString())) ?? [] };
  });
  for (const day of days) {
    const first = day.events[0];
    if (!first || Date.parse(first.startsAt) <= Date.now()) continue;
    try {
      const target = new Date(Date.parse(first.startsAt) - p.arrivalBufferMinutes * 60000);
      const route = await fetch(
        `/api/transport/journeys?${new URLSearchParams({ from: p.homeAddress, to: p.universityAddress, time: target.toISOString(), arriveBy: 'true' })}`,
      );
      if (!route.ok) {
        day.error = true;
        continue;
      }
      day.journey = rankFeasibleJourneys(
        ((await route.json()) as { journeys: TransportJourney[] }).journeys,
        first.startsAt,
        p.arrivalBufferMinutes,
      )[0];
    } catch {
      day.error = true;
    }
  }
  return days;
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
function key(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(value));
}
function time(value: string) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
    new Date(value),
  );
}
function hours(value: number) {
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <Icon className="size-5 text-brand" />
      <p className="mt-3 text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </article>
  );
}
function DayCard({ day }: { day: Day }) {
  return (
    <article className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold text-ink">
        {new Intl.DateTimeFormat('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          timeZone: 'Europe/Berlin',
        }).format(new Date(`${day.key}T12:00:00Z`))}
      </h2>
      {day.events.length ? (
        <>
          <div className="mt-4 space-y-3">
            {day.events.map((event) => (
              <div key={event.id}>
                <p className="font-semibold text-ink">{event.title}</p>
                <p className="text-sm text-muted">
                  {time(event.startsAt)}–{time(event.endsAt)}
                </p>
              </div>
            ))}
          </div>
          {day.journey && (
            <p className="mt-5 rounded-xl bg-primary-50 px-3 py-2 text-sm font-semibold text-brand-deep">
              Leave home {time(day.journey.departure)} · {hours(day.journey.durationMinutes)} travel
            </p>
          )}
          {day.error && <p className="mt-4 text-sm text-warning">Journey unavailable for this day.</p>}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No HNU classes.</p>
      )}
    </article>
  );
}
