import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { normalizeAdminPartnerLinkRequestsList } from '@/lib/admin-api-normalize';
import { adminPartnerLinkStatusLabel } from '@/lib/admin-i18n-labels';
import { getApiErrorMessage } from '@/lib/api';
import { partnerLinkStatusBadgeVariant } from '@/lib/partner-link-status';
import type { TFunction } from 'i18next';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import {
  useAdminPartnerLinkRequests,
  useApprovePartnerLinkRequest,
  useRejectPartnerLinkRequest,
} from '@/pages/partner/hooks/usePartnerLink';
import type { AdminPartnerLinkRequest } from '@/types/admin';

function formatLinkRequestDate(value: string, empty: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return empty;
  }
  return format(d, 'd MMM yyyy HH:mm', { locale: tr });
}

/** Müşteri talep notu; teknik enum/API kodlarını göstermez. */
function partnerLinkRequestNote(message: string | null | undefined): string | null {
  const text = message?.trim();
  if (!text) {
    return null;
  }
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) {
    return null;
  }
  return text;
}

function RequestTable({
  rows,
  showActions,
  onApprove,
  onReject,
  busyId,
  t,
  emDash,
}: {
  rows: AdminPartnerLinkRequest[];
  showActions: boolean;
  onApprove: (row: AdminPartnerLinkRequest) => void;
  onReject: (row: AdminPartnerLinkRequest) => void;
  busyId: string | null;
  t: TFunction;
  emDash: string;
}): ReactElement {
  if (rows.length === 0) {
    return (
      <AdminListEmptyState
        hasActiveFilters={false}
        emptyTitle={t('admin.common.listEmpty.partnerLinks')}
        emptyDescription={t('admin.pages.partnerLinks.empty')}
        icon={Link2}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[42%]">{t('admin.pages.partnerLinks.table.client')}</TableHead>
          <TableHead className="w-[42%]">{t('admin.pages.partnerLinks.table.partner')}</TableHead>
          <TableHead>{t('admin.pages.partnerLinks.table.date')}</TableHead>
          {showActions ? (
            <TableHead className="text-right">{t('admin.pages.partnerLinks.table.actions')}</TableHead>
          ) : (
            <TableHead>{t('admin.pages.partnerLinks.table.status')}</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const requestNote = partnerLinkRequestNote(row.message);
          return (
          <TableRow key={row.id}>
            <TableCell className="align-top">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="font-medium">{row.clientOrg?.name ?? emDash}</p>
                <p className="text-xs text-muted-foreground">
                  @{row.clientOrg?.slug ?? emDash}
                </p>
                {requestNote ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t('admin.pages.partnerLinks.requestNote')}{' '}
                    </span>
                    {requestNote}
                  </p>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="align-top">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="font-medium">{row.partnerOrg?.name ?? emDash}</p>
                <p className="text-xs text-muted-foreground">
                  @{row.partnerOrg?.slug ?? emDash}
                </p>
              </div>
            </TableCell>
            <TableCell className="align-top whitespace-nowrap text-muted-foreground">
              {formatLinkRequestDate(row.requestedAt, emDash)}
              {!showActions ? (
                <div className="mt-2">
                  <Badge variant={partnerLinkStatusBadgeVariant(row.status)}>
                    {adminPartnerLinkStatusLabel(row.status, t)}
                  </Badge>
                  {row.adminNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">{row.adminNote}</p>
                  ) : null}
                </div>
              ) : null}
            </TableCell>
            {showActions ? (
              <TableCell className="space-x-2 text-right align-top">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => onApprove(row)}
                >
                  {busyId === row.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    t('admin.pages.partnerLinks.approve')
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === row.id}
                  onClick={() => onReject(row)}
                >
                  {t('admin.pages.partnerLinks.reject')}
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}

export function AdminPartnerLinksPage(): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const pending = useAdminPartnerLinkRequests('PENDING');
  const historyApproved = useAdminPartnerLinkRequests('APPROVED');
  const historyRejected = useAdminPartnerLinkRequests('REJECTED');
  const approve = useApprovePartnerLinkRequest();
  const reject = useRejectPartnerLinkRequest();
  const [rejectRow, setRejectRow] = useState<AdminPartnerLinkRequest | null>(null);
  const [approveRow, setApproveRow] = useState<AdminPartnerLinkRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingRows = normalizeAdminPartnerLinkRequestsList(pending.data);
  const history = [
    ...normalizeAdminPartnerLinkRequestsList(historyApproved.data),
    ...normalizeAdminPartnerLinkRequestsList(historyRejected.data),
  ].sort((a, b) => {
    const bTime = new Date(b.reviewedAt ?? b.requestedAt).getTime();
    const aTime = new Date(a.reviewedAt ?? a.requestedAt).getTime();
    const bMs = Number.isNaN(bTime) ? 0 : bTime;
    const aMs = Number.isNaN(aTime) ? 0 : aTime;
    return bMs - aMs;
  });

  const loading =
    pending.isLoading || historyApproved.isLoading || historyRejected.isLoading;
  const loadError =
    pending.error ?? historyApproved.error ?? historyRejected.error;
  const pendingCount = pendingRows.length;

  const retryLoad = (): void => {
    void pending.refetch();
    void historyApproved.refetch();
    void historyRejected.refetch();
  };

  const handleApproveConfirm = (): void => {
    if (!approveRow) {
      return;
    }
    const id = approveRow.id;
    setBusyId(id);
    approve.mutate(id, {
      onSuccess: () => {
        toast.success(t('admin.pages.partnerLinks.toast.approved'));
        setApproveRow(null);
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
      onSettled: () => setBusyId(null),
    });
  };

  const rejectReasonTrimmed = rejectNote.trim();
  const rejectReasonValid = rejectReasonTrimmed.length >= 10;

  const handleRejectSubmit = (): void => {
    if (!rejectRow) return;
    if (!rejectReasonValid) {
      toast.error(t('admin.partner.linkRequest.rejectReasonMinLength'));
      return;
    }
    setBusyId(rejectRow.id);
    reject.mutate(
      { id: rejectRow.id, note: rejectReasonTrimmed },
      {
        onSuccess: () => {
          toast.success(t('admin.pages.partnerLinks.toast.rejected'));
          setRejectRow(null);
          setRejectNote('');
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.partnerLinks.title')}
        description={t('admin.pages.partnerLinks.description')}
      />

      {loading ? <TableSkeleton rows={6} cols={4} /> : null}

      {loadError ? (
        <QueryErrorAlert error={loadError} onRetry={retryLoad} />
      ) : !loading ? (
        <Card>
          <CardContent className="pt-6">
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              {t('admin.pages.partnerLinks.tabs.pending')}
              {pendingCount > 0 ? (
                <Badge className="ml-2 border-0 bg-sky-500 text-white hover:bg-sky-500">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="history">{t('admin.pages.partnerLinks.tabs.history')}</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <RequestTable
              rows={pendingRows}
              showActions
              busyId={busyId}
              t={t}
              emDash={emDash}
              onApprove={(row) => setApproveRow(row)}
              onReject={(row) => {
                setRejectRow(row);
                setRejectNote('');
              }}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <RequestTable
              rows={history}
              showActions={false}
              busyId={busyId}
              t={t}
              emDash={emDash}
              onApprove={() => undefined}
              onReject={() => undefined}
            />
          </TabsContent>
        </Tabs>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={approveRow != null} onOpenChange={() => setApproveRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.pages.partnerLinks.approveDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {approveRow
                ? t('admin.pages.partnerLinks.approveDialog.description', {
                    client: approveRow.clientOrg?.name ?? emDash,
                    partner: approveRow.partnerOrg?.name ?? emDash,
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
              {t('admin.pages.partnerLinks.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectRow != null} onOpenChange={() => setRejectRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pages.partnerLinks.rejectDialog.title')}</DialogTitle>
            {rejectRow ? (
              <p className="text-sm text-muted-foreground">
                {rejectRow.clientOrg?.name ?? emDash} → {rejectRow.partnerOrg?.name ?? emDash}
              </p>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">{t('admin.partner.linkRequest.rejectReason')}</Label>
            <Textarea
              id="reject-note"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder={t('admin.pages.partnerLinks.rejectDialog.notePlaceholder')}
              minLength={10}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('admin.partner.linkRequest.rejectReasonMinLength')}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectRow(null)}>
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reject.isPending || !rejectReasonValid}
              onClick={handleRejectSubmit}
            >
              {t('admin.pages.partnerLinks.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
