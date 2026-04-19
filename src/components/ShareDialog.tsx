'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from './Toaster';
import type { Visibility } from '@/lib/types';

const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: 'Private · only you',
  unlisted: 'Unlisted · anyone with the link',
  public: 'Public · visible to anyone signed in',
};

export function ShareDialog({
  listId,
  open,
  onClose,
}: {
  listId: string;
  open: boolean;
  onClose: () => void;
}) {
  const list = useStore((s) => s.lists[listId]);
  const updateList = useStore((s) => s.updateList);
  const toast = useToast();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/shared/${listId}`;
  }, [listId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !list) return null;

  const visibility: Visibility = list.visibility ?? 'private';

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      toast.push('Copy failed. Select the URL and copy manually.', {
        kind: 'error',
      });
    }
  }

  function changeVisibility(v: Visibility) {
    updateList(listId, { visibility: v });
    toast.push(`Visibility set to ${v}`, { kind: 'success' });
  }

  const shareable = visibility !== 'private';

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-background border border-foreground/10 shadow-xl p-5">
        <div className="flex items-start justify-between mb-1">
          <h2 id="share-title" className="text-lg font-semibold">
            Share list
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-foreground/60 mb-4">
          Send the link below to invite others. If they don&apos;t have a
          pairywise account yet, they&apos;ll be prompted to sign up — the list
          will show up in their dashboard automatically.
        </p>
        <label className="block mb-4">
          <span className="text-sm font-medium">Visibility</span>
          <select
            value={visibility}
            onChange={(e) => changeVisibility(e.target.value as Visibility)}
            className="input mt-1.5"
          >
            {(['private', 'unlisted', 'public'] as Visibility[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABEL[v]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Invite link</span>
          <div className="mt-1.5 flex gap-2">
            <input
              readOnly
              value={shareable ? shareUrl : 'Make the list unlisted or public to share'}
              className="input flex-1 text-xs"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={copy}
              disabled={!shareable}
              className="px-3 py-2 text-sm rounded-md bg-foreground text-background font-medium disabled:opacity-40"
            >
              {copyState === 'copied' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </label>
      </div>
    </div>
  );
}
