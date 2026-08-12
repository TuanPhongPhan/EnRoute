import type { GoogleCalendarEvent } from '@/lib/google-calendar';
const key = 'enroute:next-event:v1';
export type EventSnapshot = { event: GoogleCalendarEvent; fetchedAt: string };
export function saveEventSnapshot(event: GoogleCalendarEvent) {
  localStorage.setItem(key, JSON.stringify({ event, fetchedAt: new Date().toISOString() }));
}
export function readEventSnapshot(): EventSnapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value?.event?.startsAt && Date.parse(value.event.startsAt) > Date.now() ? value : null;
  } catch {
    return null;
  }
}
