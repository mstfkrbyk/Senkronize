import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type { AccountingBulkResult } from '@/types/accounting';
import type { InvoiceDto } from '@/types/invoice';

import { invoicesT } from './translations';

function showBulkToast(result: AccountingBulkResult, successKey: string): void {
  if (result.failed > 0 && result.success > 0) {
    toast.warning(
      invoicesT('bulk.partialSuccess', {
        success: String(result.success),
        failed: String(result.failed),
      }),
    );
    return;
  }
  if (result.failed > 0) {
    const first = result.errors[0]?.message;
    toast.error(first ?? getApiErrorMessage(new Error('bulk_failed')));
    return;
  }
  toast.success(invoicesT(successKey, { count: String(result.success) }));
}

export function countBulkIssueEligible(items: InvoiceDto[], selectedIds: Set<string>): number {
  return items.filter((inv) => selectedIds.has(inv.id) && inv.status === 'DRAFT').length;
}

export function countBulkMarkPaidEligible(items: InvoiceDto[], selectedIds: Set<string>): number {
  return items.filter(
    (inv) =>
      selectedIds.has(inv.id) &&
      (inv.status === 'SENT' || inv.status === 'OVERDUE'),
  ).length;
}

export function idsBulkIssueEligible(items: InvoiceDto[], selectedIds: Set<string>): string[] {
  return items
    .filter((inv) => selectedIds.has(inv.id) && inv.status === 'DRAFT')
    .map((inv) => inv.id);
}

export function idsBulkMarkPaidEligible(items: InvoiceDto[], selectedIds: Set<string>): string[] {
  return items
    .filter(
      (inv) =>
        selectedIds.has(inv.id) &&
        (inv.status === 'SENT' || inv.status === 'OVERDUE'),
    )
    .map((inv) => inv.id);
}

interface UseInvoicesBulkActionsOptions {
  onSettled?: () => void;
}

export function useInvoicesBulkActions({ onSettled }: UseInvoicesBulkActionsOptions = {}): {
  issueMutation: ReturnType<typeof useMutation<AccountingBulkResult, unknown, string[]>>;
  markPaidMutation: ReturnType<typeof useMutation<AccountingBulkResult, unknown, string[]>>;
} {
  const queryClient = useQueryClient();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['invoices', 'list-meta'] });
    void queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };

  const issueMutation = useMutation({
    mutationFn: async (invoiceIds: string[]): Promise<AccountingBulkResult> => {
      const { data } = await api.post<{ data: AccountingBulkResult }>(
        '/accounting/invoices/bulk/issue',
        { invoiceIds },
      );
      return data.data;
    },
    onSuccess: (result) => {
      showBulkToast(result, 'bulk.issueSuccess');
      invalidate();
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
    onSettled,
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceIds: string[]): Promise<AccountingBulkResult> => {
      const { data } = await api.post<{ data: AccountingBulkResult }>(
        '/accounting/invoices/bulk/mark-paid',
        { invoiceIds },
      );
      return data.data;
    },
    onSuccess: (result) => {
      showBulkToast(result, 'bulk.markPaidSuccess');
      invalidate();
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
    onSettled,
  });

  return { issueMutation, markPaidMutation };
}
