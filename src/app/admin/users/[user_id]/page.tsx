'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@/lib/cloud/api';
import { useToast } from '@/components/Toaster';
import { invalidateProfile } from '@/lib/cloud/useProfiles';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

type Params = { user_id: string };

export default function AdminUserEditPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { user_id: userId } = use(params);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<api.AdminUserDetail | null>(null);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [access, setAccess] = useState<api.AdminUserListAccess[] | null>(null);
  const [joinable, setJoinable] = useState<api.AdminJoinableList[] | null>(null);
  const [pickedListId, setPickedListId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, me, a, j] = await Promise.all([
          api.adminGetUser(userId),
          api.getCurrentUserId(),
          api.adminFetchUserListAccess(userId),
          api.adminFetchJoinableLists(userId),
        ]);
        if (cancelled) return;
        setCurrentUserId(me);
        setAccess(a);
        setJoinable(j);
        if (!u) {
          setUser(null);
          return;
        }
        setUser(u);
        setHandle(u.handle ?? '');
        setDisplayName(u.displayName ?? '');
        setIsAdmin(u.isAdmin);
      } catch (err) {
        if (cancelled) return;
        toast.push(err instanceof Error ? err.message : 'Failed to load user', {
          kind: 'error',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, toast]);

  async function reloadAccess() {
    const [a, j] = await Promise.all([
      api.adminFetchUserListAccess(userId),
      api.adminFetchJoinableLists(userId),
    ]);
    setAccess(a);
    setJoinable(j);
    setPickedListId('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const trimmedHandle = handle.trim().toLowerCase();
    if (trimmedHandle && !HANDLE_RE.test(trimmedHandle)) {
      setError(
        'Handle must be 3–20 chars, lowercase letters / numbers / underscore only.',
      );
      return;
    }
    if (
      user.isAdmin &&
      !isAdmin &&
      currentUserId === user.userId &&
      !confirm(
        'You are about to remove your own admin access. You will lose this page. Continue?',
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await api.adminUpdateUser(user.userId, {
        handle: trimmedHandle || null,
        displayName: displayName.trim() || null,
        isAdmin,
      });
      invalidateProfile(user.userId);
      toast.push('User updated', { kind: 'success' });
      setUser({
        ...user,
        handle: trimmedHandle || null,
        displayName: displayName.trim() || null,
        isAdmin,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(/duplicate key/.test(msg) ? 'That handle is taken.' : msg);
    } finally {
      setSaving(false);
    }
  }

  async function removeFromList(listId: string, title: string) {
    if (!confirm(`Remove this user from "${title}"?`)) return;
    try {
      await api.removeListMember(listId, userId);
      toast.push('Removed from list', { kind: 'success' });
      await reloadAccess();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Remove failed', {
        kind: 'error',
      });
    }
  }

  async function addToList() {
    if (!pickedListId) return;
    setAdding(true);
    try {
      await api.adminAddUserToList(pickedListId, userId);
      toast.push('Added to list', { kind: 'success' });
      await reloadAccess();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Add failed', {
        kind: 'error',
      });
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-foreground/60">Loading user…</div>;
  }

  if (!user) {
    return (
      <div className="text-sm">
        <p className="text-foreground/70">User not found.</p>
        <Link
          href="/admin/users"
          className="inline-block mt-3 text-foreground/60 hover:text-foreground"
        >
          ← Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/users"
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← All users
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">
          {user.email}
        </h1>
        <p className="text-xs text-foreground/50 mt-1 font-mono">
          {user.userId}
        </p>
      </div>

      <form onSubmit={save} className="space-y-4 max-w-md">
        <label className="block">
          <span className="text-sm font-medium">Handle</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="yourname"
            className="input mt-1.5 font-mono"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Their name"
            className="input mt-1.5"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          <span className="font-medium">Platform admin</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={saving || currentUserId === null}
            className="px-4 py-2 rounded-md bg-foreground text-background font-medium text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <section className="border-t border-foreground/10 pt-6">
        <h2 className="text-lg font-semibold">List access</h2>
        <p className="text-sm text-foreground/60 mt-1 mb-3">
          Lists this user owns or is a member of. Owned lists can&apos;t be
          unassigned here — only memberships can be removed.
        </p>

        {access === null ? (
          <div className="text-sm text-foreground/60">Loading…</div>
        ) : access.length === 0 ? (
          <div className="text-sm text-foreground/60">No list access yet.</div>
        ) : (
          <ul className="rounded-md border border-foreground/15 divide-y divide-foreground/10">
            {access.map((a) => (
              <li
                key={`${a.relationship}-${a.listId}`}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span
                  className={`inline-block px-2 py-0.5 text-xs rounded ${
                    a.relationship === 'owner'
                      ? 'bg-foreground text-background'
                      : 'bg-foreground/10 text-foreground/80'
                  }`}
                >
                  {a.relationship}
                </span>
                <Link
                  href={`/lists/${a.listId}`}
                  className="flex-1 truncate hover:underline"
                >
                  {a.title}
                </Link>
                <span className="text-xs text-foreground/50">{a.visibility}</span>
                {a.relationship === 'member' && (
                  <button
                    type="button"
                    onClick={() => removeFromList(a.listId, a.title)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center gap-2">
          <select
            value={pickedListId}
            onChange={(e) => setPickedListId(e.target.value)}
            className="input flex-1"
            disabled={!joinable || joinable.length === 0}
          >
            <option value="">
              {joinable === null
                ? 'Loading…'
                : joinable.length === 0
                  ? 'No other lists available'
                  : 'Add to a list…'}
            </option>
            {(joinable ?? []).map((l) => (
              <option key={l.listId} value={l.listId}>
                {l.title} ({l.visibility})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addToList}
            disabled={!pickedListId || adding}
            className="px-3 py-2 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-40"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </section>
    </div>
  );
}
