import type { ReactElement } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { StockMovementDto } from '@/types/stock';

interface Props {
  barcode: string;
}

const MOVEMENT_TYPE_KEYS: Record<string, string> = {
  ADJUSTMENT: 'products.stockHistory.types.adjustment',
  PURCHASE: 'products.stockHistory.types.purchase',
  SALE: 'products.stockHistory.types.sale',
  RETURN: 'products.stockHistory.types.return',
  TRANSFER: 'products.stockHistory.types.transfer',
  RESERVATION: 'products.stockHistory.types.reservation',
  RELEASE: 'products.stockHistory.types.release',
};

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

function movementSource(row: StockMovementDto): string {
  if (row.orderId) {
    return `Sipariş`;
  }
  if (row.platform) {
    const branding = getMarketplaceBranding(row.platform);
    return branding.label;
  }
  if (row.note?.trim()) {
    return row.note.trim();
  }
  return 'Merkezi';
}

export function ProductStockHistoryTab({ barcode }: Props): ReactElement {
  const { t } = useTranslation();

  const historyQuery = useQuery({
    queryKey: ['stock', 'history', 'product', barcode],
    queryFn: async () => {
      const { data } = await api.get<{ data: StockMovementDto[]; total: number }>(
        '/stock/history',
        {
          params: { barcode, limit: 50, page: 1 },
        },
      );
      return data;
    },
    enabled: barcode.trim().length > 0,
  });

  const rows = historyQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('products.tabs.stockHistory')}</CardTitle>
        <CardDescription>{t('products.stockHistory.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {historyQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading', { defaultValue: 'Yükleniyor…' })}
          </div>
        ) : historyQuery.isError ? (
          <p className="text-destructive text-sm">
            {getApiErrorMessage(historyQuery.error)}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('products.stockHistory.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('products.stockHistory.date')}</TableHead>
                  <TableHead>{t('products.stockHistory.type')}</TableHead>
                  <TableHead className="text-right">
                    {t('products.stockHistory.quantity')}
                  </TableHead>
                  <TableHead>{t('products.stockHistory.source')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const typeKey = MOVEMENT_TYPE_KEYS[row.movementType];
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {typeKey ? t(typeKey) : row.movementType}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        <span
                          className={
                            row.quantity >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-destructive'
                          }
                        >
                          {row.quantity >= 0 ? '+' : ''}
                          {row.quantity.toLocaleString('tr-TR')}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {movementSource(row)}
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
