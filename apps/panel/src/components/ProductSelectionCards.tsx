import type { ReactElement } from 'react';
import { Check, Package, Plug, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ProductSelectionPreview } from '@/components/ProductSelectionPreview';
import {
  PRODUCT_SELECTION_OPTIONS,
  type ProductSelection,
} from '@/lib/product-selection';
import { cn } from '@/lib/utils';

const PRODUCT_ICONS: Record<ProductSelection, LucideIcon> = {
  ACCOUNTING: Receipt,
  INTEGRATION: Plug,
  BUNDLE: Package,
};

interface Props {
  value: ProductSelection | null;
  onChange: (value: ProductSelection) => void;
  className?: string;
}

export function ProductSelectionCards({
  value,
  onChange,
  className,
}: Props): ReactElement {
  return (
    <div className={cn('space-y-4', className)}>
      <div
        className="grid gap-3 sm:grid-cols-1"
        role="radiogroup"
        aria-label="Ürün seçimi"
      >
      {PRODUCT_SELECTION_OPTIONS.map((option) => {
        const selected = value === option.id;
        const Icon = PRODUCT_ICONS[option.id];
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'relative rounded-lg border bg-card p-4 text-left transition-all',
              selected
                ? 'border-2 border-primary shadow-sm ring-2 ring-primary/20'
                : 'border-border hover:border-primary/40',
              option.recommended && !selected && 'bg-sky-50/50 dark:bg-sky-950/20',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
                  selected
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold leading-tight">{option.title}</span>
                    {option.discountLabel ? (
                      <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        {option.discountLabel}
                      </span>
                    ) : null}
                    {option.recommended ? (
                      <span className="inline-flex rounded-full bg-sky-400 px-2 py-0.5 text-xs font-medium text-slate-900">
                        Önerilen
                      </span>
                    ) : null}
                  </div>
                  {selected ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{option.description}</p>
                <ul className="mt-3 space-y-1.5">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          selected ? 'text-primary' : 'text-muted-foreground/70',
                        )}
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        );
      })}
      </div>
      {value ? <ProductSelectionPreview selection={value} /> : null}
    </div>
  );
}
