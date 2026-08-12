create or replace function public.set_focus_rpg_equipment(p_item_id uuid) returns public.focus_rpg_inventory
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid := auth.uid(); v_item public.focus_rpg_inventory;
begin
  if v_user_id is null then raise exception 'unauthenticated'; end if;
  select * into v_item from public.focus_rpg_inventory where id = p_item_id and user_id = v_user_id for update;
  if not found or v_item.slot is null then raise exception 'item cannot be equipped'; end if;
  update public.focus_rpg_inventory set is_equipped = false where user_id = v_user_id and slot = v_item.slot;
  update public.focus_rpg_inventory set is_equipped = true where id = v_item.id returning * into v_item;
  return v_item;
end;
$$;

revoke execute on function public.set_focus_rpg_equipment(uuid) from public;
revoke execute on function public.set_focus_rpg_equipment(uuid) from anon;
grant execute on function public.set_focus_rpg_equipment(uuid) to authenticated;
