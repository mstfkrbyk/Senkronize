import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'red';
  loading?: boolean;
  onClick?: () => void;
}

const COLOR_RING: Record<KpiCardProps['color'], { ring: string; icon: string }> = {
  blue: {
    ring: 'ring-blue-100 dark:ring-blue-900/60',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    ring: 'ring-green-100 dark:ring-green-900/50',
    icon: 'text-green-600 dark:text-green-400',
  },
  yellow: {
    ring: 'ring-amber-100 dark:ring-amber-900/50',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    ring: 'ring-red-100 dark:ring-red-900/50',
    icon: 'text-red-600 dark:text-red-400',
  },
};

function formatDisplayValue(value: number | string): string {
  if (typeof value === 'string') {
    return value;
  }
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = 'geçen haftaya göre',
  icon: Icon,
  color,
  loading = false,
  onClick,
}: KpiCardProps): ReactElement {
  const tones = COLOR_RING[color];
  const numericValue = typeof value === 'number' ? value : 0;
  const animated = useCountUp(loading ? 0 : numericValue);
  const display =
    loading ? '—' : typeof value === 'string' ? value : formatDisplayValue(animated);
  const positive = change === undefined || change >= 0;

  return (
    <Card
      className={cn(
        onClick &&
          'cursor-pointer transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e): void => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn('rounded-full bg-background p-2 ring-2', tones.ring)}>
          <Icon className={cn('h-4 w-4', tones.icon)} aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums">{display}</p>
            {change !== undefined ? (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {positive ? (
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-green-600 dark:text-green-400"
                    aria-hidden
                  />
                ) : (
                  <ArrowDownRight
                    className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    positive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {positive ? '+' : ''}
                  {String(change)}%
                </span>
                <span>{changeLabel}</span>
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
