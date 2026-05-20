import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Package, Plug, Receipt } from 'lucide-react';

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

          return (
            <Card
              key={card.id}
              className={cn(
                'flex flex-col border transition-colors',
                primary && 'border-primary/70 bg-primary/5 ring-1 ring-primary/25',
                active && !primary && 'border-sky-300/80 bg-sky-50/40',
                card.recommended && !primary && !active && 'border-sky-200/60',
              )}
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                        primary
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-muted/50 text-muted-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <CardTitle className="text-base">{t(card.titleKey)}</CardTitle>
                  </div>
                  {primary ? (
                    <Badge variant="secondary" className="shrink-0">
                      {t('settings.subscriptionTab.productLines.activeBadge')}
                    </Badge>
                  ) : card.recommended && showUpgrade ? (
                    <Badge className="shrink-0 border-0 bg-sky-500 text-white hover:bg-sky-500">
                      {t('settings.subscriptionTab.productLines.recommendedBadge')}
                    </Badge>
                  ) : null}
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
                          active ? 'text-primary' : 'text-sky-500',
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
                    disabled={addProductLineMutation.isPending}
                    onClick={() => {
                      addProductLineMutation.mutate(card.id);
                    }}
                  >
                    {addProductLineMutation.isPending &&
                    addProductLineMutation.variables === card.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      t('settings.subscriptionTab.productLines.upgradeCta')
                    )}
                  </Button>
                </CardFooter>
              ) : active ? (
                <CardFooter className="pt-0">
                  <p className="w-full text-center text-xs font-medium text-primary">
                    {t('settings.subscriptionTab.productLines.included')}
                  </p>
                </CardFooter>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
