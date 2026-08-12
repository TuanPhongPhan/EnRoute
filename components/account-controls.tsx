'use client';
import { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
export function AccountControls() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const client = createClient();
    void client.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  const signIn = async () => {
    const client = createClient();
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };
  const signOut = async () => {
    const client = createClient();
    await client.auth.signOut();
    setEmail(null);
  };
  return (
    <section className="rounded-3xl border border-teal-950/10 bg-surface p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight text-ink">Account</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        {email ? `Signed in as ${email}` : 'Sign in to securely save Calendar access and enable future notifications.'}
      </p>
      {email ? (
        <button
          className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep hover:bg-teal-50"
          onClick={() => {
            void signOut();
          }}
          type="button"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      ) : (
        <button
          className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-deep"
          onClick={() => {
            void signIn();
          }}
          type="button"
        >
          <LogIn className="size-4" />
          Sign in with Google
        </button>
      )}
    </section>
  );
}
