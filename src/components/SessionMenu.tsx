'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserClient, isCloudEnabled } from '@/lib/supabase/browser';
import * as api from '@/lib/cloud/api';
import { useToast } from './Toaster';

export function SessionMenu() {
  const router = useRouter();
  const toast = useToast();
  const cloud = isCloudEnabled();
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!cloud);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!cloud) return;
    const supabase = getBrowserClient();
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
      setHydrated(true);
      if (data.user) {
        const ok = await api.isCurrentUserAdmin();
        if (mounted) setIsAdmin(ok);
      } else {
        setIsAdmin(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setEmail(session?.user?.email ?? null);
      if (session?.user) {
        const ok = await api.isCurrentUserAdmin();
        if (mounted) setIsAdmin(ok);
      } else {
        setIsAdmin(false);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [cloud]);

  async function signOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    toast.push('Signed out');
    router.push('/');
    router.refresh();
  }

  if (!cloud) return null;

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
        <Link
          href="/profile"
          className="block px-3 py-2 rounded hover:bg-foreground/5"
        >
          Profile
        </Link>
        <Link
          href="/archived"
          className="block px-3 py-2 rounded hover:bg-foreground/5"
        >
          Archived lists
        </Link>
        {isAdmin && (
          <Link
            href="/admin/users"
            className="block px-3 py-2 rounded hover:bg-foreground/5"
          >
            Admin
          </Link>
        )}
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
