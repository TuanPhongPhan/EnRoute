import type { TransportJourney, TransportJourneyLeg } from '@/lib/transport-provider';

export const transferAlertLeadMinutes = 5;

export type CommuteTransferAlert = {
  sequence: number;
  alertAt: string;
  arrivesAt: string;
  station: string;
  nextServiceLabel: string;
  nextServiceDestination: string;
};

export function createTransferAlerts(legs: TransportJourneyLeg[]): CommuteTransferAlert[] {
  const alerts: CommuteTransferAlert[] = [];
  for (let index = 0; index < legs.length; index += 1) {
    const incoming = legs[index];
    if (!incoming || incoming.mode === 'walk') continue;
    const nextService = legs.slice(index + 1).find((leg) => leg.mode !== 'walk');
    if (!nextService) continue;
    const arrivesAt = incoming.actualArrival;
    const arrival = Date.parse(arrivesAt);
    if (Number.isNaN(arrival)) continue;
    alerts.push({
      sequence: alerts.length,
      alertAt: new Date(arrival - transferAlertLeadMinutes * 60_000).toISOString(),
      arrivesAt,
      station: incoming.destination,
      nextServiceLabel: nextService.label,
      nextServiceDestination: nextService.destination,
    });
  }
  return alerts;
}

export function commuteRouteFingerprint(journey: Pick<TransportJourney, 'departure' | 'arrival' | 'legs'>) {
  // Live delays update actual times frequently. They must not turn the same trip into a
  // new monitored commute (and a fresh set of transfer notifications) on every refresh.
  // Scheduled times identify the chosen route; a different booked route still replaces it.
  return JSON.stringify({
    departure: journey.departure,
    arrival: journey.arrival,
    legs: journey.legs.map((leg) => [
      leg.mode,
      leg.label,
      leg.origin,
      leg.destination,
      leg.scheduledDeparture,
      leg.scheduledArrival,
    ]),
  });
}
