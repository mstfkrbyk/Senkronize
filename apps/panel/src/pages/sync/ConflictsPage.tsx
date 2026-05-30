import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { format } from 'date-fns';
import { AlertTriangle, RefreshCw, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { SyncAccountingModeBanner } from '@/components/sync/SyncAccountingModeBanner';
import { SyncContextCards } from '@/components/sync/SyncContextCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { formatConflictValue } from '@/lib/sync-conflict-values';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type {
  ConflictResolution,
  ConflictType,
  SyncConflictDto,
} from '@/types/sync-conflict';

import {
  useAutoResolveConflicts,
  useConflictStats,
  useDetectConflicts,
  useResolveConflict,
  useSyncConflicts,
} from './hooks/useSyncConflicts';

const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  STOCK_MISMATCH: 'Stok uyuşmazlığı',
  PRICE_MISMATCH: 'Fiyat uyuşmazlığı',
  STATUS_MISMATCH: 'Durum uyuşmazlığı',
  PRODUCT_NOT_FOUND: 'Ürün bulunamadı',
  DUPLICATE_ORDER: 'Yinelenen sipariş',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  stock: 'Stok',
  price: 'Fiyat',
  order: 'Sipariş',
  product: 'Ürün',
};

const PIE_COLORS = ['#0f172a', '#38bdf8', '#94a3b8', '#22c55e', '#f97316'];

function statusBadge(conflict: SyncConflictDto): ReactElement {
  if (conflict.resolution === null) {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
        Bekliyor
      </Badge>
    );
  }
  if (conflict.resolution === 'IGNORED') {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        Yoksayıldı
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
      Çözüldü
    </Badge>
  );
}

interface ConflictActionsProps {
  conflict: SyncConflictDto;
  onResolve: (id: string, resolution: ConflictResolution) => void;
  pending: boolean;
}

function ConflictActions({
  conflict,
  onResolve,
  pending,
}: ConflictActionsProps): ReactElement | null {
  if (conflict.resolution !== null) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => onResolve(conflict.id, 'USE_LOCAL')}
      >
        Yerel kullan
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => onResolve(conflict.id, 'USE_REMOTE')}
      >
        Uzaktan al
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        disabled={pending}
        onClick={() => onResolve(conflict.id, 'IGNORED')}
      >
        Yoksay
      </Button>
    </div>
  );
}

export function ConflictsPage(): ReactElement {
  const { t } = useTranslation();
  const { mode: accountingMode } = useAccountingMode();
  const showErpContext = accountingMode === 'EXTERNAL_ERP';

  usePageTitle(t('sync.conflicts.title'));

  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const conflictsQuery = useSyncConflicts({
    ...(statusFilter ? { status: statusFilter as 'pending' | 'resolved' | 'ignored' } : {}),
    ...(typeFilter ? { conflictType: typeFilter as ConflictType } : {}),
  });
  const statsQuery = useConflictStats();
  const detectMutation = useDetectConflicts();
  const resolveMutation = useResolveConflict();
  const autoResolveMutation = useAutoResolveConflicts();

  const pieData = useMemo(() => {
    const byType = statsQuery.data?.byType;
    if (!byType) {
      return [];
    }
    return Object.entries(byType)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: CONFLICT_TYPE_LABELS[name as ConflictType] ?? name,
        value,
      }));
  }, [statsQuery.data?.byType]);

  const handleResolve = (id: string, resolution: ConflictResolution): void => {
    resolveMutation.mutate(
      { id, resolution },
      {
        onSuccess: () => toast.success('Çakışma çözüldü'),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('sync.conflicts.title')}
        description={t('sync.conflicts.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={detectMutation.isPending}
              onClick={() =>
                detectMutation.mutate(undefined, {
                  onSuccess: (rows) =>
                    toast.success(`${rows.length} yeni çakışma tespit edildi`),
                  onError: (e) => toast.error(getApiErrorMessage(e)),
                })
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Taramayı başlat
            </Button>
            <Button
              disabled={
                autoResolveMutation.isPending ||
                (statsQuery.data?.pending ?? 0) === 0
              }
              onClick={() =>
                autoResolveMutation.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success(
                      `${r.resolved} çözüldü, ${r.ignored} yoksayıldı`,
                    ),
                  onError: (e) => toast.error(getApiErrorMessage(e)),
                })
              }
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Tümünü otomatik çöz
            </Button>
          </div>
        }
      />

      <SyncAccountingModeBanner />

      <SyncContextCards showErpContext={showErpContext} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bekleyen</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {statsQuery.isLoading
                ? '…'
                : (statsQuery.data?.pending.toLocaleString('tr-TR') ?? '0')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Manuel veya otomatik çözüm bekliyor
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Çözülen</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {statsQuery.isLoading
                ? '…'
                : (statsQuery.data?.resolved.toLocaleString('tr-TR') ?? '0')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tipe göre dağılım</CardDescription>
          </CardHeader>
          <CardContent className="h-40">
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm">Veri yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Çakışma listesi
          </CardTitle>
          <CardDescription>
            Yerel ve uzak değerleri karşılaştırın, hızlı aksiyon uygulayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label>Durum</Label>
              <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tümü</SelectItem>
                  <SelectItem value="pending">Bekliyor</SelectItem>
                  <SelectItem value="resolved">Çözüldü</SelectItem>
                  <SelectItem value="ignored">Yoksayıldı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Çakışma tipi</Label>
              <Select value={typeFilter || '__all__'} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tümü</SelectItem>
                  {Object.entries(CONFLICT_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {conflictsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : conflictsQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(conflictsQuery.error)}
            </p>
          ) : (conflictsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              Bu filtreye uygun çakışma yok.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Varlık</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Yerel</TableHead>
                    <TableHead>Uzak</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="min-w-[240px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflictsQuery.data?.map((row) => {
                    const branding = getMarketplaceBranding(row.platform);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {branding.logo ? (
                              <img
                                src={branding.logo}
                                alt=""
                                className="h-5 w-5 rounded object-contain"
                              />
                            ) : null}
                            <span className="text-sm">{branding.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {ENTITY_TYPE_LABELS[row.entityType] ?? row.entityType}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {row.entityId}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {CONFLICT_TYPE_LABELS[row.conflictType]}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatConflictValue(row.conflictType, row.localValue)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatConflictValue(row.conflictType, row.remoteValue)}
                        </TableCell>
                        <TableCell>{statusBadge(row)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <ConflictActions
                            conflict={row}
                            pending={resolveMutation.isPending}
                            onResolve={handleResolve}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
