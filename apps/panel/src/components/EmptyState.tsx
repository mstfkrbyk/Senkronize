import type { LucideIcon } from 'lucide-react';
import { PackageOpen } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <Icon
        className="h-12 w-12 text-muted-foreground"
        aria-hidden
        focusable={false}
      />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <Button type="button" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
