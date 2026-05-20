import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  BaBsReport,
  ELedgerReport,
  VatDeclarationReport,
} from '@/types/tax-report';

interface MonthArgs {
  periodKey: string;
  enabled?: boolean;
}

interface QuarterArgs {
  periodKey: string;
  enabled?: boolean;
}

export function useVatDeclaration({ periodKey, enabled = true }: MonthArgs) {
  return useQuery({
    queryKey: ['reports', 'tax', 'vat-declaration', periodKey],
    queryFn: async (): Promise<VatDeclarationReport> => {
      const { data } = await api.get<VatDeclarationReport>(
        '/reports/tax/vat-declaration',
        { params: { period: periodKey } },
      );
      return data;
    },
    enabled: enabled && /^\d{4}-\d{2}$/.test(periodKey),
  });
}

export function useELedger({ periodKey, enabled = true }: MonthArgs) {
  return useQuery({
    queryKey: ['reports', 'tax', 'e-ledger', periodKey],
    queryFn: async (): Promise<ELedgerReport> => {
      const { data } = await api.get<ELedgerReport>('/reports/tax/e-ledger', {
        params: { period: periodKey, format: 'json' },
      });
      return data;
    },
    enabled: enabled && /^\d{4}-\d{2}$/.test(periodKey),
  });
}

export function useBaBsReport({ periodKey, enabled = true }: QuarterArgs) {
  return useQuery({
    queryKey: ['reports', 'tax', 'ba-bs', periodKey],
    queryFn: async (): Promise<BaBsReport> => {
      const { data } = await api.get<BaBsReport>('/reports/tax/ba-bs', {
        params: { period: periodKey },
      });
      return data;
    },
    enabled: enabled && /^\d{4}-Q[1-4]$/i.test(periodKey),
  });
}

export async function downloadELedgerXml(periodKey: string): Promise<void> {
  const { data } = await api.get<ELedgerReport>('/reports/tax/e-ledger', {
    params: { period: periodKey, format: 'xml' },
  });
  const xml = data.payload ?? '';
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `e-defter-${periodKey}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadVatExcel(year: number, month: number): Promise<void> {
  const res = await api.get('/reports/vat/export', {
    params: { year, month, format: 'csv' },
    responseType: 'blob',
  });
  const monthPart = String(month).padStart(2, '0');
  const blob = new Blob([res.data as BlobPart], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kdv-raporu-${year}-${monthPart}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
