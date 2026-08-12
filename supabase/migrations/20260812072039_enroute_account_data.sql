create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_address text not null,
  university_address text not null,
  preferred_buffer_minutes smallint not null check (preferred_buffer_minutes in (10, 15, 20, 30)),
  calendar_id text not null default 'primary',
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_tokens text not null,
  status text not null default 'connected' check (status in ('connected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table public.monitored_commutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_event_id text not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index monitored_commutes_active_idx on public.monitored_commutes (user_id, departure_at) where status = 'active';

alter table public.user_settings enable row level security;
alter table public.calendar_integrations enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.monitored_commutes enable row level security;

create policy "users manage own settings" on public.user_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own calendar integration" on public.calendar_integrations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own push subscriptions" on public.push_subscriptions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own monitored commutes" on public.monitored_commutes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
