import type { ReactElement } from 'react';

import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { MigrationDataType, MigrationSessionProgress } from '@/types/migration';

import { DATA_TYPE_LABELS } from '../migration.constants';

interface Props {
  dataType: MigrationDataType;
  progress: MigrationSessionProgress;
  status: 'idle' | 'running' | 'completed' | 'failed';
  isStarting: boolean;
  onStartImport: () => void;
  onDownloadReport: () => void;
}

export function ImportStep({
  dataType,
  progress,
  status,
  isStarting,
  onStartImport,
  onDownloadReport,
}: Props): ReactElement {
  const pct =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;
  const isRunning = status === 'running';
  const isCompleted = status === 'completed';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="size-5 text-emerald-600" />
          ) : null}
          İçe aktarma
        </CardTitle>
        <CardDescription>
          {DATA_TYPE_LABELS[dataType]} verileriniz arka planda işlenir. Sayfayı
          kapatsanız bile işlem devam eder.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!isRunning && !isCompleted ? (
          <Button type="button" onClick={onStartImport} disabled={isStarting}>
            {isStarting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Başlatılıyor…
              </>
            ) : (
              'İçe Aktarmayı Başlat'
            )}
          </Button>
        ) : null}

        {(isRunning || isCompleted) && progress.total > 0 ? (
          <div className="space-y-3">
            <Progress value={pct} />
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">İşlenen: </span>
                <strong>
                  {progress.processed} / {progress.total}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Başarılı: </span>
                <strong className="text-emerald-600">
                  {progress.imported + progress.updated}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Hata: </span>
                <strong className="text-destructive">{progress.failed}</strong>
              </div>
            </div>
            {isRunning ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Canlı ilerleme güncelleniyor…
              </p>
            ) : null}
          </div>
        ) : null}

        {isCompleted ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">İçe aktarma tamamlandı</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                <strong className="text-foreground">{progress.imported}</strong> yeni kayıt
                eklendi
              </li>
              <li>
                <strong className="text-foreground">{progress.updated}</strong> kayıt
                güncellendi
              </li>
              {progress.skipped > 0 ? (
                <li>
                  <strong className="text-foreground">{progress.skipped}</strong> satır
                  atlandı
                </li>
              ) : null}
              {progress.failed > 0 ? (
                <li>
                  <strong className="text-destructive">{progress.failed}</strong> hata
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {isCompleted ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" asChild>
              <Link to="/products">Ürünlere Git</Link>
            </Button>
            <Button type="button" variant="outline" onClick={onDownloadReport}>
              <Download className="mr-2 size-4" />
              Raporları İndir
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
