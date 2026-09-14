import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
export async function proxy(request: NextRequest) {
  // Browser smoke tests mock client API responses and must not contact the real
  // Supabase project through middleware before those mocks are installed.
  if (process.env.E2E_TEST === 'true') return NextResponse.next({ request });
  return updateSession(request);
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
