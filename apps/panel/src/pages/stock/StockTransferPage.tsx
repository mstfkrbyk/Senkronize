import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
import { useAuth } from '@/hooks/useAuth';
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

const APPROVER_ROLES = new Set(['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER']);

function canApproveTransfers(role: string | undefined): boolean {
  return role !== undefined && APPROVER_ROLES.has(role);
}

const WIZARD_STEPS = [
  { step: 1, label: 'Ürün seç' },
  { step: 2, label: 'Miktarları belirle' },
  { step: 3, label: 'Onayla' },
] as const;

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

function TransferDetailModal({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  const transferQ = useStockTransfer(id ?? undefined);
  const confirmMut = useConfirmStockTransfer();
  const cancelMut = useCancelStockTransfer();
  const { data: me } = useAuth();
  const canApprove = canApproveTransfers(me?.user.role);

  const transfer = transferQ.data;
  const canAct =
    canApprove &&
    (transfer?.status === 'DRAFT' || transfer?.status === 'IN_TRANSIT');

  if (!id) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer detayı</DialogTitle>
        </DialogHeader>
        {transferQ.isLoading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor…</p>
        ) : !transfer ? (
          <p className="text-destructive text-sm">Transfer yüklenemedi.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">
                {transfer.fromWarehouseName} → {transfer.toWarehouseName}
              </p>
              <Badge variant={STATUS_VARIANT[transfer.status]}>
                {STATUS_LABEL[transfer.status]}
              </Badge>
            </div>
            <TransferTimeline
              status={transfer.status}
              createdAt={transfer.createdAt}
              completedAt={transfer.completedAt}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">
                      {it.productName}
                      <div className="font-mono text-xs text-muted-foreground">
                        {it.productBarcode}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {canAct ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelMut.isPending}
                  onClick={() => {
                    void cancelMut.mutateAsync(id).then(() => {
                      toast.success('Transfer reddedildi / iptal edildi');
                      void transferQ.refetch();
                    });
                  }}
                >
                  Reddet
                </Button>
                <Button
                  type="button"
                  disabled={confirmMut.isPending}
                  onClick={() => {
                    void confirmMut.mutateAsync(id).then(() => {
                      toast.success('Transfer onaylandı');
                      void transferQ.refetch();
                    });
                  }}
                >
                  Onayla
                </Button>
              </div>
            ) : null}
            <Button type="button" variant="link" className="h-auto px-0" asChild>
              <Link to={`/stock/transfers/${id}`}>Tam detay sayfası</Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferDetailView({ id }: { id: string }): ReactElement {
  usePageTitle('Transfer detayı');
  const navigate = useNavigate();
  const transferQ = useStockTransfer(id);
  const confirmMut = useConfirmStockTransfer();
  const cancelMut = useCancelStockTransfer();
  const { data: me } = useAuth();

  const transfer = transferQ.data;
  const canApprove = canApproveTransfers(me?.user.role);
  const canAct =
    canApprove &&
    (transfer?.status === 'DRAFT' || transfer?.status === 'IN_TRANSIT');

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

interface TransferListProps {
  embedded?: boolean;
}

export function StockTransfersTab({ embedded = false }: TransferListProps): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TransferStatusApi>('DRAFT');
  const [modalOpen, setModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [detailModalId, setDetailModalId] = useState<string | null>(null);

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

  useEffect(() => {
    const barcode = searchParams.get('barcode');
    if (barcode && barcode.trim().length >= 2) {
      setModalOpen(true);
      setWizardStep(1);
      void (async (): Promise<void> => {
        try {
          const { data } = await api.get<{ items: ProductListItem[] }>(
            '/products',
            { params: { search: barcode.trim(), limit: 1 } },
          );
          const product = data.items[0];
          if (product) {
            setLines([
              {
                key: product.id,
                productId: product.id,
                productName: product.name,
                productBarcode: product.barcode,
                quantity: '1',
              },
            ]);
          }
        } catch {
          /* ignore */
        }
      })();
    }
  }, [searchParams]);

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
    setWizardStep(1);
  };

  const fromWarehouseName =
    warehousesQ.data?.find((w) => w.id === fromWarehouseId)?.name ?? '—';
  const toWarehouseName =
    warehousesQ.data?.find((w) => w.id === toWarehouseId)?.name ?? '—';

  const goNextStep = (): void => {
    if (wizardStep === 1) {
      if (!fromWarehouseId || !toWarehouseId) {
        toast.error('Kaynak ve hedef depo seçin.');
        return;
      }
      if (fromWarehouseId === toWarehouseId) {
        toast.error('Kaynak ve hedef depo farklı olmalı.');
        return;
      }
      if (lines.length === 0) {
        toast.error('En az bir ürün ekleyin.');
        return;
      }
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      const invalid = lines.some((l) => {
        const q = Number.parseInt(l.quantity, 10);
        return !Number.isFinite(q) || q <= 0;
      });
      if (invalid) {
        toast.error('Tüm satırlarda geçerli miktar girin.');
        return;
      }
      setWizardStep(3);
    }
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
    <div
      className={
        embedded
          ? 'flex flex-col gap-4'
          : 'mx-auto flex w-full max-w-6xl flex-col gap-6'
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Stok transferi
            </h1>
            <p className="text-muted-foreground text-sm">
              Depolar arası çoklu ürün transferi ve onay akışı.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Depolar arası çoklu ürün transferi ve onay akışı.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!embedded ? (
            <Button type="button" variant="outline" asChild>
              <Link to="/stock">Stok yönetimine dön</Link>
            </Button>
          ) : null}
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
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailModalId(row.id)}
                          >
                            Detay
                          </Button>
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link to={`/stock/transfers/${row.id}`}>Aç</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TransferDetailModal
        id={detailModalId}
        open={detailModalId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailModalId(null);
          }
        }}
      />

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

          <div className="flex items-center gap-2">
            {WIZARD_STEPS.map(({ step, label }) => (
              <div
                key={step}
                className={`flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs ${
                  wizardStep === step
                    ? 'border-sky-400 bg-sky-50'
                    : wizardStep > step
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-muted'
                }`}
              >
                <span className="font-semibold">{step}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {wizardStep === 1 ? (
            <div className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
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
                <p className="text-muted-foreground text-sm">
                  {lines.length} ürün seçildi
                </p>
              ) : null}
            </div>
          ) : null}

          {wizardStep === 2 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {fromWarehouseName} → {toWarehouseName}
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead className="w-28">Miktar</TableHead>
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
              <div className="grid gap-2">
                <Label htmlFor="transfer-note">Not (isteğe bağlı)</Label>
                <Input
                  id="transfer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {wizardStep === 3 ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <p>
                  <span className="text-muted-foreground">Kaynak:</span>{' '}
                  {fromWarehouseName}
                </p>
                <p>
                  <span className="text-muted-foreground">Hedef:</span>{' '}
                  {toWarehouseName}
                </p>
                <p>
                  <span className="text-muted-foreground">Kalem:</span>{' '}
                  {lines.length}
                </p>
                <p>
                  <span className="text-muted-foreground">Toplam adet:</span>{' '}
                  {lines.reduce(
                    (s, l) => s + (Number.parseInt(l.quantity, 10) || 0),
                    0,
                  )}
                </p>
                {note.trim() ? (
                  <p>
                    <span className="text-muted-foreground">Not:</span> {note}
                  </p>
                ) : null}
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {lines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-2">
                    <span className="line-clamp-1">{l.productName}</span>
                    <span className="tabular-nums">{l.quantity} adet</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={wizardStep === 1}
              onClick={() =>
                setWizardStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
              }
            >
              Geri
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalOpen(false)}
              >
                Vazgeç
              </Button>
              {wizardStep < 3 ? (
                <Button type="button" onClick={goNextStep}>
                  İleri
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={createMut.isPending}
                  onClick={() => void submitTransfer()}
                >
                  Transferi oluştur
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StockTransferPage(): ReactElement {
  usePageTitle('Stok transferi');
  const { id } = useParams<{ id?: string }>();
  if (id) {
    return <TransferDetailView id={id} />;
  }
  return <StockTransfersTab />;
}
