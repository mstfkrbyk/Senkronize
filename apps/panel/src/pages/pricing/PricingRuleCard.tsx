import type { ReactElement } from 'react';
import { useState } from 'react';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { PricingRule, PricingStrategy } from '@/types/pricing';

import {
  useDeletePricingRule,
  useUpdatePricingRuleActive,
} from './hooks/usePricing';

const STRATEGY_LABELS: Record<PricingStrategy, string> = {
  MATCH_BUYBOX: "BuyBox'a eşitle",
  BEAT_BUYBOX: "BuyBox'tan ucuz",
  FIXED_MARGIN: 'Sabit marj',
  DYNAMIC: 'Dinamik (AI)',
};

interface Props {
  rule: PricingRule;
}

export function PricingRuleCard({ rule }: Props): ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useDeletePricingRule();
  const patchMutation = useUpdatePricingRuleActive();

  const platformLabel =
    rule.platform === 'TRENDYOL'
      ? 'Trendyol'
      : rule.platform === 'HEPSIBURADA'
        ? 'Hepsiburada'
        : rule.platform;

  return (
    <>
      <Card
        className={
          rule.isActive ? '' : 'border-dashed opacity-60'
        }
      >
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{rule.name}</CardTitle>
            <Badge variant="secondary">{platformLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {STRATEGY_LABELS[rule.strategy]}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Min. marj</span>
            <span className="font-medium">%{rule.minMarginPct}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Aktif</span>
            <Switch
              checked={rule.isActive}
              disabled={patchMutation.isPending}
              onCheckedChange={(checked) => {
                patchMutation.mutate({ id: rule.id, isActive: checked });
              }}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Sil
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kuralı sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{rule.name}&quot; kuralını kalıcı olarak silmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                deleteMutation.mutate(rule.id, {
                  onSettled: () => {
                    setConfirmOpen(false);
                  },
                });
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
