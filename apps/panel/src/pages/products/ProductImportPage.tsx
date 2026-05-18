import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';

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
import { api, getApiErrorMessage } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ImportResult } from '@/types/product';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductImportPage(): ReactElement {
  usePageTitle('Ürün İçe Aktarma');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
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
      const rows = (parsed.data ?? []).filter((r) =>
        Object.values(r).some((v) => String(v).trim().length > 0),
      );
      setPreviewRows(rows.slice(0, 5));
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const downloadTemplate = useCallback(async () => {
    const res = await api.get<Blob>('/products/template', {
      responseType: 'blob',
    });
    downloadBlob(
      new Blob([res.data], { type: 'text/csv;charset=utf-8;' }),
      'senkronize-urun-varyant-sablonu.csv',
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
      setStep(3);
      toast.success('İçe aktarma tamamlandı');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const previewHeaders =
    previewRows.length > 0 ? Object.keys(previewRows[0] ?? {}) : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CSV ile ürün içe aktar</h1>
        <p className="text-muted-foreground text-sm">
          Şablonu indirin, doldurun ve dosyayı yükleyin.
        </p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 rounded-md border px-3 py-2 text-center text-sm font-medium ${
              step === s
                ? 'border-accent bg-accent/10 text-accent-foreground'
                : 'border-border text-muted-foreground'
            }`}
          >
            {s}. {s === 1 ? 'Şablon' : s === 2 ? 'Dosya' : 'Sonuç'}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="size-4" />
              Şablon indir
            </CardTitle>
            <CardDescription>
              Ürün ve varyant CSV şablonunu bilgisayarınıza kaydedin.
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
              CSV şablonunu indir
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
              CSV dosyasını sürükleyip bırakın veya seçin. İlk 5 veri satırı önizlenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
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

            {previewRows.length > 0 && previewHeaders.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewHeaders.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {previewHeaders.map((h) => (
                          <TableCell key={h} className="max-w-[200px] truncate text-xs">
                            {row[h] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { setStep(1); }}>
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
                    Yükleniyor…
                  </>
                ) : (
                  'İçe aktar'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && importResult ? (
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
