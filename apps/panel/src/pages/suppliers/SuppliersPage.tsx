import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Store } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import type { SupplierDto } from '@/types/supply';

interface SupplierFormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  notes: string;
}

const emptyForm: SupplierFormState = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  taxNumber: '',
  notes: '',
};

export function SuppliersPage(): ReactElement {
  usePageTitle('Tedarikçiler');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptyForm);

  const listQuery = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: async (): Promise<{
      data: SupplierDto[];
      total: number;
    }> => {
      const { data } = await api.get<{ data: SupplierDto[]; total: number }>(
        '/suppliers',
        { params: { page, limit: 20, search: search.trim() || undefined } },
      );
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const body = {
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await api.patch(`/suppliers/${editing.id}`, body);
      } else {
        await api.post('/suppliers', body);
      }
    },
    onSuccess: async () => {
      toast.success(editing ? 'Tedarikçi güncellendi.' : 'Tedarikçi oluşturuldu.');
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/suppliers/${id}`);
    },
    onSuccess: async () => {
      toast.success('Tedarikçi silindi.');
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: SupplierDto): void => {
    setEditing(row);
    setForm({
      name: row.name,
      contactName: row.contactName ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      address: row.address ?? '',
      taxNumber: row.taxNumber ?? '',
      notes: row.notes ?? '',
    });
    setDialogOpen(true);
  };

  const totalPages = useMemo(() => {
    const t = listQuery.data?.total ?? 0;
    return Math.max(1, Math.ceil(t / 20));
  }, [listQuery.data?.total]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Tedarikçiler
          </h1>
          <p className="text-sm text-muted-foreground">
            Tedarikçi kayıtları ve satın alma geçmişi özeti
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Yeni tedarikçi
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="max-w-md flex-1 space-y-1">
          <Label htmlFor="supplier-search">Ara</Label>
          <Input
            id="supplier-search"
            placeholder="İsim veya e-posta"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <TableSkeleton rows={8} />
      ) : listQuery.isError ? (
        <EmptyState
          icon={Store}
          title="Liste yüklenemedi"
          description={getApiErrorMessage(listQuery.error)}
          action={{ label: 'Yeniden dene', onClick: () => void listQuery.refetch() }}
        />
      ) : !listQuery.data?.data.length ? (
        <EmptyState
          icon={Store}
          title="Henüz tedarikçi yok"
          description="Satın alma siparişleri için önce tedarikçi ekleyin."
          action={{ label: 'Tedarikçi ekle', onClick: openCreate }}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tedarikçi</TableHead>
                  <TableHead>İletişim</TableHead>
                  <TableHead className="text-right">Sipariş</TableHead>
                  <TableHead className="text-right">Harcama (TRY)</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/suppliers/${row.id}`}
                        className="text-sky-600 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[row.contactName, row.email, row.phone]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orderCount ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.totalSpend ?? '0.00'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (
                            window.confirm(
                              `${row.name} kaydını silmek istediğinize emin misiniz?`,
                            )
                          ) {
                            deleteMutation.mutate(row.id);
                          }
                        }}
                      >
                        Sil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Toplam {listQuery.data.total} kayıt — sayfa {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Tedarikçiyi düzenle' : 'Yeni tedarikçi'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="s-name">Unvan / ad *</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-contact">Yetkili</Label>
              <Input
                id="s-contact"
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="s-email">E-posta</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-phone">Telefon</Label>
                <Input
                  id="s-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-address">Adres</Label>
              <Textarea
                id="s-address"
                rows={2}
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-tax">Vergi no</Label>
              <Input
                id="s-tax"
                value={form.taxNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taxNumber: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-notes">Notlar</Label>
              <Textarea
                id="s-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={!form.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing ? (
                'Kaydet'
              ) : (
                'Oluştur'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
