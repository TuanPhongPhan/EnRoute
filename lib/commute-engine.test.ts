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
  it('prefers the route closest to the balanced arrival target when multiple routes meet the minimum buffer', () => {
    const routes = [
      journey('late', '2026-08-12T06:00:00.000Z', '2026-08-12T08:05:00.000Z', 125),
      journey('slow', '2026-08-12T05:30:00.000Z', '2026-08-12T07:45:00.000Z', 135),
      journey('best', '2026-08-12T05:45:00.000Z', '2026-08-12T07:50:00.000Z', 125, 0),
    ];
    expect(rankFeasibleJourneys(routes, '2026-08-12T08:15:00.000Z', 15).map((route) => route.id)).toEqual([
      'slow',
      'best',
    ]);
  });

  it('prefers the route closest to a balanced 30-minute arrival margin over a slightly faster early route', () => {
    const routes = [
      journey('early-fast', '2026-08-12T06:18:00.000Z', '2026-08-12T09:10:00.000Z', 172, 3),
      journey('balanced', '2026-08-12T07:13:00.000Z', '2026-08-12T10:10:00.000Z', 177, 2),
      journey('too-late', '2026-08-12T07:20:00.000Z', '2026-08-12T10:50:00.000Z', 210, 1),
    ];

    expect(rankFeasibleJourneys(routes, '2026-08-12T11:00:00.000Z', 15).map((route) => route.id)).toEqual([
      'balanced',
      'early-fast',
    ]);
  });

  it('never aims below a user preference that is larger than the balanced default', () => {
    const routes = [
      journey('thirty-minute-buffer', '2026-08-12T06:00:00.000Z', '2026-08-12T07:45:00.000Z', 105),
      journey('forty-five-minute-buffer', '2026-08-12T05:45:00.000Z', '2026-08-12T07:30:00.000Z', 105),
    ];

    expect(rankFeasibleJourneys(routes, '2026-08-12T08:15:00.000Z', 45).map((route) => route.id)).toEqual([
      'forty-five-minute-buffer',
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
