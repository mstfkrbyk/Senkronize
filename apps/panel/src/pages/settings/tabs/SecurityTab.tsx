import type { ReactElement } from 'react';

import { useMutation } from '@tanstack/react-query';
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
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';

import { useAuditLog } from '../hooks/useAuditLog';
import { AuditLogTable } from './AuditLogTable';

export function SecurityTab(): ReactElement {
  const auditQuery = useAuditLog(50);

  const requestExport = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/users/export-data').then((r) => r.data),
    onSuccess: (data) => {
      toast.success(
        data.message ??
          'Talebiniz alındı. 30 dakika içinde e-posta ile gönderilecektir.',
      );
    },
    onError: () => {
      toast.error('Bir hata oluştu, lütfen tekrar deneyin.');
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Denetim kaydı</CardTitle>
          <CardDescription>
            Hesabınızda yapılan son işlemler (partner erişimi ve abonelik değişiklikleri dahil).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(auditQuery.error)}
            </p>
          ) : null}
          {auditQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <AuditLogTable entries={auditQuery.data ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Aktif oturumlar</CardTitle>
            <CardDescription>
              Diğer cihazlardaki oturumlarınızı yönetin (yakında).
            </CardDescription>
          </div>
          <Badge variant="secondary">Yakında</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Oturum listesi ve uzaktan çıkış özelliği üzerinde çalışıyoruz.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Veri indirme (KVKK)</CardTitle>
          <CardDescription>
            KVKK madde 11 kapsamında kişisel verilerinize erişim ve taşınabilirlik hakkınız.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Tüm hesap verilerinizi paketleyip e-posta ile gönderebiliriz.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={requestExport.isPending}
            onClick={() => {
              requestExport.mutate();
            }}
          >
            {requestExport.isPending ? 'Gönderiliyor…' : 'Verilerimi indir'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
