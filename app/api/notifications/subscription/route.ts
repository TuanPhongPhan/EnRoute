import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type SubscriptionPayload = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const body = (await request.json()) as SubscriptionPayload;
  if (typeof body.endpoint !== 'string' || typeof body.keys?.p256dh !== 'string' || typeof body.keys.auth !== 'string')
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  // Store only browser-issued subscription material. RLS binds every record to the authenticated user.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
      { onConflict: 'user_id,endpoint' },
    );
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const endpoint = ((await request.json()) as { endpoint?: unknown }).endpoint;
  if (typeof endpoint !== 'string') return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
