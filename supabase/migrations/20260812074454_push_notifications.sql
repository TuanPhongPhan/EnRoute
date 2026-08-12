create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  leave_reminders boolean not null default false,
  disruption_alerts boolean not null default false,
  platform_alerts boolean not null default false,
  alternative_alerts boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Fingerprints make a retry-safe delivery ledger: the same commute state can notify a user only once.
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monitored_commute_id uuid references public.monitored_commutes(id) on delete cascade,
  kind text not null check (kind in ('leave', 'disruption', 'platform', 'alternative')),
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

alter table public.monitored_commutes
  add column event_starts_at timestamptz,
  add column last_evaluated_at timestamptz,
  add column last_risk text,
  add column last_platform text;

create index notification_deliveries_commute_idx on public.notification_deliveries (monitored_commute_id, created_at desc);
create index monitored_commutes_monitor_idx on public.monitored_commutes (departure_at, arrival_at) where status = 'active';

alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users read own notification deliveries" on public.notification_deliveries for select to authenticated using ((select auth.uid()) = user_id);
