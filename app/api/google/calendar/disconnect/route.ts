import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  await supabase.from('calendar_integrations').delete().eq('user_id', user.id);
  const response = NextResponse.json({ ok: true });
  return response;
}
