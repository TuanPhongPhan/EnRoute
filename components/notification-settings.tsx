'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { Bell, BellOff, LoaderCircle, LogIn, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { clientCache } from '@/lib/client-cache';
import { createClient } from '@/lib/supabase/client';

type Preferences = {
  leave_reminders: boolean;
  transfer_alerts: boolean;
  disruption_alerts: boolean;
  platform_alerts: boolean;
  alternative_alerts: boolean;
};
const initial: Preferences = {
  leave_reminders: false,
  transfer_alerts: false,
  disruption_alerts: false,
  platform_alerts: false,
  alternative_alerts: false,
};
const notificationPreferencesCacheKey = 'notification-preferences';
const notificationPreferencesCacheTtlMs = 5 * 60_000;
type NotificationStatus =
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'denied'
  | 'saving'
  | 'sign-in-required'
  | 'subscription-error'
  | 'load-error'
  | 'save-error';
type PendingChange = { key: keyof Preferences; enabled: boolean } | null;
const choices: Array<{ key: keyof Preferences; title: string; description: string }> = [
  {
    key: 'leave_reminders',
    title: 'Leave reminder',
    description: 'A single reminder 20 minutes before you should leave.',
  },
  {
    key: 'transfer_alerts',
    title: 'Change trains soon',
    description: 'A reminder five minutes before your next U-Bahn, bus, tram, or train connection.',
  },
  {
    key: 'disruption_alerts',
    title: 'Connection at risk',
    description: 'Only when a delay could make you late for class.',
  },
  { key: 'platform_alerts', title: 'Platform changes', description: 'When the live platform differs from your route.' },
  {
    key: 'alternative_alerts',
    title: 'Better alternative',
    description: 'When another route meaningfully improves your arrival.',
  },
];

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences>(
    () => clientCache.read<Preferences>(notificationPreferencesCacheKey)?.value ?? initial,
  );
  const [status, setStatus] = useState<NotificationStatus>(() =>
    clientCache.read<Preferences>(notificationPreferencesCacheKey) ? 'ready' : 'loading',
  );
  const [pendingChange, setPendingChange] = useState<PendingChange>(null);

  const loadPreferences = useCallback(async () => {
    try {
      const next = await clientCache.load(
        notificationPreferencesCacheKey,
        notificationPreferencesCacheTtlMs,
        async () => {
          const response = await fetch('/api/notifications/preferences');
          await requireSuccessfulResponse(response);
          return ((await response.json()) as { preferences: Preferences }).preferences;
        },
      );
      // A VAPID rotation invalidates the old browser subscription. Renew it quietly for
      // opted-in users rather than making them turn every notification off and on again.
      if (Object.values(next).some(Boolean) && Notification.permission === 'granted') await registerSubscription();
      setPreferences(next);
      setStatus(Notification.permission === 'denied' ? 'denied' : 'ready');
    } catch (error) {
      if (isUnauthenticatedError(error)) {
        clientCache.invalidate(notificationPreferencesCacheKey);
        setStatus('sign-in-required');
      } else if (clientCache.read<Preferences>(notificationPreferencesCacheKey)) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'ready');
      } else {
        setStatus('load-error');
      }
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    void loadPreferences();
  }, [loadPreferences]);

  async function change(key: keyof Preferences, enabled: boolean) {
    // Permission is requested only after an explicit opt-in, which prevents an intrusive prompt on first visit.
    if (enabled && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'ready');
        return;
      }
    }
    if (enabled && Notification.permission !== 'granted') {
      setStatus('denied');
      return;
    }
    setStatus('saving');
    const next = { ...preferences, [key]: enabled };
    setPendingChange({ key, enabled });
    try {
      if (enabled) await registerSubscription();
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      await requireSuccessfulResponse(response);
      setPreferences(next);
      clientCache.set(notificationPreferencesCacheKey, next);
      setPendingChange(null);
      setStatus('ready');
    } catch (error) {
      if (isUnauthenticatedError(error)) setStatus('sign-in-required');
      else if (error instanceof NotificationSubscriptionError) setStatus('subscription-error');
      else setStatus('save-error');
    }
  }

  async function signIn() {
    const client = createClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setStatus('save-error');
  }

  function retryPendingChange() {
    if (pendingChange) {
      void change(pendingChange.key, pendingChange.enabled);
      return;
    }
    setStatus('loading');
    void loadPreferences();
  }

  if (status === 'loading')
    return (
      <section className="h-40 animate-pulse rounded-3xl bg-primary-100" aria-label="Loading notification settings" />
    );
  return (
    <section
      aria-labelledby="notifications-heading"
      className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-100 text-brand-deep">
          {status === 'denied' ? (
            <BellOff aria-hidden="true" className="size-5" />
          ) : (
            <Bell aria-hidden="true" className="size-5" />
          )}
        </span>
        <div>
          <h2 id="notifications-heading" className="text-xl font-bold tracking-tight text-ink">
            Notifications
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Stay informed when EnRoute is closed. Each alert is optional and off by default.
          </p>
        </div>
      </div>
      {status === 'unsupported' ? (
        <p className="mt-5 rounded-xl bg-warning-soft p-4 text-sm leading-6 text-text-secondary">
          This browser does not support push notifications. Install EnRoute on a supported device to enable them.
        </p>
      ) : (
        <>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
            {choices.map((choice) => (
              <label
                className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors duration-200 hover:bg-primary-50"
                key={choice.key}
              >
                <span>
                  <span className="block font-bold text-ink">{choice.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted">{choice.description}</span>
                </span>
                <span className="relative flex size-11 shrink-0 items-center justify-center">
                  <input
                    aria-label={choice.title}
                    checked={preferences[choice.key]}
                    className="peer sr-only"
                    disabled={status !== 'ready'}
                    onChange={(event) => {
                      void change(choice.key, event.target.checked);
                    }}
                    type="checkbox"
                  />
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-11 items-center rounded-full border border-border bg-surface-muted p-0.5 transition-colors duration-200 peer-checked:border-brand peer-checked:bg-brand peer-checked:[&>span]:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20"
                  >
                    <span className="size-5 rounded-full bg-white shadow-sm transition-transform duration-200" />
                  </span>
                </span>
              </label>
            ))}
          </div>
          {status === 'denied' && (
            <p role="alert" className="mt-4 text-sm leading-6 text-warning">
              Notifications are blocked by this browser. Enable them in your browser or device settings, then reload
              this page.
            </p>
          )}
          {status === 'sign-in-required' && (
            <div role="alert" className="mt-4">
              <p className="text-sm leading-6 text-warning">Sign in to save notification alerts on this device.</p>
              <button
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
                onClick={() => {
                  void signIn();
                }}
                type="button"
              >
                <LogIn className="size-4" />
                Sign in with Google
              </button>
            </div>
          )}
          {(status === 'subscription-error' || status === 'save-error' || status === 'load-error') && (
            <div role="alert" className="mt-4">
              <p className="text-sm leading-6 text-warning">
                {status === 'subscription-error'
                  ? 'We could not register this device for notifications. Check your device settings, then try again.'
                  : status === 'load-error'
                    ? 'We could not load your notification settings. Please try again.'
                    : 'We could not save this change. Your previous notification settings are still active.'}
              </p>
              <button
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep transition-colors duration-200 hover:bg-primary-50"
                onClick={retryPendingChange}
                type="button"
              >
                <RefreshCw className="size-4" />
                {status === 'load-error' ? 'Reload notification settings' : 'Try again'}
              </button>
            </div>
          )}
          {status === 'saving' && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" />
              Saving your preference…
            </p>
          )}
        </>
      )}
    </section>
  );
}

