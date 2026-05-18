import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
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

const inviteSchema = z.object({
  email: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .email(FORM_MESSAGES.email),
  name: z.string().max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']),
});

type InviteForm = z.infer<typeof inviteSchema>;

const ASSIGNABLE_ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const;

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sahip',
    ADMIN: 'Yönetici',
    MANAGER: 'Müdür',
    VIEWER: 'İzleyici',
  };
  return map[role] ?? role;
}

export function TeamTab(): ReactElement {
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<OrgUser[]> => {
      const { data } = await api.get<OrgUser[]>('/users');
      return data;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (body: InviteForm): Promise<unknown> => {
      const { data } = await api.post<unknown>('/users/invite', {
        email: body.email,
        role: body.role,
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Kullanıcı davet edildi.');
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
      toast.success('Kullanıcı pasifleştirildi.');
      setRemoveId(null);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', name: '', role: 'VIEWER' },
  });

  useEffect(() => {
    if (!inviteOpen) {
      inviteForm.reset({ email: '', name: '', role: 'VIEWER' });
    }
  }, [inviteOpen, inviteForm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-primary">Ekip üyeleri</h3>
          <p className="text-sm text-muted-foreground">
            Organizasyonunuza kullanıcı davet edin ve rollerini yönetin.
          </p>
        </div>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          Davet et
        </Button>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {usersQuery.isError ? (
        <p className="text-sm text-destructive">
          {getApiErrorMessage(usersQuery.error)}
        </p>
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
                <TableHead>İsim</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.map((u) => {
                const isSelf = me?.user.id === u.id;
                const isOwner = u.role === 'OWNER';
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {isOwner || isSelf ? (
                        roleLabel(u.role)
                      ) : (
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
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Yönetici</SelectItem>
                            <SelectItem value="MANAGER">Müdür</SelectItem>
                            <SelectItem value="VIEWER">İzleyici</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-green-700">Aktif</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && !isOwner ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setRemoveId(u.id)}
                        >
                          Kaldır
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı davet et</DialogTitle>
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad (isteğe bağlı)</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                        <SelectItem value="ADMIN">Yönetici</SelectItem>
                        <SelectItem value="MANAGER">Müdür</SelectItem>
                        <SelectItem value="VIEWER">İzleyici</SelectItem>
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
                  Gönder
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeId != null} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı kaldır</AlertDialogTitle>
            <AlertDialogDescription>
              Bu kullanıcıyı ekipten çıkarmak istediğinize emin misiniz? İşlem geri alınamaz.
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
