import { describe, expect, it, vi } from 'vitest';
import {
  buildGeocodeUrl,
  buildPlanUrl,
  normalizeTransitousItinerary,
  TransitousTransportProvider,
} from '@/lib/transitous-transport-provider';

const input = {
  from: 'Graslilienanger 12, 80937 München',
  to: 'Hochschule Neu-Ulm, Wileystraße 1, 89231 Neu-Ulm',
  time: new Date('2026-08-11T06:00:00.000Z'),
  arriveBy: true,
};

describe('Transitous transport provider', () => {
  it('geocodes saved stop names then requests regional modes only and caches the journey', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'from-stop', type: 'STOP' }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 'to-stop', type: 'STOP' }]))
      .mockResolvedValueOnce(jsonResponse({ itineraries: [itinerary] }));
    const provider = new TransitousTransportProvider(fetcher, () => input.time.getTime());
    process.env.TRANSITOUS_USER_AGENT = 'EnRoute/1.0 (contact: test@example.com)';

    await provider.searchJourneys(input);
    await provider.searchJourneys(input);

    expect(fetcher).toHaveBeenCalledTimes(3);
    const planUrl = fetcher.mock.calls[2]?.[0] as URL;
    expect(planUrl.searchParams.get('transitModes')).toBe('SUBWAY,BUS,TRAM,SUBURBAN,REGIONAL_RAIL');
    expect(planUrl.searchParams.get('arriveBy')).toBe('true');
    expect(planUrl.searchParams.get('numItineraries')).toBe('3');
  });

  it('builds address-capable geocoding and regional-only planning URLs', () => {
    expect(buildGeocodeUrl('Dülferstraße').searchParams).toMatchObject({});
    expect(buildGeocodeUrl('Dülferstraße').searchParams.get('type')).toBeNull();
    expect(buildPlanUrl('from', 'to', input.time, true).searchParams.get('transitModes')).toBe(
      'SUBWAY,BUS,TRAM,SUBURBAN,REGIONAL_RAIL',
    );
  });

  it('uses a coordinate reference when an address result has no stop ID', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ type: 'ADDRESS', lat: 48.212339, lon: 11.5665618 }]))
      .mockResolvedValueOnce(jsonResponse([{ type: 'ADDRESS', lat: 48.3954, lon: 10.0083 }]))
      .mockResolvedValueOnce(jsonResponse({ itineraries: [itinerary] }));
    const provider = new TransitousTransportProvider(fetcher, () => input.time.getTime());
    process.env.TRANSITOUS_USER_AGENT = 'EnRoute/1.0 (contact: test@example.com)';
    await provider.searchJourneys(input);
    const planUrl = fetcher.mock.calls[2]?.[0] as URL;
    expect(planUrl.searchParams.get('fromPlace')).toBe('48.212339,11.5665618');
  });

  it('normalizes planned and live itinerary times', () => {
    expect(normalizeTransitousItinerary(itinerary, 0)).toMatchObject({
      id: 'regional-route',
      hasDelays: true,
      transfers: 2,
      legs: [
        { mode: 'walk', label: 'Walk' },
        { mode: 'subway', label: 'U2' },
        { mode: 'regional_train', label: 'RE 9', delayMinutes: 2 },
        { mode: 'bus', label: 'Bus 5' },
      ],
    });
  });
});

const itinerary = {
  id: 'regional-route',
  startTime: '2026-08-11T06:20:00Z',
  endTime: '2026-08-11T08:20:00Z',
  duration: 7200,
  transfers: 2,
  legs: [
    {
      mode: 'WALK',
      from: { name: 'Home' },
      to: { name: 'Dülferstraße' },
      startTime: '2026-08-11T06:20:00Z',
      endTime: '2026-08-11T06:27:00Z',
      scheduledStartTime: '2026-08-11T06:20:00Z',
      scheduledEndTime: '2026-08-11T06:27:00Z',
    },
    {
      mode: 'SUBWAY',
      displayName: 'U2',
      from: { name: 'Dülferstraße' },
      to: { name: 'München Hbf' },
      startTime: '2026-08-11T06:31:00Z',
      endTime: '2026-08-11T06:51:00Z',
      scheduledStartTime: '2026-08-11T06:30:00Z',
      scheduledEndTime: '2026-08-11T06:50:00Z',
    },
    {
      mode: 'REGIONAL_RAIL',
      displayName: 'RE 9',
      from: { name: 'München Hbf' },
      to: { name: 'Ulm Hbf' },
      startTime: '2026-08-11T07:02:00Z',
      endTime: '2026-08-11T08:07:00Z',
      scheduledStartTime: '2026-08-11T07:00:00Z',
      scheduledEndTime: '2026-08-11T08:05:00Z',
    },
    {
      mode: 'BUS',
      displayName: 'Bus 5',
      from: { name: 'Ulm Hbf' },
      to: { name: 'Neu-Ulm Hochschule' },
      startTime: '2026-08-11T08:10:00Z',
      endTime: '2026-08-11T08:20:00Z',
      scheduledStartTime: '2026-08-11T08:10:00Z',
      scheduledEndTime: '2026-08-11T08:20:00Z',
    },
  ],
};

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
