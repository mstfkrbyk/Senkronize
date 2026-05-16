import type { ReactElement } from 'react';
import { useState } from 'react';

import { ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useLowStock } from './hooks/useStock';

export function LowStockAlert(): ReactElement | null {
  const { data, isLoading, isError } = useLowStock(10);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || isError) {
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const count = data.length;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden
          />
          <div>
            <p className="font-medium">
              {count} ürünün stok seviyesi kritik
            </p>
            <p className="mt-1 text-sm text-amber-900/90">
              Eşik: 10 adet ve altı. Detayları görmek için genişletin.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-400 bg-background text-amber-950 hover:bg-amber-100"
          onClick={() => {
            setExpanded((v) => !v);
          }}
        >
          {expanded ? (
            <>
              Daralt <ChevronUp className="ml-1 h-4 w-4" aria-hidden />
            </>
          ) : (
            <>
              Genişlet <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
      {expanded ? (
        <ul className="mt-3 space-y-2 border-t border-amber-200/80 pt-3 text-sm">
          {data.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <span className="font-medium">
                {row.product?.name ?? row.barcode}
              </span>
              <span className="font-mono text-xs text-amber-900/80">
                {row.barcode} · {row.availableQty} kullanılabilir
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
