import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { getApiErrorMessage } from '@/lib/api';
import type { PlanTier } from '@/types/subscription';

import {
  useCommissionReport,
  useCommissionSummary,
  usePayoutRequest,
} from './hooks/usePartner';
import { formatTry, formatTryPlain, planLabel } from './partner-utils';

interface MonthlySummaryRow {
  label: string;
  year: number;
  month: number;
  clientCount: number | null;
  subscriptionRevenue: number | null;
  commissionRateLabel: string;
  commissionAmount: number;
  status: 'Bekleyen' | 'Ödendi';
}

export function CommissionPage(): ReactElement {
  const qc = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  const summary = useCommissionSummary();
  const report = useCommissionReport(year, month);
  const payout = usePayoutRequest();

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const defaultRate = useMemo(() => {
    const rows = report.data?.rows ?? [];
    if (rows.length === 0) {
      return 10;
    }
    const pcts = [...new Set(rows.map((r) => r.commissionPct))];
    return pcts.length === 1 ? pcts[0] : null;
  }, [report.data?.rows]);

  const monthlyRows = useMemo((): MonthlySummaryRow[] => {
    const trend = report.data?.trendLast6Months ?? [];
    const isCurrentMonth = (y: number, m: number) =>
      y === now.getFullYear() && m === now.getMonth() + 1;
    const currentClientCount = report.data?.rows.length ?? null;
    const currentRevenue = (report.data?.rows ?? []).reduce(
      (s, r) => s + r.monthlyFeeTRY,
      0,
    );
    const rateLabel =
      defaultRate != null ? `%${defaultRate}` : 'Müşteri bazlı';
    const pending = (summary.data?.pendingAmount ?? 0) > 0;

    return trend.map((t, idx) => {
      const isLatest = idx === trend.length - 1;
      return {
        label: t.label,
        year: t.year,
        month: t.month,
        clientCount: isCurrentMonth(t.year, t.month) ? currentClientCount : null,
        subscriptionRevenue: isCurrentMonth(t.year, t.month) ? currentRevenue : null,
        commissionRateLabel: rateLabel,
        commissionAmount: t.total,
        status: isLatest && pending ? 'Bekleyen' : 'Ödendi',
      };
    });
  }, [report.data, summary.data?.pendingAmount, defaultRate, now]);

  function submitPayout(): void {
    const n = Number(payoutAmount.replace(',', '.'));
    if (!Number.isFinite(n) || n < 1) {
      toast.error('Geçerli bir tutar girin.');
      return;
    }
    payout.mutate(n, {
      onSuccess: () => {
        toast.success('Ödeme talebiniz kaydedildi.');
        setPayoutOpen(false);
        setPayoutAmount('');
        void qc.invalidateQueries({ queryKey: ['partner', 'commission'] });
        void qc.invalidateQueries({ queryKey: ['partner', 'commission-report'] });
      },
      onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
    });
  }

  if (report.isLoading || summary.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  if (report.isError || summary.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {getApiErrorMessage(report.error ?? summary.error)}
      </div>
    );
  }

  const data = report.data;
  if (!data) {
    return <></>;
  }

  return (
    <div className="space-y-8">
      <Card className="border-sky-200 bg-sky-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Komisyon oranı bilgisi</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Varsayılan partner komisyon oranı{' '}
            <span className="font-medium text-foreground">%10</span>dır. Admin panelinden
            partner bazında özelleştirilebilir.
          </p>
          {summary.data ? (
            <p className="mt-2">
              Bekleyen bakiye: {formatTry(summary.data.pendingAmount)} · Ödenen toplam:{' '}
              {formatTry(summary.data.settledAmount)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Dönem yılı</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dönem ayı</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}. ay
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          disabled={!summary.data || summary.data.pendingAmount < 1}
          onClick={() => {
            if (summary.data) {
              setPayoutAmount(String(Math.floor(summary.data.pendingAmount)));
            }
            setPayoutOpen(true);
          }}
        >
          Ödeme talebi oluştur
        </Button>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">Aylık komisyon özeti</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ay</TableHead>
                <TableHead className="text-right">Müşteri sayısı</TableHead>
                <TableHead className="text-right">Abonelik geliri</TableHead>
                <TableHead className="text-right">Komisyon oranı</TableHead>
                <TableHead className="text-right">Komisyon tutarı</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    Özet verisi yok.
                  </TableCell>
                </TableRow>
              ) : (
                monthlyRows.map((row) => (
                  <TableRow key={`${row.year}-${row.month}`}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">
                      {row.clientCount ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.subscriptionRevenue != null
                        ? `₺${formatTryPlain(row.subscriptionRevenue)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.commissionRateLabel}</TableCell>
                    <TableCell className="text-right">
                      ₺{formatTryPlain(row.commissionAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'Bekleyen' ? 'secondary' : 'default'}
                        className={
                          row.status === 'Ödendi'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                            : undefined
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">
          Komisyon detay — müşteri kırılımı ({data.rows.length} müşteri)
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Müşteri</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Abonelik geliri</TableHead>
                <TableHead className="text-right">Komisyon %</TableHead>
                <TableHead className="text-right">Komisyon tutarı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Bu dönem için komisyon kaydı yok.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((r) => (
                  <TableRow key={r.clientOrgId}>
                    <TableCell className="font-medium">{r.clientName}</TableCell>
                    <TableCell>{planLabel(r.plan as PlanTier)}</TableCell>
                    <TableCell className="text-right">₺{formatTryPlain(r.monthlyFeeTRY)}</TableCell>
                    <TableCell className="text-right">{r.commissionPct}</TableCell>
                    <TableCell className="text-right">
                      ₺{formatTryPlain(r.commissionAmountTRY)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-right text-sm font-medium text-muted-foreground">
          Dönem toplamı: ₺{formatTryPlain(data.monthTotal)}
        </p>
      </div>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme talebi oluştur</DialogTitle>
            <DialogDescription>
              Bekleyen bakiyeniz:{' '}
              {summary.data ? formatTry(summary.data.pendingAmount) : '₺0,00'}. Talep tutarını
              girin; işlem muhasebe onayına iletilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="payout-amount">Tutar (TRY)</Label>
            <Input
              id="payout-amount"
              inputMode="decimal"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayoutOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={payout.isPending} onClick={submitPayout}>
              {payout.isPending ? 'Gönderiliyor…' : 'Talep gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
