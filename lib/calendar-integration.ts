import { createClient } from '@/lib/supabase/server';

export async function currentCalendarTokens() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, tokens: null, supabase };
  const { data } = await supabase.from('calendar_integrations').select('encrypted_tokens').eq('user_id', user.id).maybeSingle();
  return { user, tokens: data?.encrypted_tokens ?? null, supabase };
}
