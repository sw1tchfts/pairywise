'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from './Toaster';
import { ListSchema, type RankList } from '@/lib/types';

const LEGACY_KEY = 'pairywise-store';
const MIGRATED_FLAG = 'pairywise-local-migrated';

type LegacyPayload = {
  state?: { lists?: Record<string, unknown>; order?: string[] };
};

function readLegacyLists(): RankList[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyPayload;
    const rawLists = parsed?.state?.lists ?? {};
    const out: RankList[] = [];
    for (const val of Object.values(rawLists)) {
      const result = ListSchema.safeParse(val);
      if (result.success) out.push(result.data);
    }
    return out;
  } catch {
    return [];
  }
}

export function LocalListsMigration() {
  const hydrated = useStore((s) => s.hydrated);
  const importList = useStore((s) => s.importList);
  const toast = useToast();
  const [pending, setPending] = useState<RankList[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(MIGRATED_FLAG) === '1') return;
    queueMicrotask(() => {
      const legacy = readLegacyLists();
      if (legacy.length === 0) {
        localStorage.setItem(MIGRATED_FLAG, '1');
        return;
      }
      setPending(legacy);
    });
  }, [hydrated]);

  const count = useMemo(() => pending?.length ?? 0, [pending]);

  function dismiss(cleanup: boolean) {
    if (cleanup && typeof window !== 'undefined') {
      localStorage.removeItem(LEGACY_KEY);
    }
    localStorage.setItem(MIGRATED_FLAG, '1');
    setPending(null);
  }

  async function onImport() {
    if (!pending) return;
    setBusy(true);
    try {
      for (const l of pending) importList(l);
      toast.push(`Imported ${pending.length} list${pending.length === 1 ? '' : 's'} to your account.`, {
        kind: 'success',
      });
      dismiss(true);
    } finally {
      setBusy(false);
    }
  }

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-migration-title"
    >
      <div className="w-full max-w-md rounded-lg bg-background border border-foreground/10 shadow-xl p-5">
        <h2 id="local-migration-title" className="text-lg font-semibold">
          Import lists from this device?
        </h2>
        <p className="text-sm text-foreground/70 mt-2">
          We found {count} list{count === 1 ? '' : 's'} saved in this browser
          from before you signed in. Would you like to add{' '}
          {count === 1 ? 'it' : 'them'} to your account so{' '}
          {count === 1 ? 'it follows' : 'they follow'} you across devices?
        </p>
        <ul className="mt-3 max-h-40 overflow-auto text-sm divide-y divide-foreground/10 rounded border border-foreground/10">
          {pending.map((l) => (
            <li key={l.id} className="px-3 py-1.5 truncate">
              {l.title}{' '}
              <span className="text-foreground/40 text-xs">
                ({l.items.length} items)
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dismiss(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-foreground text-background font-medium disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
