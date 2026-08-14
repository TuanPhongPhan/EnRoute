'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { Bell, BellOff, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type Preferences = {
  leave_reminders: boolean;
  disruption_alerts: boolean;
  platform_alerts: boolean;
  alternative_alerts: boolean;
};
const initial: Preferences = {
  leave_reminders: false,
  disruption_alerts: false,
  platform_alerts: false,
  alternative_alerts: false,
};
const choices: Array<{ key: keyof Preferences; title: string; description: string }> = [
  {
    key: 'leave_reminders',
    title: 'Leave reminder',
    description: 'A single reminder 20 minutes before you should leave.',
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
  const [preferences, setPreferences] = useState<Preferences>(initial);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported' | 'denied' | 'saving' | 'error'>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    void fetch('/api/notifications/preferences')
      .then(async (response) => {
        if (!response.ok) {
          setStatus('ready');
          return;
        }
        setPreferences(((await response.json()) as { preferences: Preferences }).preferences);
        setStatus(Notification.permission === 'denied' ? 'denied' : 'ready');
      })
      .catch(() => setStatus('error'));
  }, []);

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
    try {
      if (enabled) await registerSubscription();
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).then((response) => {
        if (!response.ok) throw new Error();
      });
      setPreferences(next);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
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
                <input
                  aria-label={choice.title}
                  checked={preferences[choice.key]}
                  className="size-5 accent-teal-600"
                  disabled={status === 'saving' || status === 'denied'}
                  onChange={(event) => {
                    void change(choice.key, event.target.checked);
                  }}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
          {status === 'denied' && (
            <p className="mt-4 text-sm leading-6 text-warning">
              Notifications are blocked by this browser. Enable them in your browser or device settings, then reload
              this page.
            </p>
          )}
          {status === 'error' && (
            <p className="mt-4 text-sm leading-6 text-warning">
              We could not save notification settings. Please try again.
            </p>
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
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('VAPID public key is unavailable.');
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) }));
  const response = await fetch('/api/notifications/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) throw new Error('Subscription could not be saved.');
}

function decodeKey(value: string) {
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
