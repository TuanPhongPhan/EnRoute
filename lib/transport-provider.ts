export type TransportMode = 'walk' | 'subway' | 'tram' | 'bus' | 'regional_train' | 'ice' | 'other';

export type TransportJourneyLeg = {
  mode: TransportMode;
  label: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  actualDeparture: string;
  scheduledArrival: string;
  actualArrival: string;
  platform?: string;
  delayMinutes: number;
  hasRealtime?: boolean;
};

export type TransportJourney = {
  id: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  transfers: number;
  hasDelays: boolean;
  hasRealtime?: boolean;
  refreshToken?: string;
  legs: TransportJourneyLeg[];
};

export type JourneySearchInput = {
  from: string;
  to: string;
  time: Date;
  arriveBy?: boolean;
};

export interface TransportProvider {
  searchJourneys(input: JourneySearchInput): Promise<TransportJourney[]>;
}

export class TransportProviderError extends Error {
  constructor(public readonly code: 'location_not_found' | 'no_route' | 'rate_limited' | 'unavailable', message: string) {
    super(message);
    this.name = 'TransportProviderError';
  }
}
