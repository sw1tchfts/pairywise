'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useToast } from './Toaster';
import type { Visibility } from '@/lib/types';
import * as api from '@/lib/cloud/api';
import { profileLabel, useProfiles } from '@/lib/cloud/useProfiles';
import { useCurrentUserId } from '@/lib/supabase/useCurrentUser';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: 'Private · only you',
  unlisted: 'Unlisted · anyone with the link',
  public: 'Public · visible to anyone signed in',
};

export function ShareDialog({
  listId,
  open,
  onClose,
}: {
  listId: string;
  open: boolean;
  onClose: () => void;
}) {
  const list = useStore((s) => s.lists[listId]);
  const updateList = useStore((s) => s.updateList);
  const hydrate = useStore((s) => s.hydrate);
  const router = useRouter();
  const toast = useToast();
  const currentUserId = useCurrentUserId();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [members, setMembers] = useState<api.ListMember[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const ownedByMe = list && (!list.ownerId || list.ownerId === currentUserId);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/shared/${listId}`;
  }, [listId]);

  const listOwnerId = list?.ownerId ?? null;
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    if (listOwnerId) ids.add(listOwnerId);
    for (const m of members ?? []) ids.add(m.userId);
    return Array.from(ids);
  }, [listOwnerId, members]);

  const profiles = useProfiles(profileIds);

  const refreshMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const rows = await api.fetchListMembers(listId);
      setMembers(rows);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to load members.', {
        kind: 'error',
      });
    } finally {
      setLoadingMembers(false);
    }
  }, [listId, toast]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      refreshMembers();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, refreshMembers]);

  if (!open || !list) return null;

  const visibility: Visibility = list.visibility ?? 'private';

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      toast.push('Copy failed. Select the URL and copy manually.', {
        kind: 'error',
      });
    }
  }

  function changeVisibility(v: Visibility) {
    updateList(listId, { visibility: v });
    toast.push(`Visibility set to ${v}`, { kind: 'success' });
  }

  async function removeMember(userId: string) {
    const isSelf = userId === currentUserId;
    const label = profileLabel(profiles.get(userId), userId);
    const confirmed = confirm(
      isSelf
        ? `Leave "${list!.title}"? You can rejoin if the owner re-sends the link.`
        : `Remove ${label} from this list?`,
    );
    if (!confirmed) return;
    setBusyUserId(userId);
    try {
      await api.removeListMember(listId, userId);
      setMembers((cur) => cur?.filter((m) => m.userId !== userId) ?? null);
      toast.push(isSelf ? 'Left the list' : `Removed ${label}`, { kind: 'info' });
      if (isSelf) {
        onClose();
        await hydrate();
        router.push('/');
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Remove failed.', {
        kind: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  const shareable = visibility !== 'private';
  const ownerId = list.ownerId ?? currentUserId ?? null;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-auto rounded-lg bg-background border border-foreground/10 shadow-xl">
        <div className="sticky top-0 bg-background border-b border-foreground/10 p-5 flex items-start justify-between">
          <div>
            <h2 id="share-title" className="text-lg font-semibold">
              Share &amp; members
            </h2>
            <p className="text-xs text-foreground/60 mt-0.5 truncate">
              {list.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {ownedByMe && (
          <section className="p-5 border-b border-foreground/10 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Visibility</span>
              <select
                value={visibility}
                onChange={(e) => changeVisibility(e.target.value as Visibility)}
                className="input mt-1.5"
              >
                {(['private', 'unlisted', 'public'] as Visibility[]).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Invite link</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  readOnly
                  value={
                    shareable ? shareUrl : 'Make the list unlisted or public to share'
                  }
                  className="input flex-1 text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={copy}
                  disabled={!shareable}
                  className="px-3 py-2 text-sm rounded-md bg-foreground text-background font-medium disabled:opacity-40"
                >
                  {copyState === 'copied' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-foreground/60 mt-1.5">
                Anyone with the link signs in (or signs up) and is auto-added
                as a voter. The list shows up in their dashboard from then on.
              </p>
            </label>
          </section>
        )}

        <section className="p-5">
          <h3 className="text-sm font-medium mb-3">
            People with access{' '}
            <span className="text-foreground/50 font-normal">
              ({1 + (members?.length ?? 0)})
            </span>
          </h3>

          <ul className="divide-y divide-foreground/10">
            {ownerId && (
              <PersonRow
                label={profileLabel(profiles.get(ownerId), ownerId)}
                role="Owner"
                isYou={ownerId === currentUserId}
              />
            )}
            {loadingMembers && !members ? (
              <li className="py-2 text-xs text-foreground/50">Loading…</li>
            ) : (members?.length ?? 0) === 0 ? (
              <li className="py-2 text-xs text-foreground/50">
                No other members yet. Share the link to invite people.
              </li>
            ) : (
              members!.map((m) => (
                <PersonRow
                  key={m.userId}
                  label={profileLabel(profiles.get(m.userId), m.userId)}
                  role="Voter"
                  joinedAt={m.joinedAt}
                  isYou={m.userId === currentUserId}
                  canRemove={Boolean(ownedByMe) || m.userId === currentUserId}
                  busy={busyUserId === m.userId}
                  onRemove={() => removeMember(m.userId)}
                  removeLabel={
                    m.userId === currentUserId ? 'Leave' : 'Remove'
                  }
                />
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function PersonRow({
  label,
  role,
  joinedAt,
  isYou,
  canRemove,
  busy,
  onRemove,
  removeLabel,
}: {
  label: string;
  role: string;
  joinedAt?: number;
  isYou?: boolean;
  canRemove?: boolean;
  busy?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <li className="py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm flex items-center gap-2">
          <span className="truncate">{label}</span>
          {isYou && (
            <span className="text-[10px] uppercase tracking-wider text-foreground/50">
              you
            </span>
          )}
        </div>
        <div className="text-xs text-foreground/50 mt-0.5">
          {role}
          {joinedAt && <> · joined {new Date(joinedAt).toLocaleDateString()}</>}
        </div>
      </div>
      {canRemove && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-xs px-2.5 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
        >
          {busy ? '…' : (removeLabel ?? 'Remove')}
        </button>
      )}
    </li>
  );
}
