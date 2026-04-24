'use client';

import { useEffect, useState } from 'react';
import { fetchProfiles, type Profile } from './api';
import { isCloudEnabled } from '../supabase/browser';

const cache = new Map<string, Profile>();
const inflight = new Map<string, Promise<void>>();
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

async function ensureProfiles(userIds: string[]) {
  const toFetch = userIds.filter((id) => !cache.has(id) && !inflight.has(id));
  if (toFetch.length === 0) return;
  const p = (async () => {
    try {
      const rows = await fetchProfiles(toFetch);
      const byId = new Map(rows.map((r) => [r.userId, r]));
      for (const id of toFetch) {
        cache.set(
          id,
          byId.get(id) ?? {
            userId: id,
            handle: null,
            displayName: null,
            role: 'user',
            disabledAt: null,
          },
        );
      }
      notify();
    } catch {
      // Leave uncached; we'll retry on next call.
    } finally {
      for (const id of toFetch) inflight.delete(id);
    }
  })();
  for (const id of toFetch) inflight.set(id, p);
  await p;
}

/** Get a batch of profiles by user id. Fetches missing entries on mount. */
export function useProfiles(userIds: string[]): Map<string, Profile> {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isCloudEnabled()) return;
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    ensureProfiles(userIds);
    return () => {
      listeners.delete(l);
    };
  }, [userIds]);

  const out = new Map<string, Profile>();
  for (const id of userIds) {
    const p = cache.get(id);
    if (p) out.set(id, p);
  }
  return out;
}

/** Friendly label for a profile — handle first, else display name, else short id. */
export function profileLabel(p: Profile | undefined, userId?: string): string {
  if (p?.handle) return `@${p.handle}`;
  if (p?.displayName) return p.displayName;
  if (userId) return `@user-${userId.slice(0, 6)}`;
  return 'user';
}

/** Invalidate a cached profile (call after an update). */
export function invalidateProfile(userId: string) {
  cache.delete(userId);
  notify();
}
