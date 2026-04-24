'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient, isCloudEnabled } from '../supabase/browser';

// undefined = still loading; false = signed out / not admin; true = admin.
export function useIsAdmin(): boolean | undefined {
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(() =>
    isCloudEnabled() ? undefined : false,
  );

  useEffect(() => {
    if (!isCloudEnabled()) return;
    const supabase = getBrowserClient();
    let mounted = true;

    async function refresh(userId: string | null) {
      if (!userId) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin((data?.role ?? 'user') === 'admin');
    }

    (async () => {
      const { data } = await supabase.auth.getUser();
      await refresh(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      refresh(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
