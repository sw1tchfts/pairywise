'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/cloud/api';
import type { AdminUser, UserRole } from '@/lib/cloud/api';
import { useCurrentUserId } from '@/lib/supabase/useCurrentUser';
import { useIsAdmin } from '@/lib/cloud/useIsAdmin';
import { useToast } from '@/components/Toaster';

type RowState = 'idle' | 'saving';

export default function AdminUsersPage() {
  const router = useRouter();
  const toast = useToast();
  const currentUserId = useCurrentUserId();
  const isAdmin = useIsAdmin();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (isAdmin !== true) return;
    let mounted = true;
    (async () => {
      try {
        const rows = await api.fetchAllUsersAdmin();
        if (!mounted) return;
        setUsers(rows);
        setLoadError(null);
      } catch (err) {
        if (!mounted) return;
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load users.',
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAdmin, reloadTick]);

  const reload = () => setReloadTick((n) => n + 1);

  const activeAdminCount = useMemo(
    () =>
      (users ?? []).filter((u) => u.role === 'admin' && u.disabledAt == null)
        .length,
    [users],
  );

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.handle, u.displayName, u.userId]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [users, query]);

  async function withRowState(
    userId: string,
    fn: () => Promise<void>,
    successMessage: string,
  ) {
    setRowState((s) => ({ ...s, [userId]: 'saving' }));
    try {
      await fn();
      reload();
      toast.push(successMessage, { kind: 'success' });
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed.', {
        kind: 'error',
      });
    } finally {
      setRowState((s) => {
        const next = { ...s };
        delete next[userId];
        return next;
      });
    }
  }

  async function handleRoleToggle(u: AdminUser) {
    const next: UserRole = u.role === 'admin' ? 'user' : 'admin';
    if (
      next === 'user'
      && u.role === 'admin'
      && activeAdminCount <= 1
    ) {
      toast.push('You are the last admin — promote someone else first.', {
        kind: 'error',
      });
      return;
    }
    await withRowState(
      u.userId,
      () => api.updateUserRole(u.userId, next),
      next === 'admin' ? 'Promoted to admin.' : 'Admin removed.',
    );
  }

  async function handleDisableToggle(u: AdminUser) {
    const disabling = u.disabledAt == null;
    if (
      disabling
      && u.role === 'admin'
      && activeAdminCount <= 1
    ) {
      toast.push('Cannot disable the last active admin.', { kind: 'error' });
      return;
    }
    await withRowState(
      u.userId,
      () => api.setUserDisabled(u.userId, disabling),
      disabling ? 'Account disabled.' : 'Account re-enabled.',
    );
  }

  // ---- Auth gating ----
  if (currentUserId === undefined || isAdmin === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-foreground/60 text-center">
        Loading…
      </div>
    );
  }
  if (currentUserId === null) {
    router.replace('/signin?next=/admin/users');
    return null;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-10">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-foreground/70 mt-2">
          This page is restricted to administrators.
        </p>
        <div className="mt-6">
          <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
            ← Back to lists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-sm mb-2">
        <Link href="/" className="text-foreground/60 hover:text-foreground">
          ← All lists
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        User security
      </h1>
      <p className="text-sm text-foreground/60 mt-1">
        Grant or revoke admin access, or disable accounts. Changes are enforced
        at the database level — the last remaining admin cannot be demoted or
        disabled.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email, handle, name, or id…"
          className="input sm:max-w-sm"
          type="search"
        />
        <div className="text-xs text-foreground/60">
          {users ? `${filtered.length} of ${users.length} accounts` : ''}
        </div>
      </div>

      {loadError && (
        <p className="mt-4 text-sm text-red-600">{loadError}</p>
      )}

      {!users && !loadError && (
        <p className="mt-6 text-sm text-foreground/60">Loading accounts…</p>
      )}

      {users && users.length === 0 && !loadError && (
        <p className="mt-6 text-sm text-foreground/60">No accounts found.</p>
      )}

      {users && users.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Signed up
                </th>
                <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">
                  Last sign-in
                </th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isMe = u.userId === currentUserId;
                const busy = rowState[u.userId] === 'saving';
                const disabled = u.disabledAt != null;
                return (
                  <tr
                    key={u.userId}
                    className="border-t border-foreground/10 align-top"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {u.displayName || u.handle || u.email || u.userId.slice(0, 8)}
                        {isMe && (
                          <span className="ml-2 text-xs text-foreground/50">(you)</span>
                        )}
                      </div>
                      <div className="text-xs text-foreground/60 break-all">
                        {u.email ?? '—'}
                      </div>
                      {u.handle && (
                        <div className="text-xs text-foreground/50 font-mono">
                          @{u.handle}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          u.role === 'admin'
                            ? 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-foreground text-background'
                            : 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border border-foreground/20 text-foreground/70'
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {disabled ? (
                        <span className="text-xs text-red-600">
                          Disabled{' '}
                          {new Date(u.disabledAt as number).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-foreground/60">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground/60 hidden md:table-cell">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground/60 hidden lg:table-cell">
                      {u.lastSignInAt
                        ? new Date(u.lastSignInAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRoleToggle(u)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded border border-foreground/20 text-xs hover:bg-foreground/5 disabled:opacity-40"
                      >
                        {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisableToggle(u)}
                        disabled={busy}
                        className="ml-2 px-2.5 py-1 rounded border border-foreground/20 text-xs hover:bg-foreground/5 disabled:opacity-40"
                      >
                        {disabled ? 'Re-enable' : 'Disable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
