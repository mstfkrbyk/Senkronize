import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { CreditCard, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { Textarea } from '@/components/ui/textarea';
import { adminPartnerPayoutStatusLabel } from '@/lib/admin-i18n-labels';
import { getApiErrorMessage } from '@/lib/api';
import type { AdminPartnerPayoutRequest, AdminPartnerPayoutStatus } from '@/types/admin';

import {
  useAdminPartnerPayoutRequests,
  useApproveAdminPartnerPayout,
  useRejectAdminPartnerPayout,
} from '@/pages/partner/hooks/usePartnerLink';
import { formatTry } from '@/pages/partner/partner-utils';

function payoutStatusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') {
    return 'default';
  }
  if (status === 'REJECTED') {
    return 'destructive';
  }
  return 'secondary';
}

interface Props {
  onPartnerFocus?: (partnerOrgId: string) => void;
}

export function AdminPartnerPayoutRequestsSection({
  onPartnerFocus,
}: Props): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const [statusFilter, setStatusFilter] = useState<AdminPartnerPayoutStatus | 'all'>(
    'PENDING',
  );
  const [approveRow, setApproveRow] = useState<AdminPartnerPayoutRequest | null>(null);
  const [rejectRow, setRejectRow] = useState<AdminPartnerPayoutRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryStatus = statusFilter === 'all' ? undefined : statusFilter;
  const { data, isLoading, isFetching, isError, error, refetch } =
    useAdminPartnerPayoutRequests(queryStatus);
  const approve = useApproveAdminPartnerPayout();
  const reject = useRejectAdminPartnerPayout();
  const rows = data ?? [];

  const handleApproveConfirm = (): void => {
    if (!approveRow) {
      return;
    }
    const id = approveRow.id;
    setBusyId(id);
    approve.mutate(id, {
      onSuccess: () => {
        toast.success(t('admin.pages.partnerPayouts.toast.approved'));
        setApproveRow(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
      onSettled: () => setBusyId(null),
    });
  };

  const handleRejectSubmit = (): void => {
    if (!rejectRow) {
      return;
    }
    const note = rejectNote.trim();
    const id = rejectRow.id;
    setBusyId(id);
    reject.mutate(
      { id, note: note.length > 0 ? note : undefined },
      {
        onSuccess: () => {
          toast.success(t('admin.pages.partnerPayouts.toast.rejected'));
          setRejectRow(null);
          setRejectNote('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('admin.pages.partnerPayouts.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('admin.pages.partnerPayouts.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as AdminPartnerPayoutStatus | 'all')
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">
                {t('admin.pages.partnerPayouts.filterPending')}
              </SelectItem>
              <SelectItem value="APPROVED">
                {t('admin.pages.partnerPayouts.filterApproved')}
              </SelectItem>
              <SelectItem value="REJECTED">
                {t('admin.pages.partnerPayouts.filterRejected')}
              </SelectItem>
              <SelectItem value="all">{t('admin.pages.partnerPayouts.filterAll')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw
              className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden
            />
            {t('admin.common.refresh')}
          </Button>
        </div>
      </div>

      {isLoading ? <TableSkeleton rows={5} cols={5} /> : null}

      {isError ? (
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : !isLoading && rows.length === 0 ? (
        <AdminListEmptyState
          hasActiveFilters={statusFilter !== 'PENDING'}
          emptyTitle={
            statusFilter === 'PENDING'
              ? t('admin.pages.partnerPayouts.emptyPending')
              : t('admin.pages.partnerPayouts.emptyFiltered')
          }
          icon={CreditCard}
        />
      ) : !isLoading ? (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.pages.partnerPayouts.table.partner')}</TableHead>
              <TableHead>{t('admin.pages.partnerPayouts.table.date')}</TableHead>
              <TableHead className="text-right">
                {t('admin.pages.partnerPayouts.table.amount')}
              </TableHead>
              <TableHead>{t('admin.pages.partnerPayouts.table.status')}</TableHead>
              <TableHead className="text-right">
                {t('admin.pages.partnerPayouts.table.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const created = new Date(row.createdAt);
              const isPending = row.status === 'PENDING';
              const isBusy = busyId === row.id;
              const partnerLabel = row.partnerName ?? row.partnerOrgId;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {onPartnerFocus ? (
                      <button
                        type="button"
                        className="font-medium hover:text-sky-700 hover:underline"
                        title={t('admin.pages.partnerPayouts.viewPartner', {
                          name: partnerLabel,
                        })}
                        onClick={() => onPartnerFocus(row.partnerOrgId)}
                      >
                        {partnerLabel}
                      </button>
                    ) : (
                      <span className="font-medium">{partnerLabel}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {Number.isNaN(created.getTime())
                      ? emDash
                      : format(created, 'd MMM yyyy HH:mm', { locale: tr })}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatTry(row.amountTRY)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={payoutStatusVariant(row.status)}>
                      {adminPartnerPayoutStatusLabel(row.status, t)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isPending ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy || approve.isPending || reject.isPending}
                          onClick={() => setApproveRow(row)}
                        >
                          {t('admin.pages.partnerPayouts.approve')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy || approve.isPending || reject.isPending}
                          onClick={() => {
                            setRejectRow(row);
                            setRejectNote('');
                          }}
                        >
                          {t('admin.pages.partnerPayouts.reject')}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{emDash}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      ) : null}

      <AlertDialog open={approveRow != null} onOpenChange={() => setApproveRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.pages.partnerPayouts.approveDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approveRow
                ? t('admin.pages.partnerPayouts.approveDialog.description', {
                    partner: approveRow.partnerName ?? approveRow.partnerOrgId,
                    amount: formatTry(approveRow.amountTRY),
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('admin.common.dismiss')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={approve.isPending}
              onClick={handleApproveConfirm}
            >
              {t('admin.pages.partnerPayouts.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={rejectRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectRow(null);
            setRejectNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pages.partnerPayouts.rejectDialog.title')}</DialogTitle>
            {rejectRow ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.pages.partnerPayouts.rejectDialog.summary', {
                  partner: rejectRow.partnerName ?? rejectRow.partnerOrgId,
                  amount: formatTry(rejectRow.amountTRY),
                })}
              </p>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payout-reject-note">
              {t('admin.partner.payout.rejectNote')}
            </Label>
            <Textarea
              id="payout-reject-note"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder={t('admin.pages.partnerPayouts.rejectDialog.notePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectRow(null);
                setRejectNote('');
              }}
            >
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reject.isPending}
              onClick={handleRejectSubmit}
            >
              {t('admin.pages.partnerPayouts.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
