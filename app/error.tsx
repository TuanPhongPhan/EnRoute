'use client';

export default function Error({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <section className="rounded-3xl border border-orange-200 bg-orange-50 p-6 text-ink"><p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-700">Something went wrong</p><h1 className="mt-3 text-2xl font-bold">EnRoute could not load this view.</h1><p className="mt-3 text-muted">Please try again. Your saved commute information will be available in a later milestone.</p><button className="mt-6 min-h-11 cursor-pointer rounded-xl bg-accent px-5 py-3 font-bold text-white hover:bg-orange-600" onClick={reset} type="button">Try again</button></section>;
}
