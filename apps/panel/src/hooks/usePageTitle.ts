import { useEffect } from 'react';

const APP_NAME = 'Senkronize';

export interface UsePageTitleOptions {
  /** Bildirim sayısı — başlıkta (3) öneki gösterilir */
  badgeCount?: number;
}

function formatTitle(pageTitle: string, badgeCount?: number): string {
  if (!pageTitle) {
    return APP_NAME;
  }
  const count =
    badgeCount !== undefined && badgeCount > 0 ? `(${badgeCount}) ` : '';
  return `${count}${pageTitle} | ${APP_NAME}`;
}

export function usePageTitle(
  title: string,
  options?: UsePageTitleOptions,
): void {
  const badgeCount = options?.badgeCount;

  useEffect(() => {
    document.title = formatTitle(title, badgeCount);
    return (): void => {
      document.title = APP_NAME;
    };
  }, [title, badgeCount]);
}
