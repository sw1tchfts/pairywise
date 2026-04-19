'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import type { Item } from '@/lib/types';
import { ItemEditor } from '@/components/ItemEditor';
import { ShareDialog } from '@/components/ShareDialog';
import { OverflowMenu, type OverflowAction } from '@/components/OverflowMenu';
import { useCurrentUserId } from '@/lib/supabase/useCurrentUser';
import { profileLabel, useProfiles } from '@/lib/cloud/useProfiles';
import { useToast } from '@/components/Toaster';
import { downloadJSON, exportList, slugify } from '@/lib/io';
import { PairwiseResults } from '@/components/results/PairwiseResults';

type Params = { id: string };

export default function ListDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const addItem = useStore((s) => s.addItem);
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const archiveList = useStore((s) => s.archiveList);
  const duplicateList = useStore((s) => s.duplicateList);

  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoOpen = searchParams.get('addItem') === '1';
  const autoOpenedRef = useRef(false);
  const toast = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const currentUserId = useCurrentUserId();
  const ownerIds = list?.ownerId ? [list.ownerId] : [];
  const profiles = useProfiles(ownerIds);

  useEffect(() => {
    if (shouldAutoOpen && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setEditorOpen(true);
      router.replace(`/lists/${id}`);
    }
  }, [shouldAutoOpen, id, router]);

  const editing = editingId ? list?.items.find((i) => i.id === editingId) : null;

  function openNew() {
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEdit(item: Item) {
    setEditingId(item.id);
    setEditorOpen(true);
  }

  function handleSave(payload: Omit<Item, 'id'>) {
    if (!list) return;
    if (editingId) {
      updateItem(list.id, editingId, payload);
      toast.push(`Updated "${payload.title}"`, { kind: 'success' });
    } else {
      addItem(list.id, payload);
      toast.push(`Added "${payload.title}"`, { kind: 'success' });
    }
    setEditorOpen(false);
    setEditingId(null);
  }

  function handleRemove(item: Item) {
    if (!list) return;
    const removed = item;
    removeItem(list.id, item.id);
    toast.push(`Removed "${removed.title}"`, {
      kind: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          const { id: _id, ...rest } = removed;
          void _id;
          addItem(list.id, rest);
          toast.push(`Restored "${removed.title}"`);
        },
      },
    });
  }

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

  const canVote = list.items.length >= 2;
  const ownedByMe = !list.ownerId || list.ownerId === currentUserId;
  const hasPairwise = list.comparisons.length > 0;

  const actions: OverflowAction[] = [];
  if (ownedByMe) actions.push({ label: 'Share', onClick: () => setShareOpen(true) });
  actions.push({
    label: 'Export JSON',
    onClick: () => {
      downloadJSON(`${slugify(list.title)}.pairywise.json`, exportList(list));
      toast.push(`Exported "${list.title}"`);
    },
  });
  if (ownedByMe) {
    actions.push({
      label: 'Duplicate',
      onClick: () => {
        const newId = duplicateList(list.id);
        if (newId) {
          toast.push(`Duplicated "${list.title}"`, { kind: 'success' });
          router.push(`/lists/${newId}`);
        }
      },
    });
    actions.push({
      label: 'Archive',
      danger: true,
      onClick: () => {
        archiveList(list.id);
        toast.push(`Archived "${list.title}"`, { kind: 'info' });
        router.push('/');
      },
    });
  }

  const primaryCta = canVote
    ? { label: hasPairwise ? 'Continue voting' : 'Start voting', href: `/lists/${list.id}/vote` }
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-2 text-sm">
        <Link href="/" className="text-foreground/60 hover:text-foreground">
          ← All lists
        </Link>
      </div>

      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-words">
              {list.title}
            </h1>
            {!ownedByMe && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/70 font-semibold">
                {list.ownerId
                  ? `Shared by ${profileLabel(profiles.get(list.ownerId), list.ownerId)}`
                  : 'Shared with you'}
              </span>
            )}
          </div>
          {list.description && (
            <p className="mt-1 text-foreground/70">{list.description}</p>
          )}
          <p className="mt-2 text-sm text-foreground/60">
            {list.items.length} items · {list.comparisons.length} votes
            {list.tags.length > 0 && <> · {list.tags.join(', ')}</>}
          </p>
        </div>
        <div className="shrink-0">
          <OverflowMenu actions={actions} />
        </div>
      </header>

      {primaryCta && (
        <div className="mt-5">
          <Link
            href={primaryCta.href}
            className="inline-block rounded-md bg-foreground text-background px-5 py-2.5 font-medium"
          >
            {primaryCta.label} →
          </Link>
        </div>
      )}
      {!primaryCta && list.items.length < 2 && ownedByMe && (
        <div className="mt-5">
          <button
            type="button"
            onClick={openNew}
            className="rounded-md bg-foreground text-background px-5 py-2.5 font-medium"
          >
            + Add items to start
          </button>
        </div>
      )}

      <ShareDialog
        listId={list.id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Items</h2>
          {ownedByMe && (
            <button
              type="button"
              onClick={openNew}
              className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
            >
              + Add item
            </button>
          )}
        </div>
        {list.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-foreground/20 p-8 text-center">
            <p className="text-sm text-foreground/70">
              {ownedByMe
                ? 'No items yet. Add at least two to start voting.'
                : 'This list has no items yet.'}
            </p>
            {ownedByMe && (
              <button
                type="button"
                onClick={openNew}
                className="mt-3 rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium"
              >
                + Add your first item
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-2">
            {list.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-md border border-foreground/10 p-2.5"
              >
                <ItemThumb item={item} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-xs text-foreground/60 truncate">
                    {[
                      item.imageUrl && 'image',
                      item.audioUrl && 'audio',
                      item.videoUrl && 'video',
                      item.linkUrl && 'link',
                    ]
                      .filter(Boolean)
                      .join(' · ') || item.description || 'Text only'}
                    {item.tags.length > 0 && (
                      <span className="text-foreground/50">
                        {' · '}
                        {item.tags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                {ownedByMe && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label={`Edit ${item.title}`}
                      className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      aria-label={`Remove ${item.title}`}
                      className="text-sm px-3 py-1.5 rounded-md border border-transparent text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900"
                    >
                      <span className="sm:hidden" aria-hidden>×</span>
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {list.items.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Ranking</h2>
          <p className="text-sm text-foreground/60 mt-1 mb-3">
            Built from your head-to-head votes. Tap any row to see its
            matchup record.
          </p>
          <PairwiseResults list={list} />
        </section>
      )}

      <ItemEditor
        open={editorOpen}
        initial={editing ?? undefined}
        allowAddAnother={!editingId}
        existing={list.items}
        editingId={editingId}
        onClose={() => {
          setEditorOpen(false);
          setEditingId(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}

function ItemThumb({ item }: { item: Item }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="w-10 h-10 rounded object-cover flex-shrink-0"
      />
    );
  }
  const badge = item.videoUrl
    ? 'vid'
    : item.audioUrl
      ? 'aud'
      : item.linkUrl
        ? 'url'
        : item.type.slice(0, 3);
  return (
    <div className="w-10 h-10 rounded bg-foreground/10 flex items-center justify-center text-[10px] uppercase text-foreground/60 flex-shrink-0">
      {badge}
    </div>
  );
}
