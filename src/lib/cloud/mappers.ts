import type {
  Algorithm,
  Bracket,
  Comparison,
  Item,
  ItemType,
  RankList,
  Tier,
  Visibility,
} from '../types';

// Row shapes from Supabase.

export type ListRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: Visibility;
  algorithm_default: Algorithm;
  tier_assignments: Record<string, Tier>;
  direct_ratings: Record<string, number>;
  bracket: Bracket | null;
  created_at: string;
  updated_at: string;
};

export type ItemRow = {
  id: string;
  list_id: string;
  type: ItemType;
  title: string;
  description: string | null;
  image_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  link_url: string | null;
  external_id: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  position: number;
  created_at: string;
};

export type ComparisonRow = {
  id: string;
  list_id: string;
  voter_id: string;
  winner_id: string;
  loser_id: string;
  skipped: boolean;
  created_at: string;
};

// Row -> domain.

export function listFromRow(
  row: ListRow,
  items: Item[] = [],
  comparisons: Comparison[] = [],
): RankList {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? undefined,
    tags: row.tags ?? [],
    visibility: row.visibility,
    items,
    comparisons,
    algorithmDefault: row.algorithm_default,
    tierAssignments: row.tier_assignments ?? {},
    directRatings: row.direct_ratings ?? {},
    bracket: row.bracket ?? null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function itemFromRow(row: ItemRow): Item {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    tags: row.tags ?? [],
    imageUrl: row.image_url ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    linkUrl: row.link_url ?? undefined,
    externalId: row.external_id ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

export function comparisonFromRow(row: ComparisonRow): Comparison {
  return {
    id: row.id,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    skipped: row.skipped || undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Domain -> row (insert payloads; snake_case).

export function itemInsert(item: Item, listId: string, position: number) {
  return {
    id: item.id,
    list_id: listId,
    type: item.type,
    title: item.title,
    description: item.description ?? null,
    image_url: item.imageUrl ?? null,
    audio_url: item.audioUrl ?? null,
    video_url: item.videoUrl ?? null,
    link_url: item.linkUrl ?? null,
    external_id: item.externalId ?? null,
    tags: item.tags ?? [],
    metadata: item.metadata ?? null,
    position,
  };
}

export function itemUpdate(patch: Partial<Omit<Item, 'id'>>) {
  const out: Record<string, unknown> = {};
  if ('type' in patch) out.type = patch.type;
  if ('title' in patch) out.title = patch.title;
  if ('description' in patch) out.description = patch.description ?? null;
  if ('tags' in patch) out.tags = patch.tags ?? [];
  if ('imageUrl' in patch) out.image_url = patch.imageUrl ?? null;
  if ('audioUrl' in patch) out.audio_url = patch.audioUrl ?? null;
  if ('videoUrl' in patch) out.video_url = patch.videoUrl ?? null;
  if ('linkUrl' in patch) out.link_url = patch.linkUrl ?? null;
  if ('externalId' in patch) out.external_id = patch.externalId ?? null;
  if ('metadata' in patch) out.metadata = patch.metadata ?? null;
  return out;
}
