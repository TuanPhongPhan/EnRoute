import type { Page } from '@playwright/test';

const at = (hour: number, minute: number) => new Date(Date.UTC(2030, 4, 20, hour, minute)).toISOString();

const journey = (id: string, departureMinute: number, arrivalMinute: number, label: string) => ({
  id,
  departure: at(7, departureMinute),
  arrival: at(10, arrivalMinute),
  durationMinutes: 180 - departureMinute + arrivalMinute,
  transfers: 2,
  hasDelays: false,
  legs: [
    {
      mode: 'walk',
      label: 'Walk',
      origin: 'Home',
      destination: 'Dülferstraße',
      scheduledDeparture: at(7, departureMinute),
      actualDeparture: at(7, departureMinute),
      scheduledArrival: at(7, departureMinute + 8),
      actualArrival: at(7, departureMinute + 8),
      delayMinutes: 0,
    },
    {
      mode: 'subway',
      label: 'U2',
      origin: 'Dülferstraße',
      destination: 'München Hbf',
      scheduledDeparture: at(7, departureMinute + 10),
      actualDeparture: at(7, departureMinute + 10),
      scheduledArrival: at(7, departureMinute + 30),
      actualArrival: at(7, departureMinute + 30),
      delayMinutes: 0,
    },
    {
      mode: 'regional_train',
      label,
      origin: 'München Hbf',
      destination: 'Hochschule Neu-Ulm',
      scheduledDeparture: at(7, departureMinute + 40),
      actualDeparture: at(7, departureMinute + 40),
      scheduledArrival: at(10, arrivalMinute),
      actualArrival: at(10, arrivalMinute),
      delayMinutes: 0,
    },
  ],
});

export const journeys = [journey('route-earlier', 0, 0, 'RE9'), journey('route-later', 15, 15, 'RE75')];

export const nextEvent = {
  id: 'e2e-mathematics',
  title: 'Mathematics',
  startsAt: at(10, 30),
  endsAt: at(12, 0),
  location: 'Hochschule Neu-Ulm',
};

export async function mockEnRouteApi(page: Page, options: { calendarAvailable?: boolean } = {}) {
  const calendarAvailable = options.calendarAvailable ?? true;
  await page.route('**/api/google/calendar/next-event?**', async (route) => {
    if (!calendarAvailable)
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ event: nextEvent }) });
  });
  await page.route('**/api/google/calendar/week-events?**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ events: calendarAvailable ? [nextEvent] : [] }),
    }),
  );
  await page.route('**/api/google/calendar/calendars', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"not_connected"}' }),
  );
  await page.route('**/api/transport/journeys?**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ journeys, fetchedAt: at(6, 45) }) }),
  );
  await page.route('**/api/commutes/monitor', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"ok":true,"unchanged":true}' }),
  );
  await page.route('**/api/focus-sessions', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthenticated"}' }),
  );
  await page.route('**/api/notifications/preferences', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthenticated"}' }),
  );
  await page.route('http://127.0.0.1:54321/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{"user":null}',
    }),
  );
}

export async function seedPreferences(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'enroute:commute-preferences:v3',
      JSON.stringify({
        homeAddress: 'Graslilienanger 12, 80937 München',
        universityAddress: 'Hochschule Neu-Ulm, Wileystraße 1, 89231 Neu-Ulm',
        arrivalBufferMinutes: 15,
        calendarId: 'primary',
      }),
    );
  });
}
