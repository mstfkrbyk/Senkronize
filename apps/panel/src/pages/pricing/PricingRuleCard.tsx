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
  AGGRESSIVE_BUYBOX: 'Agresif BuyBox',
  PROFIT_FOCUSED: 'Kâr odaklı',
  TIME_BASED: 'Zaman bazlı',
  STOCK_BASED: 'Stok bazlı',
};

const STRATEGY_BADGE: Partial<Record<PricingStrategy, string>> = {
  AGGRESSIVE_BUYBOX: 'AGGRESSIVE',
  PROFIT_FOCUSED: 'PROFIT_FOCUSED',
  TIME_BASED: 'TIME_BASED',
  STOCK_BASED: 'STOCK_BASED',
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
          <div className="flex flex-wrap items-center gap-2">
            {STRATEGY_BADGE[rule.strategy] ? (
              <Badge className="bg-sky-500 text-white hover:bg-sky-500/90">
                {STRATEGY_BADGE[rule.strategy]}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {STRATEGY_LABELS[rule.strategy] ?? rule.strategy}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(rule.categoryFilter != null && rule.categoryFilter !== '') ||
          (rule.brandFilter != null && rule.brandFilter !== '') ||
          (rule.skuPattern != null && rule.skuPattern !== '') ? (
            <div className="flex flex-wrap gap-1">
              {rule.categoryFilter ? (
                <Badge variant="outline">Kat: {rule.categoryFilter}</Badge>
              ) : null}
              {rule.brandFilter ? (
                <Badge variant="outline">Mrk: {rule.brandFilter}</Badge>
              ) : null}
              {rule.skuPattern ? <Badge variant="outline">SKU</Badge> : null}
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Min. marj</span>
            <span className="font-medium">%{rule.minMarginPct}</span>
          </div>
          {rule.costPrice != null && rule.costPrice > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maliyet</span>
              <span className="font-medium">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  maximumFractionDigits: 2,
                }).format(rule.costPrice)}
              </span>
            </div>
          ) : null}
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
