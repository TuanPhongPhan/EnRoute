export type CompletedFocusSession = {
  completedMinutes: number;
  completedAt: string;
};

export type FocusSummary = {
  todayMinutes: number;
  completedSessions: number;
  currentStreak: number;
};

const berlinDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function berlinDate(value: Date | string): string {
  return berlinDateFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

function previousDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function summarizeFocusSessions(sessions: CompletedFocusSession[], now: Date = new Date()): FocusSummary {
  const today = berlinDate(now);
  const sessionDays = new Set<string>();
  let todayMinutes = 0;

  for (const session of sessions) {
    const day = berlinDate(session.completedAt);
    sessionDays.add(day);
    if (day === today) todayMinutes += session.completedMinutes;
  }

  let currentStreak = 0;
  let cursor = today;
  while (sessionDays.has(cursor)) {
    currentStreak += 1;
    cursor = previousDate(cursor);
  }

  return { todayMinutes, completedSessions: sessions.length, currentStreak };
}
