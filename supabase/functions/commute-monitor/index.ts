import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Commute = { id: string; user_id: string; departure_at: string; arrival_at: string; status: string };
type Preferences = { leave_reminders: boolean; disruption_alerts: boolean; platform_alerts: boolean; alternative_alerts: boolean };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

const json = (body: unknown, status = 200) => Response.json(body, { status });

Deno.serve(async (request) => {
  if (request.headers.get('x-enroute-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'unauthorized' }, 401);
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys.default, { auth: { persistSession: false } });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const now = new Date();
  const lower = new Date(now.getTime() - 30 * 60_000).toISOString();
  const upper = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const { data: commutes, error } = await db.from('monitored_commutes').select('id,user_id,departure_at,arrival_at,status').eq('status', 'active').gte('departure_at', lower).lte('departure_at', upper);
  if (error) return json({ error: 'load_failed' }, 500);
  let delivered = 0;
  for (const commute of (commutes ?? []) as Commute[]) {
    const departure = new Date(commute.departure_at);
    if (departure <= now) { await db.from('monitored_commutes').update({ status: 'completed', last_evaluated_at: now.toISOString() }).eq('id', commute.id); continue; }
    const minutesUntil = Math.round((departure.getTime() - now.getTime()) / 60_000);
    if (minutesUntil < 16 || minutesUntil > 24) continue;
    const [{ data: preferences }, { data: subscriptions }] = await Promise.all([
      db.from('notification_preferences').select('leave_reminders,disruption_alerts,platform_alerts,alternative_alerts').eq('user_id', commute.user_id).maybeSingle(),
      db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', commute.user_id),
    ]);
    if (!(preferences as Preferences | null)?.leave_reminders || !subscriptions?.length) continue;
    const fingerprint = `leave:${commute.id}:${departure.toISOString()}`;
    const { data: alreadySent } = await db.from('notification_deliveries').select('id').eq('user_id', commute.user_id).eq('fingerprint', fingerprint).maybeSingle();
    if (alreadySent) continue;
    const payload = JSON.stringify({ title: 'Leave in about 20 minutes', body: `Your next HNU commute leaves at ${departure.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}.`, url: '/journey', tag: fingerprint });
    let sent = false;
    for (const subscription of subscriptions as Subscription[]) {
      try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 3600 }); sent = true; }
      catch (pushError) { if (pushError instanceof Error && /404|410/.test(pushError.message)) await db.from('push_subscriptions').delete().eq('id', subscription.id); }
    }
    if (sent) { await db.from('notification_deliveries').insert({ user_id: commute.user_id, monitored_commute_id: commute.id, kind: 'leave', fingerprint }); delivered++; }
  }
  return json({ ok: true, delivered });
});
