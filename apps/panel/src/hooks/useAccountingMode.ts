import { useMemo } from 'react';
import { type UseQueryResult } from '@tanstack/react-query';

import {
  countActiveErpConnections,
  resolveAccountingMode,
} from '@/lib/accounting-mode';
import { hasOrgProductLine } from '@/lib/org-products';
import type { AccountingMode } from '@/types/auth';
import { useAuthStore } from '@/store/auth.store';
import { useErpConnections, type ErpConnectionDto } from './useErpConnections';

export interface UseAccountingModeResult {
  mode: AccountingMode;
  isLoading: boolean;
  hasActiveErpConnection: boolean;
  activeErpConnectionCount: number;
}

function hasBackendAccountingMode(
  mode: AccountingMode | undefined,
): mode is AccountingMode {
  return mode === 'NATIVE' || mode === 'EXTERNAL_ERP';
}

export function useAccountingMode(): UseAccountingModeResult {
  const org = useAuthStore((s) => s.currentOrg);
  const orgProducts = org?.orgProducts;
  const orgAccountingMode = org?.accountingMode;

  const needsErpProbe =
    hasOrgProductLine(orgProducts, 'ACCOUNTING') ||
    hasOrgProductLine(orgProducts, 'INTEGRATION');

  const erpQuery: UseQueryResult<ErpConnectionDto[], Error> = useErpConnections();
  const { data: connections, isLoading: erpLoading } = erpQuery;

  const activeCount = useMemo(
    () => countActiveErpConnections(connections),
    [connections],
  );

  const mode = useMemo(
    () => resolveAccountingMode(orgAccountingMode, activeCount),
    [orgAccountingMode, activeCount],
  );

  const needsModeFallback =
    needsErpProbe && !hasBackendAccountingMode(orgAccountingMode);

  return {
    mode,
    isLoading: needsModeFallback && erpLoading,
    hasActiveErpConnection: activeCount > 0,
    activeErpConnectionCount: activeCount,
  };
}
