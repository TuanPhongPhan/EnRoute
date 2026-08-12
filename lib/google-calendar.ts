import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { Credentials } from 'google-auth-library';
import { google } from 'googleapis';

// Keep OAuth access minimal: EnRoute only reads calendars and events, never creates or changes them.
const scopes = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

type StoredGoogleCredentials = Credentials;

export type GoogleCalendarOption = { id: string; title: string; primary: boolean };
export type GoogleCalendarEvent = { id: string; title: string; startsAt: string; endsAt: string; location: string };
export type GoogleCalendarErrorCode = 'authorization_expired' | 'calendar_access_denied' | 'calendar_api_disabled' | 'calendar_not_found' | 'calendar_rate_limited' | 'calendar_unavailable';

export function hasGoogleCalendarConfiguration() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REDIRECT_URI && encryptionKey());
}

export function createGoogleOAuthClient() {
  if (!hasGoogleCalendarConfiguration()) throw new Error('Google Calendar is not configured.');
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_OAUTH_REDIRECT_URI);
}

export function createAuthorizationUrl(state: string) {
  return createGoogleOAuthClient().generateAuthUrl({ access_type: 'offline', include_granted_scopes: true, prompt: 'consent', scope: scopes, state });
}

export async function exchangeAuthorizationCode(code: string) {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error('Google did not return an access token.');
  return encryptCredentials(tokens);
}

export async function listCalendars(encryptedTokens: string): Promise<GoogleCalendarOption[]> {
  const calendar = await calendarClient(encryptedTokens);
  const response = await calendar.calendarList.list({ minAccessRole: 'reader', showHidden: false });
  return (response.data.items ?? []).flatMap((item) => item.id && item.summary ? [{ id: item.id, title: item.summary, primary: item.primary ?? false }] : []);
}

export async function getNextUniversityEvent(encryptedTokens: string, calendarId: string): Promise<GoogleCalendarEvent | null> {
  const events = await getUniversityEvents(encryptedTokens, calendarId, new Date().toISOString(), undefined, 25);
  return events[0] ?? null;
}

export async function getUniversityEvents(encryptedTokens: string, calendarId: string, timeMin: string, timeMax?: string, maxResults = 100): Promise<GoogleCalendarEvent[]> {
  const calendar = await calendarClient(encryptedTokens);
  const response = await calendar.events.list({ calendarId, maxResults, orderBy: 'startTime', singleEvents: true, timeMin, timeMax });
  return (response.data.items ?? []).flatMap((event) => isUniversityLocation(event.location) && event.id && event.start?.dateTime && event.end?.dateTime ? [{ id: event.id, title: event.summary?.trim() || 'University class', startsAt: event.start.dateTime, endsAt: event.end.dateTime, location: event.location ?? 'Hochschule Neu-Ulm' }] : []);
}

function isUniversityLocation(location: string | null | undefined) {
  // Calendar selection narrows the source; location matching prevents unrelated events from creating commutes.
  return /hochschule\s*neu-ulm|\bhnu\b|wileystra(?:ß|ss)e/i.test(location ?? '');
}

async function calendarClient(encryptedTokens: string) {
  const client = createGoogleOAuthClient();
  client.setCredentials(decryptCredentials(encryptedTokens));
  return google.calendar({ version: 'v3', auth: client });
}

function encryptionKey() {
  // AES-256-GCM requires exactly 32 bytes. The hex env value stays server-side and is never returned to the client.
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) return null;
  return Buffer.from(value, 'hex');
}

function encryptCredentials(credentials: StoredGoogleCredentials) {
  const key = encryptionKey();
  if (!key) throw new Error('Google token encryption key is missing or invalid.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  // Version the payload to allow future key/format migrations without guessing how old tokens were encrypted.
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptCredentials(value: string): StoredGoogleCredentials {
  const key = encryptionKey();
  const [version, iv, tag, ciphertext] = value.split('.');
  if (!key || version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Stored Google authorization is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as StoredGoogleCredentials;
}

export function getGoogleCalendarError(error: unknown): { code: GoogleCalendarErrorCode; status: number } {
  const details = error instanceof Error ? error.message.toLowerCase() : '';
  const response = typeof error === 'object' && error !== null && 'response' in error ? (error as { response?: { status?: unknown; data?: { error?: { message?: unknown } } } }).response : undefined;
  const status = typeof response?.status === 'number' ? response.status : undefined;
  const message = typeof response?.data?.error?.message === 'string' ? response.data.error.message.toLowerCase() : details;
  if (message.includes('has not been used') || message.includes('is disabled')) return { code: 'calendar_api_disabled', status: 503 };
  if (status === 401 || message.includes('invalid_grant')) return { code: 'authorization_expired', status: 401 };
  if (status === 403) return { code: 'calendar_access_denied', status: 403 };
  if (status === 404) return { code: 'calendar_not_found', status: 404 };
  if (status === 429) return { code: 'calendar_rate_limited', status: 429 };
  return { code: 'calendar_unavailable', status: 502 };
}
