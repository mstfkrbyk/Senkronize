import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { useDropzone } from 'react-dropzone';
import { Loader2, Upload } from 'lucide-react';

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
import { cn } from '@/lib/utils';

import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../migration.constants';

interface Props {
  file: File | null;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  isUploading: boolean;
  onFileAccepted: (file: File) => void;
}

export function FileUploadStep({
  file,
  headers,
  previewRows,
  totalRows,
  isUploading,
  onFileAccepted,
}: Props): ReactElement {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const next = accepted[0];
      if (next) {
        onFileAccepted(next);
      }
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxSize: MAX_FILE_SIZE_BYTES,
      maxFiles: 1,
      disabled: isUploading,
    });

  const previewSlice = previewRows.slice(0, 5);
  const displayHeaders =
    headers.length > 0 ? headers : previewSlice[0] ? Object.keys(previewSlice[0]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dosya yükleme</CardTitle>
        <CardDescription>
          Desteklenen formatlar: CSV, XLSX, JSON, XML. Maksimum dosya boyutu 50 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          {...getRootProps()}
          className={cn(
            'flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
            isDragActive
              ? 'border-accent bg-accent/5'
              : 'border-muted-foreground/25 bg-muted/30',
            isUploading && 'pointer-events-none opacity-60',
          )}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-8 text-muted-foreground" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            {isUploading
              ? 'Dosya yükleniyor ve analiz ediliyor…'
              : 'Dosyayı sürükleyip bırakın veya bu alana tıklayın'}
          </p>
          {file ? (
            <p className="text-xs font-medium text-foreground">{file.name}</p>
          ) : null}
        </div>

        {fileRejections.length > 0 ? (
          <p className="text-sm text-destructive">
            {fileRejections[0]?.errors[0]?.message === 'File is larger than 52428800 bytes'
              ? 'Dosya boyutu 50 MB sınırını aşıyor.'
              : (fileRejections[0]?.errors[0]?.message ?? 'Dosya kabul edilmedi.')}
          </p>
        ) : null}

        {previewSlice.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Önizleme (ilk 5 satır){totalRows > 0 ? ` — toplam ${totalRows} satır` : ''}
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayHeaders.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewSlice.map((row, i) => (
                    <TableRow key={`preview-${i}`}>
                      {displayHeaders.map((h) => (
                        <TableCell key={`${i}-${h}`} className="max-w-[200px] truncate text-xs">
                          {row[h] ?? '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : file && !isUploading ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Önizlenecek veri bulunamadı. Dosya formatını kontrol edin.
          </p>
        ) : null}

        {file && !isUploading && previewSlice.length === 0 ? (
          <Button type="button" variant="secondary" onClick={() => onFileAccepted(file)}>
            Yeniden yükle
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
