import { useCallback, useSyncExternalStore } from 'react';

import type { GlobalSearchHit } from '@/types/search';

const HISTORY_KEY = 'senkronize-search-history';
const CLICKED_KEY = 'senkronize-search-clicked';
const MAX_TERMS = 10;
const MAX_CLICKED = 10;

export interface SearchHistoryClicked {
  hit: GlobalSearchHit;
  clickedAt: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadTerms(): string[] {
  const parsed = readJson<unknown>(HISTORY_KEY, []);
  return Array.isArray(parsed)
    ? parsed.filter((x): x is string => typeof x === 'string')
    : [];
}

function loadClicked(): SearchHistoryClicked[] {
  const parsed = readJson<unknown>(CLICKED_KEY, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isClickedEntry);
}

function isClickedEntry(v: unknown): v is SearchHistoryClicked {
  if (v === null || typeof v !== 'object') {
    return false;
  }
  const o = v as Record<string, unknown>;
  const hit = o.hit;
  if (hit === null || typeof hit !== 'object') {
    return false;
  }
  const h = hit as Record<string, unknown>;
  return (
    typeof o.clickedAt === 'number' &&
    typeof h.id === 'string' &&
    typeof h.label === 'string' &&
    typeof h.href === 'string' &&
    (h.type === 'product' || h.type === 'order' || h.type === 'listing')
  );
}

let termsSnapshot = loadTerms();
let clickedSnapshot = loadClicked();
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const l of listeners) {
    l();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function refreshSnapshots(): void {
  termsSnapshot = loadTerms();
  clickedSnapshot = loadClicked();
}

export function useSearchHistory(): {
  terms: string[];
  clicked: SearchHistoryClicked[];
  addTerm: (term: string) => void;
  addClicked: (hit: GlobalSearchHit) => void;
  removeTerm: (term: string) => void;
  clearTerms: () => void;
} {
  const terms = useSyncExternalStore(subscribe, () => termsSnapshot, () => []);
  const clicked = useSyncExternalStore(subscribe, () => clickedSnapshot, () => []);

  const addTerm = useCallback((term: string): void => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      return;
    }
    const next = [trimmed, ...loadTerms().filter((x) => x !== trimmed)].slice(
      0,
      MAX_TERMS,
    );
    writeJson(HISTORY_KEY, next);
    refreshSnapshots();
    emitChange();
  }, []);

  const addClicked = useCallback((hit: GlobalSearchHit): void => {
    const key = `${hit.type}:${hit.id}`;
    const filtered = loadClicked().filter(
      (c) => `${c.hit.type}:${c.hit.id}` !== key,
    );
    const next: SearchHistoryClicked[] = [
      { hit, clickedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_CLICKED);
    writeJson(CLICKED_KEY, next);
    refreshSnapshots();
    emitChange();
  }, []);

  const removeTerm = useCallback((term: string): void => {
    const next = loadTerms().filter((x) => x !== term);
    writeJson(HISTORY_KEY, next);
    refreshSnapshots();
    emitChange();
  }, []);

  const clearTerms = useCallback((): void => {
    writeJson(HISTORY_KEY, []);
    refreshSnapshots();
    emitChange();
  }, []);

  return { terms, clicked, addTerm, addClicked, removeTerm, clearTerms };
}
