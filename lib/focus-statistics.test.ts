import { describe, expect, it } from 'vitest';

import { summarizeFocusSessions } from '@/lib/focus-statistics';

describe('summarizeFocusSessions', () => {
  it('uses Europe/Berlin dates for the daily total and streak', () => {
    const summary = summarizeFocusSessions(
      [
        { completedMinutes: 25, completedAt: '2026-09-05T08:00:00.000Z' },
        { completedMinutes: 50, completedAt: '2026-09-04T12:00:00.000Z' },
        { completedMinutes: 25, completedAt: '2026-09-03T12:00:00.000Z' },
      ],
      new Date('2026-09-05T14:00:00.000Z'),
    );

    expect(summary).toEqual({ todayMinutes: 25, completedSessions: 3, currentStreak: 3 });
  });

  it('does not continue a streak when there is no session today', () => {
    const summary = summarizeFocusSessions(
      [{ completedMinutes: 25, completedAt: '2026-09-04T12:00:00.000Z' }],
      new Date('2026-09-05T14:00:00.000Z'),
    );

    expect(summary.currentStreak).toBe(0);
  });
});
