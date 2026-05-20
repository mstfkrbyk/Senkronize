import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { api, getApiErrorMessage } from '@/lib/api';

import {
  API_KEY_PERMISSIONS,
  type ApiKeyRow,
  type CreatedApiKeyResponse,
  type CreateApiKeyInput,
  formatApiKeyDate,
  readStoredApiKeyPermissions,
  removeStoredApiKeyPermissions,
  writeStoredApiKeyPermissions,
} from '../api-keys.constants';
import { CreateApiKeyModal } from './CreateApiKeyModal';
import { EditApiKeyModal } from './EditApiKeyModal';

function statusBadge(row: ApiKeyRow, t: (key: string) => string): ReactElement {
  if (!row.isActive) {
    return <Badge variant="secondary">{t('settings.apiKeys.statusInactive')}</Badge>;
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return <Badge variant="destructive">{t('settings.apiKeys.statusExpired')}</Badge>;
  }
  return <Badge variant="default">{t('settings.apiKeys.statusActive')}</Badge>;
}

function permissionsLabel(
  row: ApiKeyRow,
  t: (key: string) => string,
): string {
  const perms = readStoredApiKeyPermissions(row.id) ?? row.permissions ?? [];
  if (perms.length === 0) {
    return '—';
  }
  const labels = perms.map((p) => {
    const found = API_KEY_PERMISSIONS.find((item) => item.value === p);
    return found ? t(found.labelKey) : p;
  });
  return labels.join(', ');
}

export function ApiKeysTab(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ApiKeyRow | null>(null);
  const [createdSecret, setCreatedSecret] = useState<CreatedApiKeyResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lastCreatedPermissions, setLastCreatedPermissions] = useState<string[]>([]);

  const keysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: async (): Promise<ApiKeyRow[]> => {
      const { data } = await api.get<ApiKeyRow[]>('/api-keys');
      return data;
    },
  });

  const rows = useMemo(() => keysQuery.data ?? [], [keysQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateApiKeyInput): Promise<CreatedApiKeyResponse> => {
      const { data } = await api.post<CreatedApiKeyResponse>('/api-keys', {
        name: input.name,
        permissions: input.permissions,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      });
      return data;
    },
    onSuccess: (data, variables) => {
      writeStoredApiKeyPermissions(data.id, variables.permissions);
      setLastCreatedPermissions(variables.permissions);
      setCreatedSecret(data);
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success(t('settings.apiKeys.createSuccess'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const editMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      permissions: string[];
      expiresAt?: string;
    }): Promise<void> => {
      await api.patch(`/api-keys/${input.id}`, {
        name: input.name,
        permissions: input.permissions,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : { expiresAt: null }),
      });
    },
    onMutate: (variables) => {
      writeStoredApiKeyPermissions(variables.id, variables.permissions);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success(t('settings.apiKeys.editSuccess'));
      setEditRow(null);
    },
    onError: (_err: unknown, variables) => {
      writeStoredApiKeyPermissions(variables.id, variables.permissions);
      toast.warning(t('settings.apiKeys.editLocalOnly'));
      setEditRow(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api-keys/${id}`);
    },
    onSuccess: (_data, id) => {
      removeStoredApiKeyPermissions(id);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success(t('settings.apiKeys.deleteSuccess'));
      setDeleteId(null);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const copyPrefix = async (prefix: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${prefix}…`);
      toast.success(t('settings.apiKeys.copyPrefixSuccess'));
    } catch {
      toast.error(t('settings.apiKeys.copyFailed'));
    }
  };

  const copySecret = async (): Promise<void> => {
    if (!createdSecret?.key) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdSecret.key);
      toast.success(t('settings.apiKeys.copySuccess'));
    } catch {
      toast.error(t('settings.apiKeys.copyFailed'));
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('settings.apiKeys.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.apiKeys.subtitle')}</p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <KeyRound className="mr-2 size-4" />
            {t('settings.apiKeys.createButton')}
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
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.apiKeys.colName')}</TableHead>
                  <TableHead>{t('settings.apiKeys.colCreated')}</TableHead>
                  <TableHead>{t('settings.apiKeys.colLastUsed')}</TableHead>
                  <TableHead>{t('settings.apiKeys.colPermissions')}</TableHead>
                  <TableHead>{t('settings.apiKeys.colStatus')}</TableHead>
                  <TableHead className="text-right">{t('settings.apiKeys.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      {t('settings.apiKeys.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.keyPrefix}…
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatApiKeyDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatApiKeyDate(row.lastUsedAt)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm" title={permissionsLabel(row, t)}>
                        {permissionsLabel(row, t)}
                      </TableCell>
                      <TableCell>{statusBadge(row, t)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => void copyPrefix(row.keyPrefix)}
                              >
                                <Copy className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('settings.apiKeys.copyPrefix')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setEditRow(row)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('common.edit')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(row.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('common.delete')}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <CreateApiKeyModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          isPending={createMutation.isPending}
          onSubmit={(input) => createMutation.mutate(input)}
        />

        <EditApiKeyModal
          open={editRow !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditRow(null);
            }
          }}
          apiKey={editRow}
          isPending={editMutation.isPending}
          onSubmit={(input) => {
            writeStoredApiKeyPermissions(input.id, input.permissions);
            editMutation.mutate(input);
          }}
        />

        <Dialog
          open={createdSecret !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreatedSecret(null);
              setLastCreatedPermissions([]);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('settings.apiKeys.secretTitle')}</DialogTitle>
              <DialogDescription>{t('settings.apiKeys.secretDescription')}</DialogDescription>
            </DialogHeader>
            {createdSecret ? (
              <div className="space-y-3">
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                  {t('settings.apiKeys.secretWarning')}
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs break-all">
                  {createdSecret.key}
                </div>
                {lastCreatedPermissions.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('settings.apiKeys.colPermissions')}:{' '}
                    {lastCreatedPermissions
                      .map((p) => {
                        const found = API_KEY_PERMISSIONS.find((item) => item.value === p);
                        return found ? t(found.labelKey) : p;
                      })
                      .join(', ')}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void copySecret()}>
                    <Copy className="mr-2 size-4" />
                    {t('settings.apiKeys.copyButton')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreatedSecret(null);
                      setLastCreatedPermissions([]);
                    }}
                  >
                    {t('common.close')}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.apiKeys.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('settings.apiKeys.deleteDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) {
                    deleteMutation.mutate(deleteId);
                  }
                }}
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
