import type { GoogleCalendarEvent } from '@/lib/google-calendar';
import { departureCountdown, type CommuteRecommendation } from '@/lib/commute-engine';

export type CommuteLegView = { id: string; mode: 'walk' | 'subway' | 'tram' | 'ice' | 'bus' | 'regional_train' | 'other'; label: string; detail: string; departure: string; arrival: string; duration: string; delayMinutes: number; platform?: string };
export type TodayCommute = { currentTime: string; day: string; nextClass: { name: string; startsAt: string; endsAt: string; location: string }; leaveHomeAt: string; departureCountdown: string; arrivalAt: string; bufferMinutes: number; status: 'On time' | 'Tight connection' | 'Connection at risk' | 'Late for class' | 'Minor delay'; liveDataAvailable: boolean; updatedAt: string; legs: CommuteLegView[] };

export function createTodayCommute(event: GoogleCalendarEvent, recommendation: CommuteRecommendation, now = new Date()): TodayCommute {
  const journey = recommendation.journey;
  const countdown = departureCountdown(recommendation.leaveHomeAt, now);
  return {
    currentTime: formatTime(now.toISOString()),
    day: new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Europe/Berlin' }).format(now),
    nextClass: { name: event.title, startsAt: formatTime(event.startsAt), endsAt: formatTime(event.endsAt), location: event.location },
    leaveHomeAt: formatTime(recommendation.leaveHomeAt), departureCountdown: countdown > 0 ? `${countdown} min` : 'Now', arrivalAt: formatTime(recommendation.expectedArrivalAt), bufferMinutes: recommendation.bufferMinutes,
    status: recommendation.risk === 'late' ? 'Late for class' : recommendation.connectionRisk !== 'safe' ? 'Connection at risk' : journey.hasDelays ? 'Minor delay' : recommendation.risk === 'tight' ? 'Tight connection' : 'On time', liveDataAvailable: journey.hasRealtime ?? false, updatedAt: now.toISOString(),
    legs: journey.legs.map((leg) => ({ id: `${leg.actualDeparture}-${leg.actualArrival}-${leg.label}-${leg.origin}-${leg.destination}`, mode: leg.mode, label: leg.label, detail: `${leg.origin} → ${leg.destination}`, departure: formatTime(leg.actualDeparture), arrival: formatTime(leg.actualArrival), duration: minutesLabel(leg.actualDeparture, leg.actualArrival), delayMinutes: leg.delayMinutes, platform: leg.platform })),
  };
}

function formatTime(value: string) { return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(value)); }
function minutesLabel(start: string, end: string) { const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000)); return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`; }
