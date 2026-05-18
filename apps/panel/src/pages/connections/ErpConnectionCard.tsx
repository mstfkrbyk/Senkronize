import type { ReactElement } from 'react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

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
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useDeleteErpConnection,
  useTestErpConnection,
  useToggleErpConnection,
  type ErpConnectionDto,
} from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';
import { getErpBranding } from '@/pages/connections/erp-display';

interface Props {
  connection: ErpConnectionDto;
  onEditPress: (connection: ErpConnectionDto) => void;
}

type ErpStatusUi = 'active' | 'error' | 'inactive';

function deriveErpStatus(connection: ErpConnectionDto): ErpStatusUi {
  if (!connection.isActive) {
    return 'inactive';
  }
  if (connection.syncErrorCount >= 3) {
    return 'error';
  }
  return 'active';
}

function ErpStatusBadge({ status }: { status: ErpStatusUi }): ReactElement {
  const config: Record<ErpStatusUi, { label: string; className: string }> = {
    active: {
      label: 'Aktif',
      className: 'border-green-200 bg-green-50 text-green-800',
    },
    error: {
      label: 'Hata',
      className: 'border-red-200 bg-red-50 text-red-800',
    },
    inactive: {
      label: 'Bağlantı Yok',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
  };
  const c = config[status];
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}

export function ErpConnectionCard({ connection, onEditPress }: Props): ReactElement {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const testMutation = useTestErpConnection();
  const toggleMutation = useToggleErpConnection();
  const deleteMutation = useDeleteErpConnection();

  const { label, logo, accountFieldLabel } = getErpBranding(connection.erpType);

  const lastSyncLabel =
    connection.lastSyncAt !== null
      ? formatDistanceToNow(new Date(connection.lastSyncAt), {
          addSuffix: true,
          locale: tr,
        })
      : 'Henüz senkron yok';

  const status = deriveErpStatus(connection);

  const handleTest = (): void => {
    testMutation.mutate(
      { connectionId: connection.id },
      {
        onSuccess: (res) => {
          if (res.connected) {
            toast.success('Bağlantı testi başarılı.');
          } else {
            toast.warning('Bağlantı testi başarısız oldu.');
          }
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const handleActiveChange = (checked: boolean): void => {
    toggleMutation.mutate(
      { id: connection.id, isActive: checked },
      {
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const handleDelete = (): void => {
    deleteMutation.mutate(connection.id, {
      onSuccess: () => {
        toast.success('ERP bağlantısı silindi.');
        setDeleteOpen(false);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              <span aria-hidden>{logo}</span>
              <span>{label}</span>
              <ErpStatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {accountFieldLabel}: {connection.accountLabel ?? '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Label htmlFor={`active-erp-${connection.id}`} className="text-xs text-muted-foreground">
              Bağlantıyı etkinleştir
            </Label>
            <Switch
              id={`active-erp-${connection.id}`}
              checked={connection.isActive}
              disabled={toggleMutation.isPending}
              onCheckedChange={(v) => {
                handleActiveChange(v);
              }}
              aria-label="Bağlantıyı etkinleştir"
            />
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">
            Son senkron: {lastSyncLabel}
          </p>
          {connection.syncErrorCount > 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              Son dönemde {connection.syncErrorCount} senkron hatası
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => {
              handleTest();
            }}
          >
            {testMutation.isPending ? 'Test…' : 'Test Et'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              onEditPress(connection);
            }}
          >
            Düzenle
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              setDeleteOpen(true);
            }}
          >
            Sil
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ERP bağlantısını sil</AlertDialogTitle>
            <AlertDialogDescription>
              {label} bağlantısı kaldırılacak. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleteMutation.isPending ? 'Siliniyor…' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
