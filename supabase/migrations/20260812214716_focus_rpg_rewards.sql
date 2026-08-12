create table public.focus_rpg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  focus integer not null default 1 check (focus >= 1),
  knowledge integer not null default 1 check (knowledge >= 1),
  resilience integer not null default 1 check (resilience >= 1),
  unspent_stat_points integer not null default 0 check (unspent_stat_points >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  last_completed_date date,
  updated_at timestamptz not null default now()
);

create table public.focus_rpg_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  activity text not null check (activity in ('Study', 'Read', 'Flashcards', 'Code', 'Watch', 'Podcast', 'Rest')),
  completed_minutes smallint not null check (completed_minutes between 1 and 180),
  xp_awarded integer not null check (xp_awarded > 0),
  completed_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

create table public.focus_rpg_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null references public.focus_rpg_claims(id) on delete cascade,
  item_key text not null,
  item_name text not null,
  rarity text not null check (rarity in ('common', 'uncommon', 'rare')),
  slot text check (slot in ('charm', 'tool', 'cloak')),
  stat text check (stat in ('focus', 'knowledge', 'resilience')),
  stat_bonus smallint not null default 0 check (stat_bonus between 0 and 3),
  is_equipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (claim_id)
);

create table public.focus_rpg_encounters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null unique references public.focus_rpg_claims(id) on delete cascade,
  enemy_name text not null,
  enemy_health integer not null check (enemy_health >= 0),
  player_health integer not null check (player_health >= 0),
  turns smallint not null default 0 check (turns between 0 and 3),
  status text not null default 'pending' check (status in ('pending', 'won', 'lost')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.focus_rpg_profiles enable row level security;
alter table public.focus_rpg_claims enable row level security;
alter table public.focus_rpg_inventory enable row level security;
alter table public.focus_rpg_encounters enable row level security;

create policy "users read own focus RPG profile" on public.focus_rpg_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own focus RPG claims" on public.focus_rpg_claims for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own focus RPG inventory" on public.focus_rpg_inventory for select to authenticated using ((select auth.uid()) = user_id);
create policy "users read own focus RPG encounters" on public.focus_rpg_encounters for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.claim_focus_rpg_reward(
  p_client_session_id uuid,
  p_activity text,
  p_completed_minutes smallint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.focus_rpg_profiles;
  v_claim public.focus_rpg_claims;
  v_item public.focus_rpg_inventory;
  v_encounter public.focus_rpg_encounters;
  v_today date := timezone('Europe/Berlin', now())::date;
  v_roll numeric := random();
  v_item_index integer;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  if p_activity not in ('Study', 'Read', 'Flashcards', 'Code', 'Watch', 'Podcast', 'Rest')
    or p_completed_minutes not between 1 and 180 then raise exception 'invalid reward'; end if;

  select * into v_claim from public.focus_rpg_claims
    where user_id = v_user_id and client_session_id = p_client_session_id;
  if found then
    select * into v_profile from public.focus_rpg_profiles where user_id = v_user_id;
    select * into v_item from public.focus_rpg_inventory where claim_id = v_claim.id;
    select * into v_encounter from public.focus_rpg_encounters where claim_id = v_claim.id;
    return jsonb_build_object('profile', to_jsonb(v_profile), 'claim', to_jsonb(v_claim), 'item', to_jsonb(v_item), 'encounter', to_jsonb(v_encounter), 'duplicate', true);
  end if;

  insert into public.focus_rpg_profiles (user_id) values (v_user_id)
    on conflict (user_id) do nothing;
  select * into v_profile from public.focus_rpg_profiles where user_id = v_user_id for update;

  v_profile.xp := v_profile.xp + p_completed_minutes;
  while v_profile.xp >= v_profile.level * 100 loop
    v_profile.xp := v_profile.xp - v_profile.level * 100;
    v_profile.level := v_profile.level + 1;
    v_profile.unspent_stat_points := v_profile.unspent_stat_points + 1;
  end loop;
  v_profile.current_streak := case
    when v_profile.last_completed_date = v_today then v_profile.current_streak
    when v_profile.last_completed_date = v_today - 1 then v_profile.current_streak + 1
    else 1
  end;
  v_profile.last_completed_date := v_today;
  update public.focus_rpg_profiles set
    level = v_profile.level, xp = v_profile.xp, unspent_stat_points = v_profile.unspent_stat_points,
    current_streak = v_profile.current_streak, last_completed_date = v_profile.last_completed_date, updated_at = now()
    where user_id = v_user_id returning * into v_profile;

  insert into public.focus_rpg_claims (user_id, client_session_id, activity, completed_minutes, xp_awarded)
    values (v_user_id, p_client_session_id, p_activity, p_completed_minutes, p_completed_minutes)
    returning * into v_claim;

  if v_roll < 0.08 then
    v_item_index := floor(random() * 3)::integer;
    insert into public.focus_rpg_inventory (user_id, claim_id, item_key, item_name, rarity, slot, stat, stat_bonus)
      values (v_user_id, v_claim.id,
        (array['signal-lantern', 'scholar-compass', 'storm-cloak'])[v_item_index + 1],
        (array['Signal Lantern', 'Scholar Compass', 'Storm Cloak'])[v_item_index + 1],
        'rare', (array['charm', 'tool', 'cloak'])[v_item_index + 1],
        (array['focus', 'knowledge', 'resilience'])[v_item_index + 1], 3)
      returning * into v_item;
  elsif v_roll < 0.30 then
    v_item_index := floor(random() * 3)::integer;
    insert into public.focus_rpg_inventory (user_id, claim_id, item_key, item_name, rarity, slot, stat, stat_bonus)
      values (v_user_id, v_claim.id,
        (array['route-charm', 'note-kit', 'steady-scarf'])[v_item_index + 1],
        (array['Route Charm', 'Note Kit', 'Steady Scarf'])[v_item_index + 1],
        'uncommon', (array['charm', 'tool', 'cloak'])[v_item_index + 1],
        (array['focus', 'knowledge', 'resilience'])[v_item_index + 1], 2)
      returning * into v_item;
  else
    v_item_index := floor(random() * 3)::integer;
    insert into public.focus_rpg_inventory (user_id, claim_id, item_key, item_name, rarity, slot, stat, stat_bonus)
      values (v_user_id, v_claim.id,
        (array['tea-token', 'study-pencil', 'calm-thread'])[v_item_index + 1],
        (array['Tea Token', 'Study Pencil', 'Calm Thread'])[v_item_index + 1],
        'common', null, (array['focus', 'knowledge', 'resilience'])[v_item_index + 1], 1)
      returning * into v_item;
  end if;

  insert into public.focus_rpg_encounters (user_id, claim_id, enemy_name, enemy_health, player_health)
    values (v_user_id, v_claim.id, (array['Tunnel Wisp', 'Platform Phantom', 'Delay Drake'])[floor(random() * 3)::integer + 1], 10 + v_profile.level, 10 + v_profile.resilience)
    returning * into v_encounter;
  return jsonb_build_object('profile', to_jsonb(v_profile), 'claim', to_jsonb(v_claim), 'item', to_jsonb(v_item), 'encounter', to_jsonb(v_encounter), 'duplicate', false);
end;
$$;

create or replace function public.allocate_focus_rpg_stat(p_stat text) returns public.focus_rpg_profiles
language plpgsql security definer set search_path = public
as $$
declare v_profile public.focus_rpg_profiles; v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_stat not in ('focus', 'knowledge', 'resilience') then raise exception 'invalid request'; end if;
  select * into v_profile from public.focus_rpg_profiles where user_id = v_user_id for update;
  if not found or v_profile.unspent_stat_points < 1 then raise exception 'no stat points available'; end if;
  update public.focus_rpg_profiles set
    focus = focus + case when p_stat = 'focus' then 1 else 0 end,
    knowledge = knowledge + case when p_stat = 'knowledge' then 1 else 0 end,
    resilience = resilience + case when p_stat = 'resilience' then 1 else 0 end,
    unspent_stat_points = unspent_stat_points - 1, updated_at = now()
  where user_id = v_user_id returning * into v_profile;
  return v_profile;
end;
$$;

create or replace function public.resolve_focus_rpg_encounter(p_encounter_id uuid, p_action text) returns public.focus_rpg_encounters
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid := auth.uid(); v_profile public.focus_rpg_profiles; v_encounter public.focus_rpg_encounters;
  v_bonus integer := 0; v_player_damage integer; v_enemy_damage integer;
begin
  if v_user_id is null or p_action not in ('attack', 'focus', 'guard') then raise exception 'invalid request'; end if;
  select * into v_encounter from public.focus_rpg_encounters where id = p_encounter_id and user_id = v_user_id for update;
  if not found then raise exception 'encounter not found'; end if;
  if v_encounter.status <> 'pending' then return v_encounter; end if;
  select * into v_profile from public.focus_rpg_profiles where user_id = v_user_id;
  select coalesce(sum(stat_bonus), 0) into v_bonus from public.focus_rpg_inventory where user_id = v_user_id and is_equipped;
  v_player_damage := case p_action when 'attack' then 3 + v_profile.focus + v_bonus when 'focus' then 2 + v_profile.knowledge + v_bonus else 1 end;
  v_enemy_damage := greatest(0, 2 + floor(random() * 3)::integer - case when p_action = 'guard' then v_profile.resilience else 0 end);
  v_encounter.enemy_health := greatest(0, v_encounter.enemy_health - v_player_damage);
  v_encounter.player_health := greatest(0, v_encounter.player_health - v_enemy_damage);
  v_encounter.turns := v_encounter.turns + 1;
  if v_encounter.enemy_health = 0 then v_encounter.status := 'won';
  elsif v_encounter.player_health = 0 or v_encounter.turns >= 3 then v_encounter.status := case when v_encounter.player_health >= v_encounter.enemy_health then 'won' else 'lost' end;
  end if;
  update public.focus_rpg_encounters set enemy_health = v_encounter.enemy_health, player_health = v_encounter.player_health,
    turns = v_encounter.turns, status = v_encounter.status, resolved_at = case when v_encounter.status = 'pending' then null else now() end
    where id = v_encounter.id returning * into v_encounter;
  return v_encounter;
end;
$$;

revoke all on function public.claim_focus_rpg_reward(uuid, text, smallint) from public;
revoke all on function public.allocate_focus_rpg_stat(text) from public;
revoke all on function public.resolve_focus_rpg_encounter(uuid, text) from public;
grant execute on function public.claim_focus_rpg_reward(uuid, text, smallint) to authenticated;
grant execute on function public.allocate_focus_rpg_stat(text) to authenticated;
grant execute on function public.resolve_focus_rpg_encounter(uuid, text) to authenticated;
