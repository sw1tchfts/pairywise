'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase/browser';

export function HeaderActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setSignedIn(Boolean(data.user));
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!signedIn) return null;

  return (
    <Link
      href="/lists/new"
      className="rounded-md bg-foreground text-background px-3 py-1.5 font-medium hover:opacity-90 whitespace-nowrap"
    >
      + New list
    </Link>
  );
}
