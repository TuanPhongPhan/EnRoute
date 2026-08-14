import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm md:p-10">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
      <h1 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-ink md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
      <div className="mt-8 rounded-2xl border border-primary-100 bg-primary-50 p-5">
        <p className="font-semibold text-brand-deep">Coming in the mock-data milestone</p>
        <p className="mt-1 text-sm leading-6 text-muted">This route is ready for its focused, responsive experience.</p>
      </div>
      <Link
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-white transition-colors duration-200 hover:bg-primary-600 active:bg-primary-700"
        href="/"
      >
        <span>Return to Today</span>
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
