'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getBrowserClient } from '@/lib/supabase/browser';

const PUBLIC_PATHS = ['/signin', '/signup'];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

type Props = {
  children: React.ReactNode;
  /** User id resolved on the server, used to skip the SSR/client signed-in
   *  flash. Null means signed out (or the server lookup failed). */
  initialUserId: string | null;
};

export function CloudHydrator({ children, initialUserId }: Props) {
  const hydrate = useStore((s) => s.hydrate);
  const reset = useStore((s) => s.reset);
  const hydrated = useStore((s) => s.hydrated);
  const hydrateError = useStore((s) => s.hydrateError);
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState<boolean | null>(() =>
    initialUserId ? true : null,
  );

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const hasUser = Boolean(data.user);
      setSignedIn(hasUser);
      if (hasUser) hydrate();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setSignedIn(true);
        if (session) hydrate();
      } else if (event === 'SIGNED_OUT') {
        setSignedIn(false);
        reset();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrate, reset]);

  if (isPublicPath(pathname)) return <>{children}</>;

  if (signedIn === null) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-foreground/50">
        Loading…
      </div>
    );
  }

  if (!signedIn) return null;

  if (hydrateError) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10 text-center">
        <p className="text-sm text-red-600">Couldn’t load your lists.</p>
        <p className="text-xs text-foreground/50 mt-1">{hydrateError}</p>
        <button
          type="button"
          className="mt-4 rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5"
          onClick={() => hydrate()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-foreground/50">
        Loading your lists…
      </div>
    );
  }

  return <>{children}</>;
}
