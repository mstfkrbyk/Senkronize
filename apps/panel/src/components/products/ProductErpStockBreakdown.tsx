import type { ReactElement } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorMessage } from '@/lib/api';
import { erpConnectionDisplayName, erpConnectionRoleLabel } from '@/lib/erp-connection-display';
import { getErpDisplay } from '@/lib/platform-display';
import type { ErpStockBreakdown } from '@/types/stock';

interface Props {
  barcode: string | null;
}

export function ProductErpStockBreakdown({ barcode }: Props): ReactElement | null {
  const trimmed = barcode?.trim() ?? '';

  const breakdownQuery = useQuery({
    queryKey: ['stock', 'erp-sources', trimmed],
    queryFn: async (): Promise<ErpStockBreakdown> => {
      const { data } = await api.get<{ data: ErpStockBreakdown }>(
        `/stock/erp-sources/${encodeURIComponent(trimmed)}`,
      );
      return data.data;
    },
    enabled: trimmed.length > 0,
  });

  if (trimmed.length === 0) {
    return null;
  }

  const sources = breakdownQuery.data?.sources ?? [];

  if (!breakdownQuery.isLoading && !breakdownQuery.isError && sources.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">ERP kaynak stokları</CardTitle>
        <CardDescription>
          Merkezi stok, bağlı ERP kaynaklarının toplamından hesaplanır.
          {breakdownQuery.data
            ? ` Birleşik: ${breakdownQuery.data.mergedTotal.toLocaleString('tr-TR')} adet`
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {breakdownQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Yükleniyor…
          </div>
        ) : breakdownQuery.isError ? (
          <p className="text-destructive text-sm">{getApiErrorMessage(breakdownQuery.error)}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ERP bağlantısı</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Depo</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((row) => {
                  const erpLabel = erpConnectionDisplayName({
                    erpType: row.erpType,
                    displayName: row.displayName,
                  });
                  const erpLogo = getErpDisplay(row.erpType).logo;
                  return (
                    <TableRow key={`${row.erpConnectionId}-${row.warehouseCode}`}>
                      <TableCell className="text-sm">
                        <span className="mr-1.5" aria-hidden>
                          {erpLogo}
                        </span>
                        {erpLabel}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {erpConnectionRoleLabel(row.role)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.warehouseName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {row.quantity.toLocaleString('tr-TR')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
