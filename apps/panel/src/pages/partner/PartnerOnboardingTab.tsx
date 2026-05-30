import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Copy, RefreshCw, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { TableSkeleton } from '@/components/TableSkeleton';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import type { ClientOnboardingRow } from '@/types/partner';

import { InviteClientDialog } from './InviteClientDialog';
import { PartnerPageHeader } from './PartnerPageHeader';
import {
  usePartnerOnboardingInvites,
  useResendOnboardingInvite,
} from './hooks/usePartner';

function statusLabel(row: ClientOnboardingRow, t: TFunction): string {
  if (row.expired) {
    return t('partner.pages.onboarding.status.expired');
  }
  return t(`partner.pages.onboarding.status.${row.displayStatus}`, {
    defaultValue: row.displayStatus,
  });
}

function statusVariant(
  row: ClientOnboardingRow,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (row.expired) {
    return 'destructive';
  }
  if (row.displayStatus === 'ACTIVE') {
    return 'default';
  }
  if (row.displayStatus === 'REGISTERED' || row.displayStatus === 'ONBOARDED') {
    return 'secondary';
  }
  return 'outline';
}

export function PartnerOnboardingTab(): ReactElement {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching } = usePartnerOnboardingInvites();
  const resend = useResendOnboardingInvite();

  const sorted = useMemo((): ClientOnboardingRow[] => {
    const invites = data ?? [];
    return [...invites].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data]);

  async function copyUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('partner.pages.onboarding.toast.linkCopied'));
    } catch {
      toast.error(t('partner.pages.onboarding.toast.copyFailed'));
    }
  }

  const pageHeader = (
    <PartnerPageHeader
      title={t('partner.pages.onboarding.title')}
      description={t('partner.pages.onboarding.description')}
      actions={
        <InviteClientDialog
          trigger={
            <Button type="button" size="default">
              <UserPlus className="mr-2 size-4" aria-hidden />
              {t('partner.pages.onboarding.inviteClient')}
            </Button>
          }
        />
      }
    />
  );

  const inviteCta = (
    <InviteClientDialog
      trigger={
        <Button type="button" size="default">
          <UserPlus className="mr-2 size-4" aria-hidden />
          {t('partner.pages.onboarding.inviteClient')}
        </Button>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        {pageHeader}
        <div className="rounded-md border p-4">
          <TableSkeleton rows={5} cols={4} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          icon={UserPlus}
          title={t('partner.pages.onboarding.errorTitle')}
          description={t('partner.pages.onboarding.errorDescription')}
          actionSlot={
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {t('partner.pages.onboarding.retry')}
            </Button>
          }
        />
        <QueryErrorAlert error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      {sorted.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={t('partner.pages.onboarding.emptyTitle')}
          description={t('partner.pages.onboarding.emptyDescription')}
          actionSlot={inviteCta}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partner.pages.onboarding.tableEmail')}</TableHead>
                <TableHead>{t('partner.pages.onboarding.tableInviteDate')}</TableHead>
                <TableHead>{t('partner.pages.onboarding.tableStatus')}</TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.onboarding.tableActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.inviteEmail}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'd MMM yyyy HH:mm', { locale: tr })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row)}>{statusLabel(row, t)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyUrl(row.inviteUrl)}
                      >
                        <Copy className="mr-1 size-3.5" aria-hidden />
                        {t('partner.pages.onboarding.copyLink')}
                      </Button>
                      {row.displayStatus === 'INVITED' && !row.expired ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={resend.isPending}
                          onClick={() =>
                            resend.mutate(row.id, {
                              onSuccess: () =>
                                toast.success(t('partner.pages.onboarding.toast.resent')),
                              onError: (e: unknown) =>
                                toast.error(getApiErrorMessage(e)),
                            })
                          }
                        >
                          <RefreshCw className="mr-1 size-3.5" aria-hidden />
                          {t('partner.pages.onboarding.resend')}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
