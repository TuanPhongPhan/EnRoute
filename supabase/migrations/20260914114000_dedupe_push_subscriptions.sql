-- Browser push endpoints change after a VAPID-key rotation. Associate endpoints with
-- a local app installation so a replacement cannot leave stale endpoints delivering
-- the same notification to one device.
alter table public.push_subscriptions
  add column if not exists device_id text;

create index if not exists push_subscriptions_user_device_idx
  on public.push_subscriptions (user_id, device_id)
  where device_id is not null;
