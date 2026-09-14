alter table public.notification_preferences
  add column transfer_alerts boolean not null default false;

alter table public.monitored_commutes
  add column direction text not null default 'outbound' check (direction in ('outbound', 'return')),
  add column route_fingerprint text;

create unique index monitored_commutes_one_active_route_idx
  on public.monitored_commutes (user_id, calendar_event_id, direction)
  where status = 'active';

create table public.commute_transfer_alerts (
  id uuid primary key default gen_random_uuid(),
  monitored_commute_id uuid not null references public.monitored_commutes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence smallint not null check (sequence >= 0),
  alert_at timestamptz not null,
  arrives_at timestamptz not null,
  station text not null,
  next_service_label text not null,
  next_service_destination text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'cancelled')),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (monitored_commute_id, sequence)
);

create index commute_transfer_alerts_due_idx
  on public.commute_transfer_alerts (alert_at)
  where status = 'scheduled';

alter table public.commute_transfer_alerts enable row level security;

create policy "users read own commute transfer alerts"
  on public.commute_transfer_alerts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users create own commute transfer alerts"
  on public.commute_transfer_alerts for insert to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.notification_deliveries
  add column commute_transfer_alert_id uuid references public.commute_transfer_alerts(id) on delete cascade;

alter table public.notification_deliveries
  drop constraint notification_deliveries_kind_check,
  add constraint notification_deliveries_kind_check
    check (kind in ('leave', 'disruption', 'platform', 'alternative', 'transfer'));
