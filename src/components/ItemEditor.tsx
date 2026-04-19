'use client';

import { useEffect, useRef, useState } from 'react';
import type { Item } from '@/lib/types';
import { UrlPreviewInput } from './UrlPreviewInput';
import { TmdbSearchInput } from './TmdbSearchInput';
import { TagInput } from './TagInput';
import { VoteCard } from './VoteCard';

type Props = {
  open: boolean;
  initial?: Partial<Item>;
  onClose: () => void;
  onSave: (item: Omit<Item, 'id'>) => void;
  /** When true, show a "Save & add another" button (useful for initial list setup). */
  allowAddAnother?: boolean;
  /** Existing items to check for duplicates (excluding the one being edited). */
  existing?: Item[];
  /** Id of the item currently being edited, so it's excluded from duplicate checks. */
  editingId?: string | null;
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

function normalizeTitle(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findDuplicate(
  existing: Item[] | undefined,
  editingId: string | null | undefined,
  draft: Pick<Item, 'title' | 'linkUrl' | 'externalId'>,
): Item | null {
  if (!existing || existing.length === 0) return null;
  const title = normalizeTitle(draft.title);
  const linkUrl = draft.linkUrl?.trim();
  const externalId = draft.externalId?.trim();
  for (const it of existing) {
    if (it.id === editingId) continue;
    if (externalId && it.externalId === externalId) return it;
    if (linkUrl && it.linkUrl?.trim() === linkUrl) return it;
    if (title && normalizeTitle(it.title) === title) return it;
  }
  return null;
}

function ItemEditorForm({
  initial,
  onClose,
  onSave,
  allowAddAnother,
  existing,
  editingId,
}: Omit<Props, 'open'>) {
  const isEditing = Boolean(initial?.title);
  const [draft, setDraft] = useState<Omit<Item, 'id'>>(() => ({
    ...EMPTY,
    ...initial,
    tags: initial?.tags ?? [],
    title: initial?.title ?? '',
  }));
  const [importMode, setImportMode] = useState<'none' | 'url' | 'tmdb'>('none');
  const [showPreview, setShowPreview] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const duplicate = findDuplicate(existing, editingId, {
    title: draft.title,
    linkUrl: draft.linkUrl,
    externalId: draft.externalId,
  });

  function handleImport(patch: Partial<Omit<Item, 'id'>>) {
    setDraft((d) => ({
      ...d,
      ...patch,
      tags: patch.tags ?? d.tags,
    }));
    setImportMode('none');
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  useEffect(() => {
    titleRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commit() {
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      imageUrl: draft.imageUrl?.trim() || undefined,
      audioUrl: draft.audioUrl?.trim() || undefined,
      videoUrl: draft.videoUrl?.trim() || undefined,
      linkUrl: draft.linkUrl?.trim() || undefined,
      tags: draft.tags ?? [],
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
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-lg rounded-t-xl sm:rounded-lg shadow-xl border border-black/10 dark:border-white/10 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isEditing ? 'Edit item' : 'New item'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-foreground/60 hover:text-foreground text-sm"
            >
              Close
            </button>
          </div>

          {!isEditing && (
            <div className="rounded-md border border-dashed border-black/15 dark:border-white/15 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-foreground/60">
                  Quick import (optional)
                </span>
                <button
                  type="button"
                  onClick={() => setImportMode(importMode === 'url' ? 'none' : 'url')}
                  className={`text-xs px-2 py-1 rounded border ${
                    importMode === 'url'
                      ? 'border-foreground bg-foreground/5'
                      : 'border-foreground/20 hover:bg-foreground/5'
                  }`}
                >
                  From URL
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode(importMode === 'tmdb' ? 'none' : 'tmdb')}
                  className={`text-xs px-2 py-1 rounded border ${
                    importMode === 'tmdb'
                      ? 'border-foreground bg-foreground/5'
                      : 'border-foreground/20 hover:bg-foreground/5'
                  }`}
                >
                  Movie / TV
                </button>
              </div>
              {importMode === 'url' && (
                <div className="mt-3">
                  <UrlPreviewInput onImport={handleImport} />
                </div>
              )}
              {importMode === 'tmdb' && (
                <div className="mt-3">
                  <TmdbSearchInput onImport={handleImport} />
                </div>
              )}
            </div>
          )}

          <Field label="Title" required>
            <input
              ref={titleRef}
              className="input"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              required
            />
          </Field>

          {duplicate && (
            <div
              role="alert"
              className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs"
            >
              Looks like a duplicate of{' '}
              <span className="font-medium">{duplicate.title}</span>. You can still
              save if you want two copies.
            </div>
          )}

          <Field label="Description">
            <textarea
              className="input resize-y"
              rows={3}
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>

          <Field label="Tags" hint="Press Enter or comma to add">
            <TagInput
              value={draft.tags ?? []}
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
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

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-foreground/60 hover:text-foreground"
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            {draft.title.trim() && (
              <span className="text-[11px] text-foreground/50">
                How your vote card will look
              </span>
            )}
          </div>
          {showPreview && draft.title.trim() && (
            <div className="rounded-lg bg-foreground/5 p-3">
              <VoteCard
                preview
                item={{
                  id: 'preview',
                  type: draft.type,
                  title: draft.title.trim() || 'Untitled',
                  description: draft.description?.trim() || undefined,
                  tags: draft.tags ?? [],
                  imageUrl: draft.imageUrl?.trim() || undefined,
                  audioUrl: draft.audioUrl?.trim() || undefined,
                  videoUrl: draft.videoUrl?.trim() || undefined,
                  linkUrl: draft.linkUrl?.trim() || undefined,
                }}
              />
            </div>
          )}

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
