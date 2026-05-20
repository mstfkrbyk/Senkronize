import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { api } from '@/lib/api';
import type { StockListResponse } from '@/types/stock';

import { useCreateStockCountSession } from './hooks/useStockCount';
import { useWarehouses } from './hooks/useStockManagement';

interface ScannedRow {
  barcode: string;
  name: string;
  systemQty: number;
  countedQty: number;
}

export function StockCountScanPage(): ReactElement {
  usePageTitle('Barkod ile sayım');
  const navigate = useNavigate();

  const warehousesQ = useWarehouses();
  const createSession = useCreateStockCountSession();

  const [warehouseId, setWarehouseId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeBarcode, setActiveBarcode] = useState('');
  const [countedInput, setCountedInput] = useState('1');
  const [rows, setRows] = useState<ScannedRow[]>([]);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (warehousesQ.data?.length && !warehouseId) {
      const def =
        warehousesQ.data.find((w) => w.isDefault) ?? warehousesQ.data[0];
      setWarehouseId(def.id);
    }
  }, [warehousesQ.data, warehouseId]);

  const lookupProduct = useCallback(
    async (barcode: string): Promise<{ name: string; systemQty: number }> => {
      const { data } = await api.get<StockListResponse>('/stock', {
        params: { search: barcode, limit: 5, page: 1, warehouseId },
      });
      const match =
        data.items.find((i) => i.barcode === barcode) ?? data.items[0];
      return {
        name: match?.product?.name ?? barcode,
        systemQty: match?.quantity ?? 0,
      };
    },
    [warehouseId],
  );

  const addOrUpdateScan = useCallback(
    async (barcode: string, counted: number): Promise<void> => {
      const trimmed = barcode.trim();
      if (!trimmed) {
        return;
      }
      const existing = rows.find((r) => r.barcode === trimmed);
      if (existing) {
        setRows((prev) =>
          prev.map((r) =>
            r.barcode === trimmed ? { ...r, countedQty: counted } : r,
          ),
        );
        return;
      }
      try {
        const { name, systemQty } = await lookupProduct(trimmed);
        setRows((prev) => [
          { barcode: trimmed, name, systemQty, countedQty: counted },
          ...prev,
        ]);
      } catch {
        setRows((prev) => [
          {
            barcode: trimmed,
            name: trimmed,
            systemQty: 0,
            countedQty: counted,
          },
          ...prev,
        ]);
      }
    },
    [lookupProduct, rows],
  );

  const onScan = async (code: string): Promise<void> => {
    setActiveBarcode(code);
    setCountedInput('1');
    setScannerOpen(false);
    try {
      const { name, systemQty } = await lookupProduct(code);
      setActiveBarcode(code);
      setCountedInput(String(systemQty > 0 ? systemQty : 1));
      toast.success(`${name} okundu`);
    } catch {
      toast.info('Ürün bulunamadı; miktarı girin.');
    }
  };

  const confirmCurrent = (): void => {
    const qty = Number.parseInt(countedInput, 10);
    if (!activeBarcode.trim()) {
      toast.error('Önce barkod okutun.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Geçerli miktar girin.');
      return;
    }
    void addOrUpdateScan(activeBarcode, qty);
    setActiveBarcode('');
    setCountedInput('1');
  };

  const totalDiff = useMemo(
    () => rows.reduce((s, r) => s + (r.countedQty - r.systemQty), 0),
    [rows],
  );

  const finishSession = async (): Promise<void> => {
    if (!warehouseId) {
      toast.error('Depo seçin.');
      return;
    }
    if (rows.length === 0) {
      toast.error('En az bir ürün tarayın.');
      return;
    }
    setFinishing(true);
    try {
      const session = await createSession.mutateAsync({
        warehouseId,
        countMode: 'FULL',
      });
      for (const row of rows) {
        await api.post(`/stock/count-sessions/${session.id}/items`, {
          barcode: row.barcode,
          countedQuantity: row.countedQty,
        });
      }
      toast.success('Sayım oturumu oluşturuldu');
      navigate(`/stock/count?session=${session.id}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  const activeRow = rows.find((r) => r.barcode === activeBarcode);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ScanLine className="size-6 text-sky-500" aria-hidden />
            Barkod ile sayım
          </h1>
          <p className="text-muted-foreground text-sm">
            Kamera veya okuyucu ile tarayın; oturum bitince fark raporuna gidin.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/stock/count">Klasik sayım</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oturum</CardTitle>
          <CardDescription>Depo seçin ve taramaya başlayın</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Depo</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Depo seçin" />
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
            className="w-full"
            size="lg"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="mr-2 size-5" aria-hidden />
            Barkod tara
          </Button>

          {(activeBarcode || activeRow) && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
              <p className="text-sm font-medium">
                {activeRow?.name ?? activeBarcode}
              </p>
              <p className="text-muted-foreground text-xs font-mono">
                {activeBarcode}
              </p>
              <p className="text-sm">
                Mevcut stok:{' '}
                <span className="font-semibold tabular-nums">
                  {(activeRow?.systemQty ?? 0).toLocaleString('tr-TR')}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="scan-qty" className="shrink-0">
                  Sayılan
                </Label>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Azalt"
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
                  className="text-center"
                  value={countedInput}
                  onChange={(e) => setCountedInput(e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Artır"
                  onClick={() =>
                    setCountedInput((v) =>
                      String((Number.parseInt(v, 10) || 0) + 1),
                    )
                  }
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button type="button" className="w-full" onClick={confirmCurrent}>
                Listeye ekle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Taranan ürünler</CardTitle>
            <CardDescription>
              {rows.length} kalem · Net fark:{' '}
              <span
                className={
                  totalDiff < 0
                    ? 'text-destructive font-medium'
                    : totalDiff > 0
                      ? 'text-emerald-600 font-medium'
                      : ''
                }
              >
                {totalDiff > 0 ? '+' : ''}
                {totalDiff}
              </span>
            </CardDescription>
          </div>
          {rows.length > 0 ? (
            <Badge variant="secondary">{rows.length}</Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              Henüz taranan ürün yok.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Sistem</TableHead>
                    <TableHead className="text-right">Sayılan</TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.barcode}>
                      <TableCell>
                        <div className="text-sm font-medium line-clamp-1">
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
                          aria-label="Kaldır"
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

          <Button
            type="button"
            className="mt-4 w-full"
            size="lg"
            disabled={finishing || rows.length === 0}
            onClick={() => void finishSession()}
          >
            <Check className="mr-2 size-5" aria-hidden />
            Oturumu tamamla ve fark raporuna git
          </Button>
        </CardContent>
      </Card>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => void onScan(code)}
      />
    </div>
  );
}
