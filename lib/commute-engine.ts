import type { TransportJourney } from '@/lib/transport-provider';

export type CommuteRisk = 'safe' | 'tight' | 'late';
export type ConnectionRisk = 'safe' | 'at_risk' | 'missed';

export const balancedArrivalBufferMinutes = 30;

export type CommuteRecommendation = {
  journey: TransportJourney;
  leaveHomeAt: string;
  expectedArrivalAt: string;
  bufferMinutes: number;
  risk: CommuteRisk;
  connectionRisk: ConnectionRisk;
};

export function rankFeasibleJourneys(
  journeys: TransportJourney[],
  classStartsAt: string,
  arrivalBufferMinutes: number,
) {
  // A route must reach HNU before the user-configured buffer begins; showing a faster-but-late option is misleading.
  const targetArrival = Date.parse(classStartsAt) - arrivalBufferMinutes * 60_000;
  // Aim for a practical cushion instead of always choosing the shortest trip, which can require leaving unnecessarily early.
  const balancedBuffer = Math.max(arrivalBufferMinutes, balancedArrivalBufferMinutes);
  return journeys
    .filter((journey) => Date.parse(journey.arrival) <= targetArrival)
    .sort(
      (left, right) =>
        Math.abs(arrivalBuffer(classStartsAt, left.arrival) - balancedBuffer) -
          Math.abs(arrivalBuffer(classStartsAt, right.arrival) - balancedBuffer) ||
        left.transfers - right.transfers ||
        left.durationMinutes - right.durationMinutes ||
        Date.parse(right.arrival) - Date.parse(left.arrival),
    );
}

export function createCommuteRecommendation(
  journey: TransportJourney,
  classStartsAt: string,
  arrivalBufferMinutes: number,
): CommuteRecommendation {
  const bufferMinutes = arrivalBuffer(classStartsAt, journey.arrival);
  return {
    journey,
    leaveHomeAt: journey.departure,
    expectedArrivalAt: journey.arrival,
    bufferMinutes,
    risk: bufferMinutes >= arrivalBufferMinutes ? 'safe' : bufferMinutes >= 0 ? 'tight' : 'late',
    connectionRisk: connectionRisk(journey),
  };
}

export function connectionRisk(journey: TransportJourney, minimumMinutes = 5): ConnectionRisk {
  // Use actual times so realtime delays affect transfer risk; five minutes is the app's conservative default.
  for (let index = 0; index < journey.legs.length - 1; index += 1) {
    const margin = Math.round(
      (Date.parse(journey.legs[index + 1].actualDeparture) - Date.parse(journey.legs[index].actualArrival)) / 60_000,
    );
    if (margin < 0) return 'missed';
    if (margin < minimumMinutes) return 'at_risk';
  }
  return 'safe';
}

export function departureCountdown(leaveHomeAt: string, now = new Date()) {
  return Math.round((Date.parse(leaveHomeAt) - now.getTime()) / 60_000);
}

function arrivalBuffer(classStartsAt: string, arrivalAt: string) {
  return Math.round((Date.parse(classStartsAt) - Date.parse(arrivalAt)) / 60_000);
}
