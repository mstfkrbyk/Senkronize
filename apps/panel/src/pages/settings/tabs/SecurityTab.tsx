import type { ReactElement } from 'react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { getApiErrorMessage } from '@/lib/api';

import { useAuditLog } from '../hooks/useAuditLog';
import { AuditLogTable } from './AuditLogTable';

export function SecurityTab(): ReactElement {
  const auditQuery = useAuditLog(50);
  const [exportOpen, setExportOpen] = useState(false);

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
          <Button type="button" variant="secondary" onClick={() => setExportOpen(true)}>
            Verilerimi indir
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Talebiniz alındı</AlertDialogTitle>
            <AlertDialogDescription>
              Veri dışa aktarma talebiniz kaydedildi. Verileriniz 30 dakika içinde e-posta ile
              gönderilecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Kapat</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => setExportOpen(false)}>
              Tamam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
