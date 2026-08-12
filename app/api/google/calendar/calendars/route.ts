import { NextResponse } from 'next/server';
import { getGoogleCalendarError, hasGoogleCalendarConfiguration, listCalendars } from '@/lib/google-calendar';
import { currentCalendarTokens } from '@/lib/calendar-integration';

export async function GET() {
  if (!hasGoogleCalendarConfiguration()) return NextResponse.json({ error: 'configuration_required' }, { status: 503 });
  const { tokens } = await currentCalendarTokens();
  if (!tokens) return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  try {
    return NextResponse.json({ calendars: await listCalendars(tokens) });
  } catch (error) {
    const calendarError = getGoogleCalendarError(error);
    return NextResponse.json({ error: calendarError.code }, { status: calendarError.status });
  }
}
