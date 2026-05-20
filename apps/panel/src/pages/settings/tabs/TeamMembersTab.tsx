import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';

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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import type { OrgUser } from '@/types/user';

const ASSIGNABLE_ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const;

const inviteSchema = z.object({
  email: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .email(FORM_MESSAGES.email),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']),
});

type InviteForm = z.infer<typeof inviteSchema>;

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sahip',
    ADMIN: 'Admin',
    MANAGER: 'Yönetici',
    VIEWER: 'Görüntüleyici',
    SUPER_ADMIN: 'Sistem yöneticisi',
  };
  return map[role] ?? role;
}

function initials(name: string, email: string): string {
  const n = name.trim();
  if (n.length >= 2) {
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

interface UserInviteRow {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

type OrgMember = OrgUser & { lastActivityAt: string };

export function TeamMembersTab(): ReactElement {
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>('');

  const isOwner = me?.user.role === 'OWNER';
  const canManageInvites =
    me?.user.role === 'OWNER' || me?.user.role === 'ADMIN';

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<OrgMember[]> => {
      const { data } = await api.get<OrgMember[]>('/users');
      return data;
    },
  });

  const invitesQuery = useQuery({
    queryKey: ['users', 'invites'],
    enabled: canManageInvites,
    queryFn: async (): Promise<UserInviteRow[]> => {
      const { data } = await api.get<UserInviteRow[]>('/users/invites');
      return data;
    },
  });

  const invalidateUsers = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
    void queryClient.invalidateQueries({ queryKey: ['users', 'invites'] });
  }, [queryClient]);

  const inviteMutation = useMutation({
    mutationFn: async (body: InviteForm): Promise<unknown> => {
      const { data } = await api.post<unknown>('/users/invite', {
        email: body.email,
        role: body.role,
      });
      return data;
    },
    onSuccess: () => {
      invalidateUsers();
      toast.success('Davet gönderildi. Alıcıya e-posta iletildi.');
      setInviteOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const roleMutation = useMutation({
    mutationFn: async (input: { id: string; role: string }): Promise<unknown> => {
      const { data } = await api.patch<unknown>(`/users/${input.id}/role`, {
        role: input.role,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Rol güncellendi.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Üye organizasyondan çıkarıldı.');
      setRemoveId(null);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/users/invites/${id}`);
    },
    onSuccess: () => {
      invalidateUsers();
      toast.success('Davet iptal edildi.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (newOwnerId: string): Promise<void> => {
      await api.post('/users/transfer-ownership', { newOwnerId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Sahiplik devredildi.');
      setTransferOpen(false);
      setTransferTargetId('');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodFormResolver(inviteSchema),
    defaultValues: { email: '', role: 'VIEWER' },
  });

  const transferCandidates = useMemo(() => {
    const list = usersQuery.data ?? [];
    return list.filter(
      (u) => u.id !== me?.user.id && u.role !== 'OWNER' && u.role !== 'SUPER_ADMIN',
    );
  }, [usersQuery.data, me?.user.id]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-primary">Ekip üyeleri</h3>
          <p className="text-sm text-muted-foreground">
            Üyeleri yönetin, davet gönderin ve rolleri düzenleyin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Button
              type="button"
              variant="outline"
              disabled={transferCandidates.length === 0}
              onClick={() => setTransferOpen(true)}
            >
              Sahipliği devret
            </Button>
          ) : null}
          {canManageInvites ? (
            <Button type="button" onClick={() => setInviteOpen(true)}>
              Üye davet et
            </Button>
          ) : null}
        </div>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {usersQuery.isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(usersQuery.error)}</p>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError && usersQuery.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Henüz ekip üyesi yok.
        </p>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError && usersQuery.data?.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Üye</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Son aktif</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.map((u) => {
                const isSelf = me?.user.id === u.id;
                const isRowOwner = u.role === 'OWNER';
                const canManageRole =
                  (me?.user.role === 'OWNER' || me?.user.role === 'ADMIN') && !isSelf && !isRowOwner;
                const canRemove =
                  (me?.user.role === 'OWNER' ||
                    (me?.user.role === 'ADMIN' && u.role !== 'ADMIN')) &&
                  !isSelf &&
                  !isRowOwner;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-sm text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.lastActivityAt).toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canManageRole ? (
                          <Select
                            value={u.role}
                            onValueChange={(role) => {
                              if (
                                ASSIGNABLE_ROLES.includes(
                                  role as (typeof ASSIGNABLE_ROLES)[number],
                                )
                              ) {
                                roleMutation.mutate({ id: u.id, role });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="MANAGER">Yönetici</SelectItem>
                              <SelectItem value="VIEWER">Görüntüleyici</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {canRemove ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setRemoveId(u.id)}
                          >
                            Kaldır
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {canManageInvites ? (
        <div>
          <h3 className="text-lg font-medium text-primary">Bekleyen davetler</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Davet bağlantıları 48 saat geçerlidir; alıcıya e-posta gönderilir.
          </p>
          {invitesQuery.isLoading ? <Skeleton className="h-10 w-full" /> : null}
          {invitesQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(invitesQuery.error)}</p>
          ) : null}
          {!invitesQuery.isLoading &&
          !invitesQuery.isError &&
          (invitesQuery.data?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              Bekleyen davet yok.
            </p>
          ) : null}
          {!invitesQuery.isLoading && invitesQuery.data?.length ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Gönderim</TableHead>
                    <TableHead>Bitiş</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitesQuery.data.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{roleLabel(inv.role)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={cancelInviteMutation.isPending}
                          onClick={() => cancelInviteMutation.mutate(inv.id)}
                        >
                          İptal et
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Üye davet et</DialogTitle>
          </DialogHeader>
          <Form {...inviteForm}>
            <form
              onSubmit={inviteForm.handleSubmit((values) => {
                inviteMutation.mutate(values);
              })}
              className="space-y-4"
            >
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="kullanici@firma.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MANAGER">Yönetici</SelectItem>
                        <SelectItem value="VIEWER">Görüntüleyici</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  Davet gönder
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sahipliği devret</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Yeni sahip olarak seçilen kullanıcı mevcut sahip ile yer değiştirir.
          </p>
          <div className="space-y-2 py-2">
            <Label htmlFor="transfer-target">Hedef kullanıcı</Label>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger id="transfer-target">
                <SelectValue placeholder="Kullanıcı seçin" />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={!transferTargetId || transferMutation.isPending}
              onClick={() => transferMutation.mutate(transferTargetId)}
            >
              Devret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeId != null} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Üyeyi kaldır</AlertDialogTitle>
            <AlertDialogDescription>
              Bu üye organizasyondan çıkarılacak ve oturumları sonlandırılacak. Devam etmek istiyor
              musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (removeId) {
                  removeMutation.mutate(removeId);
                }
              }}
            >
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
