import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  StockCountModeApi,
  StockCountSessionDetail,
} from '@/types/stock-count';

export function useStockCountSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['stock', 'count-session', sessionId],
    queryFn: async (): Promise<StockCountSessionDetail> => {
      const { data } = await api.get<{ data: StockCountSessionDetail }>(
        `/stock/count-sessions/${sessionId as string}`,
      );
      return data.data;
    },
    enabled: typeof sessionId === 'string' && sessionId.length > 0,
  });
}

export function useCreateStockCountSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      warehouseId: string;
      countMode: StockCountModeApi;
      filterBrand?: string;
      filterCategory?: string;
    }): Promise<{ id: string }> => {
      const { data } = await api.post<{ data: { id: string } }>(
        '/stock/count-sessions',
        payload,
      );
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useUpsertStockCountItem(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      barcode: string;
      countedQuantity: number;
    }): Promise<void> => {
      await api.post(
        `/stock/count-sessions/${sessionId as string}/items`,
        payload,
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['stock', 'count-session', sessionId],
      });
      await qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useApplyStockCountSession(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ applied: number }> => {
      const { data } = await api.post<{ success: true; applied: number }>(
        `/stock/count-sessions/${sessionId as string}/apply`,
        {},
      );
      return { applied: data.applied };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['stock', 'count-session', sessionId],
      });
      await qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useCancelStockCountSession(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/stock/count-sessions/${sessionId as string}/cancel`, {});
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['stock', 'count-session', sessionId],
      });
    },
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useExportStockCountPdf(sessionId: string | undefined) {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await api.get(
        `/stock/count-sessions/${sessionId as string}/export-pdf`,
        { responseType: 'blob' },
      );
      downloadBlob(
        new Blob([res.data as BlobPart], { type: 'application/pdf' }),
        `sayim-${(sessionId ?? 'form').slice(0, 8)}.pdf`,
      );
    },
  });
}

export function useImportStockCountCsv(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<{ imported: number; skipped: number }> => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<{
        data: { imported: number; skipped: number };
      }>(`/stock/count-sessions/${sessionId as string}/import-csv`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['stock', 'count-session', sessionId],
      });
      await qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
