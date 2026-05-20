import type { ReactElement } from 'react';
import { Fragment, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import {
  BREADCRUMB_DYNAMIC_PARENTS,
  BREADCRUMB_LABELS,
} from '@/constants/breadcrumb-routes';
import { useBreadcrumbContext } from '@/contexts/breadcrumb.context';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function buildItems(pathname: string, tailLabel: string | null): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: 'Gösterge Paneli', href: '/dashboard' },
  ];

  if (pathname === '/' || pathname === '/dashboard') {
    return [{ label: 'Gösterge Paneli' }];
  }

  const exact = BREADCRUMB_LABELS[pathname];
  if (exact) {
    items.push({ label: exact });
    return items;
  }

  for (const dyn of BREADCRUMB_DYNAMIC_PARENTS) {
    if (dyn.pattern.test(pathname)) {
      items.push({ label: dyn.parentLabel, href: dyn.parentPath });
      const segment = pathname.split('/').pop() ?? '';
      const tail =
        tailLabel ??
        (segment.length > 12 ? `#${segment.slice(0, 8)}…` : segment);
      items.push({ label: tail });
      return items;
    }
  }

  const parts = pathname.split('/').filter(Boolean);
  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const label = BREADCRUMB_LABELS[acc];
    if (label) {
      const isLast = i === parts.length - 1;
      items.push({
        label: isLast && tailLabel ? tailLabel : label,
        href: isLast ? undefined : acc,
      });
    }
  }

  if (items.length === 1 && parts.length > 0) {
    items.push({
      label: tailLabel ?? parts[parts.length - 1] ?? pathname,
    });
  }

  return items;
}

export function Breadcrumb({ className }: { className?: string }): ReactElement | null {
  const location = useLocation();
  const { tailLabel } = useBreadcrumbContext();

  const items = useMemo(
    () => buildItems(location.pathname, tailLabel),
    [location.pathname, tailLabel],
  );

  if (items.length <= 1 && location.pathname === '/dashboard') {
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
