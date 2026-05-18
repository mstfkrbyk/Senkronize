import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Copy, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
import {
  usePartnerOnboardingInvites,
  useResendOnboardingInvite,
} from './hooks/usePartner';

function statusLabel(row: ClientOnboardingRow): string {
  if (row.expired) {
    return 'Süresi doldu';
  }
  switch (row.displayStatus) {
    case 'INVITED':
      return 'Bekliyor';
    case 'REGISTERED':
      return 'Kayıtlı';
    case 'ONBOARDED':
      return 'Onboarding';
    case 'ACTIVE':
      return 'Aktif';
    default:
      return row.displayStatus;
  }
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
  const { data, isLoading, isError, error } = usePartnerOnboardingInvites();
  const resend = useResendOnboardingInvite();

  const sorted = useMemo((): ClientOnboardingRow[] => {
    if (!data) {
      return [];
    }
    return [...data].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data]);

  async function copyUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Davet bağlantısı kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı.');
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Müşteri onboarding</h2>
          <p className="text-sm text-muted-foreground">
            Müşterinize kayıt daveti gönderin; davet listesini ve durumlarını buradan takip edin.
          </p>
        </div>
        <InviteClientDialog
          trigger={<Button type="button">Müşteri davet et</Button>}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-posta</TableHead>
              <TableHead>Davet tarihi</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Henüz davet yok.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.inviteEmail}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'd MMM yyyy HH:mm', { locale: tr })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyUrl(row.inviteUrl)}
                      >
                        <Copy className="mr-1 size-3.5" />
                        Bağlantıyı kopyala
                      </Button>
                      {row.displayStatus === 'INVITED' && !row.expired ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={resend.isPending}
                          onClick={() =>
                            resend.mutate(row.id, {
                              onSuccess: () => toast.success('Davet yeniden gönderildi.'),
                              onError: (e: unknown) =>
                                toast.error(getApiErrorMessage(e)),
                            })
                          }
                        >
                          <RefreshCw className="mr-1 size-3.5" />
                          Yeniden gönder
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
