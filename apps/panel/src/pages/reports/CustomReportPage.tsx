import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { GripVertical, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { ReportConfig, ReportResult } from '@/types/custom-report';

import { useRunCustomReport, useSaveCustomReport } from './hooks/useCustomReports';
import { formatTry } from './report-utils';

export type MetricId =
  | 'revenue'
  | 'orderCount'
  | 'returnRate'
  | 'avgBasket'
  | 'buyboxPct'
  | 'stockTurnover';

export type ChartKind = 'line' | 'bar' | 'pie' | 'table';

interface MetricDef {
  id: MetricId;
  label: string;
  column: string;
}

const AVAILABLE_METRICS: MetricDef[] = [
  { id: 'revenue', label: 'Gelir', column: 'totalAmount' },
  { id: 'orderCount', label: 'Sipariş Sayısı', column: 'orderCount' },
  { id: 'returnRate', label: 'İade Oranı', column: 'returnRate' },
  { id: 'avgBasket', label: 'Ortalama Sepet', column: 'avgOrderValue' },
  { id: 'buyboxPct', label: 'BuyBox %', column: 'buyboxWinRate' },
  { id: 'stockTurnover', label: 'Stok Devir Hızı', column: 'stockTurnover' },
];

function subDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
}

function SortableMetric({
  id,
  label,
  onRemove,
}: {
  id: string;
  label: string;
  onRemove: () => void;
}): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-2"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Sürükle"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
        Kaldır
      </Button>
    </div>
  );
}

export function CustomReportPage(): ReactElement {
  const [startDate, setStartDate] = useState(subDaysIso(30));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMetrics, setSelectedMetrics] = useState<MetricId[]>(['revenue', 'orderCount']);
  const [chartKind, setChartKind] = useState<ChartKind>('bar');
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const runMutation = useRunCustomReport();
  const saveMutation = useSaveCustomReport();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const buildConfig = useCallback((): ReportConfig => {
    const columns = selectedMetrics.map(
      (m) => AVAILABLE_METRICS.find((x) => x.id === m)?.column ?? m,
    );
    return {
      reportType: 'ORDERS',
      columns,
      filters: [],
      dateRange: { from: startDate, to: endDate },
      limit: 500,
    };
  }, [selectedMetrics, startDate, endDate]);

  const runPreview = useCallback(async (): Promise<void> => {
    if (selectedMetrics.length === 0) {
      setPreview(null);
      return;
    }
    try {
      const res = await runMutation.mutateAsync({ config: buildConfig(), preview: true });
      setPreview(res);
    } catch {
      setPreview(null);
    }
  }, [buildConfig, runMutation, selectedMetrics.length]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runPreview();
    }, 700);
    return () => window.clearTimeout(t);
  }, [runPreview]);

  function onDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('pool-')) {
      const metric = activeId.replace('pool-', '') as MetricId;
      if (!selectedMetrics.includes(metric)) {
        setSelectedMetrics((prev) => [...prev, metric]);
      }
      return;
    }
    if (selectedMetrics.includes(activeId as MetricId) && selectedMetrics.includes(overId as MetricId)) {
      const oldIndex = selectedMetrics.indexOf(activeId as MetricId);
      const newIndex = selectedMetrics.indexOf(overId as MetricId);
      setSelectedMetrics(arrayMove(selectedMetrics, oldIndex, newIndex));
    }
  }

  function removeMetric(id: MetricId): void {
    setSelectedMetrics((prev) => prev.filter((m) => m !== id));
  }

  async function handleSave(): Promise<void> {
    if (!saveName.trim()) {
      toast.error('Rapor adı girin.');
      return;
    }
    try {
      await saveMutation.mutateAsync({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        reportType: 'ORDERS',
        config: buildConfig(),
      });
      toast.success('Rapor kaydedildi.');
      setSaveOpen(false);
    } catch {
      toast.error('Kayıt başarısız.');
    }
  }

  const chartPreview = useMemo(() => {
    if (!preview || preview.rows.length === 0) return [];
    const col = preview.columns[0];
    const valCol = preview.columns[1] ?? preview.columns[0];
    return preview.rows.slice(0, 12).map((row, i) => ({
      label: String(row[col] ?? `Satır ${i + 1}`),
      value: Number(row[valCol] ?? 0),
    }));
  }, [preview]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metrik havuzu</CardTitle>
            <p className="text-sm text-muted-foreground">Metriği rapor alanına sürükleyin.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {AVAILABLE_METRICS.map((m) => (
              <div
                key={m.id}
                id={`pool-${m.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('metric', m.id);
                }}
                className="cursor-grab rounded-md border bg-muted/40 px-3 py-2 text-sm"
              >
                {m.label}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Rapor alanı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Başlangıç</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bitiş</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Grafik tipi</Label>
                <Select value={chartKind} onValueChange={(v) => setChartKind(v as ChartKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Çizgi</SelectItem>
                    <SelectItem value="bar">Sütun</SelectItem>
                    <SelectItem value="pie">Pasta</SelectItem>
                    <SelectItem value="table">Tablo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div
                className="min-h-[120px] space-y-2 rounded-md border border-dashed p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const metric = e.dataTransfer.getData('metric') as MetricId;
                  if (metric && !selectedMetrics.includes(metric)) {
                    setSelectedMetrics((prev) => [...prev, metric]);
                  }
                }}
              >
                {selectedMetrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Metrik eklemek için sürükleyin.</p>
                ) : (
                  <SortableContext items={selectedMetrics} strategy={verticalListSortingStrategy}>
                    {selectedMetrics.map((id) => {
                      const meta = AVAILABLE_METRICS.find((m) => m.id === id);
                      return (
                        <SortableMetric
                          key={id}
                          id={id}
                          label={meta?.label ?? id}
                          onRemove={() => removeMetric(id)}
                        />
                      );
                    })}
                  </SortableContext>
                )}
              </div>
            </DndContext>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="default" onClick={() => setSaveOpen(true)}>
                <Save className="mr-2 h-4 w-4" />
                Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Canlı önizleme</CardTitle>
          {runMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </CardHeader>
        <CardContent>
          {!preview || preview.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Metrik seçildiğinde önizleme otomatik güncellenir.
            </p>
          ) : chartKind === 'table' ? (
            <PreviewTable result={preview} />
          ) : chartKind === 'pie' ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartPreview} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                    {chartPreview.map((_, i) => (
                      <Cell key={i} fill={['#0f172a', '#38bdf8', '#22c55e', '#f97316'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : chartKind === 'line' ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPreview}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                  <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartPreview}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                  <Legend />
                  <Bar dataKey="value" name="Değer" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raporu kaydet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Ad</Label>
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              E-posta zamanlaması kayıttan sonra kayıtlı raporlar listesinden ayarlanabilir.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saveMutation.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewTable({ result }: { result: ReportResult }): ReactElement {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {result.columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row, i) => (
            <TableRow key={i}>
              {result.columns.map((c) => (
                <TableCell key={c} className="max-w-[200px] truncate">
                  {String(row[c] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
