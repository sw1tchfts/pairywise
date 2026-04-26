import { z } from 'zod';

const ItemTypeSchema = z.enum([
  'text',
  'image',
  'url',
  'tmdb',
  'spotify',
  'youtube',
  'media',
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

const ItemSchema = z.object({
  id: z.string(),
  type: ItemTypeSchema.default('text'),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  externalId: z.string().optional(),
  creatorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Item = z.infer<typeof ItemSchema>;

const ComparisonSchema = z.object({
  id: z.string(),
  voterId: z.string().optional(),
  winnerId: z.string(),
  loserId: z.string(),
  skipped: z.boolean().optional(),
  createdAt: z.number(),
});
export type Comparison = z.infer<typeof ComparisonSchema>;

export type Algorithm = 'elo' | 'bradleyTerry';

const TierSchema = z.enum(['S', 'A', 'B', 'C', 'D']);
export type Tier = z.infer<typeof TierSchema>;

const BracketMatchSchema = z.object({
  id: z.string(),
  round: z.number(),
  aId: z.string().nullable(),
  bId: z.string().nullable(),
  winnerId: z.string().nullable(),
});
export type BracketMatch = z.infer<typeof BracketMatchSchema>;

const BracketSchema = z.object({
  seed: z.array(z.string()),
  matches: z.array(BracketMatchSchema),
  championId: z.string().nullable().optional(),
});
export type Bracket = z.infer<typeof BracketSchema>;

const VisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type Visibility = z.infer<typeof VisibilitySchema>;

const PhaseSchema = z.enum(['submission', 'voting']);
export type Phase = z.infer<typeof PhaseSchema>;

export const ListSchema = z.object({
  id: z.string(),
  ownerId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: VisibilitySchema.default('private'),
  phase: PhaseSchema.default('voting'),
  items: z.array(ItemSchema).default([]),
  comparisons: z.array(ComparisonSchema).default([]),
  algorithmDefault: z.enum(['elo', 'bradleyTerry']).default('elo'),
  tierAssignments: z.record(z.string(), TierSchema).default({}),
  directRatings: z.record(z.string(), z.number()).default({}),
  bracket: BracketSchema.nullable().default(null),
  archivedAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type RankList = z.infer<typeof ListSchema>;

export type Ranking = {
  itemId: string;
  rank: number;
  score: number;
  confidence: number;
  wins: number;
  losses: number;
  comparisons: number;
};
