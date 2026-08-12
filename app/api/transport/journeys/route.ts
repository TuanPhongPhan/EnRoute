import { NextResponse } from 'next/server';
import { TransitousTransportProvider } from '@/lib/transitous-transport-provider';
import { TransportProviderError } from '@/lib/transport-provider';

export const runtime = 'nodejs';

const provider = new TransitousTransportProvider();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const time = url.searchParams.get('time');
  const arriveBy = url.searchParams.get('arriveBy') === 'true';
  if (!isStop(from) || !isStop(to)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const routeTime = time ? new Date(time) : new Date();
  if (Number.isNaN(routeTime.getTime())) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  try {
    const journeys = await provider.searchJourneys({ from, to, time: routeTime, arriveBy });
    return NextResponse.json({ journeys, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TransportProviderError) {
      const status = error.code === 'location_not_found' ? 404 : error.code === 'no_route' ? 422 : error.code === 'rate_limited' ? 429 : 503;
      return NextResponse.json({ error: error.code }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}

function isStop(value: string | null): value is string { return Boolean(value && value.trim().length >= 2 && value.length <= 120); }
