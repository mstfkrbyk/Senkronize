import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreatedApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  key: string;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '—';
  }
}

export function ApiKeysTab(): ReactElement {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<CreatedApiKeyResponse | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: async (): Promise<ApiKeyRow[]> => {
      const { data } = await api.get<ApiKeyRow[]>('/api-keys');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<CreatedApiKeyResponse> => {
      const { data } = await api.post<CreatedApiKeyResponse>('/api-keys', { name });
      return data;
    },
    onSuccess: (data) => {
      setCreatedSecret(data);
      setNewKeyName('');
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API anahtarı oluşturuldu');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api-keys/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API anahtarı devre dışı bırakıldı');
      setDisableId(null);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const handleCreateSubmit = (): void => {
    const trimmed = newKeyName.trim();
    if (!trimmed) {
      toast.error('Lütfen bir isim girin.');
      return;
    }
    createMutation.mutate(trimmed);
  };

  const copySecret = async (): Promise<void> => {
    if (!createdSecret?.key) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdSecret.key);
      toast.success('Panoya kopyalandı');
    } catch {
      toast.error('Kopyalama başarısız oldu');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">API anahtarları</h2>
          <p className="text-sm text-muted-foreground">
            Masaüstü ajanı ve otomasyonlar için güvenli erişim. Anahtarlar yalnızca oluşturulduğunda tam metin
            olarak gösterilir.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Yeni key oluştur
        </Button>
      </div>

      {keysQuery.isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(keysQuery.error)}</p>
      ) : null}

      {keysQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İsim</TableHead>
                <TableHead>Önek</TableHead>
                <TableHead>Son kullanım</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(keysQuery.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Henüz API anahtarı yok.
                  </TableCell>
                </TableRow>
              ) : (
                (keysQuery.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-xs">{row.keyPrefix}…</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(row.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDisableId(row.id)}
                      >
                        Sil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni API anahtarı</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="api-key-name">İsim</Label>
            <Input
              id="api-key-name"
              placeholder="Örn. Tauri masaüstü ajanı"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
            >
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createdSecret !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedSecret(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Anahtarınız hazır</DialogTitle>
            <DialogDescription>
              Bu anahtar bir daha gösterilmeyecek. Güvenli bir yerde saklayın veya hemen kopyalayın.
            </DialogDescription>
          </DialogHeader>
          {createdSecret ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs break-all">
                {createdSecret.key}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void copySecret()}>
                  Kopyala
                </Button>
                <Button type="button" variant="outline" onClick={() => setCreatedSecret(null)}>
                  Kapat
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={disableId !== null} onOpenChange={(o) => !o && setDisableId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API anahtarını devre dışı bırak?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz; anahtar kalıcı olarak kullanılamaz hale gelir. Yerel ajanlar bu anahtarla
              artık bağlanamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (disableId) {
                  disableMutation.mutate(disableId);
                }
              }}
            >
              Devre dışı bırak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
