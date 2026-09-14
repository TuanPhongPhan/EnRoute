'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react';
import { TodayDashboard } from '@/components/today-dashboard';
import { clientCache } from '@/lib/client-cache';
import { createCommuteRecommendation, rankFeasibleJourneys } from '@/lib/commute-engine';
import { monitorCommute } from '@/lib/commute-monitor-client';
import { readCommutePreferences } from '@/lib/commute-preferences';
import { readCurrentJourney, saveCurrentJourneys, selectedJourney } from '@/lib/current-journey';
import { createTodayCommute, type TodayCommute } from '@/lib/commute-view';
import { berlinDayRange } from '@/lib/return-journey';
import type { TransportJourney } from '@/lib/transport-provider';
import { readEventSnapshot, saveEventSnapshot } from '@/lib/offline-snapshot';

type CalendarEvent = { id: string; title: string; startsAt: string; endsAt: string; location: string };
type CalendarResponse = { event: CalendarEvent | null };
type DayEventsResponse = { events: CalendarEvent[] };
type CalendarState = 'loading' | 'connected' | 'disconnected' | 'no-event' | 'unavailable';
type TransportState = 'loading' | 'route_ready' | 'location_not_found' | 'no_route' | 'rate_limited' | 'unavailable';
type JourneyResponse = { journeys: TransportJourney[]; fetchedAt: string };
type CachedCalendarResult = { event: CalendarEvent | null; state: CalendarState };
const todayCalendarCacheTtlMs = 60_000;

export function TodayDashboardClient() {
  const [commute, setCommute] = useState<TodayCommute | null>(null);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [calendarState, setCalendarState] = useState<CalendarState>('loading');
  const [transportState, setTransportState] = useState<TransportState>('loading');
  const [returnClassEndsAt, setReturnClassEndsAt] = useState<string | undefined>();
  const [returnJourney, setReturnJourney] = useState<TransportJourney | null>(null);
  const [returnJourneyUpdatedAt, setReturnJourneyUpdatedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const handleReturnJourneyChange = useCallback((journey: TransportJourney | null, updatedAt: string | null) => {
    setReturnJourney(journey);
    setReturnJourneyUpdatedAt(updatedAt);
  }, []);

  const refreshJourney = useCallback(async (nextEvent: CalendarEvent) => {
    const preferences = readCommutePreferences();
    setTransportState('loading');
    try {
      const targetArrival = new Date(Date.parse(nextEvent.startsAt) - preferences.arrivalBufferMinutes * 60_000);
      const params = new URLSearchParams({
        from: preferences.homeAddress,
        to: preferences.universityAddress,
        time: targetArrival.toISOString(),
        arriveBy: 'true',
      });
      const response = await fetch(`/api/transport/journeys?${params.toString()}`);
      if (!response.ok) {
        setTransportState(toTransportState(((await response.json()) as { error?: string }).error));
        return;
      }
      const payload = (await response.json()) as JourneyResponse;
      const ranked = rankFeasibleJourneys(payload.journeys, nextEvent.startsAt, preferences.arrivalBufferMinutes);
      if (!ranked.length) {
        setTransportState('no_route');
        return;
      }
      const current = saveCurrentJourneys(
        ranked,
        undefined,
        readCurrentJourney()?.selectedJourneyId,
        payload.fetchedAt,
      );
      const journey = selectedJourney(current);
      if (!journey) {
        setTransportState('unavailable');
        return;
      }
      setCommute(
        createTodayCommute(
          nextEvent,
          createCommuteRecommendation(journey, nextEvent.startsAt, preferences.arrivalBufferMinutes),
          new Date(),
          new Date(payload.fetchedAt),
        ),
      );
      void monitorCommute(
        { calendarEventId: nextEvent.id, eventStartsAt: nextEvent.startsAt, direction: 'outbound' },
        journey,
      );
      setTransportState('route_ready');
    } catch {
      setTransportState('unavailable');
    }
  }, []);

  useEffect(() => {
    const cached = readEventSnapshot();
    if (cached) {
      const current = readCurrentJourney();
      const journey = selectedJourney(current);
      if (journey)
        setCommute(
          createTodayCommute(
            cached.event,
            createCommuteRecommendation(journey, cached.event.startsAt, readCommutePreferences().arrivalBufferMinutes),
            new Date(),
            new Date(current?.fetchedAt ?? cached.fetchedAt),
          ),
        );
      setEvent(cached.event);
      setCalendarState('connected');
      void refreshJourney(cached.event);
    }
    const preferences = readCommutePreferences();
    void clientCache
      .load<CachedCalendarResult>(`today:next-event:${preferences.calendarId}`, todayCalendarCacheTtlMs, async () => {
        const response = await fetch(
          `/api/google/calendar/next-event?calendarId=${encodeURIComponent(preferences.calendarId)}`,
        );
        if (!response.ok) return { event: null, state: response.status === 401 ? 'disconnected' : 'unavailable' };
        const payload = (await response.json()) as CalendarResponse;
        return { event: payload.event, state: payload.event ? 'connected' : 'no-event' };
      })
      .then((result) => {
        if (!result.event) {
          setCalendarState(result.state);
          return;
        }
        saveEventSnapshot(result.event);
        setEvent(result.event);
        setCalendarState(result.state);
        void refreshJourney(result.event);
      })
      .catch(() => setCalendarState('unavailable'));
  }, [refreshJourney]);

  useEffect(() => {
    const preferences = readCommutePreferences();
    const { start, end } = berlinDayRange();
    const key = `today:last-class:${preferences.calendarId}:${start.toISOString()}`;
    void clientCache
      .load(key, todayCalendarCacheTtlMs, async () => {
        const response = await fetch(
          `/api/google/calendar/week-events?${new URLSearchParams({
            calendarId: preferences.calendarId,
            start: start.toISOString(),
            end: end.toISOString(),
          })}`,
        );
        if (!response.ok) throw new Error('day_events_unavailable');
        return ((await response.json()) as DayEventsResponse).events;
      })
      .then((events) => {
        const lastClass = events.reduce<CalendarEvent | null>(
          (latest, next) => (!latest || Date.parse(next.endsAt) > Date.parse(latest.endsAt) ? next : latest),
          null,
        );
        setReturnClassEndsAt(lastClass?.endsAt);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!event) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshJourney(event);
    };
    const timer = window.setInterval(refreshWhenVisible, 120_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [event, refreshJourney]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <TodayDashboard
      calendarState={calendarState}
      commute={commute}
      now={now}
      returnJourney={returnJourney}
      returnJourneyUpdatedAt={returnJourneyUpdatedAt}
      onReturnJourneyChange={handleReturnJourneyChange}
      returnClassEndsAt={returnClassEndsAt}
      onRefreshJourney={
        event
          ? () => {
              void refreshJourney(event);
            }
          : undefined
      }
      transportState={transportState}
    />
  );
}

function toTransportState(error: string | undefined): TransportState {
  if (error === 'location_not_found') return 'location_not_found';
  if (error === 'no_route') return 'no_route';
  if (error === 'rate_limited') return 'rate_limited';
  return 'unavailable';
}
