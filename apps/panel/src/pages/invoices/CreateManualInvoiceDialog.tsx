import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { api, getApiErrorMessage } from '@/lib/api';
import type { InvoiceDto } from '@/types/invoice';

import {
  defaultManualInvoiceDueDate,
  validateManualInvoiceDueDate,
} from './invoice-utils';
import {
  InvoiceNativeCreateGate,
  useInvoiceNativeCreateAllowed,
} from './InvoiceNativeCreateGate';
import { invoicesT } from './translations';

export interface ManualInvoiceCustomerPrefill {
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invoice: InvoiceDto) => void;
  initialCustomer?: ManualInvoiceCustomerPrefill | null;
}

function resetFormFields(
  setters: {
    setCustomerName: (v: string) => void;
    setCustomerEmail: (v: string) => void;
    setCustomerPhone: (v: string) => void;
    setLineName: (v: string) => void;
    setLineQty: (v: string) => void;
    setLinePrice: (v: string) => void;
    setDueDate: (v: string) => void;
  },
): void {
  setters.setCustomerName('');
  setters.setCustomerEmail('');
  setters.setCustomerPhone('');
  setters.setLineName('');
  setters.setLineQty('1');
  setters.setLinePrice('');
  setters.setDueDate(defaultManualInvoiceDueDate());
}

export function CreateManualInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
  initialCustomer,
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const { isAllowed } = useInvoiceNativeCreateAllowed();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineName, setLineName] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('');
  const [dueDate, setDueDate] = useState(() => defaultManualInvoiceDueDate());
  const [dueDateTouched, setDueDateTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDueDate(defaultManualInvoiceDueDate());
    setDueDateTouched(false);
  }, [open]);

  useEffect(() => {
    if (!open || !initialCustomer) {
      return;
    }
    setCustomerName(initialCustomer.name);
    setCustomerEmail(initialCustomer.email?.trim() ?? '');
    setCustomerPhone(initialCustomer.phone?.trim() ?? '');
  }, [open, initialCustomer]);

  const clearForm = (): void => {
    resetFormFields({
      setCustomerName,
      setCustomerEmail,
      setCustomerPhone,
      setLineName,
      setLineQty,
      setLinePrice,
      setDueDate,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (): Promise<InvoiceDto> => {
      const qty = Number(lineQty);
      const price = Number(linePrice);
      const email = customerEmail.trim();
      const phone = customerPhone.trim();
      const { data } = await api.post<{ data: InvoiceDto }>('/invoices', {
        customerName: customerName.trim(),
        ...(email.length > 0 ? { customerEmail: email } : {}),
        ...(phone.length > 0 ? { customerPhone: phone } : {}),
        dueDate: dueDate.trim(),
        items: [{ name: lineName.trim(), quantity: qty, unitPrice: price }],
      });
      return data.data;
    },
    onSuccess: (invoice) => {
      toast.success(invoicesT('create.success'));
      onCreated(invoice);
      onOpenChange(false);
      clearForm();
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const dueDateError = validateManualInvoiceDueDate(dueDate);
  const showDueDateError = dueDateTouched && dueDateError !== null;

  const canCreate =
    customerName.trim().length > 0 &&
    lineName.trim().length > 0 &&
    Number(lineQty) > 0 &&
    Number(linePrice) >= 0 &&
    dueDateError === null;

  const handleCreate = (): void => {
    setDueDateTouched(true);
    const dueErr = validateManualInvoiceDueDate(dueDate);
    if (dueErr !== null) {
      toast.error(dueErr);
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          clearForm();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{invoicesT('create.title')}</DialogTitle>
        </DialogHeader>
        <InvoiceNativeCreateGate>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="customerName">{invoicesT('create.customerName')}</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lineName">{invoicesT('create.lineName')}</Label>
            <Input
              id="lineName"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">{invoicesT('create.dueDate')}</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              aria-invalid={showDueDateError}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => setDueDateTouched(true)}
            />
            {showDueDateError ? (
              <p className="text-destructive text-sm" role="alert">
                {dueDateError}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="lineQty">{invoicesT('create.quantity')}</Label>
              <Input
                id="lineQty"
                type="number"
                min={1}
                value={lineQty}
                onChange={(e) => setLineQty(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="linePrice">{invoicesT('create.unitPrice')}</Label>
              <Input
                id="linePrice"
                type="number"
                min={0}
                step="0.01"
                value={linePrice}
                onChange={(e) => setLinePrice(e.target.value)}
              />
            </div>
          </div>
        </div>
        </InvoiceNativeCreateGate>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isAllowed ? invoicesT('actions.cancel') : invoicesT('externalErp.dialogClose')}
          </Button>
          {isAllowed ? (
            <Button
              disabled={!canCreate || createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {invoicesT('actions.create')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
