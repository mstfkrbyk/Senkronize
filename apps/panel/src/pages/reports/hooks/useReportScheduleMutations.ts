import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type { ScheduledCustomReportItem } from '@/types/custom-report';
import type {
  ReportScheduleFormat,
  ReportScheduleFrequencyUi,
  ReportScheduleItem,
  ReportScheduleType,
  UnifiedReportSchedule,
} from '@/types/report';

const DISABLED_KEY = 'senkronize:disabled-standard-schedules';

function readDisabledIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISABLED_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function writeDisabledIds(ids: Set<string>): void {
  localStorage.setItem(DISABLED_KEY, JSON.stringify([...ids]));
}

export function mapStandardSchedules(
  items: ReportScheduleItem[],
): UnifiedReportSchedule[] {
  const disabled = readDisabledIds();
  return items.map((item) => {
    const reportType: ReportScheduleType =
      item.reportKind === 'PROFIT'
        ? 'PROFIT'
        : item.reportKind === 'SALES'
          ? 'SALES'
          : 'CUSTOM';
    const frequency: ReportScheduleFrequencyUi =
      item.frequency === 'WEEKLY' ? 'WEEKLY' : 'MONTHLY';
    return {
      id: item.id,
      source: 'standard',
      reportType,
      frequency,
      format: 'PDF',
      emails: item.emails,
      lastRunAt: item.lastRunAt,
      isActive: item.emails.length > 0 && !disabled.has(`standard:${item.id}`),
    };
  });
}

export function mapCustomSchedules(
  items: ScheduledCustomReportItem[],
): UnifiedReportSchedule[] {
  const disabled = readDisabledIds();
  return items.map((item) => {
    const freq = item.schedule.frequency ?? 'weekly';
    const frequency: ReportScheduleFrequencyUi =
      freq === 'daily' ? 'DAILY' : freq === 'monthly' ? 'MONTHLY' : 'WEEKLY';
    const fmt = item.schedule.format ?? 'csv';
    return {
      id: item.id,
      source: 'custom',
      reportType: 'CUSTOM',
      frequency,
      format: fmt === 'csv' ? 'EXCEL' : 'PDF',
      emails: item.schedule.emails,
      lastRunAt: item.lastRunAt,
      isActive: item.schedule.emails.length > 0 && !disabled.has(`custom:${item.id}`),
      name: item.name,
    };
  });
}

interface CreateScheduleInput {
  reportType: ReportScheduleType;
  frequency: ReportScheduleFrequencyUi;
  format: ReportScheduleFormat;
  emails: string[];
  name?: string;
}

function mapFrequencyToStandard(
  frequency: ReportScheduleFrequencyUi,
): 'WEEKLY' | 'MONTHLY' {
  return frequency === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY';
}

function mapFrequencyToCustom(
  frequency: ReportScheduleFrequencyUi,
): 'daily' | 'weekly' | 'monthly' {
  if (frequency === 'DAILY') {
    return 'daily';
  }
  if (frequency === 'MONTHLY') {
    return 'monthly';
  }
  return 'weekly';
}

export function useCreateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScheduleInput): Promise<void> => {
      const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()))].filter(
        Boolean,
      );
      if (emails.length === 0) {
        throw new Error('En az bir e-posta adresi girin.');
      }

      if (input.reportType === 'SALES' || input.reportType === 'PROFIT') {
        await api.post('/reports/schedule', {
          reportKind: input.reportType === 'PROFIT' ? 'PROFIT' : 'SALES',
          frequency: mapFrequencyToStandard(input.frequency),
          emails,
        });
        return;
      }

      const metrics =
        input.reportType === 'VAT'
          ? (['revenue', 'profit_margin'] as const)
          : (['revenue', 'orders'] as const);

      await api.post('/reports/schedule', {
        name:
          input.name ??
          (input.reportType === 'VAT' ? 'KDV raporu' : 'Özel rapor'),
        report: {
          metrics: [...metrics],
          dimensions: ['platform'],
          period: '30d',
        },
        emails,
        frequency: mapFrequencyToCustom(input.frequency),
        format: input.format === 'PDF' ? 'json' : 'csv',
      });
    },
    onSuccess: () => {
      toast.success('Rapor zamanlaması kaydedildi.');
      void queryClient.invalidateQueries({ queryKey: ['reports', 'schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useToggleReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      item,
      active,
    }: {
      item: UnifiedReportSchedule;
      active: boolean;
    }): Promise<void> => {
      const disabled = readDisabledIds();
      const key = `${item.source}:${item.id}`;
      if (active) {
        disabled.delete(key);
      } else {
        disabled.add(key);
      }
      writeDisabledIds(disabled);
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.active ? 'Zamanlama etkinleştirildi.' : 'Zamanlama duraklatıldı.',
      );
      void queryClient.invalidateQueries({ queryKey: ['reports', 'schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}
