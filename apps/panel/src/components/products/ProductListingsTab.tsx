import type { ReactElement } from 'react';
import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, Rocket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { formatMoney } from '@/components/products/variant-utils';
import { api, getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { ProductDetailListing } from '@/types/product';

interface Props {
  productId: string;
  listings: ProductDetailListing[];
  onChanged: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

function InlinePriceCell({
  listing,
  field,
  onSaved,
}: {
  listing: ProductDetailListing;
  field: 'salePrice' | 'listPrice';
  onSaved: () => void;
}): ReactElement {
  const initial =
    field === 'salePrice'
      ? formatMoney(listing.salePrice).replace(' ₺', '')
      : formatMoney(listing.listPrice).replace(' ₺', '');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  const mutation = useMutation({
    mutationFn: async () => {
      const n = Number.parseFloat(value.replace(',', '.'));
      if (!Number.isFinite(n)) {
        throw new Error('Geçersiz fiyat');
      }
      const salePrice =
        field === 'salePrice' ? n : Number.parseFloat(String(listing.salePrice));
      const listPrice =
        field === 'listPrice' ? n : Number.parseFloat(String(listing.listPrice));
      await api.patch(`/listings/${listing.id}/price`, { salePrice, listPrice });
    },
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  if (!editing) {
    return (
      <TableCell
        className="cursor-pointer text-right tabular-nums"
        onClick={() => {
          setValue(initial);
          setEditing(true);
        }}
      >
        {field === 'salePrice'
          ? formatMoney(listing.salePrice)
          : formatMoney(listing.listPrice)}
      </TableCell>
    );
  }

  return (
    <TableCell>
      <Input
        className="h-8 text-right"
        autoFocus
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          mutation.mutate();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            mutation.mutate();
          }
          if (e.key === 'Escape') {
            setValue(initial);
            setEditing(false);
          }
        }}
      />
    </TableCell>
  );
}

function InlineStockCell({
  listing,
  onSaved,
}: {
  listing: ProductDetailListing;
  onSaved: () => void;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(listing.quantity));

  const mutation = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(value, 10);
      await api.patch(`/listings/${listing.id}/stock`, {
        quantity: Number.isFinite(n) ? Math.max(0, n) : listing.quantity,
      });
    },
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  if (!editing) {
    return (
      <TableCell
        className="cursor-pointer text-right tabular-nums"
        onClick={() => {
          setValue(String(listing.quantity));
          setEditing(true);
        }}
      >
        {listing.quantity.toLocaleString('tr-TR')}
      </TableCell>
    );
  }

  return (
    <TableCell>
      <Input
        className="h-8 text-right"
        autoFocus
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          mutation.mutate();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            mutation.mutate();
          }
          if (e.key === 'Escape') {
            setValue(String(listing.quantity));
            setEditing(false);
          }
        }}
      />
    </TableCell>
  );
}

export function ProductListingsTab({
  productId,
  listings,
  onChanged,
}: Props): ReactElement {
  const [removeId, setRemoveId] = useState<string | null>(null);

  const pushMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: unknown[] }>(
        `/products/${productId}/push`,
      );
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Yayınlama kuyruğa alındı (${data.data.length} platform)`,
      );
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (listingId: string) => {
      await api.delete(`/listings/${listingId}`);
    },
    onSuccess: () => {
      toast.success('Listing platformdan kaldırıldı');
      setRemoveId(null);
      onChanged();
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Listingler</CardTitle>
          <CardDescription>
            Platform listeleri, fiyat ve stok durumu
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pushMutation.isPending}
          onClick={() => {
            pushMutation.mutate();
          }}
        >
          {pushMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 size-4" />
          )}
          Tüm platformlara yayınla
        </Button>
      </CardHeader>
      <CardContent>
        {listings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Henüz listing yok. Tüm platformlara yayınla ile oluşturabilirsiniz.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead className="text-right">Satış fiyatı</TableHead>
                <TableHead className="text-right">Liste fiyatı</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead>Son güncelleme</TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((row) => {
                const branding = getMarketplaceBranding(row.platform);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{branding.logo}</span>
                        <span className="text-sm font-medium">
                          {branding.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.approved ? 'default' : 'secondary'}>
                        {row.approved ? 'Onaylı' : 'Beklemede'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate text-sm">{row.title}</div>
                    </TableCell>
                    <InlinePriceCell
                      listing={row}
                      field="salePrice"
                      onSaved={onChanged}
                    />
                    <InlinePriceCell
                      listing={row}
                      field="listPrice"
                      onSaved={onChanged}
                    />
                    <InlineStockCell listing={row} onSaved={onChanged} />
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(row.lastSyncAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        title="Platformdan kaldır"
                        onClick={() => {
                          setRemoveId(row.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Platformdan kaldır</AlertDialogTitle>
            <AlertDialogDescription>
              Bu listing pasifleştirilecek ve platformdan kaldırma işlemi
              kuyruğa alınacak. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeId) {
                  removeMutation.mutate(removeId);
                }
              }}
            >
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
