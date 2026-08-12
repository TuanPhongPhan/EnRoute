import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Payload = { calendarEventId?: unknown; departureAt?: unknown; arrivalAt?: unknown; eventStartsAt?: unknown };

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
  // One active record per user/event prevents the scheduler from delivering duplicate reminders after route refreshes.
  await supabase
    .from('monitored_commutes')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('calendar_event_id', body.calendarEventId)
    .eq('status', 'active');
  const { error } = await supabase.from('monitored_commutes').insert({
    user_id: user.id,
    calendar_event_id: body.calendarEventId,
    departure_at: body.departureAt,
    arrival_at: body.arrivalAt,
    event_starts_at: body.eventStartsAt,
  });
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
