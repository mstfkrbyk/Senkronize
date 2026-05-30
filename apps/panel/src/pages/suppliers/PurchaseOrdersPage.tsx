import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Clock,
  Download,
  Loader2,
  Plus,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { PO_STATUS_LABEL_TR, poStatusBadgeClass } from '@/lib/po-status';
import {
  currentMonthSpend,
  formatSupplierDate,
  formatTryAmount,
} from '@/pages/suppliers/supplier-utils';
import type {
  POStatus,
  PurchaseOrderAnalyticsDto,
  PurchaseOrderDetailDto,
  ReplenishmentSuggestionDto,
  SupplierDto,
} from '@/types/supply';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'DRAFT', label: PO_STATUS_LABEL_TR.DRAFT },
  { value: 'SENT', label: PO_STATUS_LABEL_TR.SENT },
  { value: 'CONFIRMED', label: PO_STATUS_LABEL_TR.CONFIRMED },
  { value: 'PARTIALLY_RECEIVED', label: PO_STATUS_LABEL_TR.PARTIALLY_RECEIVED },
  { value: 'RECEIVED', label: PO_STATUS_LABEL_TR.RECEIVED },
  { value: 'CANCELLED', label: PO_STATUS_LABEL_TR.CANCELLED },
];

interface PoLineForm {
  barcode: string;
  productName: string;
  quantity: string;
  unitCost: string;
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadPoCsv(rows: PurchaseOrderDetailDto[]): void {
  const headers = [
    'siparis_no',
    'tedarikci',
    'durum',
    'tutar',
    'para',
    'kalem',
    'olusturma',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((po) =>
      [
        escapeCsvCell(po.orderNumber),
        escapeCsvCell(po.supplier.name),
        escapeCsvCell(po.status),
        escapeCsvCell(po.totalAmount),
        escapeCsvCell(po.currency),
        escapeCsvCell(String(po.items.length)),
        escapeCsvCell(po.createdAt),
      ].join(','),
    ),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `satinalma-siparisleri-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: typeof ShoppingCart;
  tone: string;
  loading: boolean;
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  loading,
}: KpiCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`size-5 ${tone}`} aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
            {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PurchaseOrdersPage(): ReactElement {
  usePageTitle('Satın alma siparişleri');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PoLineForm[]>([
    { barcode: '', productName: '', quantity: '1', unitCost: '0' },
  ]);

  useEffect(() => {
    const preSupplier = searchParams.get('supplierId');
    if (preSupplier) {
      setSupplierFilter(preSupplier);
      setSupplierId(preSupplier);
    }
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
    }
    const barcode = searchParams.get('barcode');
    const name = searchParams.get('name');
    const qty = searchParams.get('qty');
    if (barcode?.trim() && name?.trim()) {
      const safeQty =
        qty !== null && qty !== '' && !Number.isNaN(Number(qty))
          ? String(Math.max(1, Math.floor(Number(qty))))
          : '1';
      setCreateOpen(true);
      setLines([
        {
          barcode: barcode.trim(),
          productName: name.trim(),
          quantity: safeQty,
          unitCost: '0',
        },
      ]);
    }
    if (
      preSupplier ||
      searchParams.get('create') ||
      barcode
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete('supplierId');
      next.delete('create');
      next.delete('barcode');
      next.delete('name');
      next.delete('qty');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const listQuery = useQuery({
    queryKey: ['purchase-orders', page, supplierFilter, statusFilter, fromDate, toDate],
    queryFn: async (): Promise<{
      data: PurchaseOrderDetailDto[];
      total: number;
    }> => {
      const { data } = await api.get<{
        data: PurchaseOrderDetailDto[];
        total: number;
      }>('/purchase-orders', {
        params: {
          page,
          limit: PAGE_SIZE,
          supplierId: supplierFilter || undefined,
          status: statusFilter !== 'all' ? (statusFilter as POStatus) : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      });
      return data;
    },
  });

  const analyticsQuery = useQuery({
    queryKey: ['purchase-orders', 'analytics'],
    queryFn: async (): Promise<PurchaseOrderAnalyticsDto> => {
      const { data } = await api.get<{ data: PurchaseOrderAnalyticsDto }>(
        '/purchase-orders/analytics',
      );
      return data.data;
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all-dd'],
    queryFn: async (): Promise<SupplierDto[]> => {
      const { data } = await api.get<{ data: SupplierDto[]; total: number }>(
        '/suppliers',
        { params: { page: 1, limit: 500, isActive: true } },
      );
      return data.data;
    },
  });

  const suggestionsQuery = useQuery({
    queryKey: ['po-suggestions'],
    queryFn: async (): Promise<ReplenishmentSuggestionDto[]> => {
      const { data } = await api.get<{ data: ReplenishmentSuggestionDto[] }>(
        '/purchase-orders/suggestions',
        { params: { threshold: 5 } },
      );
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const items = lines
        .map((l) => ({
          barcode: l.barcode.trim(),
          productName: l.productName.trim(),
          quantity: Number.parseInt(l.quantity, 10),
          unitCost: Number.parseFloat(l.unitCost),
        }))
        .filter((l) => l.barcode && l.productName && l.quantity > 0);
      await api.post('/purchase-orders', {
        supplierId,
        items,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success('Sipariş taslağı oluşturuldu.');
      setCreateOpen(false);
      setSupplierId('');
      setExpectedDate('');
      setNotes('');
      setLines([{ barcode: '', productName: '', quantity: '1', unitCost: '0' }]);
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders', 'analytics'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const totalPages = useMemo(() => {
    const t = listQuery.data?.total ?? 0;
    return Math.max(1, Math.ceil(t / PAGE_SIZE));
  }, [listQuery.data?.total]);

  const applySuggestion = (s: ReplenishmentSuggestionDto): void => {
    setCreateOpen(true);
    setLines((prev) => [
      ...prev.filter((l) => l.barcode.trim().length > 0),
      {
        barcode: s.barcode,
        productName: s.productName,
        quantity: String(s.suggestedOrderQuantity),
        unitCost: '0',
      },
    ]);
    toast.message('Kalem eklendi', { description: s.message });
  };

  const analytics = analyticsQuery.data;
  const kpiLoading = analyticsQuery.isLoading;
  const avgOrderValue =
    analytics && analytics.totalOrders > 0
      ? analytics.totalAmount / analytics.totalOrders
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Satın Alma Siparişleri"
        description="Taslak oluşturun, onaylayın ve mal teslim alın."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!listQuery.data?.data.length}
              onClick={() => {
                if (listQuery.data?.data.length) {
                  downloadPoCsv(listQuery.data.data);
                }
              }}
            >
              <Download className="mr-2 size-4" />
              CSV
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Yeni sipariş
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Toplam sipariş"
          value={kpiLoading ? '—' : String(analytics?.totalOrders ?? 0)}
          icon={ClipboardList}
          tone="text-sky-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Bekleyen"
          value={kpiLoading ? '—' : String(analytics?.pendingOrders ?? 0)}
          sub="Gönderildi / onaylı"
          icon={Clock}
          tone="text-amber-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Bu ay harcama"
          value={
            kpiLoading ? '—' : formatTryAmount(currentMonthSpend(analytics?.monthlySpend))
          }
          icon={TrendingUp}
          tone="text-emerald-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Ort. sipariş değeri"
          value={kpiLoading ? '—' : formatTryAmount(avgOrderValue)}
          sub="İptal hariç"
          icon={ShoppingCart}
          tone="text-indigo-600"
          loading={kpiLoading}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full space-y-1 sm:w-52">
          <Label>Tedarikçi</Label>
          <Select
            value={supplierFilter || 'all'}
            onValueChange={(v) => {
              setSupplierFilter(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm tedarikçiler</SelectItem>
              {(suppliersQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label>Durum</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="po-from">Başlangıç</Label>
          <Input
            id="po-from"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="po-to">Bitiş</Label>
          <Input
            id="po-to"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {suggestionsQuery.data && suggestionsQuery.data.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
            <Sparkles className="size-4" />
            Düşük stok önerileri
          </div>
          <ul className="space-y-2 text-sm">
            {suggestionsQuery.data.slice(0, 5).map((s) => (
              <li
                key={s.barcode}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  <strong>{s.productName}</strong> — mevcut {s.currentQuantity} ad.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applySuggestion(s)}
                >
                  Taslağa ekle
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <TableSkeleton rows={8} />
      ) : listQuery.isError ? (
        <EmptyState
          title="Liste yüklenemedi"
          description={getApiErrorMessage(listQuery.error)}
          action={{ label: 'Yeniden dene', onClick: () => void listQuery.refetch() }}
        />
      ) : !listQuery.data?.data.length ? (
        <EmptyState
          title="Henüz sipariş yok"
          description="Yeni bir satın alma taslağı oluşturarak başlayın."
          action={{ label: 'Yeni sipariş', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO no</TableHead>
                  <TableHead>Tedarikçi</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Ürün</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.data.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        to={`/purchase-orders/${po.id}`}
                        className="text-sky-600 hover:underline"
                      >
                        {po.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{po.supplier.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatSupplierDate(po.createdAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTryAmount(po.totalAmount)} {po.currency}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={poStatusBadgeClass(po.status)}
                      >
                        {PO_STATUS_LABEL_TR[po.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {po.items.length}
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="link" className="px-0" asChild>
                        <Link to={`/purchase-orders/${po.id}`}>Detay</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Toplam {listQuery.data.total} kayıt — sayfa {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni satın alma siparişi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Tedarikçi *</Label>
              <Select
                value={supplierId || undefined}
                onValueChange={setSupplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliersQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-exp">Beklenen teslim tarihi</Label>
              <Input
                id="po-exp"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-notes">Notlar</Label>
              <Input
                id="po-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kalemler</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLines((ls) => [
                      ...ls,
                      { barcode: '', productName: '', quantity: '1', unitCost: '0' },
                    ])
                  }
                >
                  Satır ekle
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-12 sm:items-end"
                >
                  <div className="sm:col-span-3">
                    <Label className="text-xs">Barkod / SKU</Label>
                    <Input
                      value={line.barcode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((ls) =>
                          ls.map((x, i) => (i === idx ? { ...x, barcode: v } : x)),
                        );
                      }}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Label className="text-xs">Ürün adı</Label>
                    <Input
                      value={line.productName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((ls) =>
                          ls.map((x, i) => (i === idx ? { ...x, productName: v } : x)),
                        );
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Miktar</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((ls) =>
                          ls.map((x, i) => (i === idx ? { ...x, quantity: v } : x)),
                        );
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Birim fiyat</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitCost}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((ls) =>
                          ls.map((x, i) => (i === idx ? { ...x, unitCost: v } : x)),
                        );
                      }}
                    />
                  </div>
                  <div className="sm:col-span-1 flex sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={lines.length <= 1}
                      onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                    >
                      Sil
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={
                !supplierId ||
                createMutation.isPending ||
                !lines.some((l) => l.barcode.trim() && l.productName.trim())
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Oluştur'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
