import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import {
  formatPartnerNavContext,
  resolvePartnerSubPageTitle,
} from '@/lib/partner-nav-context';
import { cn } from '@/lib/utils';

export interface PartnerPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PartnerPageHeader({
  title,
  description,
  actions,
  className,
}: PartnerPageHeaderProps): ReactElement {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const pageLabel = resolvePartnerSubPageTitle(pathname, t);
  const contextLine = formatPartnerNavContext(pageLabel, t);

  const heading = (
    <div>
      <p className="text-sm text-muted-foreground">{contextLine}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">{title}</h1>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );

  if (actions) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-end justify-between gap-4',
          className,
        )}
      >
        {heading}
        {actions}
      </div>
    );
  }

  return <div className={className}>{heading}</div>;
}
