import { NextResponse } from 'next/server';

import { summarizeFocusSessions, type CompletedFocusSession } from '@/lib/focus-statistics';
import { createClient } from '@/lib/supabase/server';

type FocusSessionRow = {
  id: string;
  client_session_id: string;
  title: string;
  planned_minutes: number;
  completed_minutes: number;
  destination: string;
  started_at: string;
  completed_at: string;
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function serializeSummary(rows: FocusSessionRow[]) {
  const summary = summarizeFocusSessions(
    rows.map(
      (row): CompletedFocusSession => ({
        completedMinutes: row.completed_minutes,
        completedAt: row.completed_at,
      }),
    ),
  );

  return { summary, sessions: rows };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('id, client_session_id, title, planned_minutes, completed_minutes, destination, started_at, completed_at')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'focus_sessions_unavailable' }, { status: 500 });
  return NextResponse.json(serializeSummary((data ?? []) as FocusSessionRow[]));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';

  if (
    !isUuid(body.clientSessionId) ||
    !validDate(body.startedAt) ||
    !Number.isInteger(body.plannedMinutes) ||
    (body.plannedMinutes as number) < 5 ||
    (body.plannedMinutes as number) > 50 ||
    title.length < 1 ||
    title.length > 120 ||
    destination.length > 160
  ) {
    return NextResponse.json({ error: 'invalid_focus_session' }, { status: 400 });
  }

  const record = {
    user_id: user.id,
    client_session_id: body.clientSessionId,
    title,
    planned_minutes: body.plannedMinutes as number,
    completed_minutes: body.plannedMinutes as number,
    destination,
    started_at: body.startedAt,
  };
  const { data: inserted, error } = await supabase
    .from('focus_sessions')
    .insert(record)
    .select('id, client_session_id, title, planned_minutes, completed_minutes, destination, started_at, completed_at')
    .maybeSingle();

  if (error && error.code !== '23505') return NextResponse.json({ error: 'focus_session_not_saved' }, { status: 500 });

  const { data: rows, error: rowsError } = await supabase
    .from('focus_sessions')
    .select('id, client_session_id, title, planned_minutes, completed_minutes, destination, started_at, completed_at')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false });

  if (rowsError) return NextResponse.json({ error: 'focus_sessions_unavailable' }, { status: 500 });
  return NextResponse.json({ ...serializeSummary((rows ?? []) as FocusSessionRow[]), session: inserted ?? null });
}
