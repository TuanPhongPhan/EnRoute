import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

const stats = ['focus', 'knowledge', 'resilience'] as const;
const actions = ['attack', 'focus', 'guard'] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const [{ data: profile }, { data: inventory }, { data: encounter }] = await Promise.all([
    supabase.from('focus_rpg_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('focus_rpg_inventory').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase
      .from('focus_rpg_encounters')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return NextResponse.json({ profile, inventory: inventory ?? [], encounter });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === 'claim') {
    if (
      typeof body.sessionId !== 'string' ||
      typeof body.activity !== 'string' ||
      typeof body.minutes !== 'number' ||
      !Number.isInteger(body.minutes)
    ) {
      return NextResponse.json({ error: 'invalid_reward' }, { status: 400 });
    }
    const { data, error } = await supabase.rpc('claim_focus_rpg_reward', {
      p_client_session_id: body.sessionId,
      p_activity: body.activity,
      p_completed_minutes: body.minutes,
    });
    if (error) return NextResponse.json({ error: 'claim_failed' }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === 'allocate') {
    if (!stats.includes(body.stat as (typeof stats)[number]))
      return NextResponse.json({ error: 'invalid_stat' }, { status: 400 });
    const { data, error } = await supabase.rpc('allocate_focus_rpg_stat', { p_stat: body.stat });
    if (error) return NextResponse.json({ error: 'allocation_failed' }, { status: 400 });
    return NextResponse.json({ profile: data });
  }

  if (body.action === 'combat') {
    if (typeof body.encounterId !== 'string' || !actions.includes(body.combatAction as (typeof actions)[number]))
      return NextResponse.json({ error: 'invalid_combat_action' }, { status: 400 });
    const { data, error } = await supabase.rpc('resolve_focus_rpg_encounter', {
      p_encounter_id: body.encounterId,
      p_action: body.combatAction,
    });
    if (error) return NextResponse.json({ error: 'combat_failed' }, { status: 400 });
    return NextResponse.json({ encounter: data });
  }

  if (body.action === 'equip') {
    if (typeof body.itemId !== 'string') return NextResponse.json({ error: 'invalid_item' }, { status: 400 });
    const { data, error } = await supabase.rpc('set_focus_rpg_equipment', { p_item_id: body.itemId });
    if (error) return NextResponse.json({ error: 'equip_failed' }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
