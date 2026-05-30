import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  useErpConnections,
  type ErpConnectionDto,
} from '@/hooks/useErpConnections';
import { api } from '@/lib/api';
import type { SyncLogEntry } from '@/types/sync-log';

import {
  buildErpTransferReportSummary,
  type ErpTransferReportSummary,
} from './erp-transfer-report.utils';

const ERP_SYNC_LOG_LIMIT = 50;

export interface ErpTransferReportData {
  connections: ErpConnectionDto[];
  logs: SyncLogEntry[];
  summary: ErpTransferReportSummary;
  connectionsQuery: ReturnType<typeof useErpConnections>;
  logsQuery: UseQueryResult<SyncLogEntry[], Error>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useErpTransferReport(): ErpTransferReportData {
  const connectionsQuery = useErpConnections();

  const logsQuery = useQuery({
    queryKey: ['erp-transfer-sync-logs', ERP_SYNC_LOG_LIMIT],
    queryFn: async (): Promise<SyncLogEntry[]> => {
      const params = new URLSearchParams({
        jobTypeStartsWith: 'erp:',
        limit: String(ERP_SYNC_LOG_LIMIT),
      });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });

  const connections = useMemo(
    () => connectionsQuery.data ?? [],
    [connectionsQuery.data],
  );
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data]);

  const summary = useMemo(
    () => buildErpTransferReportSummary(connections, logs),
    [connections, logs],
  );

  const isLoading = connectionsQuery.isLoading || logsQuery.isLoading;
  const isError = connectionsQuery.isError || logsQuery.isError;
  const error = connectionsQuery.error ?? logsQuery.error ?? null;

  return {
    connections,
    logs,
    summary,
    connectionsQuery,
    logsQuery,
    isLoading,
    isError,
    error,
  };
}
