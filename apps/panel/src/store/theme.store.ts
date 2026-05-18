import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'senkronize-theme';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Sistem renk şeması değişince (ör. macOS koyu/açık) aboneleri bilgilendirir + DOM sınıfını günceller */
let prefersDarkMql: MediaQueryList | null = null;
const systemSchemeSubscribers = new Set<() => void>();

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

function dispatchSystemSchemeSubscribers(): void {
  for (const cb of systemSchemeSubscribers) {
    cb();
  }
}

function onPrefersColorSchemeChange(): void {
  if (useThemeStore.getState().theme === 'system') {
    applyTheme('system');
  }
  dispatchSystemSchemeSubscribers();
}

function ensurePrefersColorSchemeListener(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (prefersDarkMql) {
    return;
  }
  prefersDarkMql = window.matchMedia('(prefers-color-scheme: dark)');
  prefersDarkMql.addEventListener('change', onPrefersColorSchemeChange);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);

export function initTheme(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const theme: Theme = raw
      ? ((JSON.parse(raw) as { state?: { theme?: Theme } }).state?.theme ?? 'system')
      : 'system';
    applyTheme(theme);
  } catch {
    applyTheme('system');
  }
  ensurePrefersColorSchemeListener();
}

export function subscribeResolvedTheme(listener: () => void): () => void {
  ensurePrefersColorSchemeListener();
  const unsubStore = useThemeStore.subscribe(listener);
  systemSchemeSubscribers.add(listener);
  return () => {
    unsubStore();
    systemSchemeSubscribers.delete(listener);
  };
}

export function getResolvedTheme(): 'light' | 'dark' {
  const theme = useThemeStore.getState().theme;
  if (theme === 'dark') {
    return 'dark';
  }
  if (theme === 'light') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
