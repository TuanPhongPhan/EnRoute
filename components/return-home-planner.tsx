'use client';

import { ArrowRight, Clock3, Home, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readCommutePreferences } from '@/lib/commute-preferences';
import { readCurrentJourney, saveCurrentJourneys, selectedJourney } from '@/lib/current-journey';
import { formatLastUpdated } from '@/lib/commute-view';
import { berlinTimeInput, defaultReturnDeparture, setBerlinTime } from '@/lib/return-journey';
import type { TransportJourney } from '@/lib/transport-provider';

type ReturnState =
  | 'idle'
  | 'loading'
  | 'route_ready'
  | 'past_time'
  | 'location_not_found'
  | 'no_route'
  | 'rate_limited'
  | 'unavailable';
type JourneyResponse = { journeys: TransportJourney[]; fetchedAt: string };

export function ReturnHomePlanner({ lastClassEndsAt }: { lastClassEndsAt: string }) {
  const [departureAt, setDepartureAt] = useState(() => defaultReturnDeparture([{ endsAt: lastClassEndsAt }]));
  const [time, setTime] = useState(() => berlinTimeInput(defaultReturnDeparture([{ endsAt: lastClassEndsAt }])));
  const [journey, setJourney] = useState<TransportJourney | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [state, setState] = useState<ReturnState>('idle');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDeparture = defaultReturnDeparture([{ endsAt: lastClassEndsAt }]);
      const current = readCurrentJourney('return');
      const selected = selectedJourney(current);
      setDepartureAt(nextDeparture);
      setTime(berlinTimeInput(nextDeparture));
      setJourney(selected);
      setUpdatedAt(current?.fetchedAt ?? null);
      setState(selected ? 'route_ready' : 'idle');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [lastClassEndsAt]);

  function changeTime(value: string) {
    const nextDeparture = setBerlinTime(departureAt, value);
    setTime(value);
    if (nextDeparture) setDepartureAt(nextDeparture);
    setJourney(null);
    setUpdatedAt(null);
    setState('idle');
  }

  async function findReturnJourney() {
    const selectedDeparture = setBerlinTime(departureAt, time);
    if (!selectedDeparture || selectedDeparture <= new Date()) {
      setState('past_time');
      return;
    }
    const preferences = readCommutePreferences();
    setState('loading');
    try {
      const params = new URLSearchParams({
        from: preferences.universityAddress,
        to: preferences.homeAddress,
        time: selectedDeparture.toISOString(),
      });
      const response = await fetch(`/api/transport/journeys?${params.toString()}`);
      if (!response.ok) {
        setState(toReturnState(((await response.json()) as { error?: string }).error));
        return;
      }
      const payload = (await response.json()) as JourneyResponse;
      const current = saveCurrentJourneys(
        payload.journeys,
        undefined,
        readCurrentJourney('return')?.selectedJourneyId,
        payload.fetchedAt,
        'return',
      );
      const selected = selectedJourney(current);
      if (!selected) {
        setState('no_route');
        return;
      }
      setJourney(selected);
      setUpdatedAt(payload.fetchedAt);
      setDepartureAt(selectedDeparture);
      setState('route_ready');
    } catch {
      setState('unavailable');
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">After HNU</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">Return home.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Choose when you want to leave, then compare regional routes home.
          </p>
        </div>
        <Home aria-hidden="true" className="size-6 text-brand" />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Leaving at
          <span className="relative">
            <Clock3
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              aria-label="Return departure time"
              className="min-h-11 rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm font-semibold text-ink outline-none transition-colors focus:border-brand focus:ring-4 focus:ring-brand/15"
              onChange={(event) => changeTime(event.target.value)}
              type="time"
              value={time}
            />
          </span>
        </label>
        <button
          className="min-h-11 cursor-pointer rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-primary-600 active:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
          disabled={state === 'loading'}
          onClick={() => void findReturnJourney()}
          type="button"
        >
          {state === 'loading' ? 'Finding routes…' : 'Find return journeys'}
        </button>
      </div>

      {journey && state === 'route_ready' && (
        <div className="mt-6 rounded-2xl bg-primary-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold text-ink">Selected return</p>
            <span className="text-sm font-bold text-brand-deep">{formatDuration(journey.durationMinutes)}</span>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Leave HNU</p>
              <time className="mt-1 block text-xl font-bold text-ink">{formatTime(journey.departure)}</time>
            </div>
            <ArrowRight aria-hidden="true" className="size-5 text-brand" />
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Arrive home</p>
              <time className="mt-1 block text-xl font-bold text-ink">{formatTime(journey.arrival)}</time>
            </div>
          </div>
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
            <MapPin aria-hidden="true" className="size-4 text-brand" />
            {journey.transfers === 0 ? 'Direct connection' : `${journey.transfers} transfers`}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-brand-deep">{updatedAt && formatLastUpdated(updatedAt)}</p>
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep transition-colors hover:bg-primary-100"
              href="/journey?direction=return"
            >
              View details <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {state !== 'idle' && state !== 'loading' && state !== 'route_ready' && (
        <p
          aria-live="polite"
          className="mt-5 rounded-xl bg-warning-soft px-3 py-3 text-sm font-semibold text-text-secondary"
        >
          {messageFor(state, updatedAt)}
        </p>
      )}
    </article>
  );
}

function toReturnState(error: string | undefined): ReturnState {
  if (error === 'location_not_found') return 'location_not_found';
  if (error === 'no_route') return 'no_route';
  if (error === 'rate_limited') return 'rate_limited';
  return 'unavailable';
}

function messageFor(state: Exclude<ReturnState, 'idle' | 'loading' | 'route_ready'>, updatedAt: string | null) {
  if (state === 'past_time') return 'Choose a departure time that has not passed yet.';
  if (state === 'location_not_found') return 'One of your saved addresses could not be found. Update it in Settings.';
  if (state === 'no_route') return 'No regional-transport return route was found for that time.';
  const detail = updatedAt ? ` ${formatLastUpdated(updatedAt)}.` : '';
  return state === 'rate_limited' ? `Transitous is rate-limited.${detail}` : `Transitous is unavailable.${detail}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
    new Date(value),
  );
}

function formatDuration(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
