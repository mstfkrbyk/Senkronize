import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, PieChart, Users } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
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
import { usePageTitle } from '@/hooks/usePageTitle';
import { platformLabel } from '@/pages/campaigns/campaign-labels';
import {
  formatCustomerDate,
  formatTryAmount,
  SEGMENT_BADGE_CLASS,
  SEGMENT_LABELS,
  SEGMENT_OPTIONS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import type { CustomerDto } from '@/types/customer';

const PLATFORM_OPTIONS = [
  { value: 'TRENDYOL', label: 'Trendyol' },
  { value: 'HEPSIBURADA', label: 'Hepsiburada' },
  { value: 'N11', label: 'n11' },
  { value: 'AMAZON_TR', label: 'Amazon TR' },
  { value: 'CICEKSEPETI', label: 'Çiçeksepeti' },
  { value: 'PAZARAMA', label: 'Pazarama' },
] as const;

export function CustomersPage(): ReactElement {
  usePageTitle('Müşteriler');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<string>('all');
  const [segment, setSegment] = useState<string>('all');
  const [city, setCity] = useState('');
  const [exporting, setExporting] = useState(false);

  const listQuery = useQuery({
    queryKey: ['customers', page, search, platform, segment, city],
    queryFn: async (): Promise<{
      items: CustomerDto[];
      total: number;
    }> => {
      const { data } = await api.get<{
        items: CustomerDto[];
        total: number;
      }>('/customers', {
        params: {
          page,
          limit: 20,
          search: search.trim() || undefined,
          platform: platform === 'all' ? undefined : platform,
          segment: segment === 'all' ? undefined : segment,
          city: city.trim() || undefined,
        },
      });
      return data;
    },
  });

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const { data } = await api.get<string>('/customers/export', {
        responseType: 'text',
      });
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'musteriler.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Müşteri listesi indirildi.');
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Müşteriler</h1>
          <p className="text-sm text-muted-foreground">
            Pazaryeri müşterilerinizi segmentasyon ve sipariş geçmişi ile yönetin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/customers/segments">
              <PieChart className="mr-2 size-4" />
              Segmentler
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            CSV Dışa Aktar
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="Ad, e-posta veya telefon ara…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={platform}
          onValueChange={(v) => {
            setPlatform(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Pazaryeri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm pazaryerleri</SelectItem>
            {PLATFORM_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={segment}
          onValueChange={(v) => {
            setSegment(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm segmentler</SelectItem>
            {SEGMENT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Şehir"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[140px]"
        />
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton cols={7} rows={8} />
      ) : listQuery.isError ? (
        <EmptyState
          icon={Users}
          title="Müşteriler yüklenemedi"
          description={getApiErrorMessage(listQuery.error)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz müşteri yok"
          description="Siparişler senkronize edildikçe müşteri kayıtları otomatik oluşturulur."
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Pazaryeri</TableHead>
                  <TableHead>Şehir</TableHead>
                  <TableHead className="text-right">Sipariş</TableHead>
                  <TableHead className="text-right">Harcama</TableHead>
                  <TableHead>Son sipariş</TableHead>
                  <TableHead>Segment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.email ? (
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {c.platform ? platformLabel(c.platform) : '—'}
                    </TableCell>
                    <TableCell>{c.city ?? '—'}</TableCell>
                    <TableCell className="text-right">{c.totalOrders}</TableCell>
                    <TableCell className="text-right">
                      {formatTryAmount(c.totalSpent)}
                    </TableCell>
                    <TableCell>{formatCustomerDate(c.lastOrderAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.segments.map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className={SEGMENT_BADGE_CLASS[s]}
                          >
                            {SEGMENT_LABELS[s]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Toplam {total.toLocaleString('tr-TR')} müşteri · Sayfa {page} /{' '}
              {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <Button
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
    </div>
  );
}
