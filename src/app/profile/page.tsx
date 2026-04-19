'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@/lib/cloud/api';
import { useToast } from '@/components/Toaster';
import { invalidateProfile } from '@/lib/cloud/useProfiles';
import { ThemeToggle } from '@/components/ThemeToggle';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export default function ProfilePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api.fetchCurrentProfile();
      if (me) {
        setUserId(me.userId);
        setHandle(me.handle ?? '');
        setDisplayName(me.displayName ?? '');
      }
      setLoading(false);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedHandle = handle.trim().toLowerCase();
    if (trimmedHandle && !HANDLE_RE.test(trimmedHandle)) {
      setError(
        'Handle must be 3–20 chars, lowercase letters / numbers / underscore only.',
      );
      return;
    }
    setSaving(true);
    try {
      await api.updateCurrentProfile({
        handle: trimmedHandle || null,
        displayName: displayName.trim() || null,
      });
      if (userId) invalidateProfile(userId);
      toast.push('Profile saved', { kind: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      setError(
        /duplicate key/.test(msg)
          ? 'That handle is taken. Pick another.'
          : msg,
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-sm text-foreground/60 text-center">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-sm mb-2">
        <Link href="/" className="text-foreground/60 hover:text-foreground">
          ← All lists
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        Your profile
      </h1>
      <p className="text-sm text-foreground/60 mt-1">
        Pick a handle so collaborators know who shared a list with them.
      </p>
      <form onSubmit={save} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Handle</span>
          <span className="block text-xs text-foreground/60 mt-0.5">
            3–20 chars, lowercase letters / numbers / underscore. Shown as{' '}
            <span className="font-mono">@{handle || 'yourname'}</span>.
          </span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="yourname"
            autoComplete="username"
            className="input mt-1.5 font-mono"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Display name</span>
          <span className="block text-xs text-foreground/60 mt-0.5">
            Optional — shown instead of your handle when set.
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="input mt-1.5"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-foreground text-background font-medium text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <section className="mt-10 pt-6 border-t border-foreground/10">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-foreground/60 mt-1 mb-3">
          Pick your theme. &quot;Auto&quot; follows your OS setting.
        </p>
        <ThemeToggle />
      </section>
    </div>
  );
}
