import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  ReportConfig,
  ReportResult,
  SavedReportListItem,
} from '@/types/custom-report';

export function useSavedReportsList(): ReturnType<
  typeof useQuery<SavedReportListItem[], Error>
> {
  return useQuery({
    queryKey: ['reports', 'saved'],
    queryFn: async (): Promise<SavedReportListItem[]> => {
      const { data } = await api.get<SavedReportListItem[]>('/reports/saved');
      return data;
    },
  });
}

export function useRunCustomReport(): ReturnType<
  typeof useMutation<
    ReportResult,
    Error,
    { config: ReportConfig; preview?: boolean }
  >
> {
  return useMutation({
    mutationFn: async (input: { config: ReportConfig; preview?: boolean }) => {
      const { data } = await api.post<ReportResult>('/reports/run', {
        config: input.config,
        preview: input.preview === true,
      });
      return data;
    },
  });
}

export function useSaveCustomReport(): ReturnType<
  typeof useMutation<
    SavedReportListItem,
    Error,
    { name: string; description?: string; reportType: ReportConfig['reportType']; config: ReportConfig }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await api.post<SavedReportListItem>('/reports/saved', body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'saved'] });
    },
  });
}

export function useDeleteSavedReport(): ReturnType<
  typeof useMutation<void, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reports/saved/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'saved'] });
    },
  });
}

export function useRunSavedReport(): ReturnType<
  typeof useMutation<ReportResult, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ReportResult>(`/reports/saved/${id}/run`);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'saved'] });
    },
  });
}

export function useUpdateReportSchedule(): ReturnType<
  typeof useMutation<
    SavedReportListItem,
    Error,
    {
      id: string;
      emails: string[];
      frequency: 'daily' | 'weekly';
      format?: 'csv' | 'json';
    }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, emails, frequency, format }) => {
      const { data } = await api.patch<SavedReportListItem>(
        `/reports/saved/${id}/schedule`,
        { emails, frequency, format: format ?? 'csv' },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'saved'] });
    },
  });
}

export async function downloadSavedReportExport(
  id: string,
  format: 'csv' | 'json',
): Promise<void> {
  const res = await api.get<Blob>(`/reports/saved/${id}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapor.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
