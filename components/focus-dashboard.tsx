'use client';
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Pause, Play, SkipForward, WifiOff } from 'lucide-react';
import {
  clearFocus,
  focusActivities,
  blocksFor,
  readFocus,
  remainingSeconds,
  saveFocus,
  usableLeg,
  type FocusActivity,
  type FocusSession,
} from '@/lib/focus-session';
import { readCurrentJourney, selectedJourney } from '@/lib/current-journey';
export function FocusDashboard() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [activity, setActivity] = useState<FocusActivity>('Study');
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setSession(readFocus());
    setOnline(navigator.onLine);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => {
      clearInterval(timer);
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);
  const leg = usableLeg(selectedJourney(readCurrentJourney()));
  const commit = (next: FocusSession | null) => {
    setSession(next);
    if (next) saveFocus(next);
    else clearFocus();
  };
  if (!session)
    return (
      <main>
        <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Focus</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Make train time count.</h1>
        {!leg ? (
          <p className="mt-5 rounded-2xl bg-teal-50 p-5 text-muted">
            Choose a journey with a train leg on the Journey screen to build a focus plan.
          </p>
        ) : (
          <section className="mt-6 rounded-3xl border border-teal-950/10 bg-surface p-6 shadow-sm">
            <p className="text-muted">
              You have {Math.round((Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60000)} min
              before {leg.destination}.
            </p>
            <label className="mt-5 block font-bold text-ink">
              Activity
              <select
                className="mt-2 min-h-12 w-full rounded-xl border p-3"
                value={activity}
                onChange={(e) => setActivity(e.target.value as FocusActivity)}
              >
                {focusActivities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              className="mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-white"
              onClick={() =>
                commit({
                  activity,
                  blocks: blocksFor(
                    Math.round((Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60000),
                  ),
                  activeIndex: 0,
                  startedAt: new Date().toISOString(),
                  pausedMs: 0,
                  completed: false,
                  destination: leg.destination,
                })
              }
            >
              <Play className="size-5" />
              Start focus session
            </button>
          </section>
        )}
      </main>
    );
  const seconds = remainingSeconds(session, now);
  const block = session.blocks[session.activeIndex];
  const advance = () => {
    const next = session.activeIndex + 1;
    commit(
      next >= session.blocks.length
        ? { ...session, completed: true }
        : { ...session, activeIndex: next, startedAt: new Date().toISOString(), pausedMs: 0, pausedAt: undefined },
    );
  };
  if (session.completed)
    return (
      <main>
        <h1 className="text-3xl font-bold text-ink">Session complete.</h1>
        <p className="mt-3 text-muted">Nice work on your way to {session.destination}.</p>
        <button className="mt-5 rounded-xl bg-brand px-5 py-3 font-bold text-white" onClick={() => commit(null)}>
          Start another session
        </button>
      </main>
    );
  return (
    <main>
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Focus</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">{block.kind === 'focus' ? session.activity : 'Break'}</h1>
        </div>
        {!online && (
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <WifiOff className="size-4" />
            Offline
          </span>
        )}
      </div>
      <section className="mt-6 rounded-3xl bg-brand-deep p-8 text-white">
        <p className="text-7xl font-bold">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </p>
        <p className="mt-3 text-teal-100">
          Block {session.activeIndex + 1} of {session.blocks.length} · {session.destination}
        </p>
        <div className="mt-7 flex gap-3">
          <button
            className="rounded-xl bg-white px-4 py-3 font-bold text-brand-deep"
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
          >
            {session.pausedAt ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          <button className="rounded-xl border border-white/30 px-4 py-3 font-bold" onClick={advance}>
            <SkipForward className="size-5" />
          </button>
        </div>
      </section>
    </main>
  );
}
