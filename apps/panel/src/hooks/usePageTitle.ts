import { useEffect } from 'react';

import { useActiveNav } from '@/hooks/useActiveNav';

const APP_NAME = 'Senkronize';

export interface UsePageTitleOptions {
  /** Bildirim sayısı — başlıkta (3) öneki gösterilir */
  badgeCount?: number;
}

function formatTitle(
  pageTitle: string,
  groupLabel: string | undefined,
  badgeCount?: number,
): string {
  if (!pageTitle) {
    return APP_NAME;
  }
  const count =
    badgeCount !== undefined && badgeCount > 0 ? `(${badgeCount}) ` : '';
  const page = `${count}${pageTitle}`;
  if (groupLabel) {
    return `${page} | ${groupLabel} | ${APP_NAME}`;
  }
  return `${page} | ${APP_NAME}`;
}

export function usePageTitle(
  title: string,
  options?: UsePageTitleOptions,
): void {
  const badgeCount = options?.badgeCount;
  const { groupLabel } = useActiveNav();

  useEffect(() => {
    document.title = formatTitle(title, groupLabel, badgeCount);
    return (): void => {
      document.title = APP_NAME;
    };
  }, [title, groupLabel, badgeCount]);
}
