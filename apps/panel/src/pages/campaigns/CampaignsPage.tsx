import type { ReactElement } from 'react';
import { useState } from 'react';
import { Megaphone, Percent, Plus, ShoppingBag, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { TableSkeleton } from '@/components/TableSkeleton';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useAuthStore } from '@/store/auth.store';
import type { CampaignStatus } from '@/types/campaign';

import { CampaignDetailSheet } from './CampaignDetailSheet';
import { CampaignWizardDialog } from './CampaignWizardDialog';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  formatCampaignDate,
  formatMoney,
  platformLabel,
} from './campaign-labels';
import { useCampaignKpis, useCampaigns } from './hooks/useCampaigns';

type StatusFilter = CampaignStatus | 'ALL';

const FILTER_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'SCHEDULED', label: 'Zamanlanmış' },
  { value: 'DRAFT', label: 'Taslak' },
  { value: 'ENDED', label: 'Bitti' },
];

function hasProAccess(plan: string | undefined): boolean {
  return plan === 'PRO' || plan === 'KURUMSAL';
}

function statusBadgeVariant(
  status: CampaignStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'SCHEDULED':
      return 'secondary';
    case 'PAUSED':
      return 'outline';
    case 'ENDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function CampaignsPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.campaigns'));
  usePageTitle('Kampanyalar');
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const proAccess = hasProAccess(plan);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const campaignsQuery = useCampaigns(
    statusFilter === 'ALL' ? undefined : statusFilter,
    proAccess,
  );
  const kpisQuery = useCampaignKpis(proAccess);

  if (!proAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Kampanya yönetimi"
          description="Flaş indirim, sezonsal kampanyalar ve otomatik zamanlama."
          context={navContextLine}
        />
        <UpgradePrompt
          feature="Kampanya ve indirim yönetimi"
          requiredPlan="PRO"
          currentPlan={plan}
          description="Flaş indirim, sezonsal kampanyalar ve etki analizi PRO ve Kurumsal paketlerde açıktır."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kampanya yönetimi"
        description="Flaş indirim, sezonsal kampanyalar, etki analizi ve otomatik zamanlama."
        context={navContextLine}
        actions={
          <Button
            type="button"
            className="shrink-0 gap-2"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Yeni kampanya
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpisQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Aktif kampanya
                </CardTitle>
                <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpisQuery.data?.activeCampaignCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Toplam kullanım
                </CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {kpisQuery.data?.totalUsageCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Verilen indirim
                </CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(kpisQuery.data?.totalDiscountAmount ?? '0')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Dönüşüm oranı
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  %{(kpisQuery.data?.avgConversionRate ?? 0).toLocaleString('tr-TR')}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <TabsList>
              {FILTER_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {campaignsQuery.isLoading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : campaignsQuery.isError ? (
        <QueryErrorAlert
          error={campaignsQuery.error}
          onRetry={() => {
            void campaignsQuery.refetch();
          }}
        />
      ) : (campaignsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Henüz kampanya yok"
          description="İlk kampanyanızı oluşturarak platformlarda indirim uygulayın."
          action={{
            label: 'Kampanya oluştur',
            onClick: () => setWizardOpen(true),
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İsim</TableHead>
                <TableHead>Kupon</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Platformlar</TableHead>
                <TableHead>Kullanım</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-right">Ürün</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(campaignsQuery.data ?? []).map((campaign) => (
                <TableRow
                  key={campaign.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setDetailId(campaign.id);
                    setDetailOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {campaign.couponCode ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {CAMPAIGN_TYPE_LABELS[campaign.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(campaign.status)}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {campaign.platforms.slice(0, 3).map((p) => (
                        <Badge key={p} variant="outline" className="text-xs">
                          {platformLabel(p)}
                        </Badge>
                      ))}
                      {campaign.platforms.length > 3 ? (
                        <Badge variant="outline" className="text-xs">
                          +{campaign.platforms.length - 3}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {campaign.usageCount}
                    {campaign.maxUses !== null ? ` / ${campaign.maxUses}` : ''}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCampaignDate(campaign.startDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.affectedProductCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}

      <CampaignWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      <CampaignDetailSheet
        campaignId={detailId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailId(null);
          }
        }}
      />
    </div>
  );
}
