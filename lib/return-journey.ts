export type ReturnClassEvent = { endsAt: string };

const berlinTimeZone = 'Europe/Berlin';

export function defaultReturnDeparture(events: ReturnClassEvent[], now = new Date()) {
  const lastClassEnd = events.reduce<Date | null>((latest, event) => {
    const end = new Date(event.endsAt);
    return !latest || end > latest ? end : latest;
  }, null);
  return lastClassEnd && lastClassEnd > now ? lastClassEnd : now;
}

export function berlinTimeInput(value: Date) {
  const parts = berlinParts(value);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function setBerlinTime(day: Date, value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const date = berlinParts(day);
  return berlinDateTime(date.year, date.month, date.day, hour, minute);
}

export function berlinDayRange(value = new Date()) {
  const date = berlinParts(value);
  const nextDay = new Date(Date.UTC(date.year, date.month - 1, date.day) + 86_400_000);
  return {
    start: berlinDateTime(date.year, date.month, date.day, 0, 0),
    end: berlinDateTime(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), 0, 0),
  };
}

function berlinDateTime(year: number, month: number, day: number, hour: number, minute: number) {
  const intended = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = intended;
  // Reconcile a Berlin wall-clock value to UTC, including the normal DST offset change.
  for (let index = 0; index < 2; index += 1) {
    const actual = berlinParts(new Date(candidate));
    candidate += intended - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
  }
  return new Date(candidate);
}

function berlinParts(value: Date) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: berlinTimeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(formatted.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute') };
}
