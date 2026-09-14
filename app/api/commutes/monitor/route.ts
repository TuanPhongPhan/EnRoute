import { NextResponse } from 'next/server';
import { createTransferAlerts, commuteRouteFingerprint } from '@/lib/commute-transfer-alerts';
import type { TravelDirection } from '@/lib/current-journey';
import { createClient } from '@/lib/supabase/server';
import type { TransportJourneyLeg } from '@/lib/transport-provider';

type Payload = {
  calendarEventId?: unknown;
  departureAt?: unknown;
  arrivalAt?: unknown;
  eventStartsAt?: unknown;
  direction?: unknown;
  journey?: unknown;
};
type JourneyPayload = { departure: string; arrival: string; legs: TransportJourneyLeg[] };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const body = (await request.json()) as Payload;
  if (
    ![body.departureAt, body.arrivalAt, body.eventStartsAt].every(
      (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
    )
  )
    return NextResponse.json({ error: 'invalid_commute' }, { status: 400 });
  if (typeof body.calendarEventId !== 'string' || body.calendarEventId.length > 256)
    return NextResponse.json({ error: 'invalid_commute' }, { status: 400 });
  if (body.direction !== 'outbound' && body.direction !== 'return')
    return NextResponse.json({ error: 'invalid_commute' }, { status: 400 });
  if (!isJourneyPayload(body.journey)) return NextResponse.json({ error: 'invalid_commute' }, { status: 400 });

  const journey = body.journey;
  const fingerprint = commuteRouteFingerprint(journey);
  const direction: TravelDirection = body.direction;
  const { data: existing, error: existingError } = await supabase
    .from('monitored_commutes')
    .select('id, route_fingerprint')
    .eq('user_id', user.id)
    .eq('calendar_event_id', body.calendarEventId)
    .eq('direction', direction)
    .eq('status', 'active')
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  // Frequent route refreshes must not reset countdowns that have already been delivered.
  if (existing?.route_fingerprint === fingerprint) return NextResponse.json({ ok: true, unchanged: true });
  if (existing) {
    const { error: cancelError } = await supabase
      .from('monitored_commutes')
      .update({ status: 'cancelled' })
      .eq('id', existing.id)
      .eq('status', 'active');
    if (cancelError) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    await supabase
      .from('commute_transfer_alerts')
      .update({ status: 'cancelled' })
      .eq('monitored_commute_id', existing.id)
      .eq('status', 'scheduled');
  }

  const { data: commute, error } = await supabase
    .from('monitored_commutes')
    .insert({
      user_id: user.id,
      calendar_event_id: body.calendarEventId,
      departure_at: body.departureAt,
      arrival_at: body.arrivalAt,
      event_starts_at: body.eventStartsAt,
      direction,
      route_fingerprint: fingerprint,
    })
    .select('id')
    .single();
  if (error || !commute) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  const now = Date.now();
  const transfers = createTransferAlerts(journey.legs).filter((alert) => Date.parse(alert.arrivesAt) > now + 60_000);
  if (transfers.length) {
    const { error: transferError } = await supabase.from('commute_transfer_alerts').insert(
      transfers.map((alert) => ({
        monitored_commute_id: commute.id,
        user_id: user.id,
        sequence: alert.sequence,
        alert_at: alert.alertAt,
        arrives_at: alert.arrivesAt,
        station: alert.station,
        next_service_label: alert.nextServiceLabel,
        next_service_destination: alert.nextServiceDestination,
      })),
    );
    if (transferError) {
      await supabase.from('monitored_commutes').update({ status: 'cancelled' }).eq('id', commute.id);
      return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, transfers: transfers.length });
}

function isJourneyPayload(value: unknown): value is JourneyPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.departure === 'string' &&
    typeof candidate.arrival === 'string' &&
    !Number.isNaN(Date.parse(candidate.departure)) &&
    !Number.isNaN(Date.parse(candidate.arrival)) &&
    Array.isArray(candidate.legs) &&
    candidate.legs.length <= 24 &&
    candidate.legs.every(isTransportJourneyLeg)
  );
}

function isTransportJourneyLeg(value: unknown): value is TransportJourneyLeg {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isText(candidate.mode, 32) &&
    isText(candidate.label, 120) &&
    isText(candidate.origin, 160) &&
    isText(candidate.destination, 160) &&
    isDate(candidate.scheduledDeparture) &&
    isDate(candidate.actualDeparture) &&
    isDate(candidate.scheduledArrival) &&
    isDate(candidate.actualArrival) &&
    typeof candidate.delayMinutes === 'number'
  );
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
