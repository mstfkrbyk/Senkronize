import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUiStore } from '@/store/ui.store';

const QUICK_SEARCH_EVENT = 'senkronize-open-quick-search';

const SHORTCUTS: Record<string, string> = {
  'g d': '/dashboard',
  'g o': '/orders',
  'g l': '/listings',
  'g s': '/stock',
  'g p': '/products',
  'g f': '/pricing',
  'g r': '/reports',
  'g c': '/connections',
  'g m': '/migration',
  '?': '?help',
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
    return true;
  }
  return target.isContentEditable;
}

export function openQuickSearchFromShortcut(): void {
  window.dispatchEvent(new CustomEvent(QUICK_SEARCH_EVENT));
}

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();
  const setShortcutsHelpOpen = useUiStore((s) => s.setShortcutsHelpOpen);

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent): void => {
      if (e.repeat) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (isEditableTarget(e.target)) {
        return;
      }
      if (useUiStore.getState().shortcutsHelpOpen) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        openQuickSearchFromShortcut();
        buffer = '';
        clearTimeout(timer);
        return;
      }

      if (e.key === 'Escape') {
        buffer = '';
        clearTimeout(timer);
        return;
      }

      const ch = e.key.length === 1 ? e.key.toLowerCase() : null;
      if (!ch) {
        return;
      }

      buffer += (buffer ? ' ' : '') + ch;
      clearTimeout(timer);
      timer = setTimeout(() => {
        buffer = '';
      }, 1000);

      const route = SHORTCUTS[buffer];
      if (route) {
        buffer = '';
        clearTimeout(timer);
        e.preventDefault();
        if (route === '?help') {
          setShortcutsHelpOpen(true);
        } else {
          navigate(route);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(timer);
    };
  }, [navigate, setShortcutsHelpOpen]);
}
