import { describe, expect, it } from 'vitest';
import {
  connectionRisk,
  createCommuteRecommendation,
  departureCountdown,
  rankFeasibleJourneys,
} from '@/lib/commute-engine';
import type { TransportJourney } from '@/lib/transport-provider';

const journey = (
  id: string,
  departure: string,
  arrival: string,
  durationMinutes: number,
  transfers = 1,
): TransportJourney => ({ id, departure, arrival, durationMinutes, transfers, hasDelays: false, legs: [] });

describe('commute engine', () => {
  it('chooses the shortest route that satisfies the requested arrival buffer', () => {
    const routes = [
      journey('late', '2026-08-12T06:00:00.000Z', '2026-08-12T08:05:00.000Z', 125),
      journey('slow', '2026-08-12T05:30:00.000Z', '2026-08-12T07:45:00.000Z', 135),
      journey('best', '2026-08-12T05:45:00.000Z', '2026-08-12T07:50:00.000Z', 125, 0),
    ];
    expect(rankFeasibleJourneys(routes, '2026-08-12T08:15:00.000Z', 15).map((route) => route.id)).toEqual([
      'best',
      'slow',
    ]);
  });

  it('calculates leave time, arrival buffer, risk, and countdown from real timestamps', () => {
    const route = journey('route', '2026-10-25T05:30:00.000Z', '2026-10-25T07:45:00.000Z', 135);
    expect(createCommuteRecommendation(route, '2026-10-25T08:15:00.000Z', 15)).toMatchObject({
      leaveHomeAt: route.departure,
      expectedArrivalAt: route.arrival,
      bufferMinutes: 30,
      risk: 'safe',
    });
    expect(departureCountdown(route.departure, new Date('2026-10-25T05:10:00.000Z'))).toBe(20);
  });

  it('flags tight and missed live transfers', () => {
    const tight = journey('tight', '2026-08-12T06:00:00Z', '2026-08-12T08:00:00Z', 120);
    tight.legs = [
      { actualDeparture: '2026-08-12T06:00:00Z', actualArrival: '2026-08-12T07:00:00Z' },
      { actualDeparture: '2026-08-12T07:03:00Z', actualArrival: '2026-08-12T08:00:00Z' },
    ] as TransportJourney['legs'];
    expect(connectionRisk(tight)).toBe('at_risk');
  });
});
