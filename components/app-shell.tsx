'use client';

import { CalendarDays, Compass, Map, Settings, Timer, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Today', icon: Compass },
  { href: '/week', label: 'Week', icon: CalendarDays },
  { href: '/journey', label: 'Journey', icon: Map },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-canvas md:grid md:grid-cols-[15.5rem_1fr]">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3"
        href="#main-content"
      >
        Skip to content
      </a>
      <aside className="hidden border-r border-teal-950/10 bg-white/80 px-5 py-7 md:flex md:flex-col">
        <Brand />
        <Navigation pathname={pathname} orientation="sidebar" />
        <p className="mt-auto text-xs leading-5 text-muted">Commute intelligence, at a calm pace.</p>
      </aside>
      <div className="min-w-0 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-9 md:pt-8">
          <Brand compact />
          <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-brand-deep">
            Commute planner
          </span>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl px-5 pb-10 md:px-9 md:pb-12">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-xs leading-5 text-muted md:px-9">
          <p>
            Routing data:{' '}
            <a
              className="rounded underline decoration-teal-700/40 underline-offset-2 transition-colors duration-200 hover:text-brand-deep focus:outline-none focus:ring-2 focus:ring-brand"
              href="https://transitous.org/sources/"
              rel="noreferrer"
              target="_blank"
            >
              Transitous
            </a>{' '}
            · Map data ©{' '}
            <a
              className="rounded underline decoration-teal-700/40 underline-offset-2 transition-colors duration-200 hover:text-brand-deep focus:outline-none focus:ring-2 focus:ring-brand"
              href="https://www.openstreetmap.org/copyright"
              rel="noreferrer"
              target="_blank"
            >
              OpenStreetMap contributors
            </a>
          </p>
        </footer>
      </div>
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-teal-950/10 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {navigation.map((item) => (
            <NavItem item={item} key={item.href} active={pathname === item.href} orientation="bottom" />
          ))}
        </div>
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link aria-label="EnRoute home" className="inline-flex items-center gap-2 text-brand-deep" href="/">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-xl bg-brand text-sm font-bold text-white"
      >
        E
      </span>
      {!compact && <span className="text-lg font-bold tracking-tight">EnRoute</span>}
    </Link>
  );
}

function Navigation({ pathname, orientation }: { pathname: string; orientation: 'sidebar' }) {
  return (
    <nav aria-label="Primary navigation" className="mt-10 space-y-1">
      {navigation.map((item) => (
        <NavItem item={item} key={item.href} active={pathname === item.href} orientation={orientation} />
      ))}
    </nav>
  );
}

function NavItem({
  item,
  active,
  orientation,
}: {
  item: (typeof navigation)[number];
  active: boolean;
  orientation: 'sidebar' | 'bottom';
}) {
  const Icon = item.icon;
  const shared = `group inline-flex items-center gap-3 rounded-xl font-semibold transition-colors duration-200 ${active ? 'bg-teal-100 text-brand-deep' : 'text-muted hover:bg-teal-50 hover:text-brand-deep'}`;
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={
        orientation === 'sidebar'
          ? `${shared} w-full px-3 py-3`
          : `${shared} flex-1 flex-col gap-1 px-1 py-2 text-[10px]`
      }
      href={item.href}
    >
      <Icon
        aria-hidden="true"
        className={orientation === 'sidebar' ? 'size-5' : 'size-5'}
        strokeWidth={active ? 2.5 : 2}
      />
      <span>{item.label}</span>
    </Link>
  );
}
