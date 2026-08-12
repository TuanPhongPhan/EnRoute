import type { JourneySearchInput, TransportJourney, TransportJourneyLeg, TransportMode, TransportProvider } from '@/lib/transport-provider';
import { TransportProviderError } from '@/lib/transport-provider';

const baseUrl = 'https://api.transitous.org';
const cacheTtlMs = 60_000;
const regionalTransitModes = ['SUBWAY', 'BUS', 'TRAM', 'SUBURBAN', 'REGIONAL_RAIL'] as const;

type TransitousMatch = { id?: string; type?: string; lat?: number; lon?: number };
type TransitousPlace = { name?: string };
type TransitousLeg = {
  mode?: string;
  from?: TransitousPlace;
  to?: TransitousPlace;
  startTime?: string;
  endTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  displayName?: string;
  routeShortName?: string;
};
type TransitousItinerary = { id?: string; startTime?: string; endTime?: string; duration?: number; transfers?: number; legs?: TransitousLeg[] };
type TransitousPlan = { itineraries?: TransitousItinerary[] };
type CacheEntry<T> = { expiresAt: number; value: T };
type Fetcher = (input: URL, init: RequestInit) => Promise<Response>;

export class TransitousTransportProvider implements TransportProvider {
  private readonly stopCache = new Map<string, CacheEntry<string>>();
  private readonly journeyCache = new Map<string, CacheEntry<TransportJourney[]>>();

  constructor(private readonly fetcher: Fetcher = fetch, private readonly now = () => Date.now()) {}

  async searchJourneys(input: JourneySearchInput): Promise<TransportJourney[]> {
    const key = journeyCacheKey(input);
    const cached = this.fromCache(this.journeyCache, key);
    if (cached) return cached;

    try {
      const [fromPlace, toPlace] = await Promise.all([this.resolveStop(input.from), this.resolveStop(input.to)]);
      const url = buildPlanUrl(fromPlace, toPlace, input.time, input.arriveBy);
      const payload = await this.fetchJson<TransitousPlan>(url, 'plan');
      const journeys = (payload.itineraries ?? []).map(normalizeTransitousItinerary).filter((journey): journey is TransportJourney => journey !== null);
      if (!journeys.length) throw new TransportProviderError('no_route', 'No regional-transport journey was returned.');
      this.toCache(this.journeyCache, key, journeys);
      return journeys;
    } catch (error) {
      if (error instanceof TransportProviderError) throw error;
      throw new TransportProviderError('unavailable', 'Regional transport data is unavailable.');
    }
  }

  private async resolveStop(query: string) {
    const key = query.trim().toLowerCase();
    const cached = this.fromCache(this.stopCache, key);
    if (cached) return cached;
    const payload = await this.fetchJson<TransitousMatch[]>(buildGeocodeUrl(query), 'geocode');
    const address = payload.find((match) => typeof match.lat === 'number' && typeof match.lon === 'number');
    const placeReference = address ? `${address.lat},${address.lon}` : payload.find((match) => typeof match.id === 'string' && match.id.length > 0)?.id;
    if (!placeReference) throw new TransportProviderError('location_not_found', 'One of the saved addresses could not be found.');
    this.toCache(this.stopCache, key, placeReference);
    return placeReference;
  }

  private fromCache<T>(cache: Map<string, CacheEntry<T>>, key: string) {
    const cached = cache.get(key);
    return cached && cached.expiresAt > this.now() ? cached.value : null;
  }

  private toCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
    cache.set(key, { value, expiresAt: this.now() + cacheTtlMs });
  }

  private async fetchJson<T>(url: URL, kind: 'geocode' | 'plan'): Promise<T> {
    const userAgent = process.env.TRANSITOUS_USER_AGENT?.trim();
    if (!userAgent) throw new TransportProviderError('unavailable', 'Transitous is not configured. Add TRANSITOUS_USER_AGENT to .env.local.');
    let response: Response;
    try {
      response = await this.fetcher(url, { cache: 'no-store', headers: { Accept: 'application/json', 'User-Agent': userAgent } });
    } catch {
      throw new TransportProviderError('unavailable', 'Regional transport provider could not be reached.');
    }
    if (kind === 'geocode' && (response.status === 400 || response.status === 404 || response.status === 422)) {
      throw new TransportProviderError('location_not_found', 'One of the saved addresses could not be found.');
    }
    if (kind === 'plan' && response.status === 422) throw new TransportProviderError('no_route', 'No regional-transport route was found.');
    if (response.status === 429) throw new TransportProviderError('rate_limited', 'Regional transport requests are temporarily rate-limited.');
    if (!response.ok) throw new TransportProviderError('unavailable', 'Regional transport provider is unavailable.');
    return response.json() as Promise<T>;
  }
}

