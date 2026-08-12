'use client';

import { ArrowRight, CheckCircle2, Clock3, Footprints, Route, TrainFront } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readCurrentJourney, selectCurrentJourney, type CurrentJourney } from '@/lib/current-journey';
import type { TransportJourney } from '@/lib/transport-provider';

export function JourneyRouteSelector() {
  const [current, setCurrent] = useState<CurrentJourney | null | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrent(readCurrentJourney()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (current === undefined) return <JourneyLoading />;
  if (!current) return <JourneyUnavailable />;

  function chooseRoute(id: string) {
    setCurrent(selectCurrentJourney(id));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Journey</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">Choose your connection.</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted">
            Compare regional-transport routes. EnRoute balances your arrival around 30 minutes before class, then you
            can select the connection you want to use.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep transition-colors duration-200 hover:bg-teal-50"
          href="/"
        >
          <span>Back to Today</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <section aria-labelledby="route-options-heading" className="mt-7">
        <h2 id="route-options-heading" className="sr-only">
          Available route options
        </h2>
        <div aria-live="polite" className="sr-only">
          {selectedRouteLabel(current)}
        </div>
        <div className="space-y-4">
          {current.journeys.map((journey, index) => (
            <RouteOption
              isRecommended={index === 0}
              isSelected={current.selectedJourneyId === journey.id}
              journey={journey}
              key={journey.id}
              onChoose={chooseRoute}
            />
          ))}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted">
        High-speed and long-distance services are excluded. Confirm ticket validity before travelling.
      </p>
    </div>
  );
}

function RouteOption({
  isRecommended,
  isSelected,
  journey,
  onChoose,
}: {
  isRecommended: boolean;
  isSelected: boolean;
  journey: TransportJourney;
  onChoose: (id: string) => void;
}) {
  const lines = [...new Set(journey.legs.filter((leg) => leg.mode !== 'walk').map((leg) => leg.label))].slice(0, 3);
  return (
    <button
      aria-pressed={isSelected}
      className={`w-full cursor-pointer rounded-3xl border p-5 text-left shadow-sm transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 sm:p-6 ${isSelected ? 'border-brand bg-teal-50' : 'border-teal-950/10 bg-surface hover:border-brand/60 hover:bg-teal-50/50'}`}
      onClick={() => onChoose(journey.id)}
      type="button"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isSelected ? (
            <CheckCircle2 aria-hidden="true" className="size-5 text-brand" />
          ) : (
            <Route aria-hidden="true" className="size-5 text-muted" />
          )}
          <span className="font-bold text-ink">{isSelected ? 'Selected route' : 'Choose this route'}</span>
          {isRecommended && (
            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-brand-deep">
              Balanced recommendation
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-brand-deep">{formatDuration(journey.durationMinutes)}</span>
      </div>
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Leave</p>
          <time className="mt-1 block text-2xl font-bold tracking-tight text-ink">{formatTime(journey.departure)}</time>
        </div>
        <ArrowRight aria-hidden="true" className="mb-1 size-5 text-brand" />
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Arrive</p>
          <time className="mt-1 block text-2xl font-bold tracking-tight text-ink">{formatTime(journey.arrival)}</time>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-teal-950/10 pt-4 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <Clock3 aria-hidden="true" className="size-4 text-brand" />
          {journey.transfers === 0
            ? 'Direct connection'
            : `${journey.transfers} transfer${journey.transfers === 1 ? '' : 's'}`}
        </span>
        {lines.length > 0 ? (
          <span className="inline-flex items-center gap-2">
            <TrainFront aria-hidden="true" className="size-4 text-brand" />
            {lines.join(' · ')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Footprints aria-hidden="true" className="size-4 text-brand" />
            Walking route
          </span>
        )}
      </div>
    </button>
  );
}

function JourneyLoading() {
  return (
    <div aria-label="Loading journey options" className="mx-auto max-w-3xl animate-pulse space-y-4">
      <div className="h-10 w-72 rounded bg-teal-100" />
      <div className="h-52 rounded-3xl bg-teal-100" />
      <div className="h-52 rounded-3xl bg-teal-100" />
    </div>
  );
}
function JourneyUnavailable() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-teal-950/10 bg-surface p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Journey</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">No route choices yet.</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted">
        Open Today to calculate routes from your saved transit stops, then return here to choose one.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
        href="/"
      >
        Open Today
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
function selectedRouteLabel(current: CurrentJourney) {
  const index = current.journeys.findIndex((journey) => journey.id === current.selectedJourneyId);
  return `Route ${index + 1} selected.`;
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
    new Date(value),
  );
}
function formatDuration(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
