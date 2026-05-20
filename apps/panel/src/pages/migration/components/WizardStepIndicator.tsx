import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

import { WIZARD_STEPS } from '../migration.constants';

interface Props {
  currentStep: number;
}

export function WizardStepIndicator({ currentStep }: Props): ReactElement {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {WIZARD_STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const active = currentStep === stepNumber;
        const completed = currentStep > stepNumber;
        return (
          <li key={label} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            ) : null}
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-0.5',
                active && 'bg-accent/15 font-medium text-foreground',
                completed && 'text-foreground',
                !active && !completed && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-xs',
                  active && 'bg-accent text-accent-foreground',
                  completed && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                  !active && !completed && 'bg-muted text-muted-foreground',
                )}
              >
                {completed ? '✓' : stepNumber}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
