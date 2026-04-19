'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Item } from '@/lib/types';
import type { EloResult } from '@/lib/ranking/elo';

type Props = {
  items: Item[];
  rankings: EloResult[];
};

const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#65a30d',
  '#0d9488',
];

export function RatingHistoryChart({ items, rankings }: Props) {
  if (rankings.length === 0) return null;

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const topTen = rankings.slice(0, 10);

  const allSteps = new Set<number>([0]);
  for (const r of topTen) {
    for (const h of r.history) allSteps.add(h.index);
  }
  const steps = Array.from(allSteps).sort((a, b) => a - b);

  const historyById = new Map(
    topTen.map((r) => [r.itemId, new Map(r.history.map((h) => [h.index, h.rating]))]),
  );

  const data = steps.map((step) => {
    const row: Record<string, number> = { step };
    for (const r of topTen) {
      const v = historyById.get(r.itemId)!.get(step);
      if (v !== undefined) row[r.itemId] = v;
    }
    return row;
  });

  // forward-fill across rows so lines are continuous
  const lastSeen = new Map<string, number>();
  for (const row of data) {
    for (const r of topTen) {
      if (row[r.itemId] !== undefined) {
        lastSeen.set(r.itemId, row[r.itemId]);
      } else if (lastSeen.has(r.itemId)) {
        row[r.itemId] = lastSeen.get(r.itemId)!;
      }
    }
  }

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Rating history (top 10)</h3>
        <span className="text-xs text-foreground/50">ELO over time</span>
      </div>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis
              dataKey="step"
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              strokeOpacity={0.4}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              strokeOpacity={0.4}
              domain={['dataMin - 20', 'dataMax + 20']}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid rgba(128,128,128,0.3)',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(v) => `Vote #${v}`}
              formatter={(value, name) => {
                const item = typeof name === 'string' ? itemsById.get(name) : undefined;
                const num = typeof value === 'number' ? Math.round(value) : value;
                return [num as string | number, item?.title ?? String(name)];
              }}
            />
            {topTen.map((r, i) => (
              <Line
                key={r.itemId}
                type="monotone"
                dataKey={r.itemId}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {topTen.map((r, i) => {
          const item = itemsById.get(r.itemId);
          if (!item) return null;
          return (
            <li key={r.itemId} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate max-w-[160px]">{item.title}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
