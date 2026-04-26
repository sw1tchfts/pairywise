'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getBrowserClient } from '@/lib/supabase/browser';
import type { RankList } from '@/lib/types';

const PUBLIC_PATHS = ['/signin', '/signup'];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

type Props = {
  children: React.ReactNode;
  /** Lists pre-fetched on the server. Null means we couldn't fetch (signed
   *  out, or the server fetch errored) — in that case we fall back to the
   *  client-side hydrate. */
  initialLists: RankList[] | null;
  /** User id pre-fetched on the server. Null means signed out. */
  initialUserId: string | null;
};

export function CloudHydrator({
  children,
  initialLists,
  initialUserId,
}: Props) {
  const setHydratedFromServer = useStore((s) => s.setHydratedFromServer);
  const hydrate = useStore((s) => s.hydrate);
  const reset = useStore((s) => s.reset);
  const hydrated = useStore((s) => s.hydrated);
  const hydrateError = useStore((s) => s.hydrateError);
  const pathname = usePathname();

  // If the server resolved a user, trust that as the initial signed-in
  // state. Avoids an SSR/client mismatch flash when the page renders.
  const [signedIn, setSignedIn] = useState<boolean | null>(() => {
    if (initialUserId) return true;
    return null;
  });

  // Seed the store synchronously on first render when the server pre-fetched
  // data. Done in a ref-guarded effect-equivalent so it only fires once.
  const seeded = useRef(false);
  if (!seeded.current && initialLists && initialUserId) {
    setHydratedFromServer(initialLists, initialUserId);
    seeded.current = true;
  }

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;

    // If the server already populated the store, we don't need a second
    // round-trip on mount — just confirm auth state and listen for changes.
    const alreadyHydrated = Boolean(initialLists && initialUserId);

    if (!alreadyHydrated) {
      (async () => {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const hasUser = Boolean(data.user);
        setSignedIn(hasUser);
        if (hasUser) hydrate();
      })();
    }

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
  }, [hydrate, reset, initialLists, initialUserId, setHydratedFromServer]);

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
