'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browser';
import { useToast } from './Toaster';

export function SessionMenu() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
      setHydrated(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    toast.push('Signed out');
    router.push('/');
    router.refresh();
  }

  if (!hydrated) {
    return <div className="w-16 h-7" aria-hidden />;
  }

  if (!email) {
    return (
      <Link
        href="/signin"
        className="text-sm hover:text-foreground whitespace-nowrap"
      >
        Sign in
      </Link>
    );
  }

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer text-sm hover:text-foreground inline-flex items-center gap-1">
        <span aria-hidden className="hidden sm:inline">●</span>
        <span className="truncate max-w-[120px]">{email.split('@')[0]}</span>
      </summary>
      <div className="absolute right-0 mt-2 z-30 min-w-[200px] rounded-md border border-foreground/15 bg-background shadow-lg p-1 text-sm">
        <div className="px-3 py-2 text-xs text-foreground/60 truncate">{email}</div>
        <div className="h-px bg-foreground/10" />
        <button
          type="button"
          onClick={signOut}
          className="w-full text-left px-3 py-2 rounded hover:bg-foreground/5"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
