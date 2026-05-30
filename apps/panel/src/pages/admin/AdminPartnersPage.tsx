import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Handshake, MoreHorizontal } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { normalizeAdminPartnersList } from '@/lib/admin-api-normalize';
import { api, getApiErrorMessage } from '@/lib/api';
import { partnerOrgIdFromPageHash } from '@/lib/admin-partner-hash';
import {
  readAdminOrgProductFilterParam,
  type AdminOrgProductFilterValue,
} from '@/lib/admin-org-product-filter';
import {
  adminOrganizationsByPartnerUrl,
  adminPartnerRowAnchor,
  isDemoPartnerSlug,
} from '@/lib/admin-partner-nav';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { AdminOrgProductFilterSelect } from '@/pages/admin/AdminOrgProductFilterSelect';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import { AdminPartnerClientsTable } from '@/pages/admin/AdminPartnerClientsTable';
import { AdminPartnerPayoutRequestsSection } from '@/pages/admin/AdminPartnerPayoutRequestsSection';
import { useAdminPartners } from '@/pages/partner/hooks/usePartnerLink';
import type { AdminPartnerRow } from '@/types/admin';

function formatPartnerCommissionRate(rate: number, empty: string): string {
  if (!Number.isFinite(rate)) {
    return empty;
  }
  return `%${rate.toFixed(2)}`;
}

