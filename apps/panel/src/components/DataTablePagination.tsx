import type { ReactElement } from 'react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

interface Props {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  /** Klavye okları için odak gerektirmesin */
  enableKeyboardNav?: boolean;
}

export function DataTablePagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  enableKeyboardNav = true,
}: Props): ReactElement {
  useEffect(() => {
    if (!enableKeyboardNav) {
      return undefined;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (page < totalPages) {
          onPageChange(page + 1);
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (page > 1) {
          onPageChange(page - 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return (): void => {
      window.removeEventListener('keydown', onKey);
    };
  }, [enableKeyboardNav, page, totalPages, onPageChange]);

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          {start} – {end} / {total} kayıt gösteriliyor
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="page-size" className="text-sm text-muted-foreground whitespace-nowrap">
              Sayfa başına
            </Label>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                onLimitChange(Number(v));
              }}
            >
              <SelectTrigger id="page-size" className="h-9 w-[88px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {String(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2"
                  disabled={page <= 1}
                  aria-label="İlk sayfa"
                  onClick={() => {
                    onPageChange(1);
                  }}
                >
                  «
                </Button>
              </TooltipTrigger>
              <TooltipContent>İlk sayfa</TooltipContent>
            </Tooltip>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                onPageChange(Math.max(1, page - 1));
              }}
            >
              Önceki
            </Button>
            <span className="px-2 text-sm text-muted-foreground tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                onPageChange(Math.min(totalPages, page + 1));
              }}
            >
              Sonraki
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2"
                  disabled={page >= totalPages}
                  aria-label="Son sayfa"
                  onClick={() => {
                    onPageChange(totalPages);
                  }}
                >
                  »
                </Button>
              </TooltipTrigger>
              <TooltipContent>Son sayfa</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Klavye: ← → sayfa
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
