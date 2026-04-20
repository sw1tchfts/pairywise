'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from './Toaster';
import { TagInput } from './TagInput';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export function EditDetailsDialog({
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !list) return;
    queueMicrotask(() => {
      setTitle(list.title);
      setDescription(list.description ?? '');
      setTags(list.tags);
    });
  }, [open, list]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !list) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    updateList(listId, {
      title: t,
      description: description.trim() || undefined,
      tags,
    });
    toast.push('Details saved', { kind: 'success' });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-details-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={save}
        className="w-full max-w-md rounded-lg bg-background border border-foreground/10 shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <h2 id="edit-details-title" className="text-lg font-semibold">
            Edit list details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/50 hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="input mt-1.5"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input mt-1.5 resize-y"
          />
        </label>
        <div>
          <span className="text-sm font-medium">Tags</span>
          <div className="mt-1.5">
            <TagInput value={tags} onChange={setTags} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-foreground/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="px-4 py-2 text-sm rounded-md bg-foreground text-background font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
