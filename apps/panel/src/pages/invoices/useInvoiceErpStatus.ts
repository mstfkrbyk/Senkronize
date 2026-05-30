import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useErpConnections } from '@/hooks/useErpConnections';
import { api } from '@/lib/api';
import type { AuditLogEntry } from '@/types/audit-log';

import { ERP_INVOICE_TYPES, type ErpInvoiceType } from './invoice-utils';

export type ErpSyncState = 'not_connected' | 'no_order' | 'pending' | 'sent';

export interface ErpInvoiceSyncInfo {
  erpType: ErpInvoiceType;
  state: ErpSyncState;
  invoiceNo?: string;
  connectionId?: string;
}

function buildOrderErpMap(
  logs: AuditLogEntry[],
): Map<string, Map<ErpInvoiceType, { invoiceNo: string; connectionId?: string }>> {
  const map = new Map<string, Map<ErpInvoiceType, { invoiceNo: string; connectionId?: string }>>();
  for (const entry of logs) {
    if (entry.action !== 'erp.invoice_created' || !entry.resourceId) {
      continue;
    }
    const erpType = entry.metadata?.erpType;
    if (typeof erpType !== 'string' || !ERP_INVOICE_TYPES.includes(erpType as ErpInvoiceType)) {
      continue;
    }
    const typed = erpType as ErpInvoiceType;
    const invoiceNo =
      typeof entry.metadata?.invoiceNo === 'string' ? entry.metadata.invoiceNo : undefined;
    if (!invoiceNo) {
      continue;
    }
    const connectionId =
      typeof entry.metadata?.erpConnectionId === 'string'
        ? entry.metadata.erpConnectionId
        : undefined;
    let perOrder = map.get(entry.resourceId);
    if (!perOrder) {
      perOrder = new Map();
      map.set(entry.resourceId, perOrder);
    }
    perOrder.set(typed, { invoiceNo, connectionId });
  }
  return map;
}

export function useInvoiceErpStatus(): {
  getErpStatusForInvoice: (orderId: string | null) => ErpInvoiceSyncInfo[];
  activeErpTypes: ErpInvoiceType[];
  isLoading: boolean;
  isExternalErp: boolean;
} {
  const { mode, isLoading: accountingModeLoading } = useAccountingMode();
  const isExternalErp = mode === 'EXTERNAL_ERP';

  const connectionsQuery = useErpConnections();

  const auditQuery = useQuery({
    queryKey: ['audit-log', 'erp-invoices'],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data } = await api.get<AuditLogEntry[]>('/audit-log', {
        params: { limit: 100, action: 'erp.invoice_created' },
      });
      return data;
    },
    enabled: isExternalErp,
    staleTime: 60_000,
  });

  const activeErpTypes = useMemo((): ErpInvoiceType[] => {
    const conns = connectionsQuery.data ?? [];
    return ERP_INVOICE_TYPES.filter((t) =>
      conns.some((c) => c.erpType === t && c.isActive),
    );
  }, [connectionsQuery.data]);

  const connectionByType = useMemo(() => {
    const m = new Map<ErpInvoiceType, string>();
    for (const c of connectionsQuery.data ?? []) {
      if (c.isActive && ERP_INVOICE_TYPES.includes(c.erpType as ErpInvoiceType)) {
        m.set(c.erpType as ErpInvoiceType, c.id);
      }
    }
    return m;
  }, [connectionsQuery.data]);

  const orderErpMap = useMemo(
    () => buildOrderErpMap(auditQuery.data ?? []),
    [auditQuery.data],
  );

  const getErpStatusForInvoice = (orderId: string | null): ErpInvoiceSyncInfo[] => {
    if (!isExternalErp) {
      return [];
    }
    return ERP_INVOICE_TYPES.map((erpType) => {
      const connectionId = connectionByType.get(erpType);
      if (!connectionId) {
        return { erpType, state: 'not_connected' as const };
      }
      if (!orderId) {
        return { erpType, state: 'no_order' as const, connectionId };
      }
      const synced = orderErpMap.get(orderId)?.get(erpType);
      if (synced) {
        return {
          erpType,
          state: 'sent' as const,
          invoiceNo: synced.invoiceNo,
          connectionId: synced.connectionId ?? connectionId,
        };
      }
      return { erpType, state: 'pending' as const, connectionId };
    });
  };

  return {
    getErpStatusForInvoice,
    activeErpTypes: isExternalErp ? activeErpTypes : [],
    isLoading:
      accountingModeLoading ||
      (isExternalErp && (connectionsQuery.isLoading || auditQuery.isLoading)),
    isExternalErp,
  };
}
