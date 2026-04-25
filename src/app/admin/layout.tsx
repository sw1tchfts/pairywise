'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@/lib/cloud/api';

type GateState = 'loading' | 'allowed' | 'denied';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await api.isCurrentUserAdmin();
      if (cancelled) return;
      setState(ok ? 'allowed' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-sm text-foreground/60 text-center">
        Checking access…
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="text-sm text-foreground/60 mt-2">
          This area is for platform admins only.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 text-sm text-foreground/60 hover:text-foreground"
        >
          ← Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="text-sm mb-4 flex items-center gap-3">
        <Link href="/" className="text-foreground/60 hover:text-foreground">
          ← All lists
        </Link>
        <span className="text-foreground/30">/</span>
        <Link href="/admin/users" className="text-foreground/60 hover:text-foreground">
          Admin
        </Link>
      </div>
      {children}
    </div>
  );
}
