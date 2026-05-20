import type { LucideIcon } from 'lucide-react';
import { PackageOpen } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** Lucide dışı ikonlar veya özel boyut için */
  iconNode?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; href: string };
  /** `action` yerine tam kontrol (ör. çoklu buton) */
  actionSlot?: ReactNode;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  iconNode,
  title,
  description,
  action,
  secondaryAction,
  actionSlot,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      {iconNode ?? (
        <Icon
          className="h-12 w-12 text-muted-foreground"
          aria-hidden
          focusable={false}
        />
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {actionSlot ??
        (action || secondaryAction ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action ? (
              <Button type="button" variant="default" onClick={action.onClick}>
                {action.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button type="button" variant="outline" asChild>
                <Link to={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
        ) : null)}
    </div>
  );
}
