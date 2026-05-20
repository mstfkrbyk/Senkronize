import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { toast } from 'sonner';
import { Camera, FileDown, Minus, Plus, ScanLine, Upload } from 'lucide-react';

import { BarcodeScanner } from '@/components/BarcodeScanner';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  BARCODE_PRIORITY_STOCK_COUNT,
  useBarcodeInputClaim,
} from '@/hooks/useBarcodeInput';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { StockCountModeApi } from '@/types/stock-count';

import {
  useApplyStockCountSession,
  useCancelStockCountSession,
  useCreateStockCountSession,
  useExportStockCountPdf,
  useImportStockCountCsv,
  useStockCountSession,
  useUpsertStockCountItem,
} from './hooks/useStockCount';
import { useWarehouses } from './hooks/useStockManagement';

function platformCellLabel(raw: string | null): string {
  if (!raw || raw === 'Merkezi') {
    return 'Merkezi';
  }
  try {
    return getMarketplaceBranding(raw).label;
  } catch {
    return raw;
  }
}

function diffClass(d: number): string {
  if (d < 0) {
    return 'text-destructive font-medium';
  }
  if (d > 0) {
    return 'text-emerald-600 font-medium';
  }
  return 'text-muted-foreground';
}

export function StockCountPage(): ReactElement {
  usePageTitle('Stok sayımı');
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');

  const sessionQ = useStockCountSession(sessionId);
  const warehousesQ = useWarehouses();
  const createMut = useCreateStockCountSession();
  const upsertMut = useUpsertStockCountItem(sessionId ?? undefined);
  const applyMut = useApplyStockCountSession(sessionId ?? undefined);
  const cancelMut = useCancelStockCountSession(sessionId ?? undefined);
  const exportPdfMut = useExportStockCountPdf(sessionId ?? undefined);
  const importCsvMut = useImportStockCountCsv(sessionId ?? undefined);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [countMode, setCountMode] = useState<StockCountModeApi>('FULL');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const [draftBarcode, setDraftBarcode] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const session = sessionQ.data;
  const inProgress = session?.status === 'IN_PROGRESS';

  const onGlobalBarcode = useCallback(
    (code: string) => {
      if (!sessionId || !inProgress) {
        return;
      }
      setDraftBarcode(code);
      void barcodeRef.current?.focus();
    },
    [sessionId, inProgress],
  );

  useBarcodeInputClaim(
    'stock-count-active',
    BARCODE_PRIORITY_STOCK_COUNT,
    onGlobalBarcode,
    Boolean(sessionId && inProgress),
  );

  useEffect(() => {
    if (warehousesQ.data?.length && !warehouseId) {
      const def =
        warehousesQ.data.find((w) => w.isDefault) ?? warehousesQ.data[0];
      setWarehouseId(def.id);
    }
  }, [warehousesQ.data, warehouseId]);

  const resetDraft = useCallback((): void => {
    setDraftBarcode('');
    setDraftQty('1');
    void barcodeRef.current?.focus();
  }, []);

  const submitDraft = useCallback(async (): Promise<void> => {
    const bc = draftBarcode.trim();
    const qty = Number.parseInt(draftQty, 10);
    if (!bc) {
      toast.error('Barkod girin.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Geçerli bir miktar girin.');
      return;
    }
    try {
      await upsertMut.mutateAsync({ barcode: bc, countedQuantity: qty });
      toast.success('Sayım satırı güncellendi');
      resetDraft();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }, [draftBarcode, draftQty, resetDraft, upsertMut]);

  const startSession = async (): Promise<void> => {
    if (!warehouseId) {
      toast.error('Depo seçin.');
      return;
    }
    try {
      const row = await createMut.mutateAsync({
        warehouseId,
        countMode,
        filterBrand: countMode === 'PARTIAL' ? filterBrand : undefined,
        filterCategory: countMode === 'PARTIAL' ? filterCategory : undefined,
      });
      setWizardOpen(false);
      setParams({ session: row.id });
      toast.success('Sayım oturumu başlatıldı');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const adjustRow = async (barcode: string, next: number): Promise<void> => {
    const safe = Math.max(0, next);
    try {
      await upsertMut.mutateAsync({ barcode, countedQuantity: safe });
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const summary = useMemo(() => {
    if (session?.varianceSummary) {
      return {
        loss: session.items.filter((it) => it.difference < 0).length,
        gain: session.items.filter((it) => it.difference > 0).length,
        neutral: session.items.filter((it) => it.difference === 0).length,
        totalValue: session.varianceSummary.totalDifferenceValue,
        hasVariance: session.varianceSummary.itemsWithVariance > 0,
      };
    }
    if (!session?.items.length) {
      return { loss: 0, gain: 0, neutral: 0, totalValue: 0, hasVariance: false };
    }
    let loss = 0;
    let gain = 0;
    let neutral = 0;
    for (const it of session.items) {
      if (it.difference < 0) {
        loss += 1;
      } else if (it.difference > 0) {
        gain += 1;
      } else {
        neutral += 1;
      }
    }
    return {
      loss,
      gain,
      neutral,
      totalValue: 0,
      hasVariance: loss + gain > 0,
    };
  }, [session?.items, session?.varianceSummary]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stok sayımı</h1>
          <p className="text-muted-foreground text-sm">
            Depo bazlı sayım, barkod ile giriş ve farkların merkezi stoğa
            uygulanması.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/stock">Stok yönetimine dön</Link>
          </Button>
          {!sessionId || session?.status !== 'IN_PROGRESS' ? (
            <Button type="button" onClick={() => setWizardOpen(true)}>
              Yeni sayım başlat
            </Button>
          ) : null}
        </div>
      </div>

      {sessionQ.isLoading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : null}
      {sessionQ.isError ? (
        <p className="text-destructive text-sm">Oturum yüklenemedi.</p>
      ) : null}

      {session ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Oturum · {session.warehouseName} ({session.warehouseCode})
            </CardTitle>
            <CardDescription>
              Mod: {session.countMode === 'FULL' ? 'Tam sayım' : 'Kısmi sayım'}
              {session.countMode === 'PARTIAL' ? (
                <>
                  {' '}
                  · Marka: {session.filterBrand ?? '—'} · Kategori:{' '}
                  {session.filterCategory ?? '—'}
                </>
              ) : null}
              <span className="ml-2">
                <Badge variant="secondary">
                  {session.status === 'IN_PROGRESS'
                    ? 'Devam ediyor'
                    : session.status === 'COMPLETED'
                      ? 'Tamamlandı'
                      : 'İptal'}
                </Badge>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {session.status === 'IN_PROGRESS' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exportPdfMut.isPending}
                    onClick={() =>
                      void exportPdfMut
                        .mutateAsync()
                        .then(() => toast.success('Sayım formu indirildi'))
                        .catch((e) => toast.error(getApiErrorMessage(e)))
                    }
                  >
                    <FileDown className="mr-1 size-4" />
                    Sayım Formu PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importCsvMut.isPending}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <Upload className="mr-1 size-4" />
                    Sonuç Yükle (CSV)
                  </Button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      void importCsvMut
                        .mutateAsync(file)
                        .then((r) =>
                          toast.success(
                            `Yüklendi · ${r.imported} satır, ${r.skipped} atlandı`,
                          ),
                        )
                        .catch((err) => toast.error(getApiErrorMessage(err)));
                    }}
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Sayım girişi</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="grid flex-1 gap-2">
                      <Label htmlFor="count-barcode">Barkod</Label>
                      <div className="flex gap-2">
                        <Input
                          ref={barcodeRef}
                          id="count-barcode"
                          value={draftBarcode}
                          onChange={(e) => setDraftBarcode(e.target.value)}
                          placeholder="Okutun veya yazın"
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void qtyRef.current?.focus();
                              void qtyRef.current?.select();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Kamera ile tara"
                          onClick={() => setScannerOpen(true)}
                        >
                          <Camera className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid w-full gap-2 sm:w-40">
                      <Label htmlFor="count-qty">Sayılan</Label>
                      <Input
                        ref={qtyRef}
                        id="count-qty"
                        inputMode="numeric"
                        value={draftQty}
                        onChange={(e) => setDraftQty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void submitDraft();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      className="sm:mb-0.5"
                      onClick={() => void submitDraft()}
                      disabled={upsertMut.isPending}
                    >
                      Satırı kaydet
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Hızlı giriş: barkod → Enter → miktar → Enter. USB okuyucu veya
                    üstteki kamera ikonunu kullanın.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Barkod</TableHead>
                        <TableHead>Ürün</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Beklenen</TableHead>
                        <TableHead className="text-right">Sayılan</TableHead>
                        <TableHead className="text-right">Fark</TableHead>
                        <TableHead className="text-right">Fark değeri</TableHead>
                        <TableHead className="w-[140px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {session.items.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-muted-foreground h-24 text-center"
                          >
                            Henüz sayım satırı yok.
                          </TableCell>
                        </TableRow>
                      ) : (
                        session.items.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-sm">
                              {row.barcode}
                            </TableCell>
                            <TableCell>
                              {row.productName ?? '—'}
                              {row.productId ? (
                                <Button
                                  variant="link"
                                  className="h-auto px-1 py-0 text-xs"
                                  asChild
                                >
                                  <Link to={`/products/${row.productId}`}>
                                    Detay
                                  </Link>
                                </Button>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-sm">
                              {platformCellLabel(row.platformLabel)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.systemQuantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.countedQuantity}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${diffClass(row.difference)}`}
                            >
                              {row.difference > 0
                                ? `+${row.difference}`
                                : row.difference}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${diffClass(row.difference)}`}
                            >
                              {row.differenceValue !== null
                                ? `${row.differenceValue.toLocaleString('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} ₺`
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label="Azalt"
                                  disabled={upsertMut.isPending}
                                  onClick={() =>
                                    void adjustRow(
                                      row.barcode,
                                      row.countedQuantity - 1,
                                    )
                                  }
                                >
                                  <Minus className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label="Artır"
                                  disabled={upsertMut.isPending}
                                  onClick={() =>
                                    void adjustRow(
                                      row.barcode,
                                      row.countedQuantity + 1,
                                    )
                                  }
                                >
                                  <Plus className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Sayım özeti</p>
                      <p className="text-muted-foreground text-xs">
                        Kayıp satırı: {summary.loss} · Fazla: {summary.gain} · Denk:{' '}
                        {summary.neutral}
                        {summary.totalValue !== 0 ? (
                          <>
                            {' '}
                            · Net fark değeri:{' '}
                            <span className={diffClass(summary.totalValue > 0 ? 1 : -1)}>
                              {summary.totalValue.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              ₺
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={cancelMut.isPending}
                        onClick={() =>
                          void cancelMut
                            .mutateAsync()
                            .then(() => {
                              toast.success('Oturum iptal edildi');
                              setParams({});
                            })
                            .catch((e) =>
                              toast.error(getApiErrorMessage(e)),
                            )
                        }
                      >
                        İptal et
                      </Button>
                      {summary.hasVariance ? (
                        <Button
                          type="button"
                          disabled={!session.items.length || applyMut.isPending}
                          onClick={() => setApplyOpen(true)}
                        >
                          Stoku Güncelle
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled
                          title="Fark bulunmuyor"
                        >
                          Stoku Güncelle
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Bu oturum kapatıldı. Yeni sayım için &quot;Yeni sayım başlat&quot;ı
                kullanın.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Başlamak için</CardTitle>
            <CardDescription>
              Aktif bir oturum seçili değil. Yeni bir sayım başlatın veya stok
              yönetimi ekranından dönün.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-md gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="size-5" aria-hidden />
              Yeni sayım oturumu
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Depo</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Depo seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(warehousesQ.data ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sayım modu</Label>
              <Select
                value={countMode}
                onValueChange={(v) => setCountMode(v as StockCountModeApi)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Tam sayım</SelectItem>
                  <SelectItem value="PARTIAL">
                    Kısmi sayım (marka / kategori)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {countMode === 'PARTIAL' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="f-brand">Marka filtresi</Label>
                  <Input
                    id="f-brand"
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    placeholder="ör. ACME"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="f-cat">Kategori filtresi</Label>
                  <Input
                    id="f-cat"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    placeholder="ör. Giyim"
                  />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWizardOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={() => void startSession()}
              disabled={createMut.isPending || warehousesQ.isLoading}
            >
              Başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setDraftBarcode(code);
          setScannerOpen(false);
          void barcodeRef.current?.focus();
        }}
      />

      <AlertDialog open={applyOpen} onOpenChange={setApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stok güncellensin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Sayım farkları merkezi stoğa (depo: {session?.warehouseName ?? ''})
              uygulanır ve her değişiklik için düzeltme hareketi oluşturulur.
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void applyMut
                  .mutateAsync()
                  .then((r) => {
                    toast.success(`Uygulandı · ${r.applied} satır güncellendi`);
                    setApplyOpen(false);
                    void sessionQ.refetch();
                  })
                  .catch((err) =>
                    toast.error(getApiErrorMessage(err)),
                  );
              }}
            >
              Onayla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
