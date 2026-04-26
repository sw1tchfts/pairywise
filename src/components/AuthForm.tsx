'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient, isCloudEnabled } from '@/lib/supabase/browser';
import { useToast } from './Toaster';
import { errorMessage } from '@/lib/utils';

type Mode = 'signin' | 'signup';

function safeNext(next: string | null): string {
  // Only allow same-origin relative paths, to avoid open-redirect.
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error'),
  );
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = getBrowserClient();
    try {
      if (mode === 'signup') {
        const emailRedirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
            : undefined;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        // If the project has email confirmation disabled, signUp returns a
        // session and the user is signed in immediately.
        if (data.session) {
          toast.push('Welcome to pairywise', { kind: 'success' });
          router.push(next);
          router.refresh();
        } else {
          setNeedsConfirm(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.push('Welcome back', { kind: 'success' });
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err, 'Authentication failed.'));
    } finally {
      setPending(false);
    }
  }

  if (!isCloudEnabled()) {
    return (
      <div className="mx-auto max-w-sm px-4 sm:px-6 py-10 sm:py-14 text-center">
        <h1 className="text-2xl font-semibold mb-2">Auth not configured</h1>
        <p className="text-sm text-foreground/60">
          The cloud backend is not connected on this deployment yet.
        </p>
      </div>
    );
  }

  if (needsConfirm) {
    return (
      <div className="mx-auto max-w-sm px-4 sm:px-6 py-10 sm:py-14 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
          Check your email
        </h1>
        <p className="text-sm text-foreground/70 mt-2">
          We sent a confirmation link to <b>{email}</b>. Click it to finish
          signing up — you&apos;ll land back here and your account will be
          ready to go.
        </p>
      </div>
    );
  }

  const linkHref = (target: 'signin' | 'signup') =>
    next === '/' ? `/${target}` : `/${target}?next=${encodeURIComponent(next)}`;

  return (
    <div className="mx-auto max-w-sm px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
        {mode === 'signup' ? 'Create your account' : 'Sign in'}
      </h1>
      <p className="text-sm text-foreground/60 mb-6">
        {next.startsWith('/shared/')
          ? 'Sign in to join the shared list — your invite is saved.'
          : mode === 'signup'
            ? 'Save lists across devices and share them with others.'
            : 'Welcome back to pairywise.'}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1.5"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1.5"
          />
          {mode === 'signup' && (
            <span className="block text-xs text-foreground/60 mt-1">
              Minimum 8 characters.
            </span>
          )}
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || !email || !password}
          className="w-full px-4 py-2.5 rounded-md bg-foreground text-background font-medium disabled:opacity-50"
        >
          {pending ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      <p className="text-sm text-foreground/60 mt-6 text-center">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href={linkHref('signin')} className="font-medium hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href={linkHref('signup')} className="font-medium hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
