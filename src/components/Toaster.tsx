'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastKind = 'info' | 'success' | 'error';

type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
  action?: { label: string; onClick: () => void };
};

type ToastContext = {
  push: (message: string, opts?: { kind?: ToastKind; action?: Toast['action'] }) => void;
};

const Ctx = createContext<ToastContext | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return { push: () => {} } as ToastContext;
  }
  return ctx;
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastContext['push']>((message, opts = {}) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());
    const toast: Toast = {
      id,
      message,
      kind: opts.kind ?? 'info',
      action: opts.action,
    };
    setToasts((t) => [...t, toast]);
    const handle = setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, handle);
  }, [dismiss]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const handle of t.values()) clearTimeout(handle);
      t.clear();
    };
  }, []);

  // Stable context value so consumers using `useToast()` in effect deps
  // don't re-fire every time a toast is added/removed (which used to cause
  // error toasts to spam infinitely when the failing effect retried).
  const value = useMemo<ToastContext>(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-sm w-full sm:w-auto min-w-[240px] rounded-lg shadow-lg border px-4 py-2.5 text-sm flex items-center gap-3 ${
              t.kind === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : t.kind === 'success'
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-background text-foreground border-black/15 dark:border-white/15'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="text-xs font-medium underline underline-offset-2"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="text-current opacity-60 hover:opacity-100 leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
