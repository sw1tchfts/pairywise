'use client';

import { useEffect, useRef, useState } from 'react';

export type OverflowAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Rendered as a <Link>-like `<a>` when provided (via onClick router.push). */
};

export function OverflowMenu({
  actions,
  label = 'More actions',
}: {
  actions: OverflowAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="w-9 h-9 rounded-md border border-foreground/20 hover:bg-foreground/5 text-foreground/70 inline-flex items-center justify-center text-lg leading-none"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[180px] rounded-md border border-foreground/15 bg-background shadow-lg p-1 text-sm z-20"
        >
          {actions.map((action, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className={`w-full text-left px-3 py-1.5 rounded hover:bg-foreground/5 disabled:opacity-40 disabled:hover:bg-transparent ${
                action.danger ? 'text-red-600' : ''
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
