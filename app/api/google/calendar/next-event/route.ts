import { NextResponse } from 'next/server';
import { getGoogleCalendarError, getNextUniversityEvent, hasGoogleCalendarConfiguration } from '@/lib/google-calendar';
import { currentCalendarTokens } from '@/lib/calendar-integration';

export async function GET(request: Request) {
  if (!hasGoogleCalendarConfiguration()) return NextResponse.json({ error: 'configuration_required' }, { status: 503 });
  const { tokens } = await currentCalendarTokens();
  if (!tokens) return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  const calendarId = new URL(request.url).searchParams.get('calendarId') || 'primary';
  try {
    return NextResponse.json({ event: await getNextUniversityEvent(tokens, calendarId) });
  } catch (error) {
    const calendarError = getGoogleCalendarError(error);
    return NextResponse.json({ error: calendarError.code }, { status: calendarError.status });
  }
}
