import type { ReactElement } from 'react';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: TableSkeletonProps): ReactElement {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="bg-muted h-10 flex-1 animate-pulse rounded"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
