import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, UserCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { getApiErrorMessage, api } from '@/lib/api';
import { erpConnectionRoleLabel } from '@/lib/erp-connection-display';
import { getErpBranding } from '@/pages/connections/erp-display';
import { getMarketplaceDisplay } from '@/lib/platform-display';
import { useEnterAdminOrg } from '@/pages/admin/useEnterAdminOrg';
import type { AdminOrganizationDetailResponse } from '@/types/admin';

function formatSafeDate(
  value: string | Date | null | undefined,
  pattern: string,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }
  try {
    return format(new Date(value), pattern, { locale: tr });
  } catch {
    return fallback;
  }
}

interface Props {
  orgId: string;
  data: AdminOrganizationDetailResponse;
}

export function AdminOrgConnectionsPanel({ orgId, data }: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enterOrg, isEnteringOrg } = useEnterAdminOrg();
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantReason, setGrantReason] = useState('');
  const emDash = '—';

  const grantMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/admin/organizations/${orgId}/extra-erp-slot`, {
        quantity: 1,
        reason: grantReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success('Ek ERP slotu tanımlandı.');
      setGrantOpen(false);
      setGrantReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'organization', orgId] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const slotLabel =
    data.erpSlotLimit == null
      ? 'Sınırsız'
      : `${String(data.activeErpConnectionCount)} / ${String(data.erpSlotLimit)}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">ERP bağlantıları</CardTitle>
            <CardDescription>
              Org başına tek birincil ERP; ek bağlantılar salt okuma (stok/ürün). Slot:{' '}
              {slotLabel}
              {data.extraErpSlotCount > 0
                ? ` · Satın alınan ek slot: ${String(data.extraErpSlotCount)}`
                : ''}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {!data.internalAccount && !data.billingExempt ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setGrantOpen(true)}>
                Ek ERP slotu tanımla
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={isEnteringOrg(orgId)}
              onClick={() => {
                void enterOrg(orgId, data.organization.name);
              }}
            >
              {isEnteringOrg(orgId) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="mr-2 h-4 w-4" />
              )}
              Panelde yönet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad / Tür</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son senkron</TableHead>
                <TableHead className="text-right">Hata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.erpConnections ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    ERP bağlantısı yok. Panelden veya impersonate ile ekleyin.
                  </TableCell>
                </TableRow>
              ) : (
                (data.erpConnections ?? []).map((c) => {
                  const branding = getErpBranding(c.erpType);
                  const name = c.displayName?.trim() || branding.label;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <span className="mr-1">{branding.logo}</span>
                        {name}
                        <span className="ml-2 text-xs text-muted-foreground">{c.erpType}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{erpConnectionRoleLabel(c.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pasif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatSafeDate(c.lastSyncAt, 'd MMM yyyy HH:mm', emDash)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.syncErrorCount}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('admin.pages.orgDetail.connectionsTable.platform')}
          </CardTitle>
          <CardDescription>Pazaryeri ve e-ticaret mağaza bağlantıları</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.pages.orgDetail.connectionsTable.platform')}</TableHead>
                <TableHead>{t('admin.pages.orgDetail.connectionsTable.status')}</TableHead>
                <TableHead>{t('admin.pages.orgDetail.connectionsTable.lastSync')}</TableHead>
                <TableHead className="text-right">
                  {t('admin.pages.orgDetail.connectionsTable.errorCount')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.marketplaceConnections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('admin.pages.orgDetail.connectionsTable.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                data.marketplaceConnections.map((c) => {
                  const meta = getMarketplaceDisplay(c.platform);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <span className="mr-1">{meta.logo}</span>
                        {meta.label}
                      </TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                            {t('admin.pages.orgDetail.connectionsTable.active')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t('admin.pages.orgDetail.connectionsTable.inactive')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatSafeDate(c.lastSyncAt, 'd MMM yyyy HH:mm', emDash)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.syncErrorCount}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ek ERP slotu tanımla</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abonelik addon listesine <code>extra_erp_slot</code> eklenir. Mağaza açılmadan
              manuel tanım için kullanın.
            </p>
            <div className="space-y-2">
              <Label htmlFor="grant-reason">Denetim gerekçesi</Label>
              <Textarea
                id="grant-reason"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                rows={3}
                placeholder="Örn. Müşteri sözleşmesi — ikinci BizimHesap stok okuma"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGrantOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={grantMutation.isPending || grantReason.trim().length < 3}
              onClick={() => grantMutation.mutate()}
            >
              {grantMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              +1 slot tanımla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
