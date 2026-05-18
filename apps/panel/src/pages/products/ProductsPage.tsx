import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Download, Package, Search, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ProductListItem } from '@/types/product';

const PAGE_SIZE = 20;

function formatMoney(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function ProductsPage(): ReactElement {
  usePageTitle('Ürün Kataloğu');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const queryKey = useMemo(
    () => ['products', { page, search }] as const,
    [page, search],
  );

  const productsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<{ items: ProductListItem[]; total: number }>(
        '/products',
        {
          params: {
            page,
            limit: PAGE_SIZE,
            ...(search.trim() ? { search: search.trim() } : {}),
          },
        },
      );
      return data;
    },
  });

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      setPage(1);
      void productsQuery.refetch();
    },
    [productsQuery],
  );

  const items = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

  const exportCsv = useCallback(async () => {
    const res = await api.get<Blob>('/products/export', {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urunler.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ürün Kataloğu</h1>
          <p className="text-muted-foreground text-sm">
            Merkezi ürün kayıtları ve varyantlar
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download className="mr-2 size-4" />
            Dışa Aktar
          </Button>
          <Button type="button" size="sm" asChild>
            <Link to="/products/import">
              <Upload className="mr-2 size-4" />
              İçe Aktar
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Arama</CardTitle>
          <CardDescription>Ürün adı, barkod veya SKU ile filtreleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={handleSearchSubmit}>
            <Input
              placeholder="Ara…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              className="max-w-md"
            />
            <Button type="submit" variant="secondary">
              <Search className="mr-2 size-4" />
              Uygula
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            Ürünler
          </CardTitle>
          <CardDescription>
            Toplam {total.toLocaleString('tr-TR')} kayıt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {productsQuery.isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : productsQuery.isError ? (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(productsQuery.error)}
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              title={search.trim() ? 'Filtrelere uygun ürün yok' : 'Henüz ürün yok'}
              description={
                search.trim()
                  ? 'Arama terimini değiştirerek tekrar deneyin.'
                  : 'İçe aktarma veya manuel eklemeyle ürün oluşturabilirsiniz.'
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Barkod</TableHead>
                    <TableHead>Marka</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Maliyet</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.sku ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.barcode}</TableCell>
                      <TableCell>{p.brand ?? '—'}</TableCell>
                      <TableCell>{p.category ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatMoney(p.costPrice)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/products/${p.id}`}>
                            <ChevronRight className="mr-1 size-3" />
                            Detay
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">
                  Sayfa {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={() => {
                      setPage((x) => Math.max(1, x - 1));
                    }}
                  >
                    Önceki
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={() => {
                      setPage((x) => x + 1);
                    }}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
