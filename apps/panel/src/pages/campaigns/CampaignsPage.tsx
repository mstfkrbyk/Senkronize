import type { ReactElement } from 'react';
import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { UpgradePrompt } from '@/components/UpgradePrompt';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { CampaignStatus } from '@/types/campaign';

import { CampaignDetailSheet } from './CampaignDetailSheet';
import { CampaignWizardDialog } from './CampaignWizardDialog';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  formatCampaignDate,
  platformLabel,
} from './campaign-labels';
import { useCampaigns } from './hooks/useCampaigns';

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

  if (!proAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Kampanya yönetimi
          </h1>
          <p className="text-muted-foreground">
            Flaş indirim, sezonsal kampanyalar ve otomatik zamanlama.
          </p>
        </div>
        <UpgradePrompt feature="Kampanya ve indirim yönetimi" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Kampanya yönetimi
          </h1>
          <p className="text-muted-foreground">
            Flaş indirim, sezonsal kampanyalar, etki analizi ve otomatik
            zamanlama.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Yeni kampanya
        </Button>
      </div>

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

      {campaignsQuery.isLoading ? (
        <TableSkeleton columns={6} rows={5} />
      ) : campaignsQuery.isError ? (
        <p className="text-sm text-destructive">
          {getApiErrorMessage(campaignsQuery.error)}
        </p>
      ) : (campaignsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Henüz kampanya yok"
          description="İlk kampanyanızı oluşturarak platformlarda indirim uygulayın."
          action={
            <Button type="button" onClick={() => setWizardOpen(true)}>
              Kampanya oluştur
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İsim</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Platformlar</TableHead>
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
        </div>
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
