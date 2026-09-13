'use client';

import { CalendarDays, Clock3, TrainFront } from 'lucide-react';
import { useEffect, useState } from 'react';

import { calculateWeekMetrics, loadCachedWeekPlan, readCachedWeekPlan, type WeekPlanDay } from '@/lib/week-plan';

export function InsightsDashboard() {
  const [days, setDays] = useState<WeekPlanDay[] | null>(() => readCachedWeekPlan());

  useEffect(() => {
    void loadCachedWeekPlan()
      .then(setDays)
      .catch(() => setDays((current) => current ?? []));
  }, []);

  if (!days)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-52 rounded bg-primary-100" />
        <div className="h-72 rounded-3xl bg-primary-100" />
      </div>
    );

  const metrics = calculateWeekMetrics(days);
  const unavailableJourneys = days.filter((day) => day.journeyState === 'unavailable').length;

  return (
    <div>
      <header>
        <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Insights</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">Your commute week.</h1>
        <p className="mt-3 max-w-xl text-muted">Planned university and morning-commute time for the current week.</p>
      </header>

      <section aria-label="Weekly commute metrics" className="mt-7 grid gap-4 md:grid-cols-3">
        <Metric icon={CalendarDays} label="University" value={hours(metrics.universityMinutes)} />
        <Metric icon={TrainFront} label="Travel" value={hours(metrics.travelMinutes)} />
        <Metric icon={Clock3} label="Train study time" value={hours(metrics.trainMinutes)} />
      </section>

      {unavailableJourneys > 0 && (
        <p className="mt-5 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-text-secondary">
          Journey data is unavailable for {unavailableJourneys} future {unavailableJourneys === 1 ? 'day' : 'days'};
          travel totals may be incomplete.
        </p>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <Icon aria-hidden="true" className="size-5 text-brand" />
      <p className="mt-3 text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </article>
  );
}

function hours(value: number) {
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}
