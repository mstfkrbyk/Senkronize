import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Loader2, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { PartnerClientBadges } from '@/components/PartnerClientBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import type { PartnerRelationship, PartnerStatus } from '@/types/partner';

import { useTerminateRelationship } from './hooks/usePartner';
import { partnerDemoClientHint } from './partner-demo-client-hints';
import { resolvePartnerClientDisplay } from './partner-client-display';
import { useEnterPartnerClient } from './useEnterPartnerClient';

interface Props {
  relationship: PartnerRelationship;
  /** Liste sayfasına kısayol */
  showDetailLink?: boolean;
}

function statusVariant(
  status: PartnerStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'SUSPENDED':
      return 'outline';
    case 'TERMINATED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function ClientCard({
  relationship,
  showDetailLink = false,
}: Props): ReactElement {
  const { t } = useTranslation();
  const { enterClient, isEnteringClient } = useEnterPartnerClient();
  const terminate = useTerminateRelationship();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const display = resolvePartnerClientDisplay(
    relationship,
    t('partner.pages.clients.invitePending'),
  );
  const client = relationship.clientOrg;
  const entering =
    display.clientOrgId != null && isEnteringClient(display.clientOrgId);
  const demoHint = partnerDemoClientHint(client?.slug);

  async function handleCopyInvite(): Promise<void> {
    const url = relationship.inviteUrl;
    if (!url) {
      toast.error(t('partner.clientCard.toast.inviteUrlMissing'));
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('partner.clientCard.toast.inviteCopied'));
    } catch {
      toast.error(t('partner.clientCard.toast.copyFailed'));
    }
  }

  const hasIdentity = Boolean(
    client?.name?.trim() || relationship.invitedEmail?.trim(),
  );
  const title = hasIdentity
    ? display.name
    : t('partner.clientCard.unnamedClient');

  return (
    <>
      <Card className="flex flex-col transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-sky-400/60 focus-within:ring-offset-2">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant={statusVariant(relationship.status)}>
              {t(`partner.status.${relationship.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">@{display.slug}</p>
          {demoHint ? (
            <p className="text-xs text-muted-foreground">{demoHint}</p>
          ) : null}
          <PartnerClientBadges
            orgProducts={client?.orgProducts}
            accountingMode={client?.accountingMode}
            className="mt-1"
          />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 pb-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {t('partner.clientCard.commissionBadge', {
                pct: display.commissionPct,
              })}
            </Badge>
            {display.orders30d !== undefined ? (
              <Badge variant="secondary">
                {t('partner.clientCard.orders30dBadge', {
                  count: display.orders30d,
                })}
              </Badge>
            ) : null}
            {relationship.status === 'PENDING' ? (
              <Badge variant="secondary">
                {t('partner.clientCard.invitePendingBadge')}
              </Badge>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="mt-auto flex flex-wrap gap-2 border-t pt-4">
          {display.canEnter && client ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              disabled={entering}
              onClick={() => void enterClient(client.id, display.name)}
            >
              {entering ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
              ) : (
                <LogIn className="mr-1 size-4" aria-hidden />
              )}
              {entering
                ? t('partner.clientCard.enteringClient')
                : t('partner.clientCard.enterClient')}
            </Button>
          ) : null}
          {relationship.status === 'PENDING' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              disabled={!relationship.inviteUrl}
              onClick={() => void handleCopyInvite()}
            >
              <Copy className="mr-1 size-4" aria-hidden />
              {t('partner.clientCard.copyInvite')}
            </Button>
          ) : null}
          {showDetailLink ? (
            <Button type="button" variant="outline" size="sm" className="min-h-11" asChild>
              <Link to="/partner/clients">{t('partner.clientCard.detail')}</Link>
            </Button>
          ) : null}
          {relationship.status !== 'TERMINATED' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 text-destructive hover:text-destructive"
              disabled={terminate.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {t('partner.clientCard.terminate')}
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('partner.clientCard.terminateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('partner.clientCard.terminateDescription', { name: title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('partner.clientCard.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={terminate.isPending}
              onClick={() => {
                terminate.mutate(relationship.id, {
                  onSuccess: () => setConfirmOpen(false),
                  onError: (error: unknown) => {
                    toast.error(getApiErrorMessage(error));
                  },
                });
              }}
            >
              {t('partner.clientCard.confirmTerminate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
