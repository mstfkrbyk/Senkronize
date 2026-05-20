const STORAGE_KEY = 'senkronize-recent-views';
const MAX_RECENT = 5;

export type RecentViewType = 'order' | 'product';

export interface RecentView {
  type: RecentViewType;
  id: string;
  label: string;
  href: string;
  viewedAt: number;
}

function loadAll(): RecentView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentView);
  } catch {
    return [];
  }
}

function isRecentView(v: unknown): v is RecentView {
  if (v === null || typeof v !== 'object') {
    return false;
  }
  const o = v as Record<string, unknown>;
  return (
    (o.type === 'order' || o.type === 'product') &&
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.href === 'string' &&
    typeof o.viewedAt === 'number'
  );
}

function saveAll(views: RecentView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_RECENT * 2)));
}

export function getRecentViews(type?: RecentViewType): RecentView[] {
  const all = loadAll();
  const filtered = type ? all.filter((v) => v.type === type) : all;
  return filtered.slice(0, MAX_RECENT);
}

export function recordRecentView(view: Omit<RecentView, 'viewedAt'>): void {
  const key = `${view.type}:${view.id}`;
  const current = loadAll().filter((v) => `${v.type}:${v.id}` !== key);
  saveAll([{ ...view, viewedAt: Date.now() }, ...current]);
}
