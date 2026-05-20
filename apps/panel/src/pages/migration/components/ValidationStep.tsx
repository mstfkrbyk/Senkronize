import type { ReactElement } from 'react';

import { AlertTriangle, Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MigrationValidationResult } from '@/types/migration';

import { FIELD_LABELS, buildErrorsCsv, downloadCsv } from '../migration.constants';

interface Props {
  validationResult: MigrationValidationResult | null;
  isValidating: boolean;
  allowWarnings: boolean;
  onAllowWarningsChange: (value: boolean) => void;
  onValidate: () => void;
  onDownloadErrors: () => void;
}

export function ValidationStep({
  validationResult,
  isValidating,
  allowWarnings,
  onAllowWarningsChange,
  onValidate,
  onDownloadErrors,
}: Props): ReactElement {
  const errorCount = validationResult?.errors.length ?? 0;
  const warningCount = validationResult?.warnings.length ?? 0;
  const validCount = validationResult?.valid ?? 0;
  const totalCount = validationResult?.total ?? 0;

  const handleDownload = (): void => {
    if (!validationResult?.errors.length) {
      return;
    }
    const csv = buildErrorsCsv(validationResult.errors);
    downloadCsv(csv, 'migration-dogrulama-hatalari.csv');
    onDownloadErrors();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Veri doğrulama</CardTitle>
          <CardDescription>
            Dosyanızdaki kayıtları içe aktarmadan önce doğrulayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button type="button" onClick={onValidate} disabled={isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Doğrulanıyor…
              </>
            ) : (
              'Doğrula'
            )}
          </Button>

          {isValidating ? (
            <div className="space-y-2">
              <Progress value={33} className="[&>div]:animate-pulse" />
              <p className="text-sm text-muted-foreground">Kayıtlar kontrol ediliyor…</p>
            </div>
          ) : null}

          {validationResult ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <p className="text-sm text-muted-foreground">Geçerli</p>
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                  {validCount}
                </p>
              </div>
              <div className="rounded-lg border bg-destructive/5 p-4">
                <p className="text-sm text-muted-foreground">Hata</p>
                <p className="text-2xl font-semibold text-destructive">{errorCount}</p>
              </div>
              <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/30">
                <p className="text-sm text-muted-foreground">Uyarı</p>
                <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
                  {warningCount}
                </p>
              </div>
            </div>
          ) : null}

          {validationResult ? (
            <p className="text-sm text-muted-foreground">
              Toplam {totalCount} satır incelendi.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {validationResult && errorCount > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Hata listesi</CardTitle>
              <CardDescription>İçe aktarılamayan satırlar</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 size-4" />
              Hataları İndir
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Satır</TableHead>
                    <TableHead>Alan</TableHead>
                    <TableHead>Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.errors.slice(0, 100).map((err, idx) => (
                    <TableRow key={`${err.row}-${err.field}-${idx}`}>
                      <TableCell>{err.row}</TableCell>
                      <TableCell>{FIELD_LABELS[err.field] ?? err.field}</TableCell>
                      <TableCell className="text-destructive">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validationResult.errors.length > 100 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                İlk 100 hata gösteriliyor. Tümünü indirmek için CSV kullanın.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {validationResult && warningCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Uyarılar ({warningCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-40 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Satır</TableHead>
                    <TableHead>Alan</TableHead>
                    <TableHead>Uyarı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.warnings.slice(0, 20).map((warn, idx) => (
                    <TableRow key={`${warn.row}-${warn.field}-${idx}`}>
                      <TableCell>{warn.row}</TableCell>
                      <TableCell>{FIELD_LABELS[warn.field] ?? warn.field}</TableCell>
                      <TableCell>{warn.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="allow-warnings"
                checked={allowWarnings}
                onCheckedChange={(c) => onAllowWarningsChange(c === true)}
              />
              <Label htmlFor="allow-warnings" className="cursor-pointer">
                Uyarılarla devam et
              </Label>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
