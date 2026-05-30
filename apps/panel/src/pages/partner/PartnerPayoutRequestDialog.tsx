import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

import { usePayoutRequest } from './hooks/usePartner';
import { formatTry } from './partner-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAmount: number;
  amountInputId?: string;
  onSuccess?: () => void;
}

function parsePayoutAmountInput(raw: string): number {
  return Number(raw.replace(',', '.').trim());
}

function clampPayoutAmountInput(raw: string, maxAmount: number): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return raw;
  }
  const n = parsePayoutAmountInput(trimmed);
  if (!Number.isFinite(n) || n <= maxAmount) {
    return raw;
  }
  return String(Math.floor(maxAmount));
}

export function PartnerPayoutRequestDialog({
  open,
  onOpenChange,
  pendingAmount,
  amountInputId = 'payout-amount',
  onSuccess,
}: Props): ReactElement {
  const { t } = useTranslation();
  const [payoutAmount, setPayoutAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const payout = usePayoutRequest();
  const canRequestPayout = pendingAmount >= 1;
  const maxFloor = Math.floor(pendingAmount);

  useEffect(() => {
    if (!open) {
      setPayoutAmount('');
      setValidationError(null);
    }
  }, [open]);

  function validateAmount(): number | null {
    const trimmed = payoutAmount.trim();
    if (!trimmed) {
      setValidationError(t('partner.commission.payoutDialog.amountRequired'));
      return null;
    }
    const n = parsePayoutAmountInput(trimmed);
    if (!Number.isFinite(n)) {
      setValidationError(t('partner.commission.toast.invalidAmount'));
      return null;
    }
    if (n < 1) {
      setValidationError(t('partner.commission.payoutDialog.minAmountError'));
      return null;
    }
    if (n > pendingAmount) {
      setValidationError(
        t('partner.commission.toast.amountExceedsBalance', {
          amount: formatTry(pendingAmount),
        }),
      );
      return null;
    }
    setValidationError(null);
    return n;
  }

  function submitPayout(): void {
    const n = validateAmount();
    if (n === null) {
      return;
    }
    payout.mutate(n, {
      onSuccess: () => {
        toast.success(t('partner.commission.toast.payoutSubmitted'));
        onOpenChange(false);
        setPayoutAmount('');
        setValidationError(null);
        onSuccess?.();
      },
      onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('partner.commission.payoutDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('partner.commission.payoutDialog.description', {
              amount: formatTry(pendingAmount),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={amountInputId}>{t('partner.commission.payoutDialog.amountLabel')}</Label>
            {canRequestPayout ? (
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-xs"
                onClick={() => {
                  setPayoutAmount(String(maxFloor));
                  setValidationError(null);
                }}
              >
                {t('partner.commission.payoutDialog.useFullBalance')}
              </Button>
            ) : null}
          </div>
          <Input
            id={amountInputId}
            inputMode="decimal"
            placeholder={canRequestPayout ? formatTry(pendingAmount) : undefined}
            value={payoutAmount}
            onChange={(e) => {
              setValidationError(null);
              setPayoutAmount(clampPayoutAmountInput(e.target.value, pendingAmount));
            }}
            disabled={!canRequestPayout}
            aria-invalid={validationError != null}
            aria-describedby={
              validationError ? `${amountInputId}-error` : `${amountInputId}-hint`
            }
          />
          {validationError ? (
            <p id={`${amountInputId}-error`} className="text-xs text-destructive" role="alert">
              {validationError}
            </p>
          ) : canRequestPayout ? (
            <p id={`${amountInputId}-hint`} className="text-xs text-muted-foreground">
              {t('partner.commission.payoutDialog.maxHint', {
                amount: formatTry(pendingAmount),
              })}
            </p>
          ) : (
            <p id={`${amountInputId}-hint`} className="text-xs text-muted-foreground">
              {t('partner.commission.payoutDialog.minBalanceHint')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('partner.commission.payoutDialog.dismiss')}
          </Button>
          <Button
            type="button"
            disabled={payout.isPending || !canRequestPayout}
            onClick={submitPayout}
          >
            {payout.isPending
              ? t('partner.commission.payoutDialog.submitting')
              : t('partner.commission.payoutDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
