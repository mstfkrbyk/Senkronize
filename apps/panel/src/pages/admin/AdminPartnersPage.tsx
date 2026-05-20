import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { getApiErrorMessage } from '@/lib/api';
import {
  useAdminPartners,
  useUpdatePartnerCommissionRate,
} from '@/pages/partner/hooks/usePartnerLink';
import type { AdminPartnerRow } from '@/types/admin';

export function AdminPartnersPage(): ReactElement {
  const { data, isLoading, isError, error } = useAdminPartners();
  const updateRate = useUpdatePartnerCommissionRate();
  const [editing, setEditing] = useState<AdminPartnerRow | null>(null);
  const [rateInput, setRateInput] = useState('');

  const openEdit = (row: AdminPartnerRow): void => {
    setEditing(row);
    setRateInput(String(row.commissionRate));
  };

  const handleSave = (): void => {
    if (!editing) return;
    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      toast.error('Komisyon oranı 0 ile 50 arasında olmalıdır.');
      return;
    }
    updateRate.mutate(
      { partnerOrgId: editing.id, rate },
      {
        onSuccess: () => {
          toast.success('Komisyon oranı güncellendi');
          setEditing(null);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Partnerler</h2>
        <p className="text-sm text-muted-foreground">
          Partner komisyon oranlarını yönetin. Yeni müşteri bağlantılarında bu oran uygulanır.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead>Aktif müşteri</TableHead>
            <TableHead>Komisyon (%)</TableHead>
            <TableHead>Kayıt</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-muted-foreground">@{row.slug}</div>
              </TableCell>
              <TableCell>{row.activeClientCount}</TableCell>
              <TableCell>%{row.commissionRate.toFixed(2)}</TableCell>
              <TableCell>
                {format(new Date(row.createdAt), 'd MMM yyyy', { locale: tr })}
              </TableCell>
              <TableCell className="text-right">
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                  Oranı Düzenle
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing != null} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name} — komisyon oranı</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="commission-rate">Oran (%)</Label>
            <Input
              id="commission-rate"
              type="number"
              min={0}
              max={50}
              step={0.01}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={updateRate.isPending} onClick={handleSave}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
