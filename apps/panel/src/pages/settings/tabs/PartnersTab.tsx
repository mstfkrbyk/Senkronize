import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, Phone } from 'lucide-react';

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

  const activePartner = data?.find((r) => r.status === 'ACTIVE');
  const selected = data?.find((r) => r.id === confirmId);
  const partnerName =
    activePartner?.partnerOrg?.whiteLabelSettings?.brandName ??
    activePartner?.partnerOrg?.name ??
    selected?.partnerOrg?.name ??
    'Partner';

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

  if (!activePartner && rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Partnerler</h2>
          <p className="text-sm text-muted-foreground">
            Henüz bir partner ile bağlı değilsiniz. Partner ağımızdan bir ajans seçerek
            bağlantı talebi gönderebilirsiniz.
          </p>
        </div>
        <Button asChild>
          <Link to="/settings/partners">Partnerlerimizi Keşfet</Link>
        </Button>
      </div>
    );
  }

  const display = activePartner ?? rows[0];
  const wl = display.partnerOrg?.whiteLabelSettings;
  const contactEmail = wl?.supportEmail ?? null;
  const contactPhone = wl?.supportPhone ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Partnerler</h2>
        <p className="text-sm text-muted-foreground">
          Bağlı olduğunuz ajans partner bilgileri ve ilişki yönetimi.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">{partnerName}</CardTitle>
            <CardDescription>@{display.partnerOrg?.slug ?? '—'}</CardDescription>
          </div>
          <Badge variant={display.status === 'ACTIVE' ? 'default' : 'secondary'}>
            {statusLabels[display.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {(contactEmail || contactPhone) && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {contactEmail ? (
                <p className="flex items-center gap-2">
                  <Mail className="size-4 shrink-0" aria-hidden />
                  <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                    {contactEmail}
                  </a>
                </p>
              ) : null}
              {contactPhone ? (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {contactPhone}
                </p>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!activePartner ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/settings/partners">Partnerlerimizi Keşfet</Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={leave.isPending || display.status === 'TERMINATED'}
              onClick={() => setConfirmId(display.id)}
            >
              Bağlantıyı Sonlandır
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Diğer kayıtlar</p>
          <div className="grid gap-3 md:grid-cols-2">
            {rows
              .filter((r) => r.id !== display.id)
              .map((rel) => (
                <Card key={rel.id}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">
                      {rel.partnerOrg?.name ?? 'Partner'}
                    </CardTitle>
                    <Badge variant="secondary" className="w-fit">
                      {statusLabels[rel.status]}
                    </Badge>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
        Yenile
      </Button>

      <AlertDialog open={confirmId != null} onOpenChange={() => setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partner bağlantısını sonlandır</AlertDialogTitle>
            <AlertDialogDescription>
              {partnerName} ile bağlantınızı sonlandırmak istediğinize emin misiniz?
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
