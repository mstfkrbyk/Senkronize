import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Listing } from '@/types/listing';

interface Props {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTryFromDecimal(value: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(Number(value));
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ListingDetailSheet({
  listing,
  open,
  onOpenChange,
}: Props): ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {listing ? (
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span aria-hidden>
                {getMarketplaceBranding(listing.platform).logo}
              </span>
              <span className="line-clamp-2">{listing.title}</span>
            </SheetTitle>
            <SheetDescription>
              {getMarketplaceBranding(listing.platform).label} · Barkod{' '}
              <span className="font-mono">{listing.barcode}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Onay</span>
              {listing.approved ? (
                <Badge
                  variant="outline"
                  className="border-green-200 bg-green-50 text-green-800"
                >
                  Onaylı
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-900"
                >
                  Beklemede
                </Badge>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Fiyat</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Satış:{' '}
                <span className="font-semibold text-foreground">
                  {formatTryFromDecimal(listing.salePrice)}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Liste:{' '}
                <span className="font-semibold text-foreground">
                  {formatTryFromDecimal(listing.listPrice)}
                </span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Stok:{' '}
                <span className="font-semibold text-foreground">
                  {listing.quantity}
                </span>
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Görseller</p>
              {listing.imageUrls.length === 0 ? (
                <p className="text-sm text-muted-foreground">Görsel yok</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {listing.imageUrls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-square rounded-md border object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Son senkron</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listing.lastSyncAt
                  ? formatDistanceToNow(new Date(listing.lastSyncAt), {
                      addSuffix: true,
                      locale: tr,
                    })
                  : 'Henüz senkron yok'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(listing.lastSyncAt)}
              </p>
            </div>
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
