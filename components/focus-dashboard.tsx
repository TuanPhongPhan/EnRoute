'use client';
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */

import { useEffect, useState, type ReactNode } from 'react';
import { Pause, Play, Shield, SkipForward, Sparkles, Sword, Trophy, WifiOff } from 'lucide-react';

import { readCurrentJourney, selectedJourney } from '@/lib/current-journey';
import {
  blocksFor,
  clearFocus,
  focusActivities,
  readFocus,
  remainingSeconds,
  saveFocus,
  usableLeg,
  type FocusActivity,
  type FocusSession,
} from '@/lib/focus-session';
import {
  createFocusSessionId,
  focusMinutes,
  type CombatAction,
  type FocusRewardResult,
  type RpgEncounter,
  type RpgItem,
  type RpgProfile,
  xpToNextLevel,
} from '@/lib/focus-rpg';

export function FocusDashboard() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [activity, setActivity] = useState<FocusActivity>('Study');
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(true);
  const [profile, setProfile] = useState<RpgProfile | null>(null);
  const [inventory, setInventory] = useState<RpgItem[]>([]);
  const [encounter, setEncounter] = useState<RpgEncounter | null>(null);
  const [reward, setReward] = useState<FocusRewardResult | null>(null);
  const [rewardState, setRewardState] = useState<'idle' | 'claiming' | 'offline' | 'error'>('idle');

  const loadRpg = async () => {
    const response = await fetch('/api/focus-rpg');
    if (!response.ok) return;
    const data = (await response.json()) as {
      profile: RpgProfile | null;
      inventory: RpgItem[];
      encounter: RpgEncounter | null;
    };
    setProfile(data.profile);
    setInventory(data.inventory);
    setEncounter(data.encounter);
  };

  useEffect(() => {
    setSession(readFocus());
    setOnline(navigator.onLine);
    void loadRpg();
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

  async function claimRewards() {
    if (!session?.completed) return;
    if (!online) {
      localStorage.setItem('enroute:focus-rpg-pending:v1', JSON.stringify(session));
      setRewardState('offline');
      return;
    }
    setRewardState('claiming');
    try {
      const response = await fetch('/api/focus-rpg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          sessionId: session.clientSessionId,
          activity: session.activity,
          minutes: focusMinutes(session),
        }),
      });
      if (!response.ok) throw new Error('claim_failed');
      const result = (await response.json()) as FocusRewardResult;
      setReward(result);
      setProfile(result.profile);
      setEncounter(result.encounter);
      setInventory((items) => [result.item, ...items.filter((item) => item.id !== result.item.id)]);
      localStorage.removeItem('enroute:focus-rpg-pending:v1');
      setRewardState('idle');
    } catch {
      setRewardState('error');
    }
  }

  async function takeCombatTurn(action: CombatAction) {
    if (!encounter || encounter.status !== 'pending') return;
    const response = await fetch('/api/focus-rpg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'combat', encounterId: encounter.id, combatAction: action }),
    });
    if (!response.ok) return;
    setEncounter(((await response.json()) as { encounter: RpgEncounter }).encounter);
  }

  async function allocateStat(stat: 'focus' | 'knowledge' | 'resilience') {
    const response = await fetch('/api/focus-rpg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'allocate', stat }),
    });
    if (response.ok) setProfile(((await response.json()) as { profile: RpgProfile }).profile);
  }

  async function equipItem(itemId: string) {
    const response = await fetch('/api/focus-rpg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'equip', itemId }),
    });
    if (!response.ok) return;
    const { item } = (await response.json()) as { item: RpgItem };
    setInventory((items) =>
      items.map((current) => ({
        ...current,
        is_equipped: current.slot === item.slot ? current.id === item.id : current.is_equipped,
      })),
    );
  }

  const rpg = <RpgSummary inventory={inventory} onAllocate={allocateStat} onEquip={equipItem} profile={profile} />;

  if (!session)
    return (
      <main className="space-y-6">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Focus</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Make train time count.</h1>
        {!leg ? (
          <p className="rounded-2xl border border-primary-100 bg-primary-50 p-5 text-text-secondary">
            Choose a journey with a train leg on the Journey screen to build a focus plan.
          </p>
        ) : (
          <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-muted">
              You have {Math.round((Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60_000)} min
              before {leg.destination}.
            </p>
            <label className="mt-5 block font-bold text-ink">
              Activity
              <select
                className="mt-2 min-h-12 w-full rounded-xl border p-3"
                value={activity}
                onChange={(event) => setActivity(event.target.value as FocusActivity)}
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
                    Math.round((Date.parse(leg.actualArrival) - Date.parse(leg.actualDeparture)) / 60_000),
                  ),
                  activeIndex: 0,
                  startedAt: new Date().toISOString(),
                  pausedMs: 0,
                  completed: false,
                  destination: leg.destination,
                  clientSessionId: createFocusSessionId(),
                })
              }
              type="button"
            >
              <Play className="size-5" /> Start focus session
            </button>
          </section>
        )}
        {rpg}
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
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-ink">Session complete.</h1>
          <p className="mt-3 text-muted">Nice work on your way to {session.destination}.</p>
        </div>
        {!reward && (
          <button
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-60"
            disabled={rewardState === 'claiming'}
            onClick={() => void claimRewards()}
            type="button"
          >
            <Trophy className="size-5" /> {rewardState === 'claiming' ? 'Claiming rewards…' : 'Claim travel rewards'}
          </button>
        )}
        {rewardState === 'offline' && (
          <p className="text-sm text-muted">Reward saved on this device and ready to claim when you are online.</p>
        )}
        {rewardState === 'error' && (
          <p className="text-sm text-warning">
            We could not save your reward yet. Try again when your connection is ready.
          </p>
        )}
        {reward && (
          <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Journey reward</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">
              +{reward.claim.xp_awarded} XP · {reward.item.item_name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Your {reward.item.rarity} find is safely stored in your travel kit.
            </p>
          </section>
        )}
        <EncounterCard encounter={encounter} onAction={takeCombatTurn} />
        {rpg}
        <button
          className="rounded-xl bg-brand px-5 py-3 font-bold text-white"
          onClick={() => commit(null)}
          type="button"
        >
          Start another session
        </button>
      </main>
    );

  return (
    <main className="space-y-6">
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
      <section className="rounded-3xl bg-brand-deep p-8 text-white">
        <p className="text-7xl font-bold">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </p>
        <p className="mt-3 text-primary-100">
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
            type="button"
          >
            {session.pausedAt ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          <button className="rounded-xl border border-white/30 px-4 py-3 font-bold" onClick={advance} type="button">
            <SkipForward className="size-5" />
          </button>
        </div>
      </section>
      <EncounterCard encounter={encounter} onAction={takeCombatTurn} />
      {rpg}
    </main>
  );
}

