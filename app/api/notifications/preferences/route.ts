import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const fields = [
  'leave_reminders',
  'transfer_alerts',
  'disruption_alerts',
  'platform_alerts',
  'alternative_alerts',
] as const;
type Preferences = Record<(typeof fields)[number], boolean>;
const defaults: Preferences = {
  leave_reminders: false,
  transfer_alerts: false,
  disruption_alerts: false,
  platform_alerts: false,
  alternative_alerts: false,
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('leave_reminders, transfer_alerts, disruption_alerts, platform_alerts, alternative_alerts')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  return NextResponse.json({ preferences: data ?? defaults });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const body = (await request.json()) as Partial<Preferences>;
  if (fields.some((field) => typeof body[field] !== 'boolean'))
    return NextResponse.json({ error: 'invalid_preferences' }, { status: 400 });
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...body, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
