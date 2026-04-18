'use client';

import { useEffect, useRef, useState } from 'react';
import type { Item } from '@/lib/types';

type Props = {
  open: boolean;
  initial?: Partial<Item>;
  onClose: () => void;
  onSave: (item: Omit<Item, 'id'>) => void;
  /** When true, show a "Save & add another" button (useful for initial list setup). */
  allowAddAnother?: boolean;
};

const EMPTY: Omit<Item, 'id'> = {
  type: 'text',
  title: '',
  description: '',
  tags: [],
  imageUrl: '',
  audioUrl: '',
  videoUrl: '',
  linkUrl: '',
};

export function ItemEditor({ open, ...rest }: Props) {
  if (!open) return null;
  return <ItemEditorForm {...rest} />;
}

function ItemEditorForm({
  initial,
  onClose,
  onSave,
  allowAddAnother,
}: Omit<Props, 'open'>) {
  const [draft, setDraft] = useState<Omit<Item, 'id'>>(() => ({
    ...EMPTY,
    ...initial,
    tags: initial?.tags ?? [],
    title: initial?.title ?? '',
  }));
  const [tagsInput, setTagsInput] = useState(() =>
    (initial?.tags ?? []).join(', '),
  );
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commit() {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      imageUrl: draft.imageUrl?.trim() || undefined,
      audioUrl: draft.audioUrl?.trim() || undefined,
      videoUrl: draft.videoUrl?.trim() || undefined,
      linkUrl: draft.linkUrl?.trim() || undefined,
      tags,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    commit();
  }

  function handleSaveAndAddAnother() {
    if (!draft.title.trim()) return;
    commit();
    setDraft({ ...EMPTY });
    setTagsInput('');
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-lg rounded-lg shadow-xl border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {initial?.title ? 'Edit item' : 'New item'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-foreground/60 hover:text-foreground text-sm"
            >
              Close
            </button>
          </div>

          <Field label="Title" required>
            <input
              ref={titleRef}
              className="input"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              className="input resize-y"
              rows={3}
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>

          <Field label="Tags" hint="Comma-separated">
            <input
              className="input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. drama, classic"
            />
          </Field>

          <fieldset className="border border-black/10 dark:border-white/10 rounded-md p-3">
            <legend className="text-xs uppercase tracking-wider text-foreground/60 px-1">
              Media (any combination)
            </legend>
            <div className="space-y-2">
              <Field label="Image URL">
                <input
                  className="input"
                  type="url"
                  value={draft.imageUrl ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))}
                  placeholder="https://…/photo.jpg"
                />
              </Field>
              <Field label="Audio URL">
                <input
                  className="input"
                  type="url"
                  value={draft.audioUrl ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, audioUrl: e.target.value }))}
                  placeholder="https://…/track.mp3"
                />
              </Field>
              <Field label="Video URL">
                <input
                  className="input"
                  type="url"
                  value={draft.videoUrl ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                  placeholder="https://…/clip.mp4"
                />
              </Field>
              <Field label="Link URL" hint="External page this item refers to">
                <input
                  className="input"
                  type="url"
                  value={draft.linkUrl ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md hover:bg-foreground/5"
            >
              Cancel
            </button>
            {allowAddAnother && (
              <button
                type="button"
                onClick={handleSaveAndAddAnother}
                className="px-4 py-2 text-sm rounded-md border border-foreground/30 font-medium disabled:opacity-40"
                disabled={!draft.title.trim()}
              >
                Save &amp; add another
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-md bg-foreground text-background font-medium disabled:opacity-40"
              disabled={!draft.title.trim()}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {hint && <span className="block text-xs text-foreground/60 mt-0.5">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
