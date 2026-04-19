'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient, isCloudEnabled } from '@/lib/supabase/browser';
import { useToast } from './Toaster';

type Mode = 'signin' | 'signup';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = getBrowserClient();
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.push('Account created. Check your email to confirm.', {
          kind: 'success',
        });
        router.push('/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.push('Welcome back', { kind: 'success' });
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setPending(false);
    }
  }

  if (!isCloudEnabled()) {
    return (
      <div className="mx-auto max-w-sm px-4 sm:px-6 py-10 sm:py-14 text-center">
        <h1 className="text-2xl font-semibold mb-2">Auth not configured</h1>
        <p className="text-sm text-foreground/60">
          The cloud backend is not connected on this deployment yet. Local-only
          features still work.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
        {mode === 'signup' ? 'Create your account' : 'Sign in'}
      </h1>
      <p className="text-sm text-foreground/60 mb-6">
        {mode === 'signup'
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
            <Link href="/signin" className="font-medium hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="font-medium hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
