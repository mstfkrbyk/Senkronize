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
  const [saleError, setSaleError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (listing && open) {
      setSalePrice(String(Number(listing.salePrice)));
      setListPrice(String(Number(listing.listPrice)));
      setSaleError(null);
      setListError(null);
    }
  }, [listing, open]);

  const handleSubmit = (): void => {
    if (!listing) {
      return;
    }
    setSaleError(null);
    setListError(null);
    const saleRaw = salePrice.trim();
    const listRaw = listPrice.trim();
    if (saleRaw === '') {
      setSaleError(FORM_MESSAGES.required);
    }
    if (listRaw === '') {
      setListError(FORM_MESSAGES.required);
    }
    if (saleRaw === '' || listRaw === '') {
      return;
    }
    const sale = Number(saleRaw.replace(',', '.'));
    const list = Number(listRaw.replace(',', '.'));
    if (Number.isNaN(sale)) {
      setSaleError(FORM_MESSAGES.pricePositive);
    }
    if (Number.isNaN(list)) {
      setListError(FORM_MESSAGES.pricePositive);
    }
    if (Number.isNaN(sale) || Number.isNaN(list)) {
      return;
    }
    if (sale <= 0) {
      setSaleError(FORM_MESSAGES.pricePositive);
    }
    if (list <= 0) {
      setListError(FORM_MESSAGES.pricePositive);
    }
    if (sale <= 0 || list <= 0) {
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
              aria-invalid={Boolean(saleError)}
              className={cn(saleError && 'border-destructive')}
              value={salePrice}
              onChange={(e) => {
                setSalePrice(e.target.value);
                setSaleError(null);
              }}
            />
            {saleError ? (
              <p className="text-destructive text-sm">{saleError}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="list-price">Liste fiyatı (₺)</Label>
            <Input
              id="list-price"
              type="number"
              min={0}
              step="0.01"
              aria-invalid={Boolean(listError)}
              className={cn(listError && 'border-destructive')}
              value={listPrice}
              onChange={(e) => {
                setListPrice(e.target.value);
                setListError(null);
              }}
            />
            {listError ? (
              <p className="text-destructive text-sm">{listError}</p>
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
