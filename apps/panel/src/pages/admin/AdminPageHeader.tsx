import type { ReactElement, ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** Üstte « Geri » bağlantısı (detay sayfaları) */
  backLink?: { to: string; label: string };
  /** Varsayılan: gösterge paneli dışındaki sayfalarda üst bağlantı gösterilir */
  showBreadcrumbParent?: boolean;
  /** İkinci breadcrumb (örn. organizasyon listesi) */
  breadcrumbParent?: { label: string; to: string };
  /** Başlık altında rozetler veya ek özet */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  backLink,
  showBreadcrumbParent,
  breadcrumbParent,
  meta,
  actions,
  className,
}: AdminPageHeaderProps): ReactElement {
  const { t } = useTranslation();
  const adminHomeLabel = t('admin.nav.dashboard');
  const showParent = showBreadcrumbParent ?? title !== adminHomeLabel;

  usePageTitle(title);

  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="space-y-2">
        {backLink ? (
          <Link
            to={backLink.to}
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            {backLink.label}
          </Link>
        ) : null}
        <nav
          aria-label={t('admin.pageHeader.breadcrumbAria')}
          className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          {showParent ? (
            <>
              <Link
                to="/admin"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {adminHomeLabel}
              </Link>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </>
          ) : null}
          {breadcrumbParent ? (
            <>
              <Link
                to={breadcrumbParent.to}
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {breadcrumbParent.label}
              </Link>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </>
          ) : null}
          <span className="font-medium text-slate-700">{title}</span>
        </nav>
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-col gap-2">{actions}</div> : null}
    </div>
  );
}
