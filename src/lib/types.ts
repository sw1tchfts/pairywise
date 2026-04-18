import { z } from 'zod';

export const ItemTypeSchema = z.enum([
  'text',
  'image',
  'url',
  'tmdb',
  'spotify',
  'youtube',
  'media',
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemSchema = z.object({
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
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const ComparisonSchema = z.object({
  id: z.string(),
  winnerId: z.string(),
  loserId: z.string(),
  skipped: z.boolean().optional(),
  createdAt: z.number(),
});
export type Comparison = z.infer<typeof ComparisonSchema>;

export type Algorithm = 'elo' | 'bradleyTerry';

export const ListSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  items: z.array(ItemSchema).default([]),
  comparisons: z.array(ComparisonSchema).default([]),
  algorithmDefault: z.enum(['elo', 'bradleyTerry']).default('elo'),
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
