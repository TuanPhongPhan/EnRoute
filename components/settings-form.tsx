'use client';

import { CalendarDays, CheckCircle2, Home, Link2, MapPin, RotateCcw, SlidersHorizontal, Unlink, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { arrivalBufferOptions, defaultCommutePreferences, readCommutePreferences, saveCommutePreferences, type CommutePreferences } from '@/lib/commute-preferences';
import { AccountControls } from '@/components/account-controls';
import { NotificationSettings } from '@/components/notification-settings';

type Notice = { kind: 'success' | 'error'; message: string } | null;
type CalendarOption = { id: string; title: string; primary: boolean };
type CalendarState = 'loading' | 'connected' | 'disconnected' | 'configuration-required' | 'api-disabled' | 'access-denied' | 'authorization-expired' | 'rate-limited' | 'calendar-not-found' | 'unavailable';

export function SettingsForm() {
  const [preferences, setPreferences] = useState<CommutePreferences>(defaultCommutePreferences);
  const [isReady, setIsReady] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [calendarState, setCalendarState] = useState<CalendarState>('loading');
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPreferences(readCommutePreferences());
      setIsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    void fetch('/api/google/calendar/calendars').then(async (response) => {
      if (cancelled) return;
      if (response.ok) {
        const payload = await response.json() as { calendars: CalendarOption[] };
        setCalendars(payload.calendars);
        setCalendarState('connected');
        return;
      }
      const payload = await response.json() as { error?: string };
      setCalendarState(calendarStateFromError(payload.error));
    }).catch(() => { if (!cancelled) setCalendarState('unavailable'); });
    return () => { cancelled = true; };
  }, [isReady]);

  function updatePreference<Key extends keyof CommutePreferences>(key: Key, value: CommutePreferences[Key]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences.homeAddress.trim() || !preferences.universityAddress.trim()) {
      setNotice({ kind: 'error', message: 'Please enter both commute addresses.' });
      return;
    }

    try {
      saveCommutePreferences({ ...preferences, homeAddress: preferences.homeAddress.trim(), universityAddress: preferences.universityAddress.trim() });
      setNotice({ kind: 'success', message: 'Preferences saved on this device.' });
    } catch {
      setNotice({ kind: 'error', message: 'Preferences could not be saved. Check that browser storage is available.' });
    }
  }

  function reset() {
    setPreferences(defaultCommutePreferences);
    setNotice(null);
  }

  async function disconnectCalendar() {
    await fetch('/api/google/calendar/disconnect', { method: 'POST' });
    setCalendars([]);
    setCalendarState('disconnected');
    updatePreference('calendarId', 'primary');
    setNotice({ kind: 'success', message: 'Google Calendar disconnected from this device.' });
  }

  if (!isReady) return <SettingsSkeleton />;

  return (
    <div className="mx-auto max-w-4xl">
      <section aria-labelledby="settings-heading">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Settings</p>
        <h1 id="settings-heading" className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">Make this commute yours.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">These preferences shape future journey recommendations. They are saved only on this device until account sync is introduced.</p>
      </section>

      <form className="mt-7 space-y-5" onSubmit={save}>
        <AccountControls />
        <section aria-labelledby="locations-heading" className="rounded-3xl border border-teal-950/10 bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-brand-deep"><MapPin aria-hidden="true" className="size-5" /></span><div><h2 id="locations-heading" className="text-xl font-bold tracking-tight text-ink">Places</h2><p className="mt-1 text-sm leading-6 text-muted">Door-to-door planning includes the walk from home and the final walk to HNU.</p></div></div>
          <div className="mt-6 grid gap-5 md:grid-cols-2"><AddressField id="home-address" label="Home address" icon={Home} value={preferences.homeAddress} onChange={(value) => updatePreference('homeAddress', value)} /><AddressField id="university-address" label="University address" icon={MapPin} value={preferences.universityAddress} onChange={(value) => updatePreference('universityAddress', value)} /></div>
        </section>

        <section aria-labelledby="journey-preferences-heading" className="rounded-3xl border border-teal-950/10 bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-brand-deep"><SlidersHorizontal aria-hidden="true" className="size-5" /></span><div><h2 id="journey-preferences-heading" className="text-xl font-bold tracking-tight text-ink">Journey preferences</h2><p className="mt-1 text-sm leading-6 text-muted">Set your arrival margin, then choose among regional-transport route alternatives.</p></div></div>
          <fieldset className="mt-7"><legend className="font-bold text-ink">Arrival buffer</legend><p className="mt-1 text-sm text-muted">How early should you aim to reach HNU?</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{arrivalBufferOptions.map((minutes) => <BufferOption checked={preferences.arrivalBufferMinutes === minutes} key={minutes} minutes={minutes} onChange={() => updatePreference('arrivalBufferMinutes', minutes)} />)}</div></fieldset>
        </section>

        <section aria-labelledby="calendar-heading" className="rounded-3xl border border-teal-950/10 bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-brand-deep"><CalendarDays aria-hidden="true" className="size-5" /></span><div><h2 id="calendar-heading" className="text-xl font-bold tracking-tight text-ink">Google Calendar</h2><p className="mt-1 text-sm leading-6 text-muted">Read your selected university calendar to find the next class at HNU.</p></div></div>
          <CalendarConnection calendarId={preferences.calendarId} calendars={calendars} onChange={(calendarId) => updatePreference('calendarId', calendarId)} onDisconnect={disconnectCalendar} state={calendarState} />
        </section>
        <NotificationSettings />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><button className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-brand-deep transition-colors duration-200 hover:bg-teal-50" onClick={reset} type="button"><RotateCcw aria-hidden="true" className="size-4" />Restore defaults</button><button className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-white transition-colors duration-200 hover:bg-orange-600" type="submit"><CheckCircle2 aria-hidden="true" className="size-5" />Save preferences</button></div>
        <p aria-live="polite" className={notice ? `rounded-xl px-4 py-3 text-sm font-semibold ${notice.kind === 'success' ? 'bg-teal-100 text-brand-deep' : 'bg-orange-100 text-orange-800'}` : 'sr-only'}>{notice?.message}</p>
      </form>
    </div>
  );
}

