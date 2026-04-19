'use client';

import { use } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { VoteScreen } from '@/components/VoteScreen';
import { ModeSwitcher } from '@/components/ModeSwitcher';

type Params = { id: string };

export default function VotePage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);

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
      <ModeSwitcher
        listId={list.id}
        listTitle={list.title}
        current="vote"
        itemCount={list.items.length}
      />
      <VoteScreen list={list} />
    </>
  );
}
