'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Coffee, Pause, Play, RotateCcw, TimerReset, WifiOff } from 'lucide-react';

import { readCurrentJourney, selectedJourney } from '@/lib/current-journey';
import {
  breakMinutes,
  clearFocus,
  createFocusSession,
  journeyFitMinutes,
  pomodoroMinutes,
  readFocus,
  readPendingFocusCompletions,
  remainingSeconds,
  removePendingFocusCompletion,
  saveFocus,
  savePendingFocusCompletion,
  usableLeg,
  type FocusSession,
  type PendingFocusCompletion,
} from '@/lib/focus-session';
import { type FocusSummary } from '@/lib/focus-statistics';

type Completion = PendingFocusCompletion & { phase: 'focus' | 'break' };
type SyncStatus = 'idle' | 'syncing' | 'saved-locally' | 'saved';

export function FocusDashboard() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number>(25);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const finishingSessionId = useRef<string | null>(null);

  const journey = selectedJourney(readCurrentJourney());
  const leg = usableLeg(journey);
  const fitMinutes = journeyFitMinutes(journey);

  const loadSummary = useCallback(async () => {
    const response = await fetch('/api/focus-sessions');
    if (!response.ok) return;
    const data = (await response.json()) as { summary: FocusSummary };
    setSummary(data.summary);
  }, []);

  const syncCompletion = useCallback(async (item: PendingFocusCompletion) => {
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/focus-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error('focus_session_not_saved');

      const data = (await response.json()) as { summary: FocusSummary };
      removePendingFocusCompletion(item.clientSessionId);
      setSummary(data.summary);
      setSyncStatus('saved');
    } catch {
      savePendingFocusCompletion(item);
      setSyncStatus('saved-locally');
    }
  }, []);

  const syncPendingCompletions = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = readPendingFocusCompletions();
    for (const item of pending) await syncCompletion(item);
  }, [syncCompletion]);

  const commit = useCallback((next: FocusSession | null) => {
    setSession(next);
    if (next) saveFocus(next);
    else clearFocus();
  }, []);

  const finishSession = useCallback(
    (activeSession: FocusSession) => {
      if (finishingSessionId.current === activeSession.clientSessionId) return;
      finishingSessionId.current = activeSession.clientSessionId;
      commit(null);

      const completed: Completion = {
        phase: activeSession.phase,
        clientSessionId: activeSession.clientSessionId,
        title: activeSession.title,
        plannedMinutes: activeSession.plannedMinutes,
        startedAt: activeSession.startedAt,
        destination: activeSession.destination,
      };
      setCompletion(completed);

      if (activeSession.phase === 'focus') void syncCompletion(completed);
    },
    [commit, syncCompletion],
  );

  useEffect(() => {
    setSession(readFocus());
    setOnline(navigator.onLine);
    setNow(Date.now());
    void loadSummary();
    void syncPendingCompletions();

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncPendingCompletions();
    };
    addEventListener('online', updateOnline);
    addEventListener('offline', updateOnline);

    return () => {
      clearInterval(timer);
      removeEventListener('online', updateOnline);
      removeEventListener('offline', updateOnline);
    };
  }, [loadSummary, syncPendingCompletions]);

  const seconds = session ? remainingSeconds(session, now) : 0;

  useEffect(() => {
    if (session && !session.pausedAt && seconds === 0) finishSession(session);
  }, [finishSession, seconds, session]);

  function startFocus(minutes: number) {
    finishingSessionId.current = null;
    setCompletion(null);
    setSyncStatus('idle');
    commit(
      createFocusSession({
        title,
        plannedMinutes: minutes,
        destination: leg?.destination ?? 'your next stop',
      }),
    );
  }

  function startBreak() {
    finishingSessionId.current = null;
    setCompletion(null);
    commit(
      createFocusSession({
        title: 'Short break',
        plannedMinutes: breakMinutes,
        destination: completion?.destination ?? leg?.destination ?? 'your next stop',
        phase: 'break',
      }),
    );
  }

  if (completion) {
    const isBreak = completion.phase === 'break';
    return (
      <main className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Focus</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">{isBreak ? 'Break complete.' : 'Session complete.'}</h1>
          <p className="mt-3 text-text-secondary">
            {isBreak
              ? 'Ready when you are for the next focused block.'
              : `${completion.plannedMinutes} focused minutes logged for ${completion.title}.`}
          </p>
        </div>

        {!isBreak && (
          <section className="rounded-3xl border border-primary-100 bg-primary-50 p-5 text-text-secondary">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-bold text-ink">
                  {syncStatus === 'syncing'
                    ? 'Saving your session…'
                    : syncStatus === 'saved'
                      ? 'Saved to your focus history.'
                      : 'Saved on this device.'}
                </p>
                {syncStatus === 'saved-locally' && (
                  <p className="mt-1 text-sm">It will sync to your account when the connection is available.</p>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          {!isBreak && (
            <button
              className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={startBreak}
              type="button"
            >
              <Coffee className="size-5" /> Take a {breakMinutes}-min break
            </button>
          )}
          <button
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-brand bg-surface px-5 py-3 font-bold text-brand-deep transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => {
              finishingSessionId.current = null;
              setCompletion(null);
              setSyncStatus('idle');
            }}
            type="button"
          >
            <ArrowRight className="size-5" /> {isBreak ? 'Start focus' : 'Another focus block'}
          </button>
        </div>
      </main>
    );
  }

  if (!session)
    return (
      <main className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Focus</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Make train time count.</h1>
          <p className="mt-3 max-w-xl text-text-secondary">
            A simple Pomodoro timer for the part of your commute where you can concentrate.
          </p>
        </div>

        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          {leg ? (
            <p className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-text-secondary">
              Your selected connection has{' '}
              {Math.round((Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60_000)} min before{' '}
              {leg.destination}.
            </p>
          ) : (
            <p className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
              Select a journey first to fit a session around your train time. You can still choose a 25- or 50-minute
              timer.
            </p>
          )}

          <label className="mt-5 block text-sm font-bold text-ink" htmlFor="focus-title">
            What are you working on? <span className="font-normal text-muted">Optional</span>
          </label>
          <input
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-primary-100"
            id="focus-title"
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Study session"
            value={title}
          />

          <fieldset className="mt-6">
            <legend className="text-sm font-bold text-ink">Choose a duration</legend>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
              {pomodoroMinutes.map((minutes) => (
                <DurationButton
                  active={duration === minutes}
                  key={minutes}
                  label={`${minutes} min`}
                  onClick={() => setDuration(minutes)}
                />
              ))}
              <DurationButton
                active={duration === fitMinutes}
                disabled={!fitMinutes}
                label={fitMinutes ? `Fit journey · ${fitMinutes}` : 'Fit journey'}
                onClick={() => fitMinutes && setDuration(fitMinutes)}
              />
            </div>
          </fieldset>

          <button
            className="mt-6 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-white transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto"
            onClick={() => startFocus(duration)}
            type="button"
          >
            <Play className="size-5" /> Start {duration}-minute focus
          </button>
        </section>

        <FocusStats summary={summary} />
      </main>
    );

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">
            {session.phase === 'focus' ? 'Focus' : 'Break'}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink">
            {session.phase === 'focus' ? session.title : 'Take five.'}
          </h1>
        </div>
        {!online && (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-2 text-sm font-semibold text-text-secondary">
            <WifiOff className="size-4" /> Offline
          </span>
        )}
      </div>

      <section className="rounded-3xl bg-brand-deep p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-4 text-primary-100">
          <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em]">
            <TimerReset className="size-4" />{' '}
            {session.pausedAt ? 'Paused' : session.phase === 'focus' ? 'Focus time' : 'Short break'}
          </span>
          <span className="text-sm font-semibold">{session.destination}</span>
        </div>
        <p aria-live="polite" className="mt-8 text-7xl font-bold tracking-tight sm:text-8xl">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            aria-label={session.pausedAt ? 'Resume timer' : 'Pause timer'}
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-surface px-4 py-3 font-bold text-brand-deep transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() =>
              commit(
                session.pausedAt
                  ? {
                      ...session,
                      pausedMs: session.pausedMs + Date.now() - Date.parse(session.pausedAt),
                      pausedAt: undefined,
                    }
                  : { ...session, pausedAt: new Date().toISOString() },
              )
            }
            type="button"
          >
            {session.pausedAt ? <Play className="size-5" /> : <Pause className="size-5" />}
            {session.pausedAt ? 'Resume' : 'Pause'}
          </button>
          <button
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-white/35 px-4 py-3 font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => {
              finishingSessionId.current = null;
              commit(null);
            }}
            type="button"
          >
            <RotateCcw className="size-5" /> End session
          </button>
        </div>
      </section>

      <p className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-brand" />
        The timer stays on this device if your connection drops. Completed focus time syncs when you are back online.
      </p>
    </main>
  );
}

function DurationButton({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-12 cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-brand bg-primary-50 text-brand-deep'
          : 'border-border bg-surface text-text-secondary hover:border-primary-100 hover:bg-primary-50'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FocusStats({ summary }: { summary: FocusSummary | null }) {
  if (!summary)
    return (
      <p className="rounded-2xl border border-border bg-surface-muted p-4 text-sm text-text-secondary">
        Sign in to keep your focus history and streak in sync across your devices.
      </p>
    );

  return (
    <section aria-label="Focus statistics" className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Today" value={`${summary.todayMinutes} min`} />
      <StatCard label="Completed" value={`${summary.completedSessions}`} />
      <StatCard label="Day streak" value={`${summary.currentStreak}`} />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
