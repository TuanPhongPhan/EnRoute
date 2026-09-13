'use client';
import { useEffect, useState } from 'react';
import {
  hasFreshCachedWeekPlan,
  loadCachedWeekSchedule,
  loadWeekJourneys,
  readCachedWeekPlan,
  readCachedWeekSchedule,
  type WeekPlanDay,
} from '@/lib/week-plan';

export function WeekDashboard() {
  const [days, setDays] = useState<WeekPlanDay[] | null>(() => readCachedWeekPlan() ?? readCachedWeekSchedule());
  useEffect(() => {
    if (hasFreshCachedWeekPlan()) return;

    let cancelled = false;
    void loadCachedWeekSchedule()
      .then((schedule) => {
        if (cancelled) return;
        setDays((current) => mergeScheduleWithJourneys(schedule, current));
        return loadWeekJourneys(schedule, (updatedDay) => {
          if (!cancelled) setDays((current) => replaceDay(current, updatedDay));
        });
      })
      .then((completedDays) => {
        if (!cancelled && completedDays) setDays(completedDays);
      })
      .catch(() => setDays((current) => current ?? []));
    return () => {
      cancelled = true;
    };
  }, []);
  if (!days)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-56 rounded bg-primary-100" />
        <div className="h-72 rounded-3xl bg-primary-100" />
      </div>
    );
  return (
    <div>
      <header>
        <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Week</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">Your HNU week.</h1>
        <p className="mt-3 text-muted">Classes and planned morning commutes, Monday to Sunday.</p>
      </header>
      <section className="mt-7 grid gap-4 lg:grid-cols-2">
        {days.map((day) => (
          <DayCard day={day} key={day.key} />
        ))}
      </section>
    </div>
  );
}
function time(value: string) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
    new Date(value),
  );
}
function hours(value: number) {
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}
function DayCard({ day }: { day: WeekPlanDay }) {
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
          {day.journeyState === 'loading' && (
            <p aria-live="polite" className="mt-5 rounded-xl bg-surface-muted px-3 py-2 text-sm font-medium text-muted">
              Finding your morning commute…
            </p>
          )}
          {day.journeyState === 'unavailable' && (
            <p className="mt-4 text-sm text-warning">Journey unavailable for this day.</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No HNU classes.</p>
      )}
    </article>
  );
}

function mergeScheduleWithJourneys(schedule: WeekPlanDay[], current: WeekPlanDay[] | null) {
  if (!current) return schedule;
  return schedule.map((day) => {
    const existing = current.find((candidate) => candidate.key === day.key);
    return existing?.journey ? { ...day, journey: existing.journey, journeyState: existing.journeyState } : day;
  });
}

function replaceDay(days: WeekPlanDay[] | null, updatedDay: WeekPlanDay) {
  return days?.map((day) => (day.key === updatedDay.key ? updatedDay : day)) ?? [updatedDay];
}
