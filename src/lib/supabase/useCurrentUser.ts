'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from './browser';

export function useCurrentUserId(): string | null | undefined {
  // undefined = still loading; null = signed out; string = signed in
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setUserId(data.user?.id ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return userId;
}
