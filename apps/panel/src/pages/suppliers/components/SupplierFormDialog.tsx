import type { ReactElement } from 'react';

import { Loader2 } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { COUNTRY_FILTER_OPTIONS, CURRENCY_OPTIONS } from '@/pages/suppliers/supplier-utils';
import type { SupplierDto } from '@/types/supply';

export interface SupplierFormState {
  name: string;
  email: string;
  phone: string;
  country: string;
  taxNumber: string;
  contactName: string;
  paymentTerms: string;
  currency: string;
  leadTimeDays: string;
  address: string;
  notes: string;
  isActive: boolean;
}

export const emptySupplierForm: SupplierFormState = {
  name: '',
  email: '',
  phone: '',
  country: 'Türkiye',
  taxNumber: '',
  contactName: '',
  paymentTerms: '30 gün vadeli',
  currency: 'TRY',
  leadTimeDays: '7',
  address: '',
  notes: '',
  isActive: true,
};

export function supplierToForm(row: SupplierDto): SupplierFormState {
  return {
    name: row.name,
    contactName: row.contactName ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    country: row.country ?? '',
    taxNumber: row.taxNumber ?? '',
    paymentTerms: row.paymentTerms ?? '',
    currency: row.currency ?? 'TRY',
    leadTimeDays: row.leadTimeDays != null ? String(row.leadTimeDays) : '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    isActive: row.isActive,
  };
}

export function formToApiBody(form: SupplierFormState): Record<string, unknown> {
  const lead = form.leadTimeDays.trim();
  return {
    name: form.name.trim(),
    contactPerson: form.contactName.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    country: form.country.trim() || undefined,
    taxId: form.taxNumber.trim() || undefined,
    paymentTerms: form.paymentTerms.trim() || undefined,
    currency: form.currency.trim() || undefined,
    leadTimeDays: lead ? Number.parseInt(lead, 10) : undefined,
    address: form.address.trim() || undefined,
    notes: form.notes.trim() || undefined,
    isActive: form.isActive,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SupplierDto | null;
  form: SupplierFormState;
  onFormChange: (next: SupplierFormState) => void;
  onSave: () => void;
  saving: boolean;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onSave,
  saving,
}: Props): ReactElement {
  const set = (patch: Partial<SupplierFormState>): void => {
    onFormChange({ ...form, ...patch });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Tedarikçiyi düzenle' : 'Yeni tedarikçi'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="s-name">Ad / unvan *</Label>
            <Input
              id="s-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="s-email">E-posta</Label>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-phone">Telefon</Label>
              <Input
                id="s-phone"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Ülke</Label>
              <Select
                value={form.country || undefined}
                onValueChange={(v) => set({ country: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_FILTER_OPTIONS.filter((c) => c.value).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-tax">Vergi no</Label>
              <Input
                id="s-tax"
                value={form.taxNumber}
                onChange={(e) => set({ taxNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-contact">İletişim kişisi</Label>
            <Input
              id="s-contact"
              value={form.contactName}
              onChange={(e) => set({ contactName: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="s-terms">Ödeme koşulları</Label>
              <Input
                id="s-terms"
                value={form.paymentTerms}
                onChange={(e) => set({ paymentTerms: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Para birimi</Label>
              <Select value={form.currency} onValueChange={(v) => set({ currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-lead">Tedarik süresi (gün)</Label>
            <Input
              id="s-lead"
              type="number"
              min={0}
              max={365}
              value={form.leadTimeDays}
              onChange={(e) => set({ leadTimeDays: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-address">Adres</Label>
            <Textarea
              id="s-address"
              rows={2}
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-notes">Notlar</Label>
            <Textarea
              id="s-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="s-active" className="cursor-pointer">
              Aktif tedarikçi
            </Label>
            <Switch
              id="s-active"
              checked={form.isActive}
              onCheckedChange={(v) => set({ isActive: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={!form.name.trim() || saving}
            onClick={onSave}
          >
            {saving ? (
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
  );
}
