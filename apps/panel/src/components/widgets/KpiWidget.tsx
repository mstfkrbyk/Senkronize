import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface KpiWidgetProps {
  title: string;
  value: string | number;
  change: number;
  changeCaption?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  href?: string;
  loading?: boolean;
}

const COLOR_RING: Record<KpiWidgetProps['color'], { ring: string; icon: string }> = {
  blue: {
    ring: 'ring-blue-100 dark:ring-blue-900/60',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    ring: 'ring-green-100 dark:ring-green-900/50',
    icon: 'text-green-600 dark:text-green-400',
  },
  red: {
    ring: 'ring-red-100 dark:ring-red-900/50',
    icon: 'text-red-600 dark:text-red-400',
  },
  yellow: {
    ring: 'ring-amber-100 dark:ring-amber-900/50',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  purple: {
    ring: 'ring-purple-100 dark:ring-purple-900/50',
    icon: 'text-purple-600 dark:text-purple-400',
  },
};

export function KpiWidget({
  title,
  value,
  change,
  changeCaption = 'önceki döneme göre',
  icon: Icon,
  color,
  href,
  loading = false,
}: KpiWidgetProps): ReactElement {
  const navigate = useNavigate();
  const tones = COLOR_RING[color];
  const positive = change >= 0;

  return (
    <Card
      className={cn(
        href &&
          'cursor-pointer transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      role={href ? 'button' : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={
        href
          ? (): void => {
              navigate(href);
            }
          : undefined
      }
      onKeyDown={
        href
          ? (e): void => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(href);
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
            <p className="text-2xl font-bold tabular-nums">{value}</p>
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
              <span>{changeCaption}</span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
