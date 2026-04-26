'use client';

import { useEffect } from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

type Props = {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  /** Override the backdrop layout (e.g. items-end on mobile for ItemEditor). */
  backdropClassName?: string;
  children: React.ReactNode;
};

const DEFAULT_BACKDROP =
  'fixed inset-0 z-40 grid place-items-center bg-black/40 p-4';

export function Modal({
  open,
  onClose,
  labelledBy,
  backdropClassName,
  children,
}: Props) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={backdropClassName ?? DEFAULT_BACKDROP}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
