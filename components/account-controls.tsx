'use client';

import { LogIn, LogOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clientCache } from '@/lib/client-cache';
import { createClient } from '@/lib/supabase/client';

type AccountState =
  | { status: 'loading' }
  | { status: 'authenticated'; email: string }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };
type ResolvedAccountState = Extract<AccountState, { status: 'authenticated' | 'unauthenticated' }>;

const accountCacheKey = 'account-display';

export function AccountControls() {
  const [account, setAccount] = useState<AccountState>(
    () => clientCache.read<ResolvedAccountState>(accountCacheKey)?.value ?? { status: 'loading' },
  );
  const verificationVersion = useRef(0);

  const setResolvedAccount = useCallback((nextAccount: ResolvedAccountState) => {
    clientCache.set(accountCacheKey, nextAccount);
    setAccount(nextAccount);
  }, []);

  const verifyAccount = useCallback(async () => {
    const version = ++verificationVersion.current;
    const client = createClient();
    const { data, error } = await client.auth.getUser();
    if (version !== verificationVersion.current) return;
    if (error) {
      clientCache.invalidate(accountCacheKey);
      setAccount({ status: 'unavailable' });
      return;
    }
    setResolvedAccount(accountFromUser(data.user));
  }, [setResolvedAccount]);

  useEffect(() => {
    const client = createClient();
    let active = true;

    // getSession reads the browser's local session. It makes the account card feel instant,
    // while getUser below still verifies the session with Supabase before it is trusted elsewhere.
    void client.auth.getSession().then(({ data }) => {
      if (active && data.session?.user) setResolvedAccount(accountFromUser(data.session.user));
    });
    const verificationTimer = window.setTimeout(() => {
      void verifyAccount();
    }, 0);

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active || (event === 'INITIAL_SESSION' && !session?.user)) return;
      setResolvedAccount(accountFromUser(session?.user ?? null));
    });

    return () => {
      active = false;
      verificationVersion.current += 1;
      window.clearTimeout(verificationTimer);
      subscription.unsubscribe();
    };
  }, [setResolvedAccount, verifyAccount]);

  const signIn = async () => {
    const client = createClient();
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const signOut = async () => {
    verificationVersion.current += 1;
    const client = createClient();
    await client.auth.signOut();
    clientCache.invalidate(accountCacheKey);
    clientCache.invalidate('focus-summary');
    setAccount({ status: 'unauthenticated' });
  };

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold tracking-tight text-ink">Account</h2>
      {account.status === 'loading' ? (
        <>
          <p aria-live="polite" className="mt-1 text-sm leading-6 text-muted">
            Checking your sign-in status…
          </p>
          <div aria-hidden="true" className="mt-5 h-11 w-28 animate-pulse rounded-xl bg-primary-100" />
        </>
      ) : account.status === 'authenticated' ? (
        <>
          <p className="mt-1 text-sm leading-6 text-muted">Signed in as {account.email}</p>
          <button
            className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-deep hover:bg-primary-50"
            onClick={() => {
              void signOut();
            }}
            type="button"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </>
      ) : account.status === 'unavailable' ? (
        <>
          <p role="alert" className="mt-1 text-sm leading-6 text-muted">
            We couldn&apos;t confirm your sign-in status. Sign in again to continue.
          </p>
          <button
            className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
            onClick={() => {
              void signIn();
            }}
            type="button"
          >
            <LogIn className="size-4" />
            Sign in with Google
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm leading-6 text-muted">
            Sign in to securely save Calendar access and enable future notifications.
          </p>
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
        </>
      )}
    </section>
  );
}

function accountFromUser(user: { email?: string | null } | null): ResolvedAccountState {
  return user ? { status: 'authenticated', email: user.email ?? 'your Google account' } : { status: 'unauthenticated' };
}
