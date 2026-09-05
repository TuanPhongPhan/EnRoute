import { describe, expect, it } from 'vitest';

import { journeyFitMinutes } from '@/lib/focus-session';
import type { TransportJourney } from '@/lib/transport-provider';

function journeyWithTrainLeg(minutes: number): TransportJourney {
  const departure = new Date('2030-08-10T06:00:00.000Z');
  const arrival = new Date(departure.getTime() + minutes * 60_000);

  return {
    id: 'journey',
    departure: departure.toISOString(),
    arrival: arrival.toISOString(),
    durationMinutes: minutes,
    transfers: 0,
    hasDelays: false,
    legs: [
      {
        mode: 'regional_train',
        label: 'RE9',
        origin: 'München Hbf',
        destination: 'Neu-Ulm',
        scheduledDeparture: departure.toISOString(),
        actualDeparture: departure.toISOString(),
        scheduledArrival: arrival.toISOString(),
        actualArrival: arrival.toISOString(),
        delayMinutes: 0,
      },
    ],
  };
}

describe('journeyFitMinutes', () => {
  it('keeps a five-minute arrival reserve and caps a session at 50 minutes', () => {
    expect(journeyFitMinutes(journeyWithTrainLeg(40))).toBe(35);
    expect(journeyFitMinutes(journeyWithTrainLeg(90))).toBe(50);
  });

  it('does not offer a journey-fit session for a short non-train leg', () => {
    expect(journeyFitMinutes(journeyWithTrainLeg(19))).toBeNull();
  });
});
