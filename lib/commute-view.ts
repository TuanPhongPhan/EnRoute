import type { GoogleCalendarEvent } from '@/lib/google-calendar';
import { departureCountdown, type CommuteRecommendation } from '@/lib/commute-engine';

export type CommuteLegView = {
  id: string;
  mode: 'walk' | 'subway' | 'tram' | 'ice' | 'bus' | 'regional_train' | 'other';
  label: string;
  detail: string;
  departure: string;
  arrival: string;
  duration: string;
  delayMinutes: number;
  platform?: string;
};
export type TodayCommute = {
  currentTime: string;
  day: string;
  greeting: string;
  nextClass: { name: string; startsAt: string; endsAt: string; location: string };
  leaveHomeAt: string;
  leaveHomeAtIso: string;
  departureCountdown: {
    label: string;
    isDue: boolean;
  };
  arrivalAt: string;
  bufferMinutes: number;
  status: 'On time' | 'Tight connection' | 'Connection at risk' | 'Late for class' | 'Minor delay';
  liveDataAvailable: boolean;
  updatedAt: string;
  legs: CommuteLegView[];
};

export function createTodayCommute(
  event: GoogleCalendarEvent,
  recommendation: CommuteRecommendation,
  now = new Date(),
  transportUpdatedAt = now,
): TodayCommute {
  const journey = recommendation.journey;
  const countdown = departureCountdown(recommendation.leaveHomeAt, now);
  return {
    currentTime: formatTime(now.toISOString()),
    day: new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Europe/Berlin' }).format(now),
    greeting: greetingFor(now),
    nextClass: {
      name: event.title,
      startsAt: formatTime(event.startsAt),
      endsAt: formatTime(event.endsAt),
      location: event.location,
    },
    leaveHomeAt: formatTime(recommendation.leaveHomeAt),
    leaveHomeAtIso: recommendation.leaveHomeAt,
    departureCountdown: formatDepartureCountdown(countdown),
    arrivalAt: formatTime(recommendation.expectedArrivalAt),
    bufferMinutes: recommendation.bufferMinutes,
    status:
      recommendation.risk === 'late'
        ? 'Late for class'
        : recommendation.connectionRisk !== 'safe'
          ? 'Connection at risk'
          : journey.hasDelays
            ? 'Minor delay'
            : recommendation.risk === 'tight'
              ? 'Tight connection'
              : 'On time',
    liveDataAvailable: journey.hasRealtime ?? false,
    updatedAt: transportUpdatedAt.toISOString(),
    legs: journey.legs.map((leg) => ({
      id: `${leg.actualDeparture}-${leg.actualArrival}-${leg.label}-${leg.origin}-${leg.destination}`,
      mode: leg.mode,
      label: leg.label,
      detail: `${leg.origin} → ${leg.destination}`,
      departure: formatTime(leg.actualDeparture),
      arrival: formatTime(leg.actualArrival),
      duration: minutesLabel(leg.actualDeparture, leg.actualArrival),
      delayMinutes: leg.delayMinutes,
      platform: leg.platform,
    })),
  };
}

export function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Europe/Berlin',
    })
      .formatToParts(now)
      .find((part) => part.type === 'hour')?.value,
  );

  if (hour >= 5 && hour < 12) {
    return 'Good morning.';
  }

  if (hour >= 12 && hour < 18) {
    return 'Good afternoon.';
  }

  return 'Good evening.';
}

export function formatDepartureCountdown(minutes: number): {
  label: string;
  isDue: boolean;
} {
  if (minutes <= 0) {
    return { label: 'Leave now', isDue: true };
  }

  return { label: `Leave in ${formatDuration(minutes)}`, isDue: false };
}

export function formatLastUpdated(updatedAt: string, now = new Date()) {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - Date.parse(updatedAt)) / 60_000));
  if (elapsedMinutes < 1) return 'Last updated just now';
  if (elapsedMinutes < 60) return `Last updated ${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `Last updated ${elapsedHours} h ago`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
    new Date(value),
  );
}
function minutesLabel(start: string, end: string) {
  const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
  return formatDuration(minutes);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}
