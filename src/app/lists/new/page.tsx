'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function NewListPage() {
  const router = useRouter();
  const createList = useStore((s) => s.createList);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const id = createList({
      title: title.trim(),
      description: description.trim() || undefined,
      tags,
    });
    router.push(`/lists/${id}?addItem=1`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">New list</h1>
      <p className="text-sm text-foreground/60 mb-6">
        Set up the list, then add items one at a time with the editor.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Best pizza toppings"
            required
            autoFocus
            className="input"
          />
        </Field>
        <Field label="Description" hint="Optional — what is this list about?">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input resize-y"
          />
        </Field>
        <Field label="Tags" hint="Comma-separated, e.g. food, fun">
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="input"
          />
        </Field>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm rounded-md hover:bg-foreground/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-md bg-foreground text-background font-medium disabled:opacity-40"
            disabled={!title.trim()}
          >
            Create &amp; add items
          </button>
        </div>
      </form>
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
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
