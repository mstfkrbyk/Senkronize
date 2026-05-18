import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2, Play, Save, Table2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { exportToCsv } from '@/lib/csv-export';
import type { ReportConfig, ReportFilter, ReportResult, ReportType } from '@/types/custom-report';

import {
  COLUMNS_BY_TYPE,
  FILTER_FIELDS_BY_TYPE,
  GROUP_BY_OPTIONS,
  ORDER_BY_OPTIONS,
  REPORT_TYPE_LABELS,
  defaultColumnsForType,
} from './customReportColumns';
import {
  useRunCustomReport,
  useSaveCustomReport,
} from './hooks/useCustomReports';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PLATFORM_OPTIONS = [
  'TRENDYOL',
  'HEPSIBURADA',
  'N11',
  'AMAZON_TR',
] as const;

function subDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
}

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

const REPORT_TYPES: ReportType[] = [
  'ORDERS',
  'PRODUCTS',
  'LISTINGS',
  'STOCK',
  'PROFIT',
  'PLATFORM_COMPARISON',
];

export function CustomReportBuilder(): ReactElement {
  const [reportType, setReportType] = useState<ReportType>('ORDERS');
  const [startDate, setStartDate] = useState(subDaysIso(30));
  const [endDate, setEndDate] = useState(todayIso());
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selectedCols, setSelectedCols] = useState<string[]>(() => defaultColumnsForType('ORDERS'));
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({});
  const [columnHidden, setColumnHidden] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string>('');
  const [orderBy, setOrderBy] = useState<string>('');
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [fullResult, setFullResult] = useState<ReportResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const runMutation = useRunCustomReport();
  const saveMutation = useSaveCustomReport();

  useEffect(() => {
    setSelectedCols(defaultColumnsForType(reportType));
    setColumnLabels({});
    setColumnHidden({});
    setFilters([]);
    setGroupBy('');
    setOrderBy('');
    setPreview(null);
    setFullResult(null);
  }, [reportType]);

  const availableCols = useMemo(() => COLUMNS_BY_TYPE[reportType] ?? [], [reportType]);
  const filterFieldOptions = useMemo(
    () => FILTER_FIELDS_BY_TYPE[reportType] ?? [],
    [reportType],
  );

  const buildConfig = useCallback((): ReportConfig => {
    const needsDate =
      reportType === 'ORDERS' ||
      reportType === 'PROFIT' ||
      reportType === 'PLATFORM_COMPARISON';
    return {
      reportType,
      columns: selectedCols,
      columnLabels: Object.keys(columnLabels).length > 0 ? columnLabels : undefined,
      columnHidden: Object.keys(columnHidden).length > 0 ? columnHidden : undefined,
      filters,
      groupBy: groupBy || undefined,
      orderBy: orderBy || undefined,
      dateRange: needsDate ? { from: startDate, to: endDate } : undefined,
      platforms: platforms.length > 0 ? platforms : undefined,
      limit: 1000,
    };
  }, [
    reportType,
    selectedCols,
    columnLabels,
    columnHidden,
    filters,
    groupBy,
    orderBy,
    startDate,
    endDate,
    platforms,
  ]);

  function togglePlatform(p: string): void {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function addFilter(): void {
    const first = filterFieldOptions[0]?.id ?? 'platform';
    setFilters((f) => [...f, { field: first, operator: 'eq', value: '' }]);
  }

  function updateFilter(i: number, patch: Partial<ReportFilter>): void {
    setFilters((f) => f.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function removeFilter(i: number): void {
    setFilters((f) => f.filter((_, j) => j !== i));
  }

  function moveCol(id: string, dir: -1 | 1): void {
    setSelectedCols((cols) => {
      const idx = cols.indexOf(id);
      if (idx < 0) {
        return cols;
      }
      const n = idx + dir;
      if (n < 0 || n >= cols.length) {
        return cols;
      }
      const next = [...cols];
      const t = next[idx]!;
      next[idx] = next[n]!;
      next[n] = t;
      return next;
    });
  }

  async function handlePreview(): Promise<void> {
    if ((reportType === 'PROFIT' || reportType === 'PLATFORM_COMPARISON') && (!startDate || !endDate)) {
      toast.error('Bu rapor tipi için tarih aralığı seçin.');
      return;
    }
    try {
      const res = await runMutation.mutateAsync({
        config: buildConfig(),
        preview: true,
      });
      setPreview(res);
      setFullResult(null);
      toast.success('Önizleme hazır (ilk 10 satır).');
    } catch {
      toast.error('Önizleme çalıştırılamadı.');
    }
  }

  async function handleFullRun(): Promise<void> {
    if ((reportType === 'PROFIT' || reportType === 'PLATFORM_COMPARISON') && (!startDate || !endDate)) {
      toast.error('Bu rapor tipi için tarih aralığı seçin.');
      return;
    }
    try {
      const res = await runMutation.mutateAsync({
        config: buildConfig(),
        preview: false,
      });
      setFullResult(res);
      setPreview(res);
      toast.success('Rapor tamamlandı.');
    } catch {
      toast.error('Rapor çalıştırılamadı.');
    }
  }

  function handleCsvDownload(): void {
    const src = fullResult ?? preview;
    if (!src || src.rows.length === 0) {
      toast.error('Önce raporu çalıştırın.');
      return;
    }
    const headers = src.columns.map((c) => columnLabels[c] ?? c);
    const rows = src.rows.map((r) => {
      const o: Record<string, string | number | boolean> = {};
      src.columns.forEach((c, i) => {
        const key = headers[i] ?? c;
        const v = r[c];
        o[key] = v as string | number | boolean;
      });
      return o;
    });
    exportToCsv(rows, 'ozel-rapor');
    toast.success('CSV indirildi.');
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
        reportType,
        config: buildConfig(),
      });
      toast.success('Rapor kaydedildi.');
      setSaveOpen(false);
      setSaveName('');
      setSaveDescription('');
    } catch {
      toast.error('Kayıt başarısız.');
    }
  }

  const displayTable = preview ?? fullResult;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Veri kaynağı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rapor tipi</Label>
              <Select
                value={reportType}
                onValueChange={(v) => setReportType(v as ReportType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {REPORT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Başlangıç</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bitiş</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Platform filtresi (çoklu)</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm"
                  >
                    <Checkbox
                      checked={platforms.includes(p)}
                      onCheckedChange={() => togglePlatform(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Kolonlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kullanılabilir kolonlar</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {availableCols.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedCols.includes(c.id)}
                      onCheckedChange={(ch) => {
                        const on = ch === true;
                        setSelectedCols((prev) =>
                          on
                            ? prev.includes(c.id)
                              ? prev
                              : [...prev, c.id]
                            : prev.filter((x) => x !== c.id),
                        );
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Seçili sıra</Label>
              <div className="space-y-2">
                {selectedCols.map((id) => {
                  const meta = availableCols.find((c) => c.id === id);
                  return (
                    <div
                      key={id}
                      className="flex flex-col gap-2 rounded-md border bg-card p-2 sm:flex-row sm:items-center"
                    >
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => moveCol(id, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => moveCol(id, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-xs text-muted-foreground">{meta?.label ?? id}</p>
                        <Input
                          placeholder="Başlık (isteğe bağlı)"
                          value={columnLabels[id] ?? ''}
                          onChange={(e) =>
                            setColumnLabels((m) => ({ ...m, [id]: e.target.value }))
                          }
                        />
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={columnHidden[id] === true}
                            onCheckedChange={(ch) =>
                              setColumnHidden((m) => ({ ...m, [id]: ch === true }))
                            }
                          />
                          Gizle
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Filtreler ve gruplama</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filterFieldOptions.length > 0 ? (
              <>
                {filters.map((f, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-md border p-2 sm:grid-cols-12 sm:items-end"
                  >
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Alan</Label>
                      <Select
                        value={f.field}
                        onValueChange={(v) => updateFilter(i, { field: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filterFieldOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Operatör</Label>
                      <Select
                        value={f.operator}
                        onValueChange={(v) =>
                          updateFilter(i, { operator: v as ReportFilter['operator'] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eq">Eşit</SelectItem>
                          <SelectItem value="contains">İçerir</SelectItem>
                          <SelectItem value="gt">Büyük</SelectItem>
                          <SelectItem value="lt">Küçük</SelectItem>
                          <SelectItem value="in">Listede (virgül)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-5">
                      <Label className="text-xs">Değer</Label>
                      <Input
                        value={
                          f.operator === 'in' && Array.isArray(f.value)
                            ? f.value.join(',')
                            : String(f.value ?? '')
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (f.operator === 'in') {
                            updateFilter(i, {
                              value: raw.split(',').map((s) => s.trim()).filter(Boolean),
                            });
                          } else if (f.field === 'isActive' || f.field === 'approved') {
                            updateFilter(i, { value: raw === 'true' || raw === '1' });
                          } else if (f.field === 'totalAmount' || f.field === 'quantity') {
                            updateFilter(i, { value: Number(raw) });
                          } else {
                            updateFilter(i, { value: raw });
                          }
                        }}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFilter(i)}>
                        Sil
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addFilter}>
                  Filtre ekle
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Bu rapor tipi için dinamik filtre yok.</p>
            )}
            <div className="space-y-2">
              <Label>Gruplama</Label>
              <Select value={groupBy || '__none'} onValueChange={(v) => setGroupBy(v === '__none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Yok" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Yok</SelectItem>
                  {(GROUP_BY_OPTIONS[reportType] ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sıralama</Label>
              <Select value={orderBy || '__none'} onValueChange={(v) => setOrderBy(v === '__none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Varsayılan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Varsayılan</SelectItem>
                  {(ORDER_BY_OPTIONS[reportType] ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="secondary" onClick={() => void handlePreview()} disabled={runMutation.isPending}>
          {runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Table2 className="mr-2 h-4 w-4" />}
          Önizle
        </Button>
        <Button type="button" onClick={() => void handleFullRun()} disabled={runMutation.isPending}>
          {runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Tam raporu çalıştır
        </Button>
        <Button type="button" variant="outline" onClick={handleCsvDownload}>
          CSV indir
        </Button>
        <Button type="button" variant="default" onClick={() => setSaveOpen(true)}>
          <Save className="mr-2 h-4 w-4" />
          Raporu kaydet
        </Button>
      </div>

      {displayTable && displayTable.columns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sonuç</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayTable.columns.map((c) => (
                    <TableHead key={c}>{columnLabels[c] ?? c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayTable.rows.map((r, ri) => (
                  <TableRow key={ri}>
                    {displayTable.columns.map((c) => (
                      <TableCell key={c} className="max-w-[220px] truncate">
                        {formatCell(r[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

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
              <Label>Açıklama (isteğe bağlı)</Label>
              <Input value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) {
    return '—';
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) ? String(v) : '—';
  }
  if (typeof v === 'boolean') {
    return v ? 'Evet' : 'Hayır';
  }
  return String(v);
}
