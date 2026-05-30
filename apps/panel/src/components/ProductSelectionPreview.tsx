import type { ReactElement } from 'react';
import { Warehouse } from 'lucide-react';

import {
  getProductSelectionMenuPreview,
  type ProductSelectionMenuPreview,
} from '@/lib/product-selection-preview';
import type { ProductSelection } from '@/lib/product-selection';
import { cn } from '@/lib/utils';

interface Props {
  selection: ProductSelection;
  className?: string;
}

function MenuGroupPreview({
  group,
}: {
  group: ProductSelectionMenuPreview['groups'][number];
}): ReactElement {
  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {group.title}
      </p>
      <ul className="mt-1.5 space-y-0.5" aria-label={`${group.title} menü öğeleri`}>
        {group.items.map((item) => {
          const isStock = group.stockInGroup && item === 'Stok';
          return (
            <li
              key={item}
              className={cn(
                'flex items-center gap-1.5 text-sm',
                isStock ? 'font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              {isStock ? (
                <Warehouse className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <span className="inline-block w-3.5 shrink-0" aria-hidden />
              )}
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProductSelectionPreview({
  selection,
  className,
}: Props): ReactElement {
  const preview = getProductSelectionMenuPreview(selection);

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3',
        className,
      )}
      role="region"
      aria-label="Menü önizlemesi"
    >
      <p className="text-sm font-medium text-foreground">Menü önizlemesi</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Kurulum sonrası kenar çubuğunda göreceğiniz gruplar (özet).
      </p>
      <div
        className={cn(
          'mt-3 grid gap-2',
          preview.groups.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {preview.groups.map((group) => (
          <MenuGroupPreview key={group.title} group={group} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{preview.stockNote}</p>
    </div>
  );
}
