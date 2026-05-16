import type { ReactElement } from 'react';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import type { PartnerStatus } from '@/types/partner';

import {
  useLeavePartnerRelationship,
  useMyPartners,
} from '@/pages/partner/hooks/usePartner';

const statusLabels: Record<PartnerStatus, string> = {
  PENDING: 'Beklemede',
  ACTIVE: 'Aktif',
  SUSPENDED: 'Askıda',
  TERMINATED: 'Sonlandı',
};

export function PartnersTab(): ReactElement {
  const { data, isLoading, isError, error, refetch } = useMyPartners();
  const leave = useLeavePartnerRelationship();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const selected = data?.find((r) => r.id === confirmId);
  const partnerName = selected?.partnerOrg?.name ?? 'Partner';

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

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Partnerler</h2>
        <p className="text-sm text-muted-foreground">
          Hesabınıza erişimi olan ajans ve partnerleri görüntüleyin.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıtlı partner bulunmuyor.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((rel) => {
            const name = rel.partnerOrg?.name ?? 'Partner';
            return (
              <Card key={rel.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base">{name}</CardTitle>
                    <CardDescription>
                      @{rel.partnerOrg?.slug ?? '—'}
                    </CardDescription>
                  </div>
                  <Badge variant={rel.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {statusLabels[rel.status]}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={leave.isPending || rel.status === 'TERMINATED'}
                    onClick={() => setConfirmId(rel.id)}
                  >
                    İlişkiyi Sonlandır
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
        Yenile
      </Button>

      <AlertDialog open={confirmId != null} onOpenChange={() => setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partner ilişkisini sonlandır</AlertDialogTitle>
            <AlertDialogDescription>
              {partnerName} ile ilişkinizi sonlandırmak istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leave.isPending}
              onClick={() => {
                if (confirmId) {
                  leave.mutate(confirmId, {
                    onSuccess: () => setConfirmId(null),
                  });
                }
              }}
            >
              Sonlandır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
