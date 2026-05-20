import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Clock,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { StarRating } from '@/pages/suppliers/components/StarRating';
import {
  emptySupplierForm,
  formToApiBody,
  SupplierFormDialog,
  supplierToForm,
  type SupplierFormState,
} from '@/pages/suppliers/components/SupplierFormDialog';
import {
  COUNTRY_FILTER_OPTIONS,
  currentMonthSpend,
  formatSupplierDate,
  formatTryAmount,
  parseSupplierRating,
  supplierContactLine,
} from '@/pages/suppliers/supplier-utils';
import type { PurchaseOrderAnalyticsDto, SupplierDto } from '@/types/supply';

const PAGE_SIZE = 20;

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: typeof Users;
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

export function SuppliersPage(): ReactElement {
  usePageTitle('Tedarikçiler');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptySupplierForm);

  const isActiveParam =
    activeFilter === 'all' ? undefined : activeFilter === 'active';

  const listQuery = useQuery({
    queryKey: ['suppliers', page, search, country, activeFilter],
    queryFn: async (): Promise<{ data: SupplierDto[]; total: number }> => {
      const { data } = await api.get<{ data: SupplierDto[]; total: number }>('/suppliers', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          country: country || undefined,
          isActive: isActiveParam,
        },
      });
      return data;
    },
  });

  const totalCountQuery = useQuery({
    queryKey: ['suppliers', 'kpi-total'],
    queryFn: async (): Promise<number> => {
      const { data } = await api.get<{ total: number }>('/suppliers', {
        params: { page: 1, limit: 1 },
      });
      return data.total;
    },
  });

  const activeCountQuery = useQuery({
    queryKey: ['suppliers', 'kpi-active'],
    queryFn: async (): Promise<number> => {
      const { data } = await api.get<{ total: number }>('/suppliers', {
        params: { page: 1, limit: 1, isActive: true },
      });
      return data.total;
    },
  });

  const poAnalyticsQuery = useQuery({
    queryKey: ['purchase-orders', 'analytics'],
    queryFn: async (): Promise<PurchaseOrderAnalyticsDto> => {
      const { data } = await api.get<{ data: PurchaseOrderAnalyticsDto }>(
        '/purchase-orders/analytics',
      );
      return data.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const body = formToApiBody(form);
      if (editing) {
        await api.patch(`/suppliers/${editing.id}`, body);
      } else {
        await api.post('/suppliers', body);
      }
    },
    onSuccess: async () => {
      toast.success(editing ? 'Tedarikçi güncellendi.' : 'Tedarikçi oluşturuldu.');
      setDialogOpen(false);
      setEditing(null);
      setForm(emptySupplierForm);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/suppliers/${id}`);
    },
    onSuccess: async () => {
      toast.success('Tedarikçi silindi.');
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptySupplierForm);
    setDialogOpen(true);
  };

  const openEdit = (row: SupplierDto): void => {
    setEditing(row);
    setForm(supplierToForm(row));
    setDialogOpen(true);
  };

  const totalPages = useMemo(() => {
    const t = listQuery.data?.total ?? 0;
    return Math.max(1, Math.ceil(t / PAGE_SIZE));
  }, [listQuery.data?.total]);

  const kpiLoading =
    totalCountQuery.isLoading ||
    activeCountQuery.isLoading ||
    poAnalyticsQuery.isLoading;

  const monthSpend = currentMonthSpend(poAnalyticsQuery.data?.monthlySpend);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Tedarikçiler
          </h1>
          <p className="text-sm text-muted-foreground">
            Tedarikçi kayıtları, performans ve satın alma özeti
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Tedarikçi ekle
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Toplam tedarikçi"
          value={kpiLoading ? '—' : String(totalCountQuery.data ?? 0)}
          icon={Building2}
          tone="text-sky-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Aktif"
          value={kpiLoading ? '—' : String(activeCountQuery.data ?? 0)}
          sub="Pasif hariç"
          icon={Users}
          tone="text-emerald-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Ort. teslimat süresi"
          value={
            kpiLoading
              ? '—'
              : poAnalyticsQuery.data?.avgLeadTime
                ? `${poAnalyticsQuery.data.avgLeadTime} gün`
                : '—'
          }
          sub="Tamamlanan siparişler"
          icon={Clock}
          tone="text-amber-600"
          loading={kpiLoading}
        />
        <KpiCard
          title="Bu ay harcama"
          value={kpiLoading ? '—' : formatTryAmount(monthSpend)}
          sub={new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          icon={TrendingUp}
          tone="text-indigo-600"
          loading={kpiLoading}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="supplier-search">Ara</Label>
          <Input
            id="supplier-search"
            placeholder="İsim, e-posta veya iletişim"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <Label>Ülke</Label>
          <Select
            value={country || 'all'}
            onValueChange={(v) => {
              setCountry(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm ülkeler</SelectItem>
              {COUNTRY_FILTER_OPTIONS.filter((c) => c.value).map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1 sm:w-40">
          <Label>Durum</Label>
          <Select
            value={activeFilter}
            onValueChange={(v) => {
              setActiveFilter(v as 'all' | 'active' | 'inactive');
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton rows={8} />
      ) : listQuery.isError ? (
        <EmptyState
          icon={Store}
          title="Liste yüklenemedi"
          description={getApiErrorMessage(listQuery.error)}
          action={{ label: 'Yeniden dene', onClick: () => void listQuery.refetch() }}
        />
      ) : !listQuery.data?.data.length ? (
        <EmptyState
          icon={Store}
          title="Henüz tedarikçi yok"
          description="Satın alma siparişleri için önce tedarikçi ekleyin."
          action={{ label: 'Tedarikçi ekle', onClick: openCreate }}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İsim</TableHead>
                  <TableHead>Ülke</TableHead>
                  <TableHead>İletişim</TableHead>
                  <TableHead>Ödeme koşulları</TableHead>
                  <TableHead>Puan</TableHead>
                  <TableHead>Son sipariş</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.data.map((row) => (
                  <TableRow key={row.id} className={!row.isActive ? 'opacity-60' : undefined}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/suppliers/${row.id}`}
                        className="text-sky-600 hover:underline"
                      >
                        {row.name}
                      </Link>
                      {!row.isActive ? (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Pasif
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{row.country ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {supplierContactLine(row)}
                      {row.contactName ? (
                        <span className="block text-xs">{row.contactName}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{row.paymentTerms ?? '—'}</TableCell>
                    <TableCell>
                      <StarRating value={parseSupplierRating(row.rating)} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatSupplierDate(row.lastOrderAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/suppliers/${row.id}`}>Detay</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="mr-2 size-4" />
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${row.name} kaydını silmek istediğinize emin misiniz?`,
                                )
                              ) {
                                deleteMutation.mutate(row.id);
                              }
                            }}
                          >
                            Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        form={form}
        onFormChange={setForm}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
      />

      {deleteMutation.isPending ? (
        <div className="pointer-events-none fixed bottom-4 right-4 flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm shadow-md">
          <Loader2 className="size-4 animate-spin" />
          Siliniyor…
        </div>
      ) : null}
    </div>
  );
}
