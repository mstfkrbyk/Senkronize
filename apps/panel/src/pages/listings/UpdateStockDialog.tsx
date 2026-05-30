import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';

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
import { FORM_MESSAGES } from '@/lib/form-messages';
import { cn } from '@/lib/utils';
import type { Listing } from '@/types/listing';

interface Props {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutation: UseMutationResult<
    unknown,
    Error,
    { id: string; quantity: number }
  >;
}

export function UpdateStockDialog({
  listing,
  open,
  onOpenChange,
  mutation,
}: Props): ReactElement {
  const [quantity, setQuantity] = useState('');
  const [quantityError, setQuantityError] = useState<string | null>(null);

  useEffect(() => {
    if (listing && open) {
      setQuantity(String(listing.quantity));
      setQuantityError(null);
    }
  }, [listing, open]);

  const parsedQuantity = useMemo(() => {
    const raw = quantity.trim();
    if (raw === '') {
      return null;
    }
    const qty = Number(raw);
    if (Number.isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      return null;
    }
    return qty;
  }, [quantity]);

  const handleSubmit = (): void => {
    if (!listing) {
      return;
    }
    setQuantityError(null);
    const raw = quantity.trim();
    if (raw === '') {
      setQuantityError(FORM_MESSAGES.required);
      toast.error(FORM_MESSAGES.required);
      return;
    }
    const qty = Number(raw);
    if (Number.isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      setQuantityError('Geçerli bir tam sayı girin (0 veya üzeri).');
      toast.error('Geçerli bir tam sayı girin (0 veya üzeri).');
      return;
    }
    mutation.mutate(
      { id: listing.id, quantity: qty },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stok güncelle</DialogTitle>
          <DialogDescription>
            {listing?.title ?? 'Ürün'} için stok adedini güncelleyin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="stock-qty">Stok adedi</Label>
            <Input
              id="stock-qty"
              type="number"
              min={0}
              step={1}
              aria-invalid={Boolean(quantityError)}
              className={cn(quantityError && 'border-destructive')}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setQuantityError(null);
              }}
            />
            {quantityError ? (
              <p className="text-destructive text-sm">{quantityError}</p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={
              mutation.isPending || !listing || parsedQuantity === null
            }
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Güncelleniyor…' : 'Güncelle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
