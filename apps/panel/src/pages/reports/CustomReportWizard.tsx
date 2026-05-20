import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { platformDisplayName, SALES_PLATFORM_OPTIONS } from './report-utils';

type MetricOption = 'orders' | 'revenue' | 'stock' | 'returns' | 'avgBasket';
type GroupByOption = 'platform' | 'product' | 'date' | 'category';

const METRIC_COLUMNS: Record<MetricOption, string> = {
  orders: 'orderCount',
  revenue: 'totalAmount',
  stock: 'stockQuantity',
  returns: 'returnRate',
  avgBasket: 'avgOrderValue',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function CustomReportWizard({ open, onOpenChange, onSaved }: Props): ReactElement {
  const { t } = useTranslation();
  const runMutation = useRunCustomReport();
  const saveMutation = useSaveCustomReport();

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<MetricOption>('revenue');
  const [groupBy, setGroupBy] = useState<GroupByOption>('platform');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [platform, setPlatform] = useState('all');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);

  const buildConfig = useCallback((): ReportConfig => {
    const filters: ReportConfig['filters'] = [];
    if (platform !== 'all') {
      filters.push({ field: 'platform', operator: 'eq', value: platform });
    }
    if (category.trim()) {
      filters.push({ field: 'categoryName', operator: 'contains', value: category.trim() });
    }
    return {
      reportType: 'ORDERS',
      columns: [METRIC_COLUMNS[metric], groupBy === 'date' ? 'orderDate' : groupBy],
      filters,
      dateRange: { from: startDate, to: endDate },
      groupBy,
      limit: 500,
    };
  }, [metric, groupBy, startDate, endDate, platform, category]);

  async function handleRun(): Promise<void> {
    try {
      const res = await runMutation.mutateAsync({ config: buildConfig(), preview: false });
      setResult(res);
    } catch {
      toast.error(t('reports.custom.runFailed'));
    }
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) {
      toast.error(t('reports.custom.nameRequired'));
      return;
    }
    try {
      await saveMutation.mutateAsync({
        name: name.trim(),
        reportType: 'ORDERS',
        config: buildConfig(),
      });
      toast.success(t('reports.custom.saved'));
      onSaved?.();
      onOpenChange(false);
      setName('');
      setResult(null);
    } catch {
      toast.error(t('reports.custom.saveFailed'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('reports.custom.wizardTitle')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('reports.custom.reportName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>{t('reports.custom.metric')}</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orders">{t('reports.kpi.orders')}</SelectItem>
                <SelectItem value="revenue">{t('reports.kpi.revenue')}</SelectItem>
                <SelectItem value="stock">{t('reports.custom.stock')}</SelectItem>
                <SelectItem value="returns">{t('reports.kpi.returnRate')}</SelectItem>
                <SelectItem value="avgBasket">{t('reports.kpi.avgOrder')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('reports.custom.groupBy')}</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">{t('reports.columns.platform')}</SelectItem>
                <SelectItem value="product">{t('reports.custom.product')}</SelectItem>
                <SelectItem value="date">{t('reports.custom.date')}</SelectItem>
                <SelectItem value="category">{t('reports.custom.category')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('reports.period.start')}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('reports.period.end')}</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('reports.filters.platform')}</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.filters.allPlatforms')}</SelectItem>
                {SALES_PLATFORM_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {platformDisplayName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('reports.custom.category')}</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('reports.custom.categoryPlaceholder')}
            />
          </div>
        </div>

        {result ? (
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
                {result.rows.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map((c) => (
                      <TableCell key={c}>{String(row[c] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={runMutation.isPending}
            onClick={() => void handleRun()}
          >
            {runMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t('reports.custom.run')}
          </Button>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => void handleSave()}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t('reports.custom.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
