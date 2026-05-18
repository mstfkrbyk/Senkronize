import type { LucideIcon } from 'lucide-react';
import { PackageOpen } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Lucide dışı ikonlar veya özel boyut için */
  iconNode?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** `action` yerine tam kontrol (ör. çoklu buton) */
  actionSlot?: ReactNode;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  iconNode,
  title,
  description,
  action,
  actionSlot,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
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
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionSlot ??
        (action ? (
          <Button type="button" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null)}
    </div>
  );
}
