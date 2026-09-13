import { describe, expect, it } from 'vitest';
import {
  berlinDayRange,
  berlinTimeInput,
  defaultReturnDeparture,
  returnJourneyContext,
  setBerlinTime,
} from '@/lib/return-journey';

describe('return journey scheduling', () => {
  it('defaults to the latest future class end', () => {
    const now = new Date('2026-08-12T11:00:00.000Z');
    const departure = defaultReturnDeparture(
      [{ endsAt: '2026-08-12T12:00:00.000Z' }, { endsAt: '2026-08-12T14:30:00.000Z' }],
      now,
    );
    expect(departure.toISOString()).toBe('2026-08-12T14:30:00.000Z');
  });

  it('uses the current time when the final class has already ended', () => {
    const now = new Date('2026-08-12T14:00:00.000Z');
    expect(defaultReturnDeparture([{ endsAt: '2026-08-12T13:30:00.000Z' }], now)).toBe(now);
  });

  it('converts the selected Berlin wall-clock time into the correct UTC departure', () => {
    const day = new Date('2026-08-12T10:00:00.000Z');
    expect(setBerlinTime(day, '17:45')?.toISOString()).toBe('2026-08-12T15:45:00.000Z');
    expect(berlinTimeInput(day)).toBe('12:00');
  });

  it('returns the current Berlin day range', () => {
    const { start, end } = berlinDayRange(new Date('2026-08-12T10:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-08-11T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-12T22:00:00.000Z');
  });

  it('changes return planning context one hour before the final class ends', () => {
    const finalClassEnd = '2026-08-12T14:30:00.000Z';
    expect(returnJourneyContext(finalClassEnd, new Date('2026-08-12T13:29:59.000Z'))).toBe('later');
    expect(returnJourneyContext(finalClassEnd, new Date('2026-08-12T13:30:00.000Z'))).toBe('imminent');
    expect(returnJourneyContext(finalClassEnd, new Date('2026-08-12T14:30:00.000Z'))).toBe('active');
  });
});
