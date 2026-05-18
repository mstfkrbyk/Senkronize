import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  PenLine,
  ShoppingBag,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

import {
  MIGRATION_CSV_TEMPLATE,
  parseMigrationCsv,
  type MigrationCsvRow,
  type MigrationImportResult,
} from './parseMigrationCsv';

type PlatformChoice = 'ENTEGRA' | 'SOPYO' | 'CSV' | 'MANUAL';

const PLATFORMS: {
  id: PlatformChoice;
  title: string;
  description: string;
  icon: typeof Building2;
}[] = [
  {
    id: 'ENTEGRA',
    title: 'Entegra',
    description: 'Entegra dışa aktarım CSV dosyanızı yükleyin.',
    icon: Building2,
  },
  {
    id: 'SOPYO',
    title: 'Sopyo',
    description: 'Sopyo dışa aktarım CSV dosyanızı yükleyin.',
    icon: ShoppingBag,
  },
  {
    id: 'CSV',
    title: 'Diğer (CSV)',
    description: 'Şablona uygun herhangi bir CSV dosyası kullanın.',
    icon: FileSpreadsheet,
  },
  {
    id: 'MANUAL',
    title: 'Manuel',
    description: 'Ürünleri kendiniz düzenleyerek CSV hazırlayın.',
    icon: PenLine,
  },
];

function downloadTemplate(): void {
  const blob = new Blob([`\ufeff${MIGRATION_CSV_TEMPLATE}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'senkronize-urun-sablonu.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function MigrationPage(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [platform, setPlatform] = useState<PlatformChoice | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<MigrationCsvRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<MigrationImportResult | null>(
    null,
  );

  const readFilePreview = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setPreviewRows(parseMigrationCsv(text));
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const importMutation = useMutation({
    mutationFn: async (upload: File) => {
      const body = new FormData();
      body.append('file', upload);
      const { data } = await api.post<MigrationImportResult>(
        '/migration/import-products',
        body,
      );
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f) {
        readFilePreview(f);
      }
    },
    [readFilePreview],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        readFilePreview(f);
      }
    },
    [readFilePreview],
  );

  const previewSlice = previewRows.slice(0, 5);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Geçiş sihirbazı
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rakip platformdan CSV ile ürün ve stok bilgilerinizi Senkronize&apos;a
          taşıyın.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={step >= 1 ? 'font-medium text-foreground' : ''}>
          1. Platform
        </span>
        <span aria-hidden>→</span>
        <span className={step >= 2 ? 'font-medium text-foreground' : ''}>
          2. Dosya
        </span>
        <span aria-hidden>→</span>
        <span className={step >= 3 ? 'font-medium text-foreground' : ''}>
          3. Sonuç
        </span>
      </div>

      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setPlatform(p.id);
                  setStep(2);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPlatform(p.id);
                    setStep(2);
                  }
                }}
              >
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="rounded-lg bg-accent/15 p-2 text-accent">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {p.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Geri
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRightLeft className="size-4 shrink-0" />
              {platform
                ? PLATFORMS.find((p) => p.id === platform)?.title
                : null}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>CSV yükleme</CardTitle>
              <CardDescription>
                Sütunlar: barkod, ad, fiyat, stok (virgül veya noktalı virgül
                ayırıcı). İsteğe bağlı: kategori, marka, liste fiyat, açıklama,
                görsel URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={downloadTemplate}>
                  Örnek şablonu indir
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInput}
              />

              <div
                className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragActive
                    ? 'border-accent bg-accent/5'
                    : 'border-muted-foreground/25 bg-muted/30'
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  Dosyayı sürükleyip bırakın veya bu alana tıklayın
                </p>
                {file ? (
                  <p className="text-xs text-muted-foreground">{file.name}</p>
                ) : null}
              </div>

              {previewSlice.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Önizleme (ilk 5 satır)</p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Barkod</TableHead>
                          <TableHead>Ad</TableHead>
                          <TableHead className="text-right">Fiyat</TableHead>
                          <TableHead className="text-right">Stok</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewSlice.map((r, i) => (
                          <TableRow key={`${r.barcode}-${i}`}>
                            <TableCell className="font-mono text-xs">
                              {r.barcode}
                            </TableCell>
                            <TableCell>{r.name}</TableCell>
                            <TableCell className="text-right">
                              {r.salePrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{r.stock}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : file ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Önizlenecek veri bulunamadı. Başlık satırı ve en az bir veri
                  satırı olduğundan emin olun.
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
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
                    'Devam et'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === 3 && importResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              İçe aktarma sonucu
            </CardTitle>
            <CardDescription>
              Ürün kartları ve merkezi stok kayıtları güncellendi. Liste fiyatları
              pazaryeri listelemelerinde ayrı yönetilir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-emerald-600">✅</span>{' '}
                <strong>{importResult.imported}</strong> yeni ürün içe aktarıldı
              </li>
              <li>
                <span className="text-sky-600">🔄</span>{' '}
                <strong>{importResult.updated}</strong> ürün güncellendi
              </li>
              <li>
                <span className="text-muted-foreground">⏭️</span>{' '}
                <strong>{importResult.skipped}</strong> satır atlandı
              </li>
            </ul>

            {importResult.errors.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">
                  Hatalar ({importResult.errors.length})
                </p>
                <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-destructive">
                  {importResult.errors.map((err, idx) => (
                    <li key={`${idx}-${err.slice(0, 40)}`}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/listings">Ürün listesine git</Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep(1);
                  setPlatform(null);
                  setFile(null);
                  setPreviewRows([]);
                  setImportResult(null);
                }}
              >
                Yeni içe aktarma
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
