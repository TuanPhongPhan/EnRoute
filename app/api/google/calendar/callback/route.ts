import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exchangeAuthorizationCode, hasGoogleCalendarConfiguration } from '@/lib/google-calendar';
import { createClient } from '@/lib/supabase/server';

const stateCookie = 'enroute_google_oauth_state';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookie)?.value;
  const redirect = (status: string) => NextResponse.redirect(new URL(`/settings?calendar=${status}`, request.url));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [stateUserId, expectedStateValue] = expectedState?.split('.', 2) ?? [];
  if (error || !code || !state || !user || stateUserId !== user.id || state !== expectedStateValue || !hasGoogleCalendarConfiguration()) return redirect('connection-failed');

  try {
    const encryptedTokens = await exchangeAuthorizationCode(code);
    const { error: saveError } = await supabase.from('calendar_integrations').upsert({ user_id: user.id, encrypted_tokens: encryptedTokens, status: 'connected', updated_at: new Date().toISOString() });
    if (saveError) return redirect('connection-failed');
    const response = redirect('connected');
    response.cookies.delete(stateCookie);
    return response;
  } catch {
    return redirect('connection-failed');
  }
}
