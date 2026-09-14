-- The recurring monitor is production configuration, but these extensions are required
-- for a linked project restored or recreated from this migration history.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
