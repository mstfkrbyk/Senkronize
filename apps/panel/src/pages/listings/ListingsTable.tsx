import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Check, ExternalLink, MoreHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SyncStatusIndicator } from '@/components/listings/SyncStatusIndicator';
import { ProductImage } from '@/components/ProductImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getListingPlatformUrl,
  LISTING_STATUS_CLASS,
  LISTING_STATUS_LABEL,
} from '@/lib/listing-display';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Listing } from '@/types/listing';

interface Props {
  listings: Listing[];
  selectedIds: Set<string>;
  showBuyBoxColumn?: boolean;
  buyBoxMap?: Map<string, { isWinner: boolean; buyBoxPrice: number }>;
  onToggleRow: (id: string, selected: boolean) => void;
  onToggleAllOnPage: (selected: boolean) => void;
  onInlinePriceSave: (listing: Listing, price: number) => void;
  onInlineStockSave: (listing: Listing, stock: number) => void;
  onForceSync?: (listing: Listing) => void;
  onRemove?: (listing: Listing) => void;
  priceSavingId?: string | null;
  stockSavingId?: string | null;
}

function formatTryFromDecimal(value: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(Number(value));
}

function listingKey(listing: Listing): string {
  return `${listing.barcode}:${listing.platform}`;
}

function BuyBoxBadge({
  listing,
  buyBoxMap,
}: {
  listing: Listing;
  buyBoxMap?: Map<string, { isWinner: boolean; buyBoxPrice: number }>;
}): ReactElement {
  const snap = buyBoxMap?.get(listingKey(listing));
  if (!snap) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        —
      </Badge>
    );
  }
  if (snap.isWinner) {
    return (
      <Badge className="gap-1 border-0 bg-emerald-600 text-white hover:bg-emerald-600/90">
        <Check className="h-3 w-3" aria-hidden />
        Kazanıyor
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-amber-400 text-amber-800">
      <X className="h-3 w-3" aria-hidden />
      Kaybediyor
    </Badge>
  );
}

function InlinePriceCell({
  listing,
  onSave,
  saving,
}: {
  listing: Listing;
  onSave: (price: number) => void;
  saving: boolean;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(listing.salePrice);

  useEffect(() => {
    if (!editing) {
      setValue(listing.salePrice);
    }
  }, [listing.salePrice, editing]);

  const commit = (): void => {
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      setValue(listing.salePrice);
      setEditing(false);
      return;
    }
    if (n !== Number(listing.salePrice)) {
      onSave(n);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-8 w-28 text-right tabular-nums"
        inputMode="decimal"
        value={value}
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            commit();
          }
          if (e.key === 'Escape') {
            setValue(listing.salePrice);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full rounded px-1 py-0.5 text-right tabular-nums hover:bg-muted/80"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {formatTryFromDecimal(listing.salePrice)}
    </button>
  );
}

function InlineStockCell({
  listing,
  onSave,
  saving,
}: {
  listing: Listing;
  onSave: (stock: number) => void;
  saving: boolean;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(listing.quantity));

  useEffect(() => {
    if (!editing) {
      setValue(String(listing.quantity));
    }
  }, [listing.quantity, editing]);

  const commit = (): void => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0) {
      setValue(String(listing.quantity));
      setEditing(false);
      return;
    }
    if (n !== listing.quantity) {
      onSave(n);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-8 w-20 text-right tabular-nums"
        inputMode="numeric"
        value={value}
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            commit();
          }
          if (e.key === 'Escape') {
            setValue(String(listing.quantity));
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full rounded px-1 py-0.5 text-right tabular-nums hover:bg-muted/80"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {listing.quantity}
    </button>
  );
}

function PlatformBadge({ platform }: { platform: string }): ReactElement {
  const branding = getMarketplaceBranding(platform);
  return (
    <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50">
      <span aria-hidden>{branding.logo}</span>
      {branding.label}
    </Badge>
  );
}

export function ListingsTable({
  listings,
  selectedIds,
  showBuyBoxColumn = false,
  buyBoxMap,
  onToggleRow,
  onToggleAllOnPage,
  onInlinePriceSave,
  onInlineStockSave,
  onForceSync,
  onRemove,
  priceSavingId,
  stockSavingId,
}: Props): ReactElement {
  const pageIds = listings.map((l) => l.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  return (
    <ResponsiveTable>
      <div className="rounded-md border">
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px] p-2">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={(v) => {
                    onToggleAllOnPage(v === true);
                  }}
                  aria-label="Bu sayfadaki tüm listelemeleri seç"
                />
              </TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Fiyat</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              {showBuyBoxColumn ? <TableHead>BuyBox</TableHead> : null}
              <TableHead>Durum</TableHead>
              <TableHead>Son sync</TableHead>
              <TableHead className="w-[80px]">Aksiyonlar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => {
              const platformUrl = getListingPlatformUrl(
                listing.platform,
                listing.platformProductId,
                listing.barcode,
              );
              return (
                <TableRow key={listing.id} className="group relative">
                  <TableCell
                    className="w-[44px] p-2"
                    onClick={(e) => {
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
                  <TableCell className="max-w-[260px]">
                    <div className="flex items-start gap-3">
                      <ProductImage
                        src={listing.imageUrls[0]}
                        alt={listing.title}
                        size={40}
                        className="h-10 w-10 shrink-0 rounded-md"
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/listings/${listing.id}`}
                          className="block font-medium hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <span className="line-clamp-2">{listing.title}</span>
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground">
                          {listing.barcode}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PlatformBadge platform={listing.platform} />
                  </TableCell>
                  <TableCell className="text-right">
                    <InlinePriceCell
                      listing={listing}
                      saving={priceSavingId === listing.id}
                      onSave={(price) => {
                        onInlinePriceSave(listing, price);
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <InlineStockCell
                      listing={listing}
                      saving={stockSavingId === listing.id}
                      onSave={(stock) => {
                        onInlineStockSave(listing, stock);
                      }}
                    />
                  </TableCell>
                  {showBuyBoxColumn ? (
                    <TableCell>
                      <BuyBoxBadge listing={listing} buyBoxMap={buyBoxMap} />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={LISTING_STATUS_CLASS[listing.status]}
                    >
                      {LISTING_STATUS_LABEL[listing.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SyncStatusIndicator
                      platform={listing.platform}
                      lastSyncAt={listing.lastSyncAt}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {platformUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Platformda gör"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(platformUrl, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Diğer işlemler"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/listings/${listing.id}`}>Detay</Link>
                          </DropdownMenuItem>
                          {onForceSync ? (
                            <DropdownMenuItem
                              onClick={() => {
                                onForceSync(listing);
                              }}
                            >
                              Zorla sync et
                            </DropdownMenuItem>
                          ) : null}
                          {onRemove ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  onRemove(listing);
                                }}
                              >
                                Platformdan kaldır
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ResponsiveTable>
  );
}
