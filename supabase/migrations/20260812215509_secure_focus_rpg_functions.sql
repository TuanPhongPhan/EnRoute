-- PostgreSQL grants routine execution to PUBLIC by default. Explicitly revoke it from
-- anonymous users; authenticated calls remain ownership-checked with auth.uid() inside
-- each routine and are only made through EnRoute's server route.
revoke execute on function public.claim_focus_rpg_reward(uuid, text, smallint) from anon;
revoke execute on function public.allocate_focus_rpg_stat(text) from anon;
revoke execute on function public.resolve_focus_rpg_encounter(uuid, text) from anon;
