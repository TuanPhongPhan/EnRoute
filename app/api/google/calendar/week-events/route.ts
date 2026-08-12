import { NextResponse } from 'next/server';
import { getGoogleCalendarError, getUniversityEvents, hasGoogleCalendarConfiguration } from '@/lib/google-calendar';
import { currentCalendarTokens } from '@/lib/calendar-integration';
export async function GET(request: Request) {
  if (!hasGoogleCalendarConfiguration()) return NextResponse.json({ error: 'configuration_required' }, { status: 503 });
  const { tokens } = await currentCalendarTokens();
  if (!tokens) return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (
    !start ||
    !end ||
    Number.isNaN(Date.parse(start)) ||
    Number.isNaN(Date.parse(end)) ||
    Date.parse(end) - Date.parse(start) > 8 * 86_400_000
  )
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  try {
    return NextResponse.json({
      events: await getUniversityEvents(tokens, url.searchParams.get('calendarId') || 'primary', start, end),
    });
  } catch (error) {
    const mapped = getGoogleCalendarError(error);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }
}
