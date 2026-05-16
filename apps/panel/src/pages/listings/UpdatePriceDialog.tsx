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
    { id: string; salePrice: number; listPrice: number }
  >;
}

export function UpdatePriceDialog({
  listing,
  open,
  onOpenChange,
  mutation,
}: Props): ReactElement {
  const [salePrice, setSalePrice] = useState('');
  const [listPrice, setListPrice] = useState('');

  useEffect(() => {
    if (listing && open) {
      setSalePrice(String(Number(listing.salePrice)));
      setListPrice(String(Number(listing.listPrice)));
    }
  }, [listing, open]);

  const handleSubmit = (): void => {
    if (!listing) {
      return;
    }
    const sale = Number(salePrice);
    const list = Number(listPrice);
    if (Number.isNaN(sale) || Number.isNaN(list)) {
      return;
    }
    mutation.mutate(
      { id: listing.id, salePrice: sale, listPrice: list },
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
          <DialogTitle>Fiyat güncelle</DialogTitle>
          <DialogDescription>
            {listing?.title ?? 'Ürün'} için satış ve liste fiyatını güncelleyin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sale-price">Satış fiyatı (₺)</Label>
            <Input
              id="sale-price"
              type="number"
              min={0}
              step="0.01"
              value={salePrice}
              onChange={(e) => {
                setSalePrice(e.target.value);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="list-price">Liste fiyatı (₺)</Label>
            <Input
              id="list-price"
              type="number"
              min={0}
              step="0.01"
              value={listPrice}
              onChange={(e) => {
                setListPrice(e.target.value);
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
