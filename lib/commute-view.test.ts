import { describe, expect, it } from 'vitest';

import { formatDepartureCountdown, greetingFor } from '@/lib/commute-view';

describe('today commute view helpers', () => {
  it('uses Berlin time for the greeting', () => {
    expect(greetingFor(new Date('2026-08-12T04:00:00.000Z'))).toBe('Good morning.');
    expect(greetingFor(new Date('2026-08-12T10:00:00.000Z'))).toBe('Good afternoon.');
    expect(greetingFor(new Date('2026-08-12T16:00:00.000Z'))).toBe('Good evening.');
  });

  it('formats departure countdowns for quick scanning', () => {
    expect(formatDepartureCountdown(45)).toEqual({ label: '45 min', isDue: false });
    expect(formatDepartureCountdown(673)).toEqual({ label: '11 h 13 min', isDue: false });
  });

  it('uses a direct leave-now instruction when the departure is due', () => {
    expect(formatDepartureCountdown(0)).toEqual({ label: 'Leave now', isDue: true });
    expect(formatDepartureCountdown(-5)).toEqual({ label: 'Leave now', isDue: true });
  });
});
