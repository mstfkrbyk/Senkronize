import { Package, Plug, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  HOMEPAGE_PRODUCT_LINE_CARDS,
  type HomepageProductLineId,
} from '@/lib/site-content';

const PRODUCT_ICONS: Record<HomepageProductLineId, LucideIcon> = {
  integration: Plug,
  accounting: Receipt,
  bundle: Package,
};

export function HomeProductLineCards(): ReactElement {
  return (
    <section
      className="border-b border-border bg-[#F9FAFB] py-10 sm:py-12"
      aria-labelledby="home-product-lines-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 id="home-product-lines-heading" className="sr-only">
          Ürün hatları
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3 sm:gap-6">
          {HOMEPAGE_PRODUCT_LINE_CARDS.map((product) => {
            const Icon = PRODUCT_ICONS[product.id];
            const isBundle = product.id === 'bundle';
            return (
              <li key={product.id}>
                <Card
                  className={`h-full border-border bg-card transition-shadow duration-200 hover:border-primary/40 hover:shadow-md ${
                    isBundle ? 'ring-1 ring-primary/15' : ''
                  }`}
                >
                  <CardContent className="flex h-full flex-col p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      {product.badge ? (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {product.badge}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                      {product.name}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                    <Link
                      href={product.href}
                      className="mt-4 text-sm font-medium text-primary hover:underline"
                    >
                      Fiyatlandırma →
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
