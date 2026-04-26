'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as api from '@/lib/cloud/api';
import { useToast } from '@/components/Toaster';
import { errorMessage } from '@/lib/utils';

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<api.AdminUserRow[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setUsers(await api.adminListUsers());
      } catch (err) {
        toast.push(errorMessage(err, 'Failed to load users'), {
          kind: 'error',
        });
        setUsers([]);
      }
    })();
  }, [toast]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.handle ?? '').toLowerCase().includes(q) ||
        (u.displayName ?? '').toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        {users && (
          <span className="text-sm text-foreground/60">{users.length} total</span>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by email, handle, or display name"
        className="input mb-4"
      />

      {filtered === null ? (
        <div className="text-sm text-foreground/60">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-foreground/60">No matching users.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-foreground/15">
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Handle</th>
                <th className="px-3 py-2 font-medium">Display name</th>
                <th className="px-3 py-2 font-medium">Admin</th>
                <th className="px-3 py-2 font-medium text-right">Lists</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.userId}
                  className="border-t border-foreground/10 hover:bg-foreground/5"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/users/${u.userId}`}
                      className="hover:underline"
                    >
                      {u.email}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground/80">
                    {u.handle ? `@${u.handle}` : <span className="text-foreground/40">—</span>}
                  </td>
                  <td className="px-3 py-2 text-foreground/80">
                    {u.displayName ?? <span className="text-foreground/40">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {u.isAdmin ? (
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-foreground text-background">
                        admin
                      </span>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground/70">
                    {u.ownedCount} owned · {u.memberCount} joined
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
