import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Camera, Check, Minus, Plus, ScanLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { BarcodeScanner } from '@/components/BarcodeScanner';
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
import { Label } from '@/components/ui/label';
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
import { getApiErrorMessage } from '@/lib/api';

import {
  fetchProductByBarcode,
  useProductByBarcode,
} from './hooks/useProductByBarcode';
import {
  useCreateStockCountSession,
  useUpsertStockCountItem,
} from './hooks/useStockCount';
import { useWarehouses } from './hooks/useStockManagement';

interface ScannedRow {
  barcode: string;
  name: string;
  systemQty: number;
  countedQty: number;
}

export function StockCountScanPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('stock.countScan.title'));

  const warehousesQ = useWarehouses();
  const createSession = useCreateStockCountSession();

  const [warehouseId, setWarehouseId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeBarcode, setActiveBarcode] = useState('');
  const [countedInput, setCountedInput] = useState('1');
  const [rows, setRows] = useState<ScannedRow[]>([]);
  const [saving, setSaving] = useState(false);

  const upsertItem = useUpsertStockCountItem(sessionId ?? undefined);

  const productQ = useProductByBarcode(
    activeBarcode || undefined,
    warehouseId || undefined,
  );

  useEffect(() => {
    if (warehousesQ.data?.length && !warehouseId) {
      const def =
        warehousesQ.data.find((w) => w.isDefault) ?? warehousesQ.data[0];
      setWarehouseId(def.id);
    }
  }, [warehousesQ.data, warehouseId]);

  useEffect(() => {
    if (!warehouseId) {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const session = await createSession.mutateAsync({
          warehouseId,
          countMode: 'FULL',
        });
        if (!cancelled) {
          setSessionId(session.id);
          setRows([]);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca depo değişince yeni oturum
  }, [warehouseId]);

  const onScan = (code: string): void => {
    setActiveBarcode(code);
    setCountedInput('1');
    setScannerOpen(false);
  };

  useEffect(() => {
    if (!activeBarcode || !productQ.data) {
      return;
    }
    const qty = productQ.data.systemQty > 0 ? productQ.data.systemQty : 1;
    setCountedInput(String(qty));
    toast.success(t('stock.countScan.scanned', { name: productQ.data.name }));
  }, [activeBarcode, productQ.data, t]);

  const addOrUpdateScan = useCallback(
    async (barcode: string, counted: number): Promise<void> => {
      const trimmed = barcode.trim();
      if (!trimmed || !sessionId) {
        toast.error(t('stock.countScan.sessionRequired'));
        return;
      }

      const existing = rows.find((r) => r.barcode === trimmed);
      const remote = existing
        ? null
        : await fetchProductByBarcode(trimmed, warehouseId);
      const lookup = {
        name: existing?.name ?? remote?.name ?? trimmed,
        systemQty:
          existing?.systemQty ??
          remote?.systemQty ??
          productQ.data?.systemQty ??
          0,
      };

      await upsertItem.mutateAsync({
        barcode: trimmed,
        countedQuantity: counted,
      });

      if (existing) {
        setRows((prev) =>
          prev.map((r) =>
            r.barcode === trimmed ? { ...r, countedQty: counted } : r,
          ),
        );
      } else {
        setRows((prev) => [
          {
            barcode: trimmed,
            name: lookup.name,
            systemQty: lookup.systemQty,
            countedQty: counted,
          },
          ...prev,
        ]);
      }
      toast.success(t('stock.countScan.saved'));
    },
    [rows, sessionId, upsertItem, productQ.data, t],
  );

  const confirmCurrent = (): void => {
    const qty = Number.parseInt(countedInput, 10);
    if (!activeBarcode.trim()) {
      toast.error(t('stock.countScan.scanFirst'));
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error(t('stock.countScan.invalidQty'));
      return;
    }
    setSaving(true);
    void addOrUpdateScan(activeBarcode, qty)
      .then(() => {
        setActiveBarcode('');
        setCountedInput('1');
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setSaving(false));
  };

  const totalDiff = useMemo(
    () => rows.reduce((s, r) => s + (r.countedQty - r.systemQty), 0),
    [rows],
  );

  const activeRow = rows.find((r) => r.barcode === activeBarcode);
  const displayName =
    productQ.data?.name ?? activeRow?.name ?? activeBarcode;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-1 pb-8 sm:gap-6 sm:px-0">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <ScanLine className="size-6 text-sky-500 dark:text-sky-400" aria-hidden />
          {t('stock.countScan.title')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('stock.countScan.subtitle')}
        </p>
        <Button variant="outline" size="sm" className="w-fit" asChild>
          <Link to="/stock/count">{t('stock.countScan.classic')}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('stock.countScan.session')}</CardTitle>
          <CardDescription>{t('stock.countScan.sessionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t('stock.warehouse')}</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('stock.countScan.selectWarehouse')} />
              </SelectTrigger>
              <SelectContent>
                {(warehousesQ.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            className="h-12 w-full text-base"
            size="lg"
            onClick={() => setScannerOpen(true)}
            disabled={!sessionId}
          >
            <Camera className="mr-2 size-5" aria-hidden />
            {t('stock.countScan.scan')}
          </Button>

          {(activeBarcode || activeRow) && (
            <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-950/30">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {activeBarcode}
              </p>
              <p className="text-sm">
                {t('stock.countScan.systemQty')}:{' '}
                <span className="font-semibold tabular-nums">
                  {(
                    productQ.data?.systemQty ??
                    activeRow?.systemQty ??
                    0
                  ).toLocaleString('tr-TR')}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="scan-qty" className="shrink-0">
                  {t('stock.countScan.counted')}
                </Label>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-11 shrink-0"
                  aria-label={t('stock.countScan.decrease')}
                  onClick={() =>
                    setCountedInput((v) =>
                      String(Math.max(0, Number.parseInt(v, 10) - 1 || 0)),
                    )
                  }
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="scan-qty"
                  inputMode="numeric"
                  className="h-11 text-center text-lg"
                  value={countedInput}
                  onChange={(e) => setCountedInput(e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-11 shrink-0"
                  aria-label={t('stock.countScan.increase')}
                  onClick={() =>
                    setCountedInput((v) =>
                      String((Number.parseInt(v, 10) || 0) + 1),
                    )
                  }
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={saving || upsertItem.isPending}
                onClick={confirmCurrent}
              >
                {t('common.save')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">{t('stock.countScan.list')}</CardTitle>
            <CardDescription>
              {t('stock.countScan.listSummary', {
                count: rows.length,
                diff: totalDiff > 0 ? `+${totalDiff}` : String(totalDiff),
              })}
            </CardDescription>
          </div>
          {rows.length > 0 ? (
            <Badge variant="secondary">{rows.length}</Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t('stock.countScan.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stock.countScan.product')}</TableHead>
                    <TableHead className="text-right">
                      {t('stock.countScan.systemQty')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('stock.countScan.counted')}
                    </TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.barcode}>
                      <TableCell>
                        <div className="line-clamp-1 text-sm font-medium">
                          {row.name}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.barcode}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.systemQty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {row.countedQty}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-10"
                          aria-label={t('common.delete')}
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((r) => r.barcode !== row.barcode),
                            )
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {sessionId && rows.length > 0 ? (
            <Button type="button" className="mt-4 h-11 w-full" size="lg" asChild>
              <Link to={`/stock/count?session=${sessionId}`}>
                <Check className="mr-2 size-5" aria-hidden />
                {t('stock.countScan.finish')}
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onScan}
      />
    </div>
  );
}
