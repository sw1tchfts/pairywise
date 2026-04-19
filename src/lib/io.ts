import { ListSchema, type RankList } from './types';

const EXPORT_VERSION = 1;

export type Exported = {
  format: 'pairywise-list';
  version: number;
  exportedAt: number;
  list: RankList;
};

export function exportList(list: RankList): Exported {
  return {
    format: 'pairywise-list',
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    list,
  };
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImport(raw: unknown): RankList {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid file format.');
  }
  const obj = raw as { format?: string; list?: unknown };
  if (obj.format !== 'pairywise-list') {
    throw new Error('Not a pairywise export file.');
  }
  const parsed = ListSchema.safeParse(obj.list);
  if (!parsed.success) {
    throw new Error('List data is malformed or from an incompatible version.');
  }
  return parsed.data;
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'list'
  );
}