export function AdminPartnersPage(): ReactElement {
  const { t } = useTranslation();
  const emDash = t('admin.common.emDash');
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const productFilter = readAdminOrgProductFilterParam(searchParams.get('product'));
  const qc = useQueryClient();

  function setProductFilter(value: AdminOrgProductFilterValue): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('product');
        } else {
          next.set('product', value);
        }
        return next;
      },
      { replace: true },
    );
  }
  const { data, isLoading, isError, error, refetch } = useAdminPartners();
  const updateRate = useMutation({
    mutationFn: async ({
      partnerOrgId,
      commissionPct,
    }: {
      partnerOrgId: string;
      commissionPct: number;
    }): Promise<void> => {
      await api.patch(
        `/admin/partners/${encodeURIComponent(partnerOrgId)}/commission-rate`,
        { rate: commissionPct },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'partners'] });
    },
  });
  const [editing, setEditing] = useState<AdminPartnerRow | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(
    null,
  );

  const hashPartnerId = partnerOrgIdFromPageHash(location.hash);

  useEffect(() => {
    if (!hashPartnerId) {
      return;
    }
    setExpandedPartnerId(hashPartnerId);
  }, [hashPartnerId]);

  useEffect(() => {
    if (!hashPartnerId || !data) {
      return;
    }
    const anchor = adminPartnerRowAnchor(hashPartnerId);
    const el = document.getElementById(anchor);
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('ring-2', 'ring-sky-400/60');
    const highlightTimer = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-sky-400/60');
    }, 2000);
    return () => {
      window.clearTimeout(highlightTimer);
    };
  }, [hashPartnerId, data]);

  const openEdit = (row: AdminPartnerRow): void => {
    setEditing(row);
    const rate = Number.isFinite(row.commissionRate) ? row.commissionRate : 10;
    setRateInput(String(rate));
    setReasonInput('');
  };

  const handleSave = (): void => {
    if (!editing) return;
    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      toast.error(t('admin.pages.partners.toast.commissionRange'));
      return;
    }
    const reason = reasonInput.trim();
    if (!reason) {
      toast.error(t('admin.pages.partners.toast.commissionReasonRequired'));
      return;
    }
    updateRate.mutate(
      { partnerOrgId: editing.id, commissionPct: rate },
      {
        onSuccess: () => {
          toast.success(t('admin.partner.editCommissionSaved'));
          setEditing(null);
          setReasonInput('');
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  const rows = normalizeAdminPartnersList(data);
  const detailPartner =
    expandedPartnerId != null
      ? rows.find((r) => r.id === expandedPartnerId)
      : undefined;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.partners.title')}
        description={t('admin.pages.partners.description')}
        actions={
          <AdminOrgProductFilterSelect
            value={productFilter}
            onValueChange={setProductFilter}
            className="space-y-1 sm:min-w-[180px]"
          />
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
      {isLoading ? <TableSkeleton rows={6} cols={5} /> : null}

      {isError ? (
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : !isLoading && rows.length === 0 ? (
        <AdminListEmptyState
          hasActiveFilters={false}
          emptyTitle={t('admin.common.listEmpty.partners')}
          emptyDescription={t('admin.pages.partners.empty')}
          icon={Handshake}
        />
      ) : !isLoading ? (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.pages.partners.table.partner')}</TableHead>
              <TableHead>{t('admin.pages.partners.table.activeClients')}</TableHead>
              <TableHead>{t('admin.pages.partners.table.commission')}</TableHead>
              <TableHead>{t('admin.pages.partners.table.registered')}</TableHead>
              <TableHead className="text-right">{t('admin.pages.partners.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isExpanded = expandedPartnerId === row.id;
              const hasClientCount =
                typeof row.activeClientCount === 'number' &&
                Number.isFinite(row.activeClientCount);
              return (
              <TableRow
                key={row.id}
                id={adminPartnerRowAnchor(row.id)}
                className="scroll-mt-4 transition-shadow"
              >
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <button
                        type="button"
                        className="text-left font-medium hover:text-sky-700 hover:underline"
                        onClick={() => {
                          setExpandedPartnerId((prev) =>
                            prev === row.id ? null : row.id,
                          );
                        }}
                      >
                        {row.name}
                      </button>
                      <div className="text-xs text-muted-foreground">@{row.slug}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {t('admin.orgType.PARTNER')}
                    </Badge>
                    {(row.isDemo || isDemoPartnerSlug(row.slug)) ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {t('admin.pages.partners.demo')}
                      </Badge>
                    ) : null}
                    {isExpanded ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {t('admin.pages.partners.clientsExpanded')}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {hasClientCount && row.activeClientCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="font-medium tabular-nums text-sky-700 underline-offset-2 hover:underline"
                        onClick={() => {
                          setExpandedPartnerId(row.id);
                        }}
                      >
                        {row.activeClientCount}
                      </button>
                      <Link
                        to={adminOrganizationsByPartnerUrl(row.id, productFilter)}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {t('admin.pages.partners.list')}
                      </Link>
                    </div>
                  ) : hasClientCount ? (
                    <span className="text-muted-foreground">0</span>
                  ) : (
                    <span className="text-muted-foreground">{emDash}</span>
                  )}
                </TableCell>
                <TableCell>{formatPartnerCommissionRate(row.commissionRate, emDash)}</TableCell>
                <TableCell>
                  {(() => {
                    const d = new Date(row.createdAt);
                    return Number.isNaN(d.getTime())
                      ? emDash
                      : format(d, 'd MMM yyyy', { locale: tr });
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" aria-hidden />
                        <span className="sr-only">{t('admin.common.menuAria')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(row)}>
                        {t('admin.partner.editCommission')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
        </div>
      ) : null}
        </CardContent>
      </Card>

      <AdminPartnerPayoutRequestsSection
        onPartnerFocus={(partnerOrgId) => {
          setExpandedPartnerId(partnerOrgId);
        }}
      />

      {detailPartner && expandedPartnerId ? (
        <div className="space-y-3">
          {(detailPartner.isDemo || isDemoPartnerSlug(detailPartner.slug)) ? (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">{t('admin.pages.partners.demoPartnerTitle')}</p>
              <p className="mt-1 text-muted-foreground">
                {t('admin.pages.partners.demoPartnerHint', {
                  slug1: 'demo-partner-musteri',
                  slug2: 'demo-partner-musteri-2',
                  login1: 'partner@partner.com',
                  login2: 'demo-partner-musteri@senkronize.com',
                })}
              </p>
            </div>
          ) : null}
          <AdminPartnerClientsTable
            partnerOrgId={expandedPartnerId}
            partnerName={detailPartner.name}
            productFilter={productFilter}
          />
        </div>
      ) : null}

      {expandedPartnerId && !detailPartner ? (
        <p className="text-sm text-muted-foreground">
          {hashPartnerId
            ? t('admin.pages.partners.partnerNotInList')
            : t('admin.pages.partners.selectedPartnerNotFound')}
        </p>
      ) : null}

      <Dialog
        open={editing != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setReasonInput('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.pages.partners.commissionDialogTitle', {
                name: editing?.name ?? '',
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commission-rate">{t('admin.pages.partners.rateLabel')}</Label>
              <Input
                id="commission-rate"
                type="number"
                min={0}
                max={50}
                step={0.01}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission-reason">{t('admin.partner.editCommissionReason')}</Label>
              <Textarea
                id="commission-reason"
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setReasonInput('');
              }}
            >
              {t('admin.common.dismiss')}
            </Button>
            <Button
              type="button"
              disabled={updateRate.isPending || !reasonInput.trim()}
              onClick={handleSave}
            >
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
