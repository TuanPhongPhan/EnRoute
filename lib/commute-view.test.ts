import { describe, expect, it } from 'vitest';

import { formatDepartureCountdown, formatLastUpdated, greetingFor } from '@/lib/commute-view';

describe('today commute view helpers', () => {
  it('uses Berlin time for the greeting', () => {
    expect(greetingFor(new Date('2026-08-12T04:00:00.000Z'))).toBe('Good morning.');
    expect(greetingFor(new Date('2026-08-12T10:00:00.000Z'))).toBe('Good afternoon.');
    expect(greetingFor(new Date('2026-08-12T16:00:00.000Z'))).toBe('Good evening.');
  });

  it('formats departure countdowns for quick scanning', () => {
    expect(formatDepartureCountdown(45)).toEqual({ label: 'Leave in 45 min', isDue: false });
    expect(formatDepartureCountdown(673)).toEqual({ label: 'Leave in 11 h 13 min', isDue: false });
  });

  it('uses a direct leave-now instruction when the departure is due', () => {
    expect(formatDepartureCountdown(0)).toEqual({ label: 'Leave now', isDue: true });
    expect(formatDepartureCountdown(-5)).toEqual({ label: 'Leave now', isDue: true });
  });

  it('describes the age of the last successful transport update', () => {
    const now = new Date('2026-08-12T08:10:00.000Z');
    expect(formatLastUpdated('2026-08-12T08:00:30.000Z', now)).toBe('Last updated 9 min ago');
    expect(formatLastUpdated('2026-08-12T06:00:00.000Z', now)).toBe('Last updated 2 h ago');
  });
});
