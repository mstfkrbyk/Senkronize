import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api';
import type { ProductListItem } from '@/types/product';
import type { TransferStatusApi } from '@/types/stock-transfer';

import {
  useCancelStockTransfer,
  useConfirmStockTransfer,
  useCreateStockTransfer,
  useStockTransfer,
  useStockTransfers,
} from './hooks/useStockTransfer';
import { useWarehouses } from './hooks/useStockManagement';

const STATUS_LABEL: Record<TransferStatusApi, string> = {
  DRAFT: 'Bekleyen',
  IN_TRANSIT: 'Transit',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

const STATUS_VARIANT: Record<
  TransferStatusApi,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'secondary',
  IN_TRANSIT: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

interface DraftLine {
  key: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: string;
}

function TransferTimeline({
  status,
  createdAt,
  completedAt,
}: {
  status: TransferStatusApi;
  createdAt: string;
  completedAt: string | null;
}): ReactElement {
  const steps = [
    { key: 'DRAFT', label: 'Oluşturuldu', icon: Circle },
    { key: 'IN_TRANSIT', label: 'Transit', icon: Truck },
    { key: 'COMPLETED', label: 'Tamamlandı', icon: CheckCircle2 },
  ] as const;

  const currentIdx =
    status === 'CANCELLED'
      ? -1
      : status === 'COMPLETED'
        ? 2
        : status === 'IN_TRANSIT'
          ? 1
          : 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      {steps.map((step, idx) => {
        const done = currentIdx >= idx;
        const Icon = step.icon;
        const dateLabel =
          step.key === 'DRAFT'
            ? format(new Date(createdAt), 'd MMM yyyy HH:mm', { locale: tr })
            : step.key === 'COMPLETED' && completedAt
              ? format(new Date(completedAt), 'd MMM yyyy HH:mm', {
                  locale: tr,
                })
              : null;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full border ${
                done
                  ? 'border-sky-500 bg-sky-50 text-sky-600'
                  : 'border-muted text-muted-foreground'
              }`}
            >
              <Icon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{step.label}</p>
              {dateLabel ? (
                <p className="text-muted-foreground text-xs">{dateLabel}</p>
              ) : null}
            </div>
            {idx < steps.length - 1 ? (
              <div className="bg-border mx-2 hidden h-px w-8 sm:block" />
            ) : null}
          </div>
        );
      })}
      {status === 'CANCELLED' ? (
        <Badge variant="destructive">İptal edildi</Badge>
      ) : null}
    </div>
  );
}

function TransferDetailView({ id }: { id: string }): ReactElement {
  usePageTitle('Transfer detayı');
  const navigate = useNavigate();
  const transferQ = useStockTransfer(id);
  const confirmMut = useConfirmStockTransfer();
  const cancelMut = useCancelStockTransfer();

  const transfer = transferQ.data;
  const canAct =
    transfer?.status === 'DRAFT' || transfer?.status === 'IN_TRANSIT';

  const onConfirm = async (): Promise<void> => {
    try {
      await confirmMut.mutateAsync(id);
      toast.success('Transfer onaylandı, stok hareketleri oluşturuldu');
      void transferQ.refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const onCancel = async (): Promise<void> => {
    try {
      await cancelMut.mutateAsync(id);
      toast.success('Transfer iptal edildi');
      void transferQ.refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  if (transferQ.isLoading) {
    return <p className="text-muted-foreground text-sm">Yükleniyor…</p>;
  }
  if (transferQ.isError || !transfer) {
    return (
      <p className="text-destructive text-sm">Transfer yüklenemedi.</p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" asChild>
            <Link to="/stock/transfers" aria-label="Listeye dön">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Transfer #{transfer.id.slice(0, 8)}
            </h1>
            <p className="text-muted-foreground text-sm">
              {transfer.fromWarehouseName} → {transfer.toWarehouseName}
            </p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[transfer.status]}>
          {STATUS_LABEL[transfer.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Durum</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferTimeline
            status={transfer.status}
            createdAt={transfer.createdAt}
            completedAt={transfer.completedAt}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ürünler</CardTitle>
          <CardDescription>
            Toplam {transfer.itemCount} kalem · {transfer.totalQuantity} adet
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barkod</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-sm">
                    {it.productBarcode}
                  </TableCell>
                  <TableCell>{it.productName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {transfer.note ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Not: {transfer.note}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canAct ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={cancelMut.isPending}
            onClick={() => void onCancel()}
          >
            İptal et
          </Button>
          <Button
            type="button"
            disabled={confirmMut.isPending}
            onClick={() => void onConfirm()}
          >
            Onayla
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="link"
        className="w-fit px-0"
        onClick={() => navigate('/stock/transfers')}
      >
        Tüm transferlere dön
      </Button>
    </div>
  );
}

function TransferListView(): ReactElement {
  usePageTitle('Stok transferi');
  const navigate = useNavigate();
  const [tab, setTab] = useState<TransferStatusApi>('DRAFT');
  const [modalOpen, setModalOpen] = useState(false);

  const transfersQ = useStockTransfers({ status: tab, limit: 50 });
  const warehousesQ = useWarehouses();
  const createMut = useCreateStockTransfer();

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductListItem[]>([]);
  const [searching, setSearching] = useState(false);

  const searchProducts = useCallback(async (q: string): Promise<void> => {
    const term = q.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get<{ items: ProductListItem[] }>(
        '/products',
        { params: { search: term, limit: 8 } },
      );
      setSearchResults(data.items ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const addLine = (product: ProductListItem): void => {
    if (lines.some((l) => l.productId === product.id)) {
      toast.error('Bu ürün zaten listede.');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: product.id,
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode,
        quantity: '1',
      },
    ]);
    setProductSearch('');
    setSearchResults([]);
  };

  const removeLine = (key: string): void => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const resetModal = (): void => {
    setFromWarehouseId('');
    setToWarehouseId('');
    setNote('');
    setLines([]);
    setProductSearch('');
    setSearchResults([]);
  };

  const submitTransfer = async (): Promise<void> => {
    if (!fromWarehouseId || !toWarehouseId) {
      toast.error('Kaynak ve hedef depo seçin.');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error('Kaynak ve hedef depo farklı olmalı.');
      return;
    }
    const items = lines
      .map((l) => ({
        productId: l.productId,
        quantity: Number.parseInt(l.quantity, 10),
      }))
      .filter((it) => Number.isFinite(it.quantity) && it.quantity > 0);
    if (items.length === 0) {
      toast.error('En az bir geçerli ürün satırı ekleyin.');
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        fromWarehouseId,
        toWarehouseId,
        note: note.trim() || undefined,
        items,
      });
      setModalOpen(false);
      resetModal();
      toast.success('Transfer oluşturuldu');
      navigate(`/stock/transfers/${created.id}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const rows = transfersQ.data?.data ?? [];

  const emptyMessage = useMemo(() => {
    if (tab === 'DRAFT') return 'Bekleyen transfer yok.';
    if (tab === 'IN_TRANSIT') return 'Transit transfer yok.';
    if (tab === 'COMPLETED') return 'Tamamlanan transfer yok.';
    return 'Kayıt yok.';
  }, [tab]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stok transferi
          </h1>
          <p className="text-muted-foreground text-sm">
            Depolar arası çoklu ürün transferi ve onay akışı.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/stock">Stok yönetimine dön</Link>
          </Button>
          <Button type="button" onClick={() => setModalOpen(true)}>
            <Plus className="mr-1 size-4" />
            Yeni transfer
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TransferStatusApi)}
      >
        <TabsList>
          <TabsTrigger value="DRAFT">Bekleyen</TabsTrigger>
          <TabsTrigger value="IN_TRANSIT">Transit</TabsTrigger>
          <TabsTrigger value="COMPLETED">Tamamlanan</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          {transfersQ.isLoading ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {emptyMessage}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Hedef</TableHead>
                    <TableHead className="text-right">Kalem</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="text-muted-foreground size-3.5" />
                          {format(new Date(row.createdAt), 'd MMM yyyy', {
                            locale: tr,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.fromWarehouseName}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({row.fromWarehouseCode})
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.toWarehouseName}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({row.toWarehouseCode})
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.itemCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totalQuantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link to={`/stock/transfers/${row.id}`}>Detay</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetModal();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5" />
              Yeni transfer
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Kaynak depo</Label>
              <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
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
              <Label>Hedef depo</Label>
              <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(warehousesQ.data ?? [])
                    .filter((w) => w.id !== fromWarehouseId)
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transfer-note">Not (isteğe bağlı)</Label>
              <Input
                id="transfer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Ürün ekle</Label>
              <Input
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  void searchProducts(e.target.value);
                }}
                placeholder="Ürün adı veya barkod ara…"
              />
              {searching ? (
                <p className="text-muted-foreground text-xs">Aranıyor…</p>
              ) : null}
              {searchResults.length > 0 ? (
                <ul className="max-h-36 overflow-y-auto rounded-md border text-sm">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="hover:bg-muted w-full px-3 py-2 text-left"
                        onClick={() => addLine(p)}
                      >
                        {p.name}
                        <span className="text-muted-foreground ml-2 font-mono text-xs">
                          {p.barcode}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {lines.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead className="w-24">Miktar</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.key}>
                        <TableCell className="text-sm">
                          {line.productName}
                          <div className="text-muted-foreground font-mono text-xs">
                            {line.productBarcode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="numeric"
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key
                                    ? { ...l, quantity: e.target.value }
                                    : l,
                                ),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Satırı sil"
                            onClick={() => removeLine(line.key)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={createMut.isPending}
              onClick={() => void submitTransfer()}
            >
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StockTransferPage(): ReactElement {
  const { id } = useParams<{ id?: string }>();
  if (id) {
    return <TransferDetailView id={id} />;
  }
  return <TransferListView />;
}
