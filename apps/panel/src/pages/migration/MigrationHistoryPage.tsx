import type { ReactElement } from 'react';
import { useState } from 'react';

import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowRightLeft, Eye, Loader2, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { MigrationHistoryItem, MigrationSessionStatus } from '@/types/migration';

import {
  DATA_TYPE_LABELS,
  FIELD_LABELS,
  SESSION_STATUS_LABELS,
  SOURCE_FORMAT_LABELS,
} from './migration.constants';
import { useMigrationHistory } from './hooks/useMigration';

function statusBadge(status: MigrationSessionStatus): ReactElement {
  const variants: Record<
    MigrationSessionStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    uploaded: 'outline',
    mapped: 'outline',
    validated: 'secondary',
    queued: 'secondary',
    processing: 'secondary',
    completed: 'default',
    failed: 'destructive',
  };
  return (
    <Badge variant={variants[status]}>
      {SESSION_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function MigrationHistoryPage(): ReactElement {
  usePageTitle('İçe Aktarma Geçmişi');
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useMigrationHistory();
  const [detailItem, setDetailItem] = useState<MigrationHistoryItem | null>(null);

  const handleRerun = (item: MigrationHistoryItem): void => {
    navigate('/migration', {
      state: {
        rerun: {
          sourceFormat: item.sourceFormat,
          dataType: item.dataType,
        },
      },
    });
    toast.info('Sihirbaz aynı ayarlarla açıldı');
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">İçe aktarma geçmişi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Geçmiş veri taşıma işlemlerinizi görüntüleyin ve yönetin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Yenile
          </Button>
          <Button type="button" size="sm" asChild>
            <Link to="/migration">
              <ArrowRightLeft className="mr-2 size-4" />
              Yeni içe aktarma
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geçmiş importlar</CardTitle>
          <CardDescription>Tarih, kaynak, veri tipi ve sonuç özeti</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Geçmiş yüklenemedi. Lütfen tekrar deneyin.
            </p>
          ) : !data?.length ? (
            <EmptyState
              title="Henüz içe aktarma yok"
              description="Geçiş sihirbazı ile ilk veri taşıma işleminizi başlatın."
              secondaryAction={{
                label: 'Geçiş sihirbazına git',
                href: '/migration',
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Veri tipi</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-right">Başarılı</TableHead>
                    <TableHead className="text-right">Hata</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(item.createdAt), 'd MMM yyyy HH:mm', {
                          locale: tr,
                        })}
                      </TableCell>
                      <TableCell>
                        {item.sourceLabel ??
                          SOURCE_FORMAT_LABELS[item.sourceFormat] ??
                          item.sourceFormat}
                      </TableCell>
                      <TableCell>{DATA_TYPE_LABELS[item.dataType]}</TableCell>
                      <TableCell className="text-right">{item.total}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {item.success}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {item.failed}
                      </TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailItem(item)}
                          >
                            <Eye className="mr-1 size-4" />
                            Detay
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRerun(item)}
                          >
                            <RefreshCw className="mr-1 size-4" />
                            Tekrar Çalıştır
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailItem !== null} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import detayı</DialogTitle>
            <DialogDescription>
              {detailItem
                ? `${detailItem.fileName} — ${DATA_TYPE_LABELS[detailItem.dataType]}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {detailItem?.errors?.length ? (
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Satır</TableHead>
                    <TableHead>Alan</TableHead>
                    <TableHead>Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailItem.errors.map((err, idx) => (
                    <TableRow key={`${err.row}-${idx}`}>
                      <TableCell>{err.row}</TableCell>
                      <TableCell>{FIELD_LABELS[err.field] ?? err.field}</TableCell>
                      <TableCell className="text-destructive">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Kayıtlı hata bulunmuyor.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
