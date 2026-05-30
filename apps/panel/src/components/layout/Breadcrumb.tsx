import type { ReactElement } from 'react';
import { Fragment, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import {
  BREADCRUMB_DYNAMIC_PARENTS,
  BREADCRUMB_LABELS,
} from '@/constants/breadcrumb-routes';
import { useBreadcrumbContext } from '@/contexts/breadcrumb.context';
import { isConnectionDetailPath } from '@/lib/connection-detail-nav';
import { useActiveNav } from '@/hooks/useActiveNav';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BuildItemsParams {
  pathname: string;
  tailLabel: string | null;
  groupLabel: string | undefined;
  pageLabel: string | undefined;
}

function buildItems({
  pathname,
  tailLabel,
  groupLabel,
  pageLabel,
}: BuildItemsParams): BreadcrumbItem[] {
  const withGroup = (segments: BreadcrumbItem[]): BreadcrumbItem[] => {
    if (!groupLabel) {
      return segments;
    }
    return [{ label: groupLabel }, ...segments];
  };

  if (pathname === '/' || pathname === '/dashboard') {
    const label = pageLabel ?? BREADCRUMB_LABELS['/dashboard'] ?? 'Gösterge Paneli';
    return withGroup([{ label }]);
  }

  if (pathname.startsWith('/settings/') && pathname !== '/settings') {
    const leafLabel = tailLabel ?? BREADCRUMB_LABELS[pathname];
    if (leafLabel) {
      return withGroup([
        {
          label: BREADCRUMB_LABELS['/settings'] ?? 'Ayarlar',
          href: '/settings',
        },
        { label: leafLabel },
      ]);
    }
  }

  if (pathname === '/products/import') {
    return withGroup([
      {
        label: BREADCRUMB_LABELS['/products'] ?? 'Ürünler',
        href: '/products',
      },
      { label: BREADCRUMB_LABELS['/products/import'] ?? 'İçe aktar' },
    ]);
  }

  if (pathname === '/customers/segments') {
    return withGroup([
      {
        label: BREADCRUMB_LABELS['/customers'] ?? 'Müşteriler',
        href: '/customers',
      },
      { label: BREADCRUMB_LABELS['/customers/segments'] ?? 'Segmentler' },
    ]);
  }

  const exact = BREADCRUMB_LABELS[pathname];
  if (exact) {
    return withGroup([{ label: tailLabel ?? pageLabel ?? exact }]);
  }

  if (isConnectionDetailPath(pathname)) {
    const tail =
      tailLabel ??
      (pathname.split('/').pop()?.length
        ? `#${pathname.split('/').pop()!.slice(0, 8)}…`
        : pathname);
    return withGroup([{ label: tail }]);
  }

  for (const dyn of BREADCRUMB_DYNAMIC_PARENTS) {
    if (dyn.pattern.test(pathname)) {
      return withGroup([
        { label: dyn.parentLabel, href: dyn.parentPath },
        {
          label:
            tailLabel ??
            (pathname.split('/').pop()?.length
              ? `#${pathname.split('/').pop()!.slice(0, 8)}…`
              : pathname),
        },
      ]);
    }
  }

  const parts = pathname.split('/').filter(Boolean);
  let acc = '';
  const pathSegments: BreadcrumbItem[] = [];
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const label = BREADCRUMB_LABELS[acc];
    if (label) {
      const isLast = i === parts.length - 1;
      pathSegments.push({
        label: isLast && tailLabel ? tailLabel : label,
        href: isLast ? undefined : acc,
      });
    }
  }

  if (pathSegments.length > 0) {
    return withGroup(pathSegments);
  }

  if (pageLabel) {
    return withGroup([{ label: tailLabel ?? pageLabel }]);
  }

  if (parts.length > 0) {
    return withGroup([
      {
        label: tailLabel ?? parts[parts.length - 1] ?? pathname,
      },
    ]);
  }

  return withGroup([{ label: tailLabel ?? pathname }]);
}

export function Breadcrumb({ className }: { className?: string }): ReactElement | null {
  const location = useLocation();
  const { tailLabel } = useBreadcrumbContext();
  const { groupLabel, pageLabel } = useActiveNav();

  const items = useMemo(
    () =>
      buildItems({
        pathname: location.pathname,
        tailLabel,
        groupLabel,
        pageLabel,
      }),
    [location.pathname, tailLabel, groupLabel, pageLabel],
  );

  if (
    items.length <= 1 &&
    !groupLabel &&
    (location.pathname === '/' || location.pathname === '/dashboard')
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Sayfa konumu"
      className={cn('flex min-w-0 flex-wrap items-center gap-1 text-sm', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            ) : null}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'truncate',
                  isLast ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
