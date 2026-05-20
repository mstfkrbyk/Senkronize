import type { ReactElement } from 'react';

import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

interface Props {
  value: number | null | undefined;
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function StarRating({
  value,
  max = 5,
  size = 'sm',
  className,
}: Props): ReactElement {
  const rating = value ?? 0;
  const iconClass = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      title={value != null ? `${rating.toFixed(1)} / ${max}` : 'Henüz puan yok'}
      aria-label={value != null ? `Puan: ${rating.toFixed(1)}` : 'Puan yok'}
    >
      {Array.from({ length: max }, (_, i) => {
        const filled = rating >= i + 1;
        const half = !filled && rating > i && rating < i + 1;
        return (
          <Star
            key={i}
            className={cn(
              iconClass,
              filled || half
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/40',
            )}
            aria-hidden
          />
        );
      })}
      {value != null ? (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}
