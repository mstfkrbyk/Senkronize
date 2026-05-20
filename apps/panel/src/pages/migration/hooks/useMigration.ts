import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  MigrationExecuteResponse,
  MigrationHistoryItem,
  MigrationPreviewResponse,
  MigrationStatusResponse,
  MigrationUploadResponse,
  MigrationValidationResult,
} from '@/types/migration';
import type { MigrationDataType, MigrationSourceFormat } from '@/types/migration';

const MIGRATION_QUERY_KEY = ['migration'] as const;

export function useMigrationHistory() {
  return useQuery({
    queryKey: [...MIGRATION_QUERY_KEY, 'history'],
    queryFn: async (): Promise<MigrationHistoryItem[]> => {
      const { data } = await api.get<MigrationHistoryItem[]>('/migration/history');
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useMigrationPreview(sessionId: string | null) {
  return useQuery({
    queryKey: [...MIGRATION_QUERY_KEY, 'preview', sessionId],
    queryFn: async (): Promise<MigrationPreviewResponse> => {
      const { data } = await api.get<MigrationPreviewResponse>(
        `/migration/sessions/${sessionId}/preview`,
      );
      return data;
    },
    enabled: Boolean(sessionId),
  });
}

export function useMigrationStatus(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...MIGRATION_QUERY_KEY, 'status', sessionId],
    queryFn: async (): Promise<MigrationStatusResponse> => {
      const { data } = await api.get<MigrationStatusResponse>(
        `/migration/sessions/${sessionId}/status`,
      );
      return data;
    },
    enabled: Boolean(sessionId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'processing' || status === 'queued') {
        return 2000;
      }
      return false;
    },
  });
}

export function useMigrationUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File;
      dataType: MigrationDataType;
      sourceFormat: MigrationSourceFormat;
    }): Promise<MigrationUploadResponse> => {
      const body = new FormData();
      body.append('file', params.file);
      const { data } = await api.post<MigrationUploadResponse>(
        '/migration/upload',
        body,
        {
          params: {
            dataType: params.dataType,
            sourceFormat: params.sourceFormat,
          },
        },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MIGRATION_QUERY_KEY });
    },
  });
}

export function useMigrationMapColumns() {
  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      columnMapping: Record<string, string>;
    }): Promise<void> => {
      await api.post(`/migration/sessions/${params.sessionId}/map`, {
        columnMapping: params.columnMapping,
      });
    },
  });
}

export function useMigrationValidate() {
  return useMutation({
    mutationFn: async (sessionId: string): Promise<MigrationValidationResult> => {
      const { data } = await api.post<MigrationValidationResult>(
        `/migration/sessions/${sessionId}/validate`,
      );
      return data;
    },
  });
}

export function useMigrationExecute() {
  return useMutation({
    mutationFn: async (sessionId: string): Promise<MigrationExecuteResponse> => {
      const { data } = await api.post<MigrationExecuteResponse>(
        `/migration/sessions/${sessionId}/execute`,
      );
      return data;
    },
  });
}

export async function downloadMigrationErrors(sessionId: string): Promise<void> {
  const res = await api.get<Blob>(`/migration/sessions/${sessionId}/errors`, {
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `migration-hatalar-${sessionId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