export function buildGeocodeUrl(query: string) {
  const url = new URL('/api/v1/geocode', baseUrl);
  url.searchParams.set('text', query);
  url.searchParams.set('language', 'de');
  url.searchParams.set('numResults', '1');
  return url;
}

export function buildPlanUrl(fromPlace: string, toPlace: string, time: Date, arriveBy = false) {
  const url = new URL('/api/v6/plan', baseUrl);
  url.searchParams.set('fromPlace', fromPlace);
  url.searchParams.set('toPlace', toPlace);
  url.searchParams.set('time', time.toISOString());
  if (arriveBy) url.searchParams.set('arriveBy', 'true');
  url.searchParams.set('transitModes', regionalTransitModes.join(','));
  url.searchParams.set('numItineraries', '3');
  url.searchParams.set('detailedLegs', 'false');
  return url;
}

export function normalizeTransitousItinerary(itinerary: TransitousItinerary, index: number): TransportJourney | null {
  const legs = (itinerary.legs ?? []).map(normalizeLeg).filter((leg): leg is TransportJourneyLeg => leg !== null);
  const departure = itinerary.startTime ?? legs[0]?.actualDeparture;
  const arrival = itinerary.endTime ?? legs.at(-1)?.actualArrival;
  if (!departure || !arrival || !legs.length) return null;
  return {
    id: itinerary.id ?? `transitous-route-${index}`,
    departure,
    arrival,
    durationMinutes: itinerary.duration ? Math.round(itinerary.duration / 60) : Math.max(0, Math.round((Date.parse(arrival) - Date.parse(departure)) / 60_000)),
    transfers: itinerary.transfers ?? Math.max(0, legs.filter((leg) => leg.mode !== 'walk').length - 1),
    hasDelays: legs.some((leg) => leg.delayMinutes > 0),
    hasRealtime: legs.some((leg) => leg.hasRealtime),
    refreshToken: itinerary.id,
    legs,
  };
}

function normalizeLeg(leg: TransitousLeg): TransportJourneyLeg | null {
  const scheduledDeparture = leg.scheduledStartTime ?? leg.startTime;
  const actualDeparture = leg.startTime ?? scheduledDeparture;
  const scheduledArrival = leg.scheduledEndTime ?? leg.endTime;
  const actualArrival = leg.endTime ?? scheduledArrival;
  if (!scheduledDeparture || !actualDeparture || !scheduledArrival || !actualArrival) return null;
  return {
    mode: modeFor(leg.mode),
    label: leg.displayName ?? leg.routeShortName ?? labelFor(leg.mode),
    origin: leg.from?.name ?? 'Departure',
    destination: leg.to?.name ?? 'Arrival',
    scheduledDeparture,
    actualDeparture,
    scheduledArrival,
    actualArrival,
    delayMinutes: Math.max(0, Math.round(Math.max(Date.parse(actualDeparture) - Date.parse(scheduledDeparture), Date.parse(actualArrival) - Date.parse(scheduledArrival)) / 60_000)),
    hasRealtime: Boolean(leg.scheduledStartTime || leg.scheduledEndTime),
  };
}

function modeFor(mode: string | undefined): TransportMode {
  if (mode === 'WALK') return 'walk';
  if (mode === 'SUBWAY') return 'subway';
  if (mode === 'TRAM') return 'tram';
  if (mode === 'BUS') return 'bus';
  if (mode === 'REGIONAL_RAIL' || mode === 'SUBURBAN') return 'regional_train';
  if (mode === 'HIGHSPEED_RAIL' || mode === 'LONG_DISTANCE') return 'ice';
  return 'other';
}

function labelFor(mode: string | undefined) {
  if (mode === 'WALK') return 'Walk';
  if (mode === 'REGIONAL_RAIL') return 'Regional train';
  if (mode === 'SUBURBAN') return 'S-Bahn';
  return mode?.replaceAll('_', ' ') ?? 'Public transport';
}

function journeyCacheKey(input: JourneySearchInput) {
  return `${input.from.trim().toLowerCase()}|${input.to.trim().toLowerCase()}|${input.arriveBy ? 'arrive' : 'depart'}|${Math.floor(input.time.getTime() / cacheTtlMs)}`;
}
