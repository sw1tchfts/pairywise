'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'pairywise-theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'light') root.classList.add('light');
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    readTheme,
    () => 'system',
  );

  function choose(next: Theme) {
    applyTheme(next);
    if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
    // Notify our own hook, since `storage` events only fire cross-tab.
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }

  return (
    <div className="inline-flex items-center rounded-md border border-foreground/20 overflow-hidden text-xs">
      {(['light', 'system', 'dark'] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => choose(opt)}
          aria-pressed={theme === opt}
          title={`${opt.charAt(0).toUpperCase()}${opt.slice(1)} theme`}
          className={`px-2 py-1 font-medium ${
            theme === opt
              ? 'bg-foreground text-background'
              : 'text-foreground/70 hover:bg-foreground/5'
          }`}
        >
          {opt === 'light' ? 'Lt' : opt === 'dark' ? 'Dk' : 'Auto'}
        </button>
      ))}
    </div>
  );
}
