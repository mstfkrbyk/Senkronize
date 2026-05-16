import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { UseMutationResult } from '@tanstack/react-query';

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

  useEffect(() => {
    if (listing && open) {
      setQuantity(String(listing.quantity));
    }
  }, [listing, open]);

  const handleSubmit = (): void => {
    if (!listing) {
      return;
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 0) {
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
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
              }}
            />
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
            disabled={mutation.isPending || !listing}
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Güncelleniyor…' : 'Güncelle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