function RpgSummary({
  profile,
  inventory,
  onAllocate,
  onEquip,
}: {
  profile: RpgProfile | null;
  inventory: RpgItem[];
  onAllocate: (stat: 'focus' | 'knowledge' | 'resilience') => void;
  onEquip: (itemId: string) => void;
}) {
  if (!profile)
    return (
      <p className="rounded-2xl border border-primary-100 bg-primary-50 p-4 text-sm text-text-secondary">
        Complete a focus session to begin your commute adventurer journey.
      </p>
    );
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-brand">Commute adventurer</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Level {profile.level}</h2>
        </div>
        <span className="rounded-full bg-accent-100 px-3 py-1 text-sm font-bold text-accent-600">
          {profile.current_streak} day streak
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary-100">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.min(100, (profile.xp / (profile.level * 100)) * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        {xpToNextLevel(profile)} XP to level {profile.level + 1}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {(['focus', 'knowledge', 'resilience'] as const).map((stat) => (
          <button
            className="rounded-xl border border-border bg-white p-3 text-left transition-colors hover:bg-primary-50 disabled:cursor-default"
            disabled={profile.unspent_stat_points === 0}
            key={stat}
            onClick={() => onAllocate(stat)}
            type="button"
          >
            <span className="block text-xs font-bold uppercase tracking-wide text-muted">{stat}</span>
            <span className="mt-1 block text-xl font-bold text-ink">{profile[stat]}</span>
          </button>
        ))}
      </div>
      {profile.unspent_stat_points > 0 && (
        <p className="mt-3 text-sm font-semibold text-brand-deep">
          Choose an attribute to spend {profile.unspent_stat_points} stat point.
        </p>
      )}
      {inventory.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">Travel kit</p>
          {inventory.slice(0, 3).map((item) =>
            item.slot ? (
              <button
                className="mr-2 cursor-pointer rounded-lg border border-primary-100 px-3 py-2 text-sm font-semibold text-brand-deep hover:bg-primary-50"
                key={item.id}
                onClick={() => onEquip(item.id)}
                type="button"
              >
                {item.item_name} +{item.stat_bonus} {item.stat}
                {item.is_equipped ? ' · equipped' : ''}
              </button>
            ) : (
              <span className="mr-2 text-sm text-muted" key={item.id}>
                {item.item_name}
              </span>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function EncounterCard({
  encounter,
  onAction,
}: {
  encounter: RpgEncounter | null;
  onAction: (action: CombatAction) => void;
}) {
  if (!encounter) return null;
  return (
    <section className="rounded-3xl bg-brand-deep p-6 text-white shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[.16em] text-primary-100">Travel encounter</p>
      <h2 className="mt-2 text-2xl font-bold">{encounter.enemy_name}</h2>
      <p className="mt-3 text-sm text-primary-100">
        You {encounter.player_health} HP · opponent {encounter.enemy_health} HP · turn {encounter.turns}/3
      </p>
      {encounter.status !== 'pending' ? (
        <p className="mt-5 font-bold">
          {encounter.status === 'won'
            ? 'Encounter cleared.'
            : 'The encounter fades away. Your session rewards are yours to keep.'}
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <ActionButton icon={<Sword className="size-4" />} label="Attack" onClick={() => onAction('attack')} />
          <ActionButton icon={<Sparkles className="size-4" />} label="Focus" onClick={() => onAction('focus')} />
          <ActionButton icon={<Shield className="size-4" />} label="Guard" onClick={() => onAction('guard')} />
        </div>
      )}
    </section>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-deep transition-colors hover:bg-primary-50"
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
