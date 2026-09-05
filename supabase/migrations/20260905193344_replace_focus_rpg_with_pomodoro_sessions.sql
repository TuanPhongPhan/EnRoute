-- Keep prior RPG rows for reference, but retire their callable reward mechanics.
revoke all on function public.claim_focus_rpg_reward(uuid, text, smallint) from authenticated;
revoke all on function public.allocate_focus_rpg_stat(text) from authenticated;
revoke all on function public.resolve_focus_rpg_encounter(uuid, text) from authenticated;
revoke all on function public.set_focus_rpg_equipment(uuid) from authenticated;

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  planned_minutes smallint not null check (planned_minutes between 5 and 50),
  completed_minutes smallint not null check (completed_minutes between 5 and 50),
  destination text not null default '' check (char_length(destination) <= 160),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

create index focus_sessions_user_completed_at_idx on public.focus_sessions (user_id, completed_at desc);

alter table public.focus_sessions enable row level security;

create policy "users manage own focus sessions"
on public.focus_sessions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