function CalendarConnection({ calendarId, calendars, onChange, onDisconnect, state }: { calendarId: string; calendars: CalendarOption[]; onChange: (calendarId: string) => void; onDisconnect: () => void; state: CalendarState }) {
  if (state === 'loading') return <div className="mt-6 h-12 animate-pulse rounded-xl bg-teal-100" />;
  if (state === 'connected') return <div className="mt-6"><label className="block" htmlFor="calendar-id"><span className="font-bold text-ink">University calendar</span><span className="mt-1 block text-sm text-muted">Only events whose location matches HNU are used for commute planning.</span><select className="mt-3 min-h-12 w-full rounded-xl border border-teal-950/15 bg-white px-4 font-semibold text-ink outline-none transition-colors duration-200 hover:border-brand focus:border-brand" id="calendar-id" onChange={(event) => onChange(event.target.value)} value={calendarId}><option value="primary">Primary calendar</option>{calendars.filter((calendar) => calendar.id !== 'primary').map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.title}{calendar.primary ? ' (primary)' : ''}</option>)}</select></label><button className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep transition-colors duration-200 hover:bg-teal-50" onClick={onDisconnect} type="button"><Unlink aria-hidden="true" className="size-4" />Disconnect Google Calendar</button></div>;
  if (state === 'configuration-required') return <CalendarIssue title="Calendar setup is incomplete." detail={<>Add the Google OAuth values in <code className="rounded bg-white px-1.5 py-0.5">.env.local</code> using <code className="rounded bg-white px-1.5 py-0.5">.env.example</code>, then restart the app.</>} />;
  if (state === 'api-disabled') return <CalendarIssue title="Google Calendar API is disabled." detail={<>Enable <strong>Google Calendar API</strong> in the Google Cloud project that owns your OAuth client, then try again.</>} />;
  if (state === 'authorization-expired') return <CalendarIssue title="Google authorization needs refreshing." detail={<>Reconnect Google Calendar to grant EnRoute a fresh read-only token.</>} />;
  if (state === 'access-denied') return <CalendarIssue title="Google denied Calendar access." detail={<>Reconnect Google Calendar and approve the requested read-only Calendar permissions.</>} />;
  if (state === 'rate-limited') return <CalendarIssue title="Google Calendar is temporarily rate-limited." detail={<>Wait a moment, then reload this page.</>} />;
  if (state === 'calendar-not-found') return <CalendarIssue title="The selected calendar is no longer available." detail={<>Reconnect Google Calendar and select an available calendar.</>} />;
  if (state === 'unavailable') return <CalendarIssue title="Google Calendar could not be reached." detail={<>Check your connection and try again. Your last journey remains available if it was already calculated.</>} />;
  return <div className="mt-6 rounded-2xl bg-teal-50 p-4"><p className="font-bold text-brand-deep">Not connected</p><p className="mt-1 text-sm leading-6 text-muted">Connect with Google to read calendar names and future university events. EnRoute requests read-only access.</p><a className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep" href="/api/google/calendar/connect"><Link2 aria-hidden="true" className="size-4" />Connect Google Calendar</a></div>;
}

