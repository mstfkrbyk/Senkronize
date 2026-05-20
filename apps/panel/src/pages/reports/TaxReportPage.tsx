import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/lib/api';
import { printReport } from '@/lib/pdf-export';
import { exportToCsv } from '@/lib/csv-export';

import {
  downloadELedgerXml,
  downloadVatExcel,
  useBaBsReport,
  useELedger,
  useVatDeclaration,
} from './hooks/useTaxReports';
import { formatTry, platformDisplayName } from './report-utils';

const MONTHS = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
];

const YEARS = [2026, 2025, 2024];

const QUARTERS = [
  { value: '2026-Q1', label: '2026 Q1' },
  { value: '2026-Q2', label: '2026 Q2' },
  { value: '2026-Q3', label: '2026 Q3' },
  { value: '2026-Q4', label: '2026 Q4' },
  { value: '2025-Q4', label: '2025 Q4' },
];

function monthPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function vatRateAmount(
  rates: { vatRatePercent: number; vatAmount: number }[],
  target: number,
): number {
  return rates.find((r) => r.vatRatePercent === target)?.vatAmount ?? 0;
}

export function TaxReportPage(): ReactElement {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [ledgerYear, setLedgerYear] = useState(now.getFullYear());
  const [ledgerMonth, setLedgerMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState('2026-Q1');
  const [downloadingXml, setDownloadingXml] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const periodKey = monthPeriodKey(year, month);
  const ledgerPeriodKey = monthPeriodKey(ledgerYear, ledgerMonth);

  const vatQuery = useVatDeclaration({ periodKey });
  const ledgerQuery = useELedger({ periodKey: ledgerPeriodKey });
  const baBsQuery = useBaBsReport({ periodKey: quarter });

  const vatRates = useMemo(
    () => vatQuery.data?.byVatRate ?? [],
    [vatQuery.data?.byVatRate],
  );

  async function handleXmlDownload(): Promise<void> {
    setDownloadingXml(true);
    try {
      await downloadELedgerXml(ledgerPeriodKey);
      toast.success('E-Defter XML dosyası indirildi.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloadingXml(false);
    }
  }

  async function handleExcelDownload(): Promise<void> {
    setDownloadingExcel(true);
    try {
      await downloadVatExcel(year, month);
      toast.success('KDV raporu Excel dosyası indirildi.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloadingExcel(false);
    }
  }

  function handleVatCsvExport(): void {
    const rows = (vatQuery.data?.invoiceDetails ?? []).map((inv) => ({
      siparis_no: inv.platformOrderId,
      fatura_no: inv.invoiceNumber ?? '',
      platform: inv.platform,
      tutar: inv.grossAmount,
      kdv: inv.vatAmount,
    }));
    exportToCsv(rows, `kdv-beyanname-${periodKey}`);
  }

  return (
    <Tabs defaultValue="vat" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1">
        <TabsTrigger value="vat">KDV Beyanname</TabsTrigger>
        <TabsTrigger value="ledger">E-Defter Hazırlık</TabsTrigger>
        <TabsTrigger value="babs">Ba/Bs Formu</TabsTrigger>
      </TabsList>

      <TabsContent value="vat" className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Yıl</span>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Ay</span>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printReport('vat-report-print', `KDV Beyanname ${periodKey}`)}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF İndir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloadingExcel}
              onClick={() => void handleExcelDownload()}
            >
              {downloadingExcel ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Excel&apos;e Aktar
            </Button>
          </div>
        </div>

        {vatQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : vatQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{getApiErrorMessage(vatQuery.error)}</AlertDescription>
          </Alert>
        ) : (
          <div id="vat-report-print" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Toplam satış
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatTry(vatQuery.data?.grossSales ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    KDV tutarı
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatTry(vatQuery.data?.vatAmount ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    %8 KDV
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatTry(vatRateAmount(vatRates, 8))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    %18 KDV
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatTry(vatRateAmount(vatRates, 18))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    %0 KDV
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatTry(vatRateAmount(vatRates, 0))}
                  </p>
                </CardContent>
              </Card>
            </div>

            {vatQuery.data?.reportingNote ? (
              <p className="text-sm text-muted-foreground">{vatQuery.data.reportingNote}</p>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform bazlı KDV</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Sipariş</TableHead>
                      <TableHead className="text-right">Brüt satış</TableHead>
                      <TableHead className="text-right">KDV</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(vatQuery.data?.byPlatform ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          Bu dönemde kayıt yok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (vatQuery.data?.byPlatform ?? []).map((row) => (
                        <TableRow key={row.platform}>
                          <TableCell>{platformDisplayName(row.platform)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.orderCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(row.grossSales)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(row.vatAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(row.netSales)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Fatura detay listesi</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={handleVatCsvExport}>
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sipariş no</TableHead>
                      <TableHead>Fatura no</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="text-right">KDV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(vatQuery.data?.invoiceDetails ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          Fatura kaydı bulunamadı.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (vatQuery.data?.invoiceDetails ?? []).map((inv) => (
                        <TableRow key={inv.orderId}>
                          <TableCell className="font-mono text-xs">
                            {inv.platformOrderId}
                          </TableCell>
                          <TableCell>{inv.invoiceNumber ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(inv.grossAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(inv.vatAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      <TabsContent value="ledger" className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Yıl</span>
            <Select
              value={String(ledgerYear)}
              onValueChange={(v) => setLedgerYear(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Ay</span>
            <Select
              value={String(ledgerMonth)}
              onValueChange={(v) => setLedgerMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={downloadingXml}
            onClick={() => void handleXmlDownload()}
          >
            {downloadingXml ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            XML İndir
          </Button>
        </div>

        {ledgerQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : ledgerQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{getApiErrorMessage(ledgerQuery.error)}</AlertDescription>
          </Alert>
        ) : (
          <>
            {ledgerQuery.data?.stubNote ? (
              <Alert>
                <AlertDescription>{ledgerQuery.data.stubNote}</AlertDescription>
              </Alert>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Yevmiye özeti</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Hesap (Borç / Alacak)</TableHead>
                      <TableHead className="text-right">Borç</TableHead>
                      <TableHead className="text-right">Alacak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ledgerQuery.data?.entries ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          Yevmiye kaydı yok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (ledgerQuery.data?.entries ?? []).map((entry, idx) => (
                        <TableRow key={`${entry.documentNo}-${idx}`}>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {format(new Date(entry.entryDate), 'dd MMM yyyy', {
                              locale: tr,
                            })}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">
                              {entry.debitAccount}
                            </span>
                            {' / '}
                            <span className="font-mono text-xs">
                              {entry.creditAccount}
                            </span>
                            <p className="text-xs text-muted-foreground">{entry.description}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(entry.amount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      <TabsContent value="babs" className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Çeyrek</span>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {baBsQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : baBsQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{getApiErrorMessage(baBsQuery.error)}</AlertDescription>
          </Alert>
        ) : (
          <>
            {baBsQuery.data?.reportingNote ? (
              <p className="text-sm text-muted-foreground">{baBsQuery.data.reportingNote}</p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <BaBsTable
                title="Ba — Alışlar"
                rows={baBsQuery.data?.purchasesFromSuppliers ?? []}
                threshold={baBsQuery.data?.thresholdTry ?? 5000}
              />
              <BaBsTable
                title="Bs — Satışlar"
                rows={baBsQuery.data?.salesToCustomers ?? []}
                threshold={baBsQuery.data?.thresholdTry ?? 5000}
              />
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface BaBsTableProps {
  title: string;
  rows: {
    taxId: string | null;
    name: string;
    documentCount: number;
    totalAmount: number;
  }[];
  threshold: number;
}

function BaBsTable({ title, rows, threshold }: BaBsTableProps): ReactElement {
  const total = rows.reduce((s, r) => s + r.totalAmount, 0);
  const overThreshold = rows.filter((r) => r.totalAmount >= threshold).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">Toplam: {formatTry(total)}</Badge>
          <Badge variant="outline">
            {formatTry(threshold)} üzeri: {overThreshold} işlem
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VKN/TCKN</TableHead>
              <TableHead>Ünvan</TableHead>
              <TableHead className="text-right">Belge</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Eşik üzeri kayıt yok.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${row.taxId ?? row.name}`}>
                  <TableCell className="font-mono text-xs">{row.taxId ?? '—'}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.documentCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTry(row.totalAmount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
