import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, Loader2, Package, Plug, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAddProductLineMutation } from '@/hooks/useAddProductLineMutation';
import { useAuthStore } from '@/store/auth.store';
import type { OrgProductLine } from '@/types/auth';
import { cn } from '@/lib/utils';

import {
  SUBSCRIPTION_PRODUCT_LINE_CARDS,
  type SubscriptionProductLineCardId,
  canUpgradeToProductLineCard,
  isProductLineCardActive,
  isProductLineCardPrimary,
} from '../subscription-product-lines.config';

const CARD_ICONS: Record<
  SubscriptionProductLineCardId,
  typeof Plug
> = {
  INTEGRATION: Plug,
  ACCOUNTING: Receipt,
  BUNDLE: Package,
};

interface Props {
  orgProducts?: OrgProductLine[];
  className?: string;
}

export function SubscriptionProductLines({
  orgProducts: orgProductsProp,
  className,
}: Props): ReactElement {
  const { t } = useTranslation();
  const storeOrgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const orgProducts = orgProductsProp ?? storeOrgProducts;
  const addProductLineMutation = useAddProductLineMutation(orgProducts);
  const isUpgrading = addProductLineMutation.isPending;
  const upgradingCardId = addProductLineMutation.variables;

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h4 className="text-base font-medium text-primary">
          {t('settings.subscriptionTab.productLines.title')}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t('settings.subscriptionTab.productLines.subtitle')}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SUBSCRIPTION_PRODUCT_LINE_CARDS.map((card) => {
          const Icon = CARD_ICONS[card.id];
          const active = isProductLineCardActive(card.id, orgProducts);
          const primary = isProductLineCardPrimary(card.id, orgProducts);
          const showUpgrade = canUpgradeToProductLineCard(card.id, orgProducts);
          const isThisCardUpgrading = isUpgrading && upgradingCardId === card.id;

          return (
            <Card
              key={card.id}
              aria-busy={isThisCardUpgrading}
              className={cn(
                'relative flex flex-col border bg-background transition-[opacity,box-shadow,border-color]',
                primary && 'border-2 border-primary bg-primary/5 shadow-sm',
                active && !primary && 'border-sky-400 bg-sky-50/50',
                card.recommended && !primary && !active && 'border-border',
                isThisCardUpgrading && 'ring-2 ring-primary/30',
                isUpgrading && !isThisCardUpgrading && 'opacity-60',
              )}
            >
              {primary ? (
                <Badge
                  className="absolute right-3 top-3 border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                >
                  {t('settings.subscriptionTab.productLines.activePrimaryBadge')}
                </Badge>
              ) : active ? (
                <Badge
                  variant="outline"
                  className="absolute right-3 top-3 border-sky-400 text-sky-700"
                >
                  {t('settings.subscriptionTab.productLines.activeOnAccountBadge')}
                </Badge>
              ) : null}
              <CardHeader className="space-y-2 pb-3 pr-24">
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      primary
                        ? 'bg-primary text-primary-foreground'
                        : active
                          ? 'border border-sky-300 bg-sky-100 text-sky-700'
                          : 'border border-border bg-muted/50 text-muted-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle className="text-base leading-tight">{t(card.titleKey)}</CardTitle>
                    {card.recommended && showUpgrade ? (
                      <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
                        {t('settings.subscriptionTab.productLines.recommendedBadge')}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t(card.descriptionKey)}</p>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {card.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2">
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          primary ? 'text-primary' : active ? 'text-sky-600' : 'text-sky-500',
                        )}
                        aria-hidden
                      />
                      <span>{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              {showUpgrade ? (
                <CardFooter className="pt-0">
                  <Button
                    type="button"
                    variant={card.id === 'BUNDLE' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    disabled={isUpgrading}
                    aria-busy={isThisCardUpgrading}
                    onClick={() => {
                      addProductLineMutation.mutate(card.id);
                    }}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {isThisCardUpgrading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      ) : null}
                      {isThisCardUpgrading
                        ? t('settings.subscriptionTab.productLines.upgradingCta')
                        : t('settings.subscriptionTab.productLines.upgradeCta')}
                    </span>
                  </Button>
                </CardFooter>
              ) : active ? (
                <CardFooter className="pt-0">
                  <div className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    <span>{t('settings.subscriptionTab.productLines.included')}</span>
                  </div>
                </CardFooter>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
