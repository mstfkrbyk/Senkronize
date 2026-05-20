import type { ReactElement } from 'react';

import { CheckCircle2, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface TrackingTimelineStep {
  status: string;
  date: string;
  done: boolean;
}

interface Props {
  steps: TrackingTimelineStep[];
  className?: string;
}

export function TrackingTimeline({ steps, className }: Props): ReactElement {
  return (
    <ul className={cn('relative space-y-0', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const Icon = step.done ? CheckCircle2 : Circle;
        return (
          <li key={`${step.status}-${String(index)}`} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  'absolute left-[7px] top-5 h-[calc(100%-12px)] w-px',
                  step.done ? 'bg-green-600/60 dark:bg-green-500/50' : 'bg-border',
                )}
                aria-hidden
              />
            ) : null}
            <Icon
              className={cn(
                'relative z-10 mt-0.5 h-4 w-4 shrink-0',
                step.done
                  ? 'text-green-600 dark:text-green-500'
                  : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1 pt-px">
              <p
                className={cn(
                  'text-sm',
                  step.done ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.status}
              </p>
              {step.date.trim().length > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{step.date}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
