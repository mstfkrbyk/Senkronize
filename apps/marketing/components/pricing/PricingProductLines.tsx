import { Check, Package, Plug, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  PRICING_BUNDLE_OFFER,
  PRICING_PAGE_COPY,
  PRICING_PRODUCT_LINES,
  type PricingProductLine,
} from '@/lib/site-content';

const PRODUCT_ICONS: Record<PricingProductLine['id'], LucideIcon> = {
  integration: Plug,
  accounting: Receipt,
};

export function PricingProductLines(): ReactElement {
  return (
    <section className="border-b border-border bg-[#F9FAFB] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Ürün Hatları
          </h2>
          <p className="mt-4 text-muted-foreground">{PRICING_PAGE_COPY.productLinesLead}</p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {PRICING_PRODUCT_LINES.map((product) => {
            const Icon = PRODUCT_ICONS[product.id];
            return (
              <Card key={product.id} className="flex h-full flex-col border-border bg-card">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">{product.name}</CardTitle>
                      <CardDescription className="mt-2">{product.description}</CardDescription>
                    </div>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-primary">{product.priceLabel}</p>
                  <p className="text-xs text-muted-foreground">{product.billingNote}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pt-0">
                  {product.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                  {product.stockNote ? (
                    <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                      {product.stockNote}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="relative mt-8 overflow-hidden border-2 border-primary bg-card shadow-md ring-2 ring-primary/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground">
              {PRICING_BUNDLE_OFFER.discountLabel}
            </Badge>
          </div>
          <CardHeader className="pb-4 pt-10 text-center sm:text-left">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Package className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">{PRICING_BUNDLE_OFFER.name}</CardTitle>
                <CardDescription className="mt-2">
                  {PRICING_BUNDLE_OFFER.description}
                </CardDescription>
              </div>
              <div className="shrink-0 text-center sm:text-right">
                <p className="text-2xl font-bold text-primary">
                  {PRICING_BUNDLE_OFFER.priceLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {PRICING_BUNDLE_OFFER.billingNote}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {PRICING_PAGE_COPY.bundleRecommended}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {PRICING_BUNDLE_OFFER.features.map((feature) => (
                <li
                  key={feature}
                  className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground"
                >
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            {PRICING_BUNDLE_OFFER.stockNote ? (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                {PRICING_BUNDLE_OFFER.stockNote}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
