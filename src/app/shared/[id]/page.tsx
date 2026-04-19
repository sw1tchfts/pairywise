'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/cloud/api';
import { useStore } from '@/lib/store';

type Params = { id: string };

export default function SharedListPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrate = useStore((s) => s.hydrate);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'forbidden' }
    | { kind: 'notfound' }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await api.getCurrentUserId();
        if (!userId) {
          // Proxy should have redirected, but just in case.
          router.push(`/signin?next=/shared/${id}`);
          return;
        }
        const list = await api.fetchListById(id);
        if (cancelled) return;
        if (!list) {
          setState({ kind: 'notfound' });
          return;
        }
        const isOwner = list.ownerId === userId;
        const canJoin = isOwner || list.visibility !== 'private';
        if (!canJoin) {
          setState({ kind: 'forbidden' });
          return;
        }
        if (!isOwner) {
          await api.joinList(list.id);
        }
        // Pull the list (and any new membership) into the store before redirecting.
        await hydrate();
        if (cancelled) return;
        router.replace(`/lists/${list.id}/vote`);
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, hydrate, router]);

  if (state.kind === 'loading') {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-foreground/60">
        Joining list…
      </div>
    );
  }
  if (state.kind === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">This list is private</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Ask the owner to change visibility or invite you directly.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md bg-foreground text-background px-4 py-2 text-sm"
        >
          Home
        </Link>
      </div>
    );
  }
  if (state.kind === 'notfound') {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">List not found</h1>
        <p className="mt-2 text-sm text-foreground/60">
          The link may be wrong, or the owner deleted the list.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md bg-foreground text-background px-4 py-2 text-sm"
        >
          Home
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Couldn’t open shared list</h1>
      <p className="mt-2 text-sm text-red-600">{state.message}</p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-md bg-foreground text-background px-4 py-2 text-sm"
      >
        Home
      </Link>
    </div>
  );
}
