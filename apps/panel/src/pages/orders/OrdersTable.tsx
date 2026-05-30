import type { ReactElement } from 'react';

import { FileDown, Loader2, Tag, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ORDER_STATUS_CONFIG, orderStatusTone } from '@/lib/order-status';
import { ORDER_STATUS_I18N_KEY } from '@/lib/order-i18n';
import { CARGO_PROVIDER_OPTIONS, normalizeCargoProviderKey } from '@/lib/cargo-providers';
import { formatDateWithTimezone, getStoredTimezone } from '@/lib/timezone';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { OrderPageInvoiceHint } from '@/pages/orders/hooks/useOrdersPageInvoices';
import { OrderRowErpHint } from '@/pages/orders/OrderRowErpHint';
import { OrderRowInvoiceHint } from '@/pages/orders/OrderRowInvoiceHint';
import type { Order, OrderStatus } from '@/types/order';

interface Props {
  orders: Order[];
  selectedIds: Set<string>;
  onToggleRow: (id: string, selected: boolean) => void;
  onToggleAllOnPage: (selected: boolean) => void;
  onRowClick: (order: Order) => void;
  onPrintLabel?: (order: Order) => void;
  onShip?: (order: Order) => void;
  onDownloadInvoice?: (order: Order) => void;
  labelLoadingId?: string | null;
  invoiceLoadingId?: string | null;
  showNativeAccountingInvoice?: boolean;
  showExternalErpInvoice?: boolean;
  externalErpHintsLoading?: boolean;
  invoiceHintsByOrderId?: Map<string, OrderPageInvoiceHint>;
  invoiceHintsLoading?: boolean;
  invoiceCreatingOrderId?: string | null;
  onCreateInvoiceFromOrder?: (orderId: string) => void;
}

function cargoLabel(provider: string | null): string {
  if (!provider?.trim()) {
    return '—';
  }
  const key = normalizeCargoProviderKey(provider);
  const found = CARGO_PROVIDER_OPTIONS.find((o) => o.value === key);
  return found?.label ?? provider;
}

function itemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function formatTry(amount: string, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(Number(amount));
}

function formatDate(iso: string, locale: string): string {
  return formatDateWithTimezone(iso, locale, getStoredTimezone());
}

function PlatformBadge({ platform }: { platform: string }): ReactElement {
  const tone: Record<string, string> = {
    TRENDYOL:
      'border-orange-300/80 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-100',
    HEPSIBURADA:
      'border-red-300/80 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100',
  };
  const branding = getMarketplaceBranding(platform);
  return (
    <Badge
      variant="outline"
      className={
        tone[platform] ??
        'border-border bg-muted/50 text-foreground dark:bg-muted/30'
      }
    >
      <span className="mr-1" aria-hidden>
        {branding.logo}
      </span>
      {branding.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: OrderStatus }): ReactElement {
  const { t } = useTranslation();
  const config = ORDER_STATUS_CONFIG[status];
  const Icon = config?.icon;
  const label = config?.label ?? t(ORDER_STATUS_I18N_KEY[status]);
  return (
    <Badge variant="outline" className={`gap-1 ${orderStatusTone(status)}`}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {label}
    </Badge>
  );
}

export function OrdersTable({
  orders,
  selectedIds,
  onToggleRow,
  onToggleAllOnPage,
  onRowClick,
  onPrintLabel,
  onShip,
  onDownloadInvoice,
  labelLoadingId,
  invoiceLoadingId,
  showNativeAccountingInvoice = false,
  showExternalErpInvoice = false,
  externalErpHintsLoading = false,
  invoiceHintsByOrderId,
  invoiceHintsLoading = false,
  invoiceCreatingOrderId = null,
  onCreateInvoiceFromOrder,
}: Props): ReactElement {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('en') ? 'en' : 'tr';
  const pageIds = orders.map((o) => o.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));
  const showActions = Boolean(onPrintLabel || onShip || onDownloadInvoice);

  return (
    <ResponsiveTable>
      <div className="rounded-md border border-border bg-card">
        <Table className="min-w-[760px]">
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
                  aria-label={t('common.selectAllOnPage')}
                />
              </TableHead>
              <TableHead>{t('common.platform')}</TableHead>
              <TableHead>{t('common.orderNumber')}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {t('common.customer')}
              </TableHead>
              <TableHead className="hidden md:table-cell text-right">Ürün</TableHead>
              <TableHead className="text-right">{t('common.amount')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              {showNativeAccountingInvoice ? (
                <TableHead className="hidden md:table-cell w-[88px]">
                  {t('orders.list.invoiceColumn')}
                </TableHead>
              ) : null}
              {showExternalErpInvoice ? (
                <TableHead className="hidden md:table-cell w-[96px]">
                  {t('orders.list.erpColumn')}
                </TableHead>
              ) : null}
              <TableHead className="hidden lg:table-cell">Kargo</TableHead>
              <TableHead className="hidden xl:table-cell">{t('common.date')}</TableHead>
              {showActions ? (
                <TableHead className="hidden lg:table-cell w-[120px]">
                  {t('common.actions')}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className="group cursor-pointer"
                onClick={() => {
                  onRowClick(order);
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
                    checked={selectedIds.has(order.id)}
                    onCheckedChange={(v) => {
                      onToggleRow(order.id, v === true);
                    }}
                    aria-label={`Seç: ${order.platformOrderId}`}
                  />
                </TableCell>
                <TableCell>
                  <PlatformBadge platform={order.platform} />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {order.platformOrderId}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{order.customerName}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {itemCount(order)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTry(order.totalAmount, order.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                {showNativeAccountingInvoice ? (
                  <TableCell
                    className="hidden md:table-cell"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <OrderRowInvoiceHint
                      orderId={order.id}
                      invoice={invoiceHintsByOrderId?.get(order.id)?.invoice ?? null}
                      loading={invoiceHintsLoading}
                      creating={invoiceCreatingOrderId === order.id}
                      onCreate={(id) => {
                        onCreateInvoiceFromOrder?.(id);
                      }}
                    />
                  </TableCell>
                ) : null}
                {showExternalErpInvoice ? (
                  <TableCell
                    className="hidden md:table-cell"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <OrderRowErpHint orderId={order.id} loading={externalErpHintsLoading} />
                  </TableCell>
                ) : null}
                <TableCell className="hidden max-w-[120px] truncate text-sm lg:table-cell">
                  {cargoLabel(order.cargoProvider)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  {formatDate(order.platformCreatedAt, dateLocale)}
                </TableCell>
                {showActions ? (
                  <TableCell
                    className="hidden lg:table-cell"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {onPrintLabel ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Etiketi yazdır"
                          aria-label="Etiketi yazdır"
                          disabled={labelLoadingId === order.id}
                          onClick={() => {
                            onPrintLabel(order);
                          }}
                        >
                          {labelLoadingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Tag className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      ) : null}
                      {onShip ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Kargoya ver"
                          aria-label="Kargoya ver"
                          onClick={() => {
                            onShip(order);
                          }}
                        >
                          <Truck className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {onDownloadInvoice ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Fatura indir"
                          aria-label="Fatura indir"
                          disabled={invoiceLoadingId === order.id}
                          onClick={() => {
                            onDownloadInvoice(order);
                          }}
                        >
                          {invoiceLoadingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <FileDown className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ResponsiveTable>
  );
}
