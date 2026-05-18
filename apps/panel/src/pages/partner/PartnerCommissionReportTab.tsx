import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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

import { useCommissionReport, useCommissionSummary, usePayoutRequest } from './hooks/usePartner';

const PLAN_LABELS: Record<PlanTier, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

function formatTry(n: number): string {
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PartnerCommissionReportTab(): ReactElement {
  const now = useMemo(() => new Date(), []);
  const qc = useQueryClient();
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
    return <p className="text-sm text-muted-foreground">Rapor yükleniyor…</p>;
  }

  if (report.isError || summary.isError) {
    return (
      <p className="text-sm text-destructive">
        {getApiErrorMessage(report.error ?? summary.error)}
      </p>
    );
  }

  const data = report.data;
  if (!data) {
    return <></>;
  }

  const chartData = data.trendLast6Months.map((m) => ({
    name: m.label,
    tutar: m.total,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2">
          <Label>Yıl</Label>
          <Select
            value={String(year)}
            onValueChange={(v) => {
              setYear(Number(v));
            }}
          >
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
          <Label>Ay</Label>
          <Select
            value={String(month)}
            onValueChange={(v) => {
              setMonth(Number(v));
            }}
          >
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Bu ay komisyon</p>
          <p className="text-2xl font-semibold text-primary">₺{formatTry(data.monthTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Geçen ay komisyon</p>
          <p className="text-2xl font-semibold">₺{formatTry(data.previousMonthTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Birikmiş (bekleyen / ödenen)</p>
          <p className="text-lg font-semibold">
            ₺{formatTry(data.lifetimePending)} / ₺{formatTry(data.lifetimeSettled)}
          </p>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <h3 className="mb-4 text-sm font-medium">Son 6 ay komisyon trendi</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [
                  typeof value === 'number' ? `₺${formatTry(value)}` : String(value ?? ''),
                  'Komisyon',
                ]}
                labelFormatter={(l) => String(l)}
              />
              <Bar dataKey="tutar" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Komisyon" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium">Müşteri bazlı komisyon</h3>
        <Button
          type="button"
          variant="default"
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Müşteri</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Aylık ödeme (TRY)</TableHead>
              <TableHead className="text-right">Komisyon %</TableHead>
              <TableHead className="text-right">Komisyon (TRY)</TableHead>
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
                  <TableCell>
                    {PLAN_LABELS[r.plan as PlanTier] ?? r.plan}
                  </TableCell>
                  <TableCell className="text-right">₺{formatTry(r.monthlyFeeTRY)}</TableCell>
                  <TableCell className="text-right">{r.commissionPct}</TableCell>
                  <TableCell className="text-right">₺{formatTry(r.commissionAmountTRY)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme talebi</DialogTitle>
            <DialogDescription>
              Bekleyen bakiyeniz: ₺
              {summary.data ? formatTry(summary.data.pendingAmount) : '0,00'}. Talep tutarını
              girin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="payout-amount">Tutar (TRY)</Label>
            <Input
              id="payout-amount"
              inputMode="decimal"
              value={payoutAmount}
              onChange={(e) => {
                setPayoutAmount(e.target.value);
              }}
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
