import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createAuthorizationUrl, hasGoogleCalendarConfiguration } from '@/lib/google-calendar';
import { createClient } from '@/lib/supabase/server';

const stateCookie = 'enroute_google_oauth_state';

export async function GET(request: Request) {
  if (!hasGoogleCalendarConfiguration()) return NextResponse.redirect(new URL('/settings?calendar=configuration-required', request.url));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/settings?calendar=sign-in-required', request.url));
  const state = randomBytes(24).toString('base64url');
  const response = NextResponse.redirect(createAuthorizationUrl(state));
  response.cookies.set(stateCookie, `${user.id}.${state}`, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return response;
}
