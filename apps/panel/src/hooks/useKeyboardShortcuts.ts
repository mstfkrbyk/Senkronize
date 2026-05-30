import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { openCommandPalette } from '@/lib/command-palette';
import { useUiStore } from '@/store/ui.store';

const SEQUENCE_SHORTCUTS: Record<string, string> = {
  'g d': '/dashboard',
  'g o': '/orders',
  'g p': '/products',
  'g s': '/products?tab=status',
  'g r': '/reports',
  'g c': '/connections',
  'g l': '/listings',
  'g f': '/pricing',
  'g m': '/migration',
  'n o': '/orders',
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

function refetchCurrentPage(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.refetchQueries({ type: 'active' });
}

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setShortcutsHelpOpen = useUiStore((s) => s.setShortcutsHelpOpen);

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent): void => {
      if (e.repeat) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openCommandPalette();
        buffer = '';
        clearTimeout(timer);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        buffer = '';
        clearTimeout(timer);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        refetchCurrentPage(queryClient);
        buffer = '';
        clearTimeout(timer);
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
        openCommandPalette();
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

      const route = SEQUENCE_SHORTCUTS[buffer];
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
  }, [navigate, queryClient, setShortcutsHelpOpen]);
}

export {
  COMMAND_PALETTE_EVENT,
  GLOBAL_SEARCH_EVENT,
  openCommandPalette,
  openGlobalSearch,
} from '@/lib/command-palette';
