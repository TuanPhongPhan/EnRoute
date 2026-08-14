import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Footprints,
  GraduationCap,
  MapPin,
  TrainFront,
  TramFront,
} from 'lucide-react';
import Link from 'next/link';
import type { CommuteLegView, TodayCommute } from '@/lib/commute-view';

const legIcons = {
  walk: Footprints,
  subway: TramFront,
  ice: TrainFront,
  bus: TramFront,
  tram: TramFront,
  regional_train: TrainFront,
  other: TrainFront,
};
const statusStyles = {
  'On time': 'bg-success-soft text-success ring-1 ring-success/20',
  'Minor delay': 'bg-warning-soft text-warning ring-1 ring-warning/20',
  'Tight connection': 'bg-warning-soft text-warning ring-1 ring-warning/20',
  'Connection at risk': 'bg-danger-soft text-danger ring-1 ring-danger/20',
  'Late for class': 'bg-danger-soft text-danger ring-1 ring-danger/20',
} as const;

type TransportState = 'loading' | 'route_ready' | 'location_not_found' | 'no_route' | 'rate_limited' | 'unavailable';

export function TodayDashboard({
  calendarState,
  commute,
  onRefreshJourney,
  transportState,
}: {
  calendarState: 'loading' | 'connected' | 'disconnected' | 'no-event' | 'unavailable';
  commute: TodayCommute | null;
  onRefreshJourney?: () => void;
  transportState: TransportState;
}) {
  if (!commute) return <NoCommuteState calendarState={calendarState} />;
  return (
    <div className="space-y-5 md:space-y-7">
      <section aria-labelledby="today-heading" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
            {commute.day} · {commute.currentTime}
          </p>
          <h1 id="today-heading" className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
            {commute.greeting}
          </h1>
        </div>
        <div
          aria-label={`Journey status: ${commute.status}`}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold ${statusStyles[commute.status]}`}
        >
          <CheckCircle2 aria-hidden="true" className="size-4" />
          {commute.status}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-3xl bg-brand-deep p-6 text-white shadow-sm md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-100">Leave home</p>
              <p className="mt-3 text-6xl font-bold tracking-[-0.06em] sm:text-7xl">{commute.leaveHomeAt}</p>
            </div>
            <Clock3 aria-hidden="true" className="mt-1 size-6 text-primary-100" />
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-5">
            <p className="text-sm text-primary-50">
              <span className="font-bold text-white">{commute.departureCountdown.label}</span>
              {!commute.departureCountdown.isDue && ' until you need to leave'}
            </p>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-deep transition-colors duration-200 hover:bg-primary-50"
              href="#journey"
            >
              <span>Start commute</span>
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>

        <article className="rounded-3xl border border-border bg-surface p-6 shadow-sm md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Next class</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">{commute.nextClass.name}</h2>
            </div>
            <GraduationCap aria-hidden="true" className="size-6 text-brand" />
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarDays aria-hidden="true" className="size-4 text-muted" />
            {commute.nextClass.startsAt}–{commute.nextClass.endsAt}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted" />
            {commute.nextClass.location}
          </p>
          <CalendarNote state={calendarState} />
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_19rem] xl:grid-cols-[1fr_22rem]">
        <JourneyTimeline commute={commute} onRefresh={onRefreshJourney} transportState={transportState} />
        <ArrivalSummary commute={commute} />
      </section>
    </div>
  );
}

function CalendarNote({ state }: { state: 'loading' | 'connected' | 'disconnected' | 'no-event' | 'unavailable' }) {
  const messages = {
    loading: 'Checking your calendar…',
    connected: 'From your Google Calendar',
    disconnected: 'Google Calendar needs connecting in Settings',
    'no-event': 'No upcoming HNU class found',
    unavailable: 'Calendar unavailable',
  };
  return (
    <p aria-live="polite" className="mt-4 text-xs font-semibold text-muted">
      {messages[state]}
    </p>
  );
}

function JourneyTimeline({
  commute,
  onRefresh,
  transportState,
}: {
  commute: TodayCommute;
  onRefresh?: () => void;
  transportState: TransportState;
}) {
  return (
    <article id="journey" className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Your journey</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">Home to HNU</h2>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep transition-colors duration-200 hover:bg-primary-50"
          href="/journey"
        >
          <span>View details</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <TransportNote commute={commute} onRefresh={onRefresh} state={transportState} />
      <ol className="mt-7 divide-y divide-teal-950/10">
        {commute.legs.map((leg, index) => (
          <JourneyLeg key={leg.id} leg={leg} isLast={index === commute.legs.length - 1} />
        ))}
      </ol>
      <div className="mt-5 flex items-center justify-between rounded-2xl bg-primary-50 px-4 py-3">
        <span className="text-sm font-semibold text-brand-deep">Arrive at HNU</span>
        <time className="text-xl font-bold tracking-tight text-ink">{commute.arrivalAt}</time>
      </div>
    </article>
  );
}

function TransportNote({
  commute,
  onRefresh,
  state,
}: {
  commute: TodayCommute;
  onRefresh?: () => void;
  state: TransportState;
}) {
  if (state === 'route_ready')
    return (
      <p className="mt-4 text-xs font-semibold text-brand-deep">
        {commute.liveDataAvailable ? 'Live data' : 'Scheduled data'} · updated{' '}
        {new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
          new Date(commute.updatedAt),
        )}
      </p>
    );
  if (state === 'loading')
    return (
      <p aria-live="polite" className="mt-4 text-xs font-semibold text-muted">
        Finding the best current journey…
      </p>
    );
  const messages = {
    location_not_found: 'One of your saved addresses could not be found. Update it in Settings.',
    no_route: 'No regional-transport route reaches HNU within your preferred arrival buffer.',
    rate_limited: 'Live data is rate-limited. Showing your last calculated journey.',
    unavailable: 'Live data is unavailable. Showing your last calculated journey.',
  };
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-text-secondary ring-1 ring-warning/20"
      role="alert"
    >
      <span>{messages[state]}</span>
      {onRefresh && (
        <button
          className="min-h-9 cursor-pointer rounded-lg bg-white px-3 py-1.5 text-brand-deep transition-colors duration-200 hover:bg-primary-50"
          onClick={onRefresh}
          type="button"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function JourneyLeg({ leg, isLast }: { leg: CommuteLegView; isLast: boolean }) {
  const Icon = legIcons[leg.mode];
  return (
    <li className="grid grid-cols-[3.75rem_2.25rem_1fr] gap-x-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[4.5rem_2.5rem_1fr_auto] sm:items-center">
      <div>
        <time className="block font-bold tracking-tight text-ink">{leg.departure}</time>
        <span className="mt-0.5 block text-xs text-muted">{leg.duration}</span>
      </div>
      <div className="relative flex h-full justify-center">
        <span className="grid size-9 place-items-center rounded-full bg-primary-100 text-brand-deep">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        {!isLast && <span aria-hidden="true" className="absolute bottom-[-1rem] top-9 w-px bg-border" />}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-ink">{leg.label}</p>
        <p className="mt-0.5 text-sm leading-5 text-muted">{leg.detail}</p>
        {leg.delayMinutes > 0 && (
          <p className="mt-1 text-xs font-semibold text-warning">+{leg.delayMinutes} min delay</p>
        )}
        {leg.platform && <p className="mt-1 text-xs font-semibold text-brand-deep">{leg.platform}</p>}
      </div>
      <time className="col-start-3 mt-1 text-sm font-semibold text-muted sm:col-start-auto sm:mt-0">{leg.arrival}</time>
    </li>
  );
}

function ArrivalSummary({ commute }: { commute: TodayCommute }) {
  return (
    <aside className="rounded-3xl bg-accent-50 p-6 shadow-sm ring-1 ring-accent-100 md:p-7">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-600">Arrival buffer</p>
      <p className="mt-4 text-6xl font-bold tracking-[-0.06em] text-ink">
        {commute.bufferMinutes}
        <span className="ml-1 text-2xl tracking-tight">min</span>
      </p>
      <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
        You should reach HNU at <span className="font-bold text-ink">{commute.arrivalAt}</span>, before class starts at{' '}
        {commute.nextClass.startsAt}.
      </p>
      <div className="mt-7 rounded-2xl border border-accent-100 bg-white p-4">
        <p className="text-sm font-bold text-ink">{commute.status}</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Calculated from your class start and preferred arrival buffer.
        </p>
      </div>
    </aside>
  );
}

function NoCommuteState({
  calendarState,
}: {
  calendarState: 'loading' | 'connected' | 'disconnected' | 'no-event' | 'unavailable';
}) {
  const message =
    calendarState === 'loading'
      ? 'Checking your calendar…'
      : calendarState === 'no-event'
        ? 'No HNU classes are scheduled next.'
        : calendarState === 'disconnected'
          ? 'Connect Google Calendar in Settings to calculate your next commute.'
          : 'We could not calculate a commute yet. Check your calendar connection and saved addresses.';
  return (
    <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm md:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Today</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">No commute to calculate.</h1>
      <p aria-live="polite" className="mt-3 max-w-xl text-base leading-7 text-muted">
        {message}
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
        href="/settings"
      >
        Open Settings
      </Link>
    </section>
  );
}
