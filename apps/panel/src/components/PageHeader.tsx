import type { ReactElement, ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Breadcrumb tarzı üst bağlam (opsiyonel) */
  context?: string;
  /** Başlık yanında rozet veya etiket (ör. muhasebe modu) */
  badges?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  context,
  badges,
}: Props): ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-0.5 min-w-0">
        {context ? (
          <p className="text-xs text-muted-foreground">{context}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {badges}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
