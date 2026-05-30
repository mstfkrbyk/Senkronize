import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Mail, Phone } from 'lucide-react';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
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
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useMyPartners();
  const leave = useLeavePartnerRelationship();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const activePartner = data?.find((r) => r.status === 'ACTIVE');
  const selected = data?.find((r) => r.id === confirmId);
  const partnerName =
    activePartner?.partnerOrg?.whiteLabelSettings?.brandName ??
    activePartner?.partnerOrg?.name ??
    selected?.partnerOrg?.name ??
    t('settings.partnersTab.defaultPartnerName');

  if (isLoading) {
    return (
      <SettingsPageShell
        title="Partner Programı"
        description="Partner ağına katılın veya mevcut bağlantılarınızı yönetin."
      >
        <div className="flex justify-center py-16">
          <Loader2
            className="size-8 animate-spin text-muted-foreground"
            aria-label={t('common.loading')}
          />
        </div>
      </SettingsPageShell>
    );
  }

  if (isError) {
    return (
      <SettingsPageShell
        title="Partner Programı"
        description="Partner ağına katılın veya mevcut bağlantılarınızı yönetin."
      >
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      </SettingsPageShell>
    );
  }

  const rows = data ?? [];

  if (!activePartner && rows.length === 0) {
    return (
      <SettingsPageShell
        title="Partner Programı"
        description="Partner ağına katılın veya mevcut bağlantılarınızı yönetin."
      >
        <Button asChild>
          <Link to="/settings/partners">{t('settings.partnersTab.discoverCta')}</Link>
        </Button>
      </SettingsPageShell>
    );
  }

  const display = activePartner ?? rows[0];
  const wl = display.partnerOrg?.whiteLabelSettings;
  const contactEmail = wl?.supportEmail ?? null;
  const contactPhone = wl?.supportPhone ?? null;

  return (
    <SettingsPageShell
      title="Partner Programı"
      description="Partner ağına katılın veya mevcut bağlantılarınızı yönetin."
    >
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
                <Link to="/settings/partners">
                  {t('settings.partnersTab.discoverCta')}
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={leave.isPending || display.status === 'TERMINATED'}
              onClick={() => setConfirmId(display.id)}
            >
              {t('settings.partnersTab.terminate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t('settings.partnersTab.otherRecords')}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {rows
              .filter((r) => r.id !== display.id)
              .map((rel) => (
                <Card key={rel.id}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">
                      {rel.partnerOrg?.name ?? t('settings.partnersTab.defaultPartnerName')}
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
        {t('settings.partnersTab.refresh')}
      </Button>

      <AlertDialog open={confirmId != null} onOpenChange={() => setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.partnersTab.terminateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.partnersTab.terminateConfirm', { name: partnerName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('common.cancel')}</AlertDialogCancel>
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
              {t('settings.partnersTab.terminateAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPageShell>
  );
}
