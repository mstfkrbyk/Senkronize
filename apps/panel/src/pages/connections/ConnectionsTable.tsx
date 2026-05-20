import type { ReactElement } from 'react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { ConnectionHealthBadge } from '@/components/connections/ConnectionHealthBadge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useDeleteConnection,
  useTestConnection,
  useTriggerManualSync,
} from '@/hooks/useConnections';
import {
  useDeleteErpConnection,
  useTestErpConnection,
  type ErpConnectionDto,
} from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';
import {
  kindLabel,
  statusBadgeClass,
  statusLabel,
  type UnifiedConnectionRow,
} from '@/pages/connections/connection-utils';
import { getErpBranding } from '@/pages/connections/erp-display';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { MarketplaceConnectionDto } from '@/types/connection';

interface Props {
  rows: UnifiedConnectionRow[];
  marketplaceConnections: MarketplaceConnectionDto[];
  erpConnections: ErpConnectionDto[];
  onEditMarketplace: (c: MarketplaceConnectionDto) => void;
  onEditErp: (c: ErpConnectionDto) => void;
  variant?: 'default' | 'erp';
}

function platformCell(row: UnifiedConnectionRow): ReactElement {
  if (row.kind === 'erp') {
    const branding = getErpBranding(row.platform);
    return (
      <span className="flex items-center gap-2">
        <span aria-hidden>{branding.logo}</span>
        <span>{branding.label}</span>
      </span>
    );
  }
  const branding = getMarketplaceBranding(row.platform);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden>{branding.logo}</span>
      <span>{branding.label}</span>
    </span>
  );
}

function detailHref(row: UnifiedConnectionRow): string {
  if (row.kind === 'erp') {
    return `/connections/erp/${row.id}`;
  }
  return `/connections/${row.id}`;
}

export function ConnectionsTable({
  rows,
  marketplaceConnections,
  erpConnections,
  onEditMarketplace,
  onEditErp,
  variant = 'default',
}: Props): ReactElement {
  const [deleteTarget, setDeleteTarget] = useState<UnifiedConnectionRow | null>(null);

  const testMp = useTestConnection();
  const testErp = useTestErpConnection();
  const triggerSync = useTriggerManualSync();
  const deleteMp = useDeleteConnection();
  const deleteErp = useDeleteErpConnection();

  const mpById = new Map(marketplaceConnections.map((c) => [c.id, c]));
  const erpById = new Map(erpConnections.map((c) => [c.id, c]));

  const handleTest = (row: UnifiedConnectionRow): void => {
    if (row.kind === 'erp') {
      testErp.mutate(
        { connectionId: row.id },
        {
          onSuccess: (res) => {
            toast.success(res.connected ? 'Bağlantı testi başarılı.' : 'Bağlantı testi başarısız.');
          },
          onError: (error) => {
            toast.error(getApiErrorMessage(error));
          },
        },
      );
      return;
    }
    testMp.mutate(
      { connectionId: row.id },
      {
        onSuccess: (res) => {
          toast.success(res.connected ? 'Bağlantı testi başarılı.' : 'Bağlantı testi başarısız.');
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const handleSync = (row: UnifiedConnectionRow): void => {
    if (row.kind === 'erp') {
      toast.info('ERP senkronu için detay sayfasını kullanın.');
      return;
    }
    triggerSync.mutate(row.id, {
      onSuccess: () => {
        toast.success('Senkron kuyruğa alındı.');
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  const handleEdit = (row: UnifiedConnectionRow): void => {
    if (row.kind === 'erp') {
      const c = erpById.get(row.id);
      if (c) {
        onEditErp(c);
      }
      return;
    }
    const c = mpById.get(row.id);
    if (c) {
      onEditMarketplace(c);
    }
  };

  const handleDeleteConfirm = (): void => {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.kind === 'erp') {
      deleteErp.mutate(deleteTarget.id, {
        onSuccess: () => {
          toast.success('ERP bağlantısı silindi.');
          setDeleteTarget(null);
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      });
      return;
    }
    deleteMp.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Bağlantı silindi.');
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Bu kategoride bağlantı yok.
      </p>
    );
  }

  const isErpTable = variant === 'erp';

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Bağlantı adı</TableHead>
              {!isErpTable ? <TableHead>Tip</TableHead> : null}
              {isErpTable ? <TableHead>Sunucu / domain</TableHead> : null}
              <TableHead>Durum</TableHead>
              <TableHead>Son sync</TableHead>
              {isErpTable ? (
                <TableHead>Bağlı belgeler</TableHead>
              ) : (
                <TableHead>Sync sıklığı</TableHead>
              )}
              <TableHead className="text-right">Aksiyonlar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const lastSync =
                row.lastSyncAt !== null
                  ? formatDistanceToNow(new Date(row.lastSyncAt), {
                      addSuffix: true,
                      locale: tr,
                    })
                  : '—';
              const mpConn = mpById.get(row.id);

              return (
                <TableRow key={`${row.kind}-${row.id}`}>
                  <TableCell>{platformCell(row)}</TableCell>
                  <TableCell>
                    <Link
                      to={detailHref(row)}
                      className="font-medium text-sky-600 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  {!isErpTable ? <TableCell>{kindLabel(row.kind)}</TableCell> : null}
                  {isErpTable ? (
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {row.serverDomain ?? '—'}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    {row.kind !== 'erp' && mpConn ? (
                      <ConnectionHealthBadge
                        connectionId={row.id}
                        fallbackConnection={mpConn}
                      />
                    ) : (
                      <Badge variant="outline" className={statusBadgeClass(row.status)}>
                        {statusLabel(row.status)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lastSync}</TableCell>
                  {isErpTable ? (
                    <TableCell className="text-muted-foreground">
                      {row.linkedDocumentsLabel ?? '—'}
                    </TableCell>
                  ) : (
                    <TableCell>{row.syncFrequencyLabel}</TableCell>
                  )}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="İşlemler">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={testMp.isPending || testErp.isPending}
                          onClick={() => {
                            handleTest(row);
                          }}
                        >
                          {testMp.isPending || testErp.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Test Et
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={
                            triggerSync.isPending || !row.isActive || row.kind === 'erp'
                          }
                          onClick={() => {
                            handleSync(row);
                          }}
                        >
                          Sync Et
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleEdit(row);
                          }}
                        >
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeleteTarget(row);
                          }}
                        >
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bağlantıyı sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} bağlantısı kalıcı olarak kaldırılacak. Devam etmek istiyor
              musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMp.isPending || deleteErp.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
            >
              {deleteMp.isPending || deleteErp.isPending ? 'Siliniyor…' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
