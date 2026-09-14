import { expect, test } from '@playwright/test';
import { journeys, mockEnRouteApi, seedPreferences } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seedPreferences(page);
  await mockEnRouteApi(page);
});

test('loads Today with a mocked class and commute recommendation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Mathematics' })).toBeVisible();
  await expect(page.getByText('Leave home', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Home to HNU' })).toBeVisible();
  await expect(page.getByText('From your Google Calendar')).toBeVisible();
});

test('keeps the chosen route when returning to Today', async ({ page }) => {
  const monitorRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/commutes/monitor')) monitorRequests.push(request.postData() ?? '');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mathematics' })).toBeVisible();
  await page.getByRole('link', { name: 'View details' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your connection.' })).toBeVisible();

  await page.getByRole('button', { name: /Choose this route/ }).click();
  await expect(page.getByRole('button', { name: /Selected route/ })).toContainText('RE75');
  await page.getByRole('link', { name: 'Back to Today' }).click();

  await expect(page.getByRole('heading', { name: 'Home to HNU' })).toBeVisible();
  await expect.poll(() => monitorRequests.some((body) => body.includes('RE75'))).toBe(true);
});

test('shows a useful fallback when calendar data is unavailable', async ({ page }) => {
  await page.unroute('**/api/google/calendar/next-event?**');
  await mockEnRouteApi(page, { calendarAvailable: false });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'No commute to calculate.' })).toBeVisible();
  await expect(
    page.getByText('We could not calculate a commute yet. Check your calendar connection and saved addresses.'),
  ).toBeVisible();
});

test('keeps primary navigation and settings sign-in state usable', async ({ page, isMobile }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Make this commute yours.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' }).first()).toBeVisible();

  const navigation = isMobile
    ? page.getByRole('navigation', { name: 'Primary navigation' }).last()
    : page.locator('aside');
  await navigation.getByRole('link', { name: 'Focus' }).click();
  await expect(page.getByRole('heading', { name: 'Make train time count.' })).toBeVisible();
  await navigation.getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Your commute week.' })).toBeVisible();
});

test('serves PWA metadata and the service worker', async ({ page }) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  const serviceWorker = await page.request.get('/sw.js');

  expect(manifest.ok()).toBeTruthy();
  expect(serviceWorker.ok()).toBeTruthy();
});
