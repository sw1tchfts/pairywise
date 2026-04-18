'use client';

import type { Item } from '@/lib/types';

type Props = {
  item: Item;
  onSelect: () => void;
  hotkeyLabel: string;
};

export function VoteCard({ item, onSelect, hotkeyLabel }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col items-stretch text-left rounded-xl border-2 border-black/10 dark:border-white/15 p-5 hover:border-foreground focus:border-foreground focus:outline-none transition overflow-hidden min-h-[320px]"
    >
      {item.videoUrl ? (
        <video
          src={item.videoUrl}
          poster={item.imageUrl}
          controls
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
          className="w-full aspect-video object-cover rounded-md mb-4 bg-black"
        />
      ) : item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="w-full aspect-video object-cover rounded-md mb-4"
        />
      ) : null}

      {item.audioUrl && (
        <audio
          src={item.audioUrl}
          controls
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
          className="w-full mb-3"
        />
      )}

      <div className="flex-1 flex flex-col">
        <div className="text-xl font-semibold leading-snug">{item.title}</div>
        {item.description && (
          <p className="mt-2 text-sm text-foreground/70 line-clamp-3">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/70"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {item.linkUrl && (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 text-xs text-foreground/60 truncate hover:underline"
          >
            {safeHostname(item.linkUrl)}
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-foreground/20 bg-foreground/5 font-mono">
          {hotkeyLabel}
        </kbd>
        <span className="text-sm text-foreground/60 group-hover:text-foreground">
          Pick this →
        </span>
      </div>
    </button>
  );
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
