import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className }: Props): ReactElement {
  return (
    <div className={cn('overflow-x-auto -mx-4 md:mx-0', className)}>
      <div
        className={cn(
          'min-w-full',
          '[&>div]:overflow-visible',
          '[&_table]:min-w-full',
          '[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-10 [&_th:first-child]:bg-card',
          '[&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-card',
        )}
      >
        {children}
      </div>
    </div>
  );
}
