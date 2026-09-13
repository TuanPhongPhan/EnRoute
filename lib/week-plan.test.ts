import { describe, expect, it } from 'vitest';

import { calculateWeekMetrics, mapWithConcurrency, type WeekPlanDay } from '@/lib/week-plan';

const days: WeekPlanDay[] = [
  {
    key: '2026-09-14',
    journeyState: 'ready',
    events: [
      { id: 'class', title: 'Mathematics', startsAt: '2026-09-14T08:00:00.000Z', endsAt: '2026-09-14T10:00:00.000Z' },
    ],
    journey: {
      id: 'journey',
      departure: '2026-09-14T05:00:00.000Z',
      arrival: '2026-09-14T08:00:00.000Z',
      durationMinutes: 180,
      transfers: 2,
      hasDelays: false,
      legs: [
        {
          mode: 'subway',
          label: 'U2',
          origin: 'Dülferstraße',
          destination: 'München Hbf',
          scheduledDeparture: '2026-09-14T05:00:00.000Z',
          actualDeparture: '2026-09-14T05:00:00.000Z',
          scheduledArrival: '2026-09-14T05:15:00.000Z',
          actualArrival: '2026-09-14T05:15:00.000Z',
          delayMinutes: 0,
        },
        {
          mode: 'regional_train',
          label: 'RE9',
          origin: 'München Hbf',
          destination: 'Neu-Ulm',
          scheduledDeparture: '2026-09-14T05:20:00.000Z',
          actualDeparture: '2026-09-14T05:20:00.000Z',
          scheduledArrival: '2026-09-14T06:35:00.000Z',
          actualArrival: '2026-09-14T06:35:00.000Z',
          delayMinutes: 0,
        },
      ],
    },
  },
];

describe('calculateWeekMetrics', () => {
  it('preserves university and travel totals while counting only regional-train study time', () => {
    expect(calculateWeekMetrics(days)).toEqual({ universityMinutes: 120, travelMinutes: 180, trainMinutes: 75 });
  });
});

describe('mapWithConcurrency', () => {
  it('never starts more work than the configured limit', async () => {
    let active = 0;
    let highestActive = 0;
    const gates = [0, 1, 2, 3].map(() => Promise.withResolvers<void>());
    const work = mapWithConcurrency([0, 1, 2, 3], 2, async (index) => {
      active += 1;
      highestActive = Math.max(highestActive, active);
      await gates[index].promise;
      active -= 1;
      return index;
    });

    await Promise.resolve();
    expect(highestActive).toBe(2);
    gates[0].resolve();
    gates[1].resolve();
    await Promise.resolve();
    gates[2].resolve();
    gates[3].resolve();

    await expect(work).resolves.toEqual([0, 1, 2, 3]);
    expect(highestActive).toBe(2);
  });
});
