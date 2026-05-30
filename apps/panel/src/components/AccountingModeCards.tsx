import type { ReactElement } from 'react';
import { Check, Cloud, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ACCOUNTING_MODE_OPTIONS } from '@/lib/accounting-mode-options';
import type { AccountingMode } from '@/types/auth';
import { cn } from '@/lib/utils';

const MODE_ICONS: Record<AccountingMode, LucideIcon> = {
  NATIVE: Receipt,
  EXTERNAL_ERP: Cloud,
};

interface Props {
  value: AccountingMode | null;
  onChange: (value: AccountingMode) => void;
  className?: string;
}

export function AccountingModeCards({
  value,
  onChange,
  className,
}: Props): ReactElement {
  return (
    <div
      className={cn('grid gap-3 sm:grid-cols-1', className)}
      role="radiogroup"
      aria-label="Muhasebe yönetim yeri"
    >
      {ACCOUNTING_MODE_OPTIONS.map((option) => {
        const selected = value === option.id;
        const Icon = MODE_ICONS[option.id];
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
                  <span className="font-semibold leading-tight">{option.title}</span>
                  {selected ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{option.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
