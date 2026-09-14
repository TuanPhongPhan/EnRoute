import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Commute = { id: string; user_id: string; departure_at: string; arrival_at: string; status: string };
type Preferences = {
  leave_reminders: boolean;
  transfer_alerts: boolean;
  disruption_alerts: boolean;
  platform_alerts: boolean;
  alternative_alerts: boolean;
};
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
type TransferAlert = {
  id: string;
  user_id: string;
  arrives_at: string;
  station: string;
  next_service_label: string;
  next_service_destination: string;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

Deno.serve(async (request) => {
  // Cron calls bypass user JWTs, so a dedicated secret is required before privileged monitor work begins.
  if (request.headers.get('x-enroute-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'unauthorized' }, 401);
  // Supabase provisions this server-only credential for Edge Functions. Do not use the
  // internal key collection here: its format is not a stable public contract.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) return json({ error: 'push_configuration_missing' }, 503);
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch {
    // Do not surface key material or runtime stack traces to a scheduled caller.
    return json({ error: 'push_configuration_invalid' }, 503);
  }
  const now = new Date();
  // Include recently departed records so they can be completed, but inspect only the next day on each cron run.
  const lower = new Date(now.getTime() - 30 * 60_000).toISOString();
  const upper = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const { data: commutes, error } = await db.from('monitored_commutes').select('id,user_id,departure_at,arrival_at,status').eq('status', 'active').gte('departure_at', lower).lte('departure_at', upper);
  if (error) return json({ error: 'load_failed' }, 500);
  let delivered = 0;
  for (const commute of (commutes ?? []) as Commute[]) {
    const departure = new Date(commute.departure_at);
    const arrival = new Date(commute.arrival_at);
    if (arrival <= now) {
      await db.from('monitored_commutes').update({ status: 'completed', last_evaluated_at: now.toISOString() }).eq('id', commute.id);
      continue;
    }
    // Transfer alerts remain active after departure. Only the pre-departure leave reminder stops here.
    if (departure <= now) continue;
    const minutesUntil = Math.round((departure.getTime() - now.getTime()) / 60_000);
    // A five-minute scheduler needs a window around the intended 20-minute reminder, not an exact timestamp.
    if (minutesUntil < 16 || minutesUntil > 24) continue;
    const [{ data: preferences }, { data: subscriptions }] = await Promise.all([
      db.from('notification_preferences').select('leave_reminders,disruption_alerts,platform_alerts,alternative_alerts').eq('user_id', commute.user_id).maybeSingle(),
      db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', commute.user_id),
    ]);
    if (!(preferences as Preferences | null)?.leave_reminders || !subscriptions?.length) continue;
    // The unique fingerprint protects users from duplicate push sends if cron retries or multiple devices are registered.
    const fingerprint = `leave:${commute.id}:${departure.toISOString()}`;
    const { data: alreadySent } = await db.from('notification_deliveries').select('id').eq('user_id', commute.user_id).eq('fingerprint', fingerprint).maybeSingle();
    if (alreadySent) continue;
    const payload = JSON.stringify({ title: 'Leave in about 20 minutes', body: `Your next HNU commute leaves at ${departure.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}.`, url: '/journey', tag: fingerprint });
    let sent = false;
    for (const subscription of subscriptions as Subscription[]) {
      try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 3600 }); sent = true; }
      // 404/410 means the browser discarded the subscription; remove only that endpoint and keep the user's preferences.
      catch (pushError) { if (pushError instanceof Error && /404|410/.test(pushError.message)) await db.from('push_subscriptions').delete().eq('id', subscription.id); }
    }
    if (sent) { await db.from('notification_deliveries').insert({ user_id: commute.user_id, monitored_commute_id: commute.id, kind: 'leave', fingerprint }); delivered++; }
  }
  delivered += await deliverTransferAlerts(db, now);
  return json({ ok: true, delivered });
});

async function deliverTransferAlerts(db: ReturnType<typeof createClient>, now: Date) {
  const { data: alerts, error } = await db
    .from('commute_transfer_alerts')
    .select('id,user_id,arrives_at,station,next_service_label,next_service_destination')
    .eq('status', 'scheduled')
    .lte('alert_at', now.toISOString())
    .gt('arrives_at', new Date(now.getTime() + 60_000).toISOString())
    .order('alert_at', { ascending: true })
    .limit(50);
  if (error) return 0;
  let delivered = 0;
  for (const alert of (alerts ?? []) as TransferAlert[]) {
    const [{ data: preferences }, { data: subscriptions }] = await Promise.all([
      db
        .from('notification_preferences')
        .select('leave_reminders,transfer_alerts,disruption_alerts,platform_alerts,alternative_alerts')
        .eq('user_id', alert.user_id)
        .maybeSingle(),
      db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', alert.user_id),
    ]);
    if (!(preferences as Preferences | null)?.transfer_alerts || !subscriptions?.length) continue;

    // The conditional update makes concurrent scheduler executions harmless.
    const { data: claimed } = await db
      .from('commute_transfer_alerts')
      .update({ status: 'sending', claimed_at: now.toISOString() })
      .eq('id', alert.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const minutes = Math.max(1, Math.ceil((Date.parse(alert.arrives_at) - now.getTime()) / 60_000));
    const payload = JSON.stringify({
      title: `Arriving at ${alert.station} in ${minutes} min`,
      body: `Change to ${alert.next_service_label} toward ${alert.next_service_destination}.`,
      url: '/journey',
      tag: `transfer:${alert.id}`,
    });
    let sent = false;
    for (const subscription of subscriptions as Subscription[]) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          { TTL: Math.max(60, Math.ceil((Date.parse(alert.arrives_at) - now.getTime()) / 1000)) },
        );
        sent = true;
      } catch (pushError) {
        if (pushError instanceof Error && /404|410/.test(pushError.message))
          await db.from('push_subscriptions').delete().eq('id', subscription.id);
      }
    }
    if (!sent) {
      await db.from('commute_transfer_alerts').update({ status: 'scheduled', claimed_at: null }).eq('id', alert.id);
      continue;
    }
    const fingerprint = `transfer:${alert.id}`;
    await db.from('notification_deliveries').upsert(
      { user_id: alert.user_id, commute_transfer_alert_id: alert.id, kind: 'transfer', fingerprint },
      { onConflict: 'user_id,fingerprint', ignoreDuplicates: true },
    );
    await db
      .from('commute_transfer_alerts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', alert.id)
      .eq('status', 'sending');
    delivered += 1;
  }
  return delivered;
}
