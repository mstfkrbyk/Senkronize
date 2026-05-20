import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { TableHead } from '@/components/ui/table';

export type SortDirection = 'asc' | 'desc' | null;

interface Props {
  label: ReactNode;
  sortDirection: SortDirection;
  onSort?: () => void;
  className?: string;
}

function ariaSortValue(direction: SortDirection): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') {
    return 'ascending';
  }
  if (direction === 'desc') {
    return 'descending';
  }
  return 'none';
}

export function SortableTableHead({
  label,
  sortDirection,
  onSort,
  className,
}: Props): ReactElement {
  const sortable = Boolean(onSort);

  if (!sortable) {
    return <TableHead className={className}>{label}</TableHead>;
  }

  return (
    <TableHead className={className} aria-sort={ariaSortValue(sortDirection)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 font-medium hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        onClick={onSort}
        aria-label={
          sortDirection === 'asc'
            ? `${String(label)} — artan, sıralamayı değiştir`
            : sortDirection === 'desc'
              ? `${String(label)} — azalan, sıralamayı değiştir`
              : `${String(label)} — sırala`
        }
      >
        {label}
        <span className="sr-only">
          {sortDirection === 'asc'
            ? '(artan)'
            : sortDirection === 'desc'
              ? '(azalan)'
              : '(sıralanmamış)'}
        </span>
      </button>
    </TableHead>
  );
}
