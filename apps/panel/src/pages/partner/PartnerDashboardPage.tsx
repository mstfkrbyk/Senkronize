import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Percent, UserPlus, Users } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isDemoMode } from '@/lib/demo-login';
import type { PartnerDashboard, PartnerRelationship } from '@/types/partner';

import { ClientCard } from './ClientCard';
import { InviteClientDialog } from './InviteClientDialog';
import { PartnerPageHeader } from './PartnerPageHeader';
import { PartnerCommissionNoteAlert } from './PartnerCommissionNoteAlert';
import { comparePartnerDemoClientSlug } from './partner-demo-client-hints';
import { PARTNER_COMMISSION_PATH } from './partner-commission-routes';
import { formatTry } from './partner-utils';
import { usePartnerDashboard } from './hooks/usePartner';

function toRelationship(
  row: PartnerDashboard['clients'][number],
): PartnerRelationship {
  return {
    id: row.relationshipId,
    partnerOrgId: '',
    clientOrgId: row.clientOrgId,
    status: row.status,
    commissionPct: String(row.commissionPct),
    canImpersonate: row.canImpersonate,
    acceptedAt: null,
    createdAt: '',
    orders30d: row.orders30d,
    clientOrg: {
      id: row.clientOrgId,
      name: row.name,
      slug: row.slug,
      orgProducts: row.orgProducts,
      accountingMode: row.accountingMode,
    },
  };
}

function PartnerDashboardLoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <Card className="border-slate-200 bg-white">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-9 w-36" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="flex gap-2 pb-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </CardContent>
            <CardFooter className="flex gap-2 border-t pt-4">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PartnerDashboardPage(): ReactElement {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = usePartnerDashboard();

  const activeClients = useMemo(() => {
    return (data?.clients ?? [])
      .filter((c) => c.status === 'ACTIVE')
      .sort((a, b) => comparePartnerDemoClientSlug(a.slug, b.slug));
  }, [data?.clients]);

  const inviteCta = (
    <InviteClientDialog
      trigger={
        <Button type="button">
          <UserPlus className="mr-2 size-4" aria-hidden />
          {t('partner.pages.clients.inviteClient')}
        </Button>
      }
    />
  );

  const pageHeader = (
    <PartnerPageHeader
      title={t('partner.pages.dashboard.title')}
      description={t('partner.pages.dashboard.description')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to={PARTNER_COMMISSION_PATH}>
              <Percent className="mr-2 size-4" aria-hidden />
              {t('partner.pages.dashboard.commissionLink')}
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/partner/clients">{t('partner.pages.dashboard.allClientsLink')}</Link>
          </Button>
          {inviteCta}
        </div>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <CardContent className="pt-6">
            <PartnerDashboardLoadingSkeleton />
            <span className="sr-only">{t('partner.pages.dashboard.loadingAria')}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <CardContent className="pt-6">
            <QueryErrorAlert
              error={error ?? new Error(t('partner.pages.dashboard.loadFailed'))}
              onRetry={
                isError
                  ? () => {
                      void refetch();
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}
      <PartnerCommissionNoteAlert note={data.commissionNote} />

      {isDemoMode() && activeClients.length > 0 ? (
        <Alert className="border-sky-200 bg-sky-50/60">
          <AlertTitle>{t('partner.pages.dashboard.demoAlertTitle')}</AlertTitle>
          <AlertDescription>
            {t('partner.pages.dashboard.demoAlertDescription')}
          </AlertDescription>
        </Alert>
      ) : null}

      {activeClients.length > 0 && !isDemoMode() ? (
        <Alert className="border-amber-200 bg-amber-50/70">
          <ArrowLeftRight className="size-4 text-amber-700" aria-hidden />
          <AlertTitle className="text-amber-950">
            {t('partner.pages.dashboard.impersonationAlertTitle')}
          </AlertTitle>
          <AlertDescription className="text-amber-900/90">
            {t('partner.pages.dashboard.impersonationAlertDescription')}
          </AlertDescription>
        </Alert>
      ) : null}

      {data.totalClients > 0 || data.monthlyCommission > 0 ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-slate-900">
                {t('partner.pages.dashboard.commissionSummaryTitle')}
              </p>
              <p className="text-muted-foreground">
                {t('partner.pages.dashboard.commissionSummaryThisMonth', {
                  amount: formatTry(data.monthlyCommission),
                })}
                {data.totalCommission > 0 ? (
                  <>
                    {' '}
                    ·{' '}
                    {t('partner.pages.dashboard.commissionSummaryTotal', {
                      amount: formatTry(data.totalCommission),
                    })}
                  </>
                ) : null}
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link to={PARTNER_COMMISSION_PATH}>
                {t('partner.pages.dashboard.commissionDetailLink')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('partner.pages.dashboard.emptyTitle')}
          description={t('partner.pages.dashboard.emptyDescription')}
          actionSlot={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {inviteCta}
              <Button type="button" variant="outline" asChild>
                <Link to="/partner/onboarding">
                  {t('partner.pages.dashboard.manageInvitesLink')}
                </Link>
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link to={PARTNER_COMMISSION_PATH}>
                  {t('partner.pages.dashboard.commissionInfoLink')}
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeClients.map((row) => (
            <ClientCard
              key={row.relationshipId}
              relationship={toRelationship(row)}
              showDetailLink
            />
          ))}
        </div>
      )}
    </div>
  );
}
