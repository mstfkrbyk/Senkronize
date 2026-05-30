import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import { parseProductCost } from '@/lib/product-cost';
import type { ProductListItem } from '@/types/product';

function formatCostDisplay(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const n = parseProductCost(value);
  if (n <= 0) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function costToInput(value: unknown): string {
  const n = parseProductCost(value);
  return n > 0 ? String(n) : '';
}

interface Props {
  product: ProductListItem;
}

export function ProductInlineCostCell({ product }: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initial = costToInput(product.costPrice);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (!editing) {
      setValue(costToInput(product.costPrice));
    }
  }, [product.costPrice, editing]);

  const mutation = useMutation({
    mutationFn: async (costPrice: number) => {
      await api.patch(`/products/${product.id}`, { costPrice });
    },
    onSuccess: () => {
      toast.success(t('products.costSaved'));
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
      setValue(initial);
      setEditing(false);
    },
  });

  const persist = (): void => {
    const trim = value.trim();
    const n = trim === '' ? 0 : Number.parseFloat(trim.replace(',', '.'));
    if (trim !== '' && !Number.isFinite(n)) {
      setValue(initial);
      setEditing(false);
      return;
    }
    const normalized = Number.isFinite(n) ? Math.max(0, n) : 0;
    const current = parseProductCost(product.costPrice);
    if (normalized === current) {
      setEditing(false);
      return;
    }
    mutation.mutate(normalized);
  };

  if (!editing) {
    return (
      <TableCell
        className="cursor-pointer text-right text-sm tabular-nums"
        onClick={() => {
          setValue(costToInput(product.costPrice));
          setEditing(true);
        }}
      >
        {formatCostDisplay(product.costPrice)}
      </TableCell>
    );
  }

  return (
    <TableCell>
      <Input
        className="h-8 text-right tabular-nums"
        autoFocus
        inputMode="decimal"
        value={value}
        disabled={mutation.isPending}
        aria-label={t('products.cost')}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          persist();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            persist();
          }
          if (e.key === 'Escape') {
            setValue(initial);
            setEditing(false);
          }
        }}
      />
    </TableCell>
  );
}
