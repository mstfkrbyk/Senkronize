import type { ReactElement } from 'react';
import { useState } from 'react';
import { Banknote, Boxes, MoreHorizontal, Package } from 'lucide-react';

import { StockBadge } from '@/components/StockBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Listing } from '@/types/listing';

interface Props {
  listings: Listing[];
  selectedIds: Set<string>;
  onToggleRow: (id: string, selected: boolean) => void;
  onToggleAllOnPage: (selected: boolean) => void;
  onRowClick: (listing: Listing) => void;
  onOpenPrice: (listing: Listing) => void;
  onOpenStock: (listing: Listing) => void;
  onSyncAllPlatforms?: (listing: Listing) => void;
}

function formatTryFromDecimal(value: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(Number(value));
}

function ListingThumb({ urls }: { urls: string[] }): ReactElement {
  const [failed, setFailed] = useState(false);
  const url = urls[0];
  if (!url || failed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted/40">
        <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 rounded-md border object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}

function PlatformBadge({ platform }: { platform: string }): ReactElement {
  const tone: Record<string, string> = {
    TRENDYOL: 'border-orange-300 bg-orange-50 text-orange-900',
    HEPSIBURADA: 'border-red-300 bg-red-50 text-red-900',
  };
  const branding = getMarketplaceBranding(platform);
  return (
    <Badge
      variant="outline"
      className={tone[platform] ?? 'border-slate-200 bg-slate-50'}
    >
      <span className="mr-1" aria-hidden>
        {branding.logo}
      </span>
      {branding.label}
    </Badge>
  );
}

export function ListingsTable({
  listings,
  selectedIds,
  onToggleRow,
  onToggleAllOnPage,
  onRowClick,
  onOpenPrice,
  onOpenStock,
  onSyncAllPlatforms,
}: Props): ReactElement {
  const pageIds = listings.map((l) => l.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-[700px] w-full sm:min-w-0">
        <div className="rounded-md border">
          <Table className="min-w-[700px] sm:min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44px] p-2">
              <Checkbox
                checked={
                  allSelected
                    ? true
                    : someSelected
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={(v) => {
                  onToggleAllOnPage(v === true);
                }}
                aria-label="Bu sayfadaki tüm listelemeleri seç"
              />
            </TableHead>
            <TableHead className="w-[56px]">Görsel</TableHead>
            <TableHead>Ürün adı</TableHead>
            <TableHead>Barkod</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className="text-right">Fiyat</TableHead>
            <TableHead className="text-right">Stok</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="w-[200px]">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map((listing) => (
            <TableRow
              key={listing.id}
              className="cursor-pointer"
              onClick={() => {
                onRowClick(listing);
              }}
            >
              <TableCell
                className="w-[44px] p-2"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <Checkbox
                  checked={selectedIds.has(listing.id)}
                  onCheckedChange={(v) => {
                    onToggleRow(listing.id, v === true);
                  }}
                  aria-label={`Seç: ${listing.title}`}
                />
              </TableCell>
              <TableCell>
                <ListingThumb urls={listing.imageUrls} />
              </TableCell>
              <TableCell className="max-w-[220px] font-medium">
                <span className="line-clamp-2">{listing.title}</span>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {listing.barcode}
              </TableCell>
              <TableCell>
                <PlatformBadge platform={listing.platform} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatTryFromDecimal(listing.salePrice)}
              </TableCell>
              <TableCell className="text-right">
                <StockBadge quantity={listing.quantity} />
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPrice(listing);
                    }}
                  >
                    <Banknote className="h-3.5 w-3.5" aria-hidden />
                    Fiyat
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenStock(listing);
                    }}
                  >
                    <Boxes className="h-3.5 w-3.5" aria-hidden />
                    Stok
                  </Button>
                  {onSyncAllPlatforms ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label="Diğer işlemler"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSyncAllPlatforms(listing);
                          }}
                        >
                          Tüm platformlarda senkronize et
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </div>
      </div>
    </div>
  );
}
