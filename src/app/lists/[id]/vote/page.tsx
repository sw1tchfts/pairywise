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
