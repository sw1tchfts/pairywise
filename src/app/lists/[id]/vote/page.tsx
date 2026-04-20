'use client';

import { use } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { VoteScreen } from '@/components/VoteScreen';
import { useListRealtime } from '@/lib/cloud/useListRealtime';

type Params = { id: string };

export default function VotePage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  useListRealtime(list?.id);

  if (!list) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-foreground/70">List not found.</p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2">
          Back home
        </Link>
      </div>
    );
  }

  if ((list.phase ?? 'voting') === 'submission') {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Voting hasn&apos;t started yet</h1>
        <p className="mt-2 text-sm text-foreground/60">
          The list is still in submission phase. Ideas are hidden until the
          owner opens voting.
        </p>
        <Link
          href={`/lists/${list.id}`}
          className="mt-5 inline-block rounded-md bg-foreground text-background px-4 py-2 text-sm"
        >
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 text-sm">
        <Link
          href={`/lists/${list.id}`}
          className="text-foreground/60 hover:text-foreground truncate block"
        >
          ← {list.title}
        </Link>
      </div>
      <VoteScreen list={list} />
    </>
  );
}
