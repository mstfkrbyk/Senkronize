import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'senkronize-theme';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
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
}

export function subscribeResolvedTheme(listener: () => void): () => void {
  const unsubStore = useThemeStore.subscribe(listener);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', listener);
  return () => {
    unsubStore();
    mq.removeEventListener('change', listener);
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
