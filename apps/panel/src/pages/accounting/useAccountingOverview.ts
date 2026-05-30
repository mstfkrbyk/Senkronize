import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { InvoiceDto } from '@/types/invoice';

import type {
  AccountingOverview,
  AccountingOverviewResponse,
  AccountingRevenueTrend,
  AccountingRevenueTrendResponse,
} from './accounting-overview.types';

export const ACCOUNTING_RECENT_INVOICES_LIMIT = 5;
export const ACCOUNTING_REVENUE_TREND_MONTHS = 6;

export interface UseAccountingOverviewOptions {
  enabled?: boolean;
  includeRevenueTrend?: boolean;
  includeRecentInvoices?: boolean;
  revenueTrendMonths?: number;
  recentInvoicesLimit?: number;
}

export interface AccountingOverviewQueries {
  overview: UseQueryResult<AccountingOverview>;
  revenueTrend: UseQueryResult<AccountingRevenueTrend>;
  recentInvoices: UseQueryResult<InvoiceDto[]>;
}

function resolveOptions(
  options: UseAccountingOverviewOptions | boolean = true,
): Required<UseAccountingOverviewOptions> {
  if (typeof options === 'boolean') {
    return {
      enabled: options,
      includeRevenueTrend: false,
      includeRecentInvoices: false,
      revenueTrendMonths: ACCOUNTING_REVENUE_TREND_MONTHS,
      recentInvoicesLimit: ACCOUNTING_RECENT_INVOICES_LIMIT,
    };
  }

  return {
    enabled: options.enabled ?? true,
    includeRevenueTrend: options.includeRevenueTrend ?? false,
    includeRecentInvoices: options.includeRecentInvoices ?? false,
    revenueTrendMonths: options.revenueTrendMonths ?? ACCOUNTING_REVENUE_TREND_MONTHS,
    recentInvoicesLimit: options.recentInvoicesLimit ?? ACCOUNTING_RECENT_INVOICES_LIMIT,
  };
}

export function useAccountingOverview(
  options: UseAccountingOverviewOptions | boolean = true,
): AccountingOverviewQueries {
  const {
    enabled,
    includeRevenueTrend,
    includeRecentInvoices,
    revenueTrendMonths,
    recentInvoicesLimit,
  } = resolveOptions(options);

  const overview = useQuery({
    queryKey: ['accounting', 'overview'],
    queryFn: async (): Promise<AccountingOverview> => {
      const { data } = await api.get<AccountingOverviewResponse>('/accounting/overview');
      return data.data;
    },
    enabled,
  });

  const revenueTrend = useQuery({
    queryKey: ['accounting', 'revenue-trend', revenueTrendMonths],
    queryFn: async (): Promise<AccountingRevenueTrend> => {
      const { data } = await api.get<AccountingRevenueTrendResponse>('/accounting/revenue-trend', {
        params: { months: revenueTrendMonths },
      });
      return data.data;
    },
    enabled: enabled && includeRevenueTrend,
  });

  const recentInvoices = useQuery({
    queryKey: ['invoices', 'recent', recentInvoicesLimit],
    queryFn: async (): Promise<InvoiceDto[]> => {
      const { data } = await api.get<{ items: InvoiceDto[]; total: number }>('/invoices', {
        params: { page: 1, limit: recentInvoicesLimit },
      });
      return data.items;
    },
    enabled: enabled && includeRecentInvoices,
  });

  return { overview, revenueTrend, recentInvoices };
}
