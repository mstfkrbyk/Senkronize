import type { ReactElement } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import { StockBadge } from '@/components/StockBadge';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { StockEntry } from '@/types/stock';

interface Props {
  entries: StockEntry[];
}

function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), {
      addSuffix: true,
      locale: tr,
    });
  } catch {
    return iso;
  }
}

function platformLabel(platform: string | null): string {
  if (!platform || platform === 'null') {
    return 'Merkezi';
  }
  return getMarketplaceBranding(platform).label;
}

export function StockTable({ entries }: Props): ReactElement {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-[700px] w-full sm:min-w-0">
        <div className="rounded-md border">
          <Table className="min-w-[700px] sm:min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Ürün adı</TableHead>
            <TableHead>Barkod</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className="text-right">Stok</TableHead>
            <TableHead className="text-right">Rezerve</TableHead>
            <TableHead className="text-right">Kullanılabilir</TableHead>
            <TableHead>Son güncelleme</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[220px] font-medium">
                <span className="line-clamp-2">
                  {row.product?.name ?? row.barcode}
                </span>
                {row.product?.sku ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    SKU: {row.product.sku}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
              <TableCell>
                {!row.platform || row.platform === 'null' ? (
                  <Badge variant="outline" className="border-slate-200 bg-slate-50">
                    Merkezi
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <span aria-hidden>
                      {getMarketplaceBranding(row.platform).logo}
                    </span>
                    {platformLabel(row.platform)}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <StockBadge quantity={row.quantity} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.reservedQty}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {row.availableQty}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelative(row.updatedAt)}
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
