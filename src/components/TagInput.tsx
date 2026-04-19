'use client';

import { useState } from 'react';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
};

export function TagInput({ value, onChange, placeholder, id }: Props) {
  const [draft, setDraft] = useState('');

  function commit() {
    const cleaned = draft.trim().replace(/^,+|,+$/g, '').trim();
    if (!cleaned) {
      setDraft('');
      return;
    }
    if (!value.includes(cleaned)) {
      onChange([...value, cleaned]);
    }
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (!draft.trim()) return;
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (text.includes(',')) {
      e.preventDefault();
      const parts = text
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const next = [...value];
      for (const p of parts) {
        if (!next.includes(p)) next.push(p);
      }
      onChange(next);
    }
  }

  return (
    <div className="input flex flex-wrap items-center gap-1.5 min-h-[42px] py-1.5 px-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-foreground/10 text-foreground text-xs px-2 py-0.5"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            aria-label={`Remove tag ${tag}`}
            className="text-foreground/60 hover:text-foreground leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] bg-transparent border-0 outline-0 text-sm py-0.5"
      />
    </div>
  );
}