async function registerSubscription() {
  // A VAPID public key identifies this app to the browser push service; its matching private key stays in Supabase.
  try {
    const registration = await navigator.serviceWorker.ready;
    let existing = await registration.pushManager.getSubscription();
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) throw new NotificationSubscriptionError();
    const applicationServerKey = decodeKey(publicKey);
    if (existing && usesApplicationServerKey(existing, applicationServerKey)) return;
    if (existing && !usesApplicationServerKey(existing, applicationServerKey)) {
      const removed = await existing.unsubscribe();
      if (!removed) throw new NotificationSubscriptionError();
      existing = null;
    }
    const subscription =
      existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
    const response = await fetch('/api/notifications/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    await requireSuccessfulResponse(response);
  } catch (error) {
    if (error instanceof NotificationRequestError) throw error;
    throw new NotificationSubscriptionError();
  }
}

class NotificationRequestError extends Error {
  constructor(readonly status: number) {
    super(`Notification request failed with status ${status}.`);
  }
}

class NotificationSubscriptionError extends Error {}

async function requireSuccessfulResponse(response: Response) {
  if (!response.ok) throw new NotificationRequestError(response.status);
}

function isUnauthenticatedError(error: unknown) {
  return error instanceof NotificationRequestError && error.status === 401;
}

function usesApplicationServerKey(subscription: PushSubscription, applicationServerKey: Uint8Array) {
  const existingKey = subscription.options.applicationServerKey;
  if (!existingKey) return false;
  const existingBytes = new Uint8Array(existingKey);
  return (
    existingBytes.length === applicationServerKey.length &&
    existingBytes.every((byte, index) => byte === applicationServerKey[index])
  );
}

function decodeKey(value: string) {
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
