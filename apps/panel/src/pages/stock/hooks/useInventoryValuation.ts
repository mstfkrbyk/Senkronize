import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useAccountingMode } from '@/hooks/useAccountingMode';
import { api } from '@/lib/api';
import { hasOrgProductLine } from '@/lib/org-products';
import { useAuthStore } from '@/store/auth.store';

import type {
  AccountingInventoryValuation,
  AccountingInventoryValuationResponse,
} from '../accounting-inventory-valuation.types';

interface Args {
  warehouseId?: string;
  /** Ek koşul; yerel ön muhasebe dışında sorgu çalışmaz */
  enabled?: boolean;
}

/** Ön muhasebe (NATIVE) + ACCOUNTING ürün hattı */
export function useNativeInventoryValuationEnabled(): {
  enabled: boolean;
  isLoading: boolean;
} {
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode, isLoading: accountingModeLoading } = useAccountingMode();
  const enabled = useMemo(
    () => hasOrgProductLine(orgProducts, 'ACCOUNTING') && mode === 'NATIVE',
    [orgProducts, mode],
  );
  return { enabled, isLoading: accountingModeLoading };
}

export function useInventoryValuation({
  warehouseId,
  enabled: callerEnabled = true,
}: Args = {}): UseQueryResult<AccountingInventoryValuation, Error> {
  const { enabled: nativeEnabled, isLoading: accountingModeLoading } =
    useNativeInventoryValuationEnabled();

  return useQuery<AccountingInventoryValuation, Error>({
    queryKey: ['accounting', 'inventory-valuation', warehouseId ?? 'all'],
    queryFn: async (): Promise<AccountingInventoryValuation> => {
      const { data } = await api.get<AccountingInventoryValuationResponse>(
        '/accounting/inventory-valuation',
        {
          params: warehouseId ? { warehouseId } : undefined,
        },
      );
      return data.data;
    },
    enabled: nativeEnabled && callerEnabled && !accountingModeLoading,
  });
}
