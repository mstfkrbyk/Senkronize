import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Loader2, Store } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { PurchaseOrderDetailDto, SupplierDto } from '@/types/supply';

export function SupplierDetailPage(): ReactElement {
  const { supplierId } = useParams<{ supplierId: string }>();
  const id = supplierId ?? '';

  const supplierQuery = useQuery({
    queryKey: ['supplier', id],
    enabled: id.length > 0,
    queryFn: async (): Promise<SupplierDto> => {
      const { data } = await api.get<{ data: SupplierDto }>(`/suppliers/${id}`);
      return data.data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ['supplier-stats', id],
    enabled: id.length > 0,
    queryFn: async (): Promise<{ orderCount: number; totalSpend: string }> => {
      const { data } = await api.get<{
        data: { orderCount: number; totalSpend: string };
      }>(`/suppliers/${id}/stats`);
      return data.data;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['purchase-orders', 'supplier', id],
    enabled: id.length > 0,
    queryFn: async (): Promise<PurchaseOrderDetailDto[]> => {
      const { data } = await api.get<{
        data: PurchaseOrderDetailDto[];
        total: number;
      }>('/purchase-orders', {
        params: { supplierId: id, limit: 50, page: 1 },
      });
      return data.data;
    },
  });

  usePageTitle(supplierQuery.data?.name ?? 'Tedarikçi');

  if (!id) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Store}
          title="Geçersiz bağlantı"
          description="Tedarikçi seçilemedi."
        />
      </div>
    );
  }

  if (supplierQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (supplierQuery.isError || !supplierQuery.data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Store}
          title="Tedarikçi bulunamadı"
          description={getApiErrorMessage(supplierQuery.error)}
        />
      </div>
    );
  }

  const s = supplierQuery.data;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/suppliers">
            <ArrowLeft className="mr-1 size-4" />
            Listeye dön
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{s.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[s.contactName, s.email, s.phone].filter(Boolean).join(' · ') || 'İletişim yok'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam sipariş
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {statsQuery.isLoading ? '…' : (statsQuery.data?.orderCount ?? '—')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam harcama (TRY)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {statsQuery.isLoading ? '…' : (statsQuery.data?.totalSpend ?? '—')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vergi no
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{s.taxNumber ?? '—'}</CardContent>
        </Card>
      </div>

      {s.address ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adres</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{s.address}</CardContent>
        </Card>
      ) : null}

      {s.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notlar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{s.notes}</CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <ClipboardList className="size-5" />
          Satın alma geçmişi
        </h2>
        {ordersQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : ordersQuery.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(ordersQuery.error)}</p>
        ) : !ordersQuery.data?.length ? (
          <EmptyState
            icon={ClipboardList}
            title="Henüz sipariş yok"
            description="Bu tedarikçi için satın alma siparişi oluşturabilirsiniz."
            secondaryAction={{ label: 'Siparişlere git', href: '/purchase-orders' }}
          />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sipariş no</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQuery.data.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm">{po.orderNumber}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={poStatusBadgeClass(po.status)}
                      >
                        {PO_STATUS_LABEL_TR[po.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {po.totalAmount} {po.currency}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(po.createdAt).toLocaleString('tr-TR')}
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
        )}
      </div>
    </div>
  );
}