function CalendarIssue({ detail, title }: { detail: React.ReactNode; title: string }) { return <div className="mt-6 rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-orange-900"><p className="font-bold">{title}</p><p className="mt-1">{detail}</p></div>; }

function calendarStateFromError(error: string | undefined): CalendarState {
  const states: Record<string, CalendarState> = { configuration_required: 'configuration-required', calendar_api_disabled: 'api-disabled', authorization_expired: 'authorization-expired', calendar_access_denied: 'access-denied', calendar_rate_limited: 'rate-limited', calendar_not_found: 'calendar-not-found', not_connected: 'disconnected' };
  return states[error ?? ''] ?? 'unavailable';
}

function AddressField({ id, label, icon: Icon, value, onChange }: { id: string; label: string; icon: LucideIcon; value: string; onChange: (value: string) => void }) {
  return <label className="block" htmlFor={id}><span className="font-bold text-ink">{label}</span><span className="relative mt-3 block"><Icon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-brand" /><input className="min-h-12 w-full rounded-xl border border-teal-950/15 bg-white py-3 pl-12 pr-4 text-sm font-semibold text-ink outline-none transition-colors duration-200 hover:border-brand focus:border-brand" id={id} onChange={(event) => onChange(event.target.value)} value={value} /></span></label>;
}

function BufferOption({ checked, minutes, onChange }: { checked: boolean; minutes: number; onChange: () => void }) {
  return <label className={`relative flex min-h-20 cursor-pointer flex-col justify-center rounded-xl border p-3 transition-colors duration-200 ${checked ? 'border-brand bg-teal-50 text-brand-deep' : 'border-teal-950/15 bg-white text-ink hover:border-brand'}`}><input checked={checked} className="sr-only" name="arrival-buffer" onChange={onChange} type="radio" value={minutes} /><span className="text-xl font-bold tracking-tight">{minutes} min</span><span className="mt-1 text-xs text-muted">before class</span></label>;
}

function SettingsSkeleton() {
  return <div aria-label="Loading settings" className="animate-pulse space-y-5"><div className="h-7 w-48 rounded bg-teal-100" /><div className="h-5 max-w-xl rounded bg-teal-100" /><div className="h-72 rounded-3xl bg-teal-100" /><div className="h-72 rounded-3xl bg-teal-100" /></div>;
}
