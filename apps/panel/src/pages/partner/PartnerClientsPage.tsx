import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, Loader2, LogIn, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';
import { useImpersonationStore } from '@/store/impersonation.store';
import type { PartnerRelationship, PartnerStatus } from '@/types/partner';
import type { PlanTier } from '@/types/subscription';

import { InviteClientDialog } from './InviteClientDialog';
import {
  useCommissionReport,
  useMyClients,
  usePartnerClientAccess,
  usePartnerDashboard,
} from './hooks/usePartner';
import { formatTryPlain, PARTNER_STATUS_LABELS, planLabel } from './partner-utils';

type StatusFilter = 'all' | 'ACTIVE' | 'PENDING' | 'SUSPENDED';
type PlanFilter = 'all' | PlanTier;

interface ClientTableRow {
  relationshipId: string;
  clientOrgId: string | null;
  name: string;
  plan: string;
  monthlyOrders: number;
  monthlyRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  status: PartnerStatus;
  registeredAt: string;
  canImpersonate: boolean;
}

function toCsv(rows: ClientTableRow[]): string {
  const header = [
    'Firma',
    'Plan',
    'Aylık sipariş',
    'Aylık gelir (TRY)',
    'Komisyon %',
    'Komisyon (TRY)',
    'Durum',
    'Kayıt tarihi',
  ];
  const lines = rows.map((r) => {
    const date = r.registeredAt
      ? format(new Date(r.registeredAt), 'yyyy-MM-dd', { locale: tr })
      : '';
    return [
      r.name,
      planLabel(r.plan),
      String(r.monthlyOrders),
      formatTryPlain(r.monthlyRevenue),
      String(r.commissionPct),
      formatTryPlain(r.commissionAmount),
      PARTNER_STATUS_LABELS[r.status],
      date,
    ]
      .map((c) => `"${String(c).replaceAll('"', '""')}"`)
      .join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

function buildRows(
  relationships: PartnerRelationship[],
  ordersByOrg: Map<string, number>,
  reportByOrg: Map<
    string,
    { plan: string; monthlyRevenue: number; commissionAmount: number }
  >,
): ClientTableRow[] {
  return relationships.map((rel) => {
    const cid = rel.clientOrgId;
    const report = cid ? reportByOrg.get(cid) : undefined;
    const pct = Number(rel.commissionPct);
    return {
      relationshipId: rel.id,
      clientOrgId: cid,
      name: rel.clientOrg?.name ?? rel.invitedEmail ?? 'Davet bekliyor',
      plan: report?.plan ?? '—',
      monthlyOrders: cid ? (ordersByOrg.get(cid) ?? 0) : 0,
      monthlyRevenue: report?.monthlyRevenue ?? 0,
      commissionPct: pct,
      commissionAmount: report?.commissionAmount ?? 0,
      status: rel.status,
      registeredAt: rel.clientOrg?.createdAt ?? rel.createdAt,
      canImpersonate: rel.canImpersonate && rel.status === 'ACTIVE' && cid != null,
    };
  });
}

export function PartnerClientsPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const clients = useMyClients();
  const dashboard = usePartnerDashboard();
  const report = useCommissionReport(now.getFullYear(), now.getMonth() + 1);
  const accessClient = usePartnerClientAccess();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);

  const ordersByOrg = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of dashboard.data?.clients ?? []) {
      map.set(c.clientOrgId, c.orders30d);
    }
    return map;
  }, [dashboard.data?.clients]);

  const reportByOrg = useMemo(() => {
    const map = new Map<
      string,
      { plan: string; monthlyRevenue: number; commissionAmount: number }
    >();
    for (const r of report.data?.rows ?? []) {
      map.set(r.clientOrgId, {
        plan: r.plan,
        monthlyRevenue: r.monthlyFeeTRY,
        commissionAmount: r.commissionAmountTRY,
      });
    }
    return map;
  }, [report.data?.rows]);

  const allRows = useMemo(() => {
    if (!clients.data) {
      return [];
    }
    return buildRows(clients.data, ordersByOrg, reportByOrg);
  }, [clients.data, ordersByOrg, reportByOrg]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (planFilter !== 'all' && row.plan !== planFilter) {
        return false;
      }
      if (q && !row.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allRows, search, planFilter, statusFilter]);

  const loading = clients.isLoading || dashboard.isLoading || report.isLoading;
  const isError = clients.isError || dashboard.isError || report.isError;
  const error = clients.error ?? dashboard.error ?? report.error;

  async function handleAccess(clientOrgId: string, clientName: string): Promise<void> {
    try {
      const { impersonationToken } = await accessClient.mutateAsync(clientOrgId);
      startImpersonation({ id: clientOrgId, name: clientName }, impersonationToken);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) {
      toast.error('Dışa aktarılacak kayıt yok.');
      return;
    }
    const csv = '\uFEFF' + toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `musteriler-${format(now, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV indirildi.');
  }, [filtered, now]);

  if (loading) {
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
          <h2 className="text-lg font-semibold">Müşteriler</h2>
          <p className="text-sm text-muted-foreground">
            Bağlı müşterilerinizi yönetin, panele geçiş yapın veya yeni davet gönderin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={filtered.length === 0}
            onClick={exportCsv}
          >
            <Download className="mr-2 size-4" />
            CSV dışa aktar
          </Button>
          <InviteClientDialog trigger={<Button type="button">Müşteri davet et</Button>} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Firma adı ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={planFilter}
          onValueChange={(v) => setPlanFilter(v as PlanFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm planlar</SelectItem>
            <SelectItem value="BASLANGIC">Başlangıç</SelectItem>
            <SelectItem value="GELISIM">Gelişim</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="KURUMSAL">Kurumsal</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            <SelectItem value="ACTIVE">Aktif</SelectItem>
            <SelectItem value="PENDING">Trial</SelectItem>
            <SelectItem value="SUSPENDED">Pasif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firma</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Aylık sipariş</TableHead>
              <TableHead className="text-right">Aylık gelir</TableHead>
              <TableHead className="text-right">Komisyon %</TableHead>
              <TableHead className="text-right">Komisyon</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Kayıt</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Filtrelere uygun müşteri bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.relationshipId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{planLabel(row.plan)}</TableCell>
                  <TableCell className="text-right">{row.monthlyOrders}</TableCell>
                  <TableCell className="text-right">₺{formatTryPlain(row.monthlyRevenue)}</TableCell>
                  <TableCell className="text-right">{row.commissionPct}</TableCell>
                  <TableCell className="text-right">
                    ₺{formatTryPlain(row.commissionAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {PARTNER_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(row.registeredAt), 'd MMM yyyy', { locale: tr })}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.canImpersonate && row.clientOrgId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={accessClient.isPending}
                        onClick={() => void handleAccess(row.clientOrgId!, row.name)}
                      >
                        <LogIn className="mr-1 size-4" />
                        Müşteri paneline gir
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
