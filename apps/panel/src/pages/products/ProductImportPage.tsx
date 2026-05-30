import type { ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatNavPageContext } from '@/lib/nav-page-context';
import type { ImportPreviewRow, ImportResult } from '@/types/product';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeKey(key: string): string {
  return key.replace(/^\uFEFF/, '').trim().toLowerCase();
}

function rowGet(row: Record<string, string>, keys: string[]): string {
  for (const want of keys) {
    const nk = normalizeKey(want);
    for (const [col, val] of Object.entries(row)) {
      if (normalizeKey(col) === nk && val.trim()) {
        return val.trim();
      }
    }
  }
  return '';
}

function validateRow(row: Record<string, string>, lineNumber: number): ImportPreviewRow {
  const errors: string[] = [];
  const barcode = rowGet(row, ['barcode', 'barkod']);
  const name = rowGet(row, ['name', 'ad', 'title', 'baslik']);
  const salePrice = rowGet(row, ['saleprice', 'satisfiyati']);
  const listPrice = rowGet(row, ['listprice', 'listefiyati']);
  const stock = rowGet(row, ['stock', 'stok']);

  if (!barcode) {
    errors.push('Barkod zorunlu');
  }
  if (!name) {
    errors.push('Ürün adı zorunlu');
  }
  if (salePrice && Number.isNaN(Number.parseFloat(salePrice.replace(',', '.')))) {
    errors.push('Satış fiyatı geçersiz');
  }
  if (listPrice && Number.isNaN(Number.parseFloat(listPrice.replace(',', '.')))) {
    errors.push('Liste fiyatı geçersiz');
  }
  if (stock && !Number.isFinite(Number.parseInt(stock, 10))) {
    errors.push('Stok geçersiz');
  }

  return { row, lineNumber, valid: errors.length === 0, errors };
}

const STEPS = [
  'Şablon',
  'Dosya',
  'Önizleme',
  'Onay',
] as const;

export function ProductImportPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(
    groupLabel,
    t('nav.products'),
    t('products.importAction'),
  );
  usePageTitle(t('products.import'));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const readFilePreview = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
      });
      const rows: ImportPreviewRow[] = [];
      let lineNo = 1;
      for (const raw of parsed.data ?? []) {
        lineNo += 1;
        const hasData = Object.values(raw).some((v) => String(v).trim().length > 0);
        if (!hasData) {
          continue;
        }
        rows.push(validateRow(raw, lineNo));
      }
      setPreviewRows(rows);
      setStep(3);
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const validCount = useMemo(
    () => previewRows.filter((r) => r.valid).length,
    [previewRows],
  );
  const invalidCount = previewRows.length - validCount;

  const downloadTemplate = useCallback(async () => {
    const res = await api.get<Blob>('/products/import/template', {
      responseType: 'blob',
    });
    downloadBlob(
      new Blob([res.data], { type: 'text/csv;charset=utf-8;' }),
      'urun-sablonu.csv',
    );
    toast.success('Şablon indirildi');
  }, []);

  const importMutation = useMutation({
    mutationFn: async (upload: File) => {
      const body = new FormData();
      body.append('file', upload);
      const { data } = await api.post<ImportResult>('/products/import', body);
      return data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep(4);
      toast.success('İçe aktarma tamamlandı');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const previewHeaders =
    previewRows.length > 0
      ? Object.keys(previewRows[0]?.row ?? {})
      : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Ürün İçe Aktar"
        description="CSV veya pazaryeri API'si ile ürünleri içe aktarın."
        context={navContextLine}
      />

      <Card>
        <CardContent className="grid grid-cols-4 gap-2 pt-6">
        {STEPS.map((label, idx) => {
          const n = (idx + 1) as 1 | 2 | 3 | 4;
          return (
            <div
              key={label}
              className={`rounded-md border px-2 py-2 text-center text-xs font-medium sm:text-sm ${
                step === n
                  ? 'border-accent bg-accent/10 text-accent-foreground'
                  : step > n
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-border text-muted-foreground'
              }`}
            >
              {n}. {label}
            </div>
          );
        })}
        </CardContent>
      </Card>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="size-4" />
              Şablon indir
            </CardTitle>
            <CardDescription>
              Ürün CSV şablonunu bilgisayarınıza kaydedin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              type="button"
              onClick={() => {
                void downloadTemplate();
              }}
            >
              <FileSpreadsheet className="mr-2 size-4" />
              CSV şablonu indir
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setStep(2); }}>
              Devam et
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4" />
              Dosya yükle
            </CardTitle>
            <CardDescription>
              CSV veya Excel (CSV) dosyasını sürükleyip bırakın veya seçin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  readFilePreview(f);
                }
              }}
            />
            <div
              role="button"
              tabIndex={0}
              className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
                dragActive
                  ? 'border-accent bg-accent/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={() => { setDragActive(true); }}
              onDragLeave={() => { setDragActive(false); }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const f = e.dataTransfer.files[0];
                if (f) {
                  readFilePreview(f);
                }
              }}
            >
              <Upload className="text-muted-foreground mb-2 size-8" />
              <p className="font-medium">Dosya seç veya sürükle</p>
              <p className="text-muted-foreground mt-1">
                {file ? file.name : 'Henüz dosya seçilmedi'}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => { setStep(1); }}>
              Geri
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Önizleme</CardTitle>
            <CardDescription>
              {validCount} geçerli, {invalidCount} hatalı satır
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {previewRows.length > 0 && previewHeaders.length > 0 ? (
              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Satır</TableHead>
                      <TableHead className="w-20">Durum</TableHead>
                      {previewHeaders.slice(0, 6).map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((pr) => (
                      <TableRow
                        key={pr.lineNumber}
                        className={pr.valid ? '' : 'bg-destructive/5'}
                      >
                        <TableCell className="text-xs">{pr.lineNumber}</TableCell>
                        <TableCell>
                          {pr.valid ? (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-800">
                              Geçerli
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Hatalı</Badge>
                          )}
                        </TableCell>
                        {previewHeaders.slice(0, 6).map((h) => (
                          <TableCell key={h} className="max-w-[140px] truncate text-xs">
                            {pr.row[h] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            {invalidCount > 0 ? (
              <div className="text-destructive flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Hatalı satırlar içe aktarmada atlanabilir. Devam etmeden önce
                  dosyayı düzeltmeniz önerilir.
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { setStep(2); }}>
                Geri
              </Button>
              <Button
                type="button"
                disabled={!file || validCount === 0}
                onClick={() => { setStep(4); }}
              >
                Onaya geç
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && !importResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onay</CardTitle>
            <CardDescription>
              {validCount} geçerli satır içe aktarılacak.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              Dosya: <span className="font-medium">{file?.name ?? '—'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { setStep(3); }}>
                Geri
              </Button>
              <Button
                type="button"
                disabled={!file || importMutation.isPending}
                onClick={() => {
                  if (file) {
                    importMutation.mutate(file);
                  }
                }}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    İçe aktarılıyor…
                  </>
                ) : (
                  'İçe aktarmayı başlat'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && importResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Sonuç
            </CardTitle>
            <CardDescription>İçe aktarma özeti</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="text-sm">
              <li>Oluşturulan: {importResult.created}</li>
              <li>Güncellenen: {importResult.updated}</li>
              <li>Atlanan: {importResult.skipped}</li>
              <li>Hatalı satır: {importResult.errors.length}</li>
            </ul>
            {importResult.errors.length > 0 ? (
              <div className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">
                {importResult.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewRows([]);
                setImportResult(null);
              }}
            >
              Yeni içe aktarma
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
