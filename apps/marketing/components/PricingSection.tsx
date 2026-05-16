'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ReactElement } from 'react';

import { getPanelUrl } from '@/lib/panel-url';
import { PLANS } from '@/lib/site-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface PricingSectionProps {
  /** Daha geniş üst boşluk (tam sayfa kullanımı için) */
  spacious?: boolean;
}

export function PricingSection({
  spacious = false,
}: PricingSectionProps): ReactElement {
  const panel = getPanelUrl();

  return (
    <section
      className={`bg-white ${spacious ? 'py-20 sm:py-28' : 'py-16 sm:py-24'}`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Sade, Şeffaf Fiyatlandırma
          </h2>
          <p className="mt-4 text-muted-foreground">
            İhtiyacınıza uygun planı seçin; tüm planlarda temel güvenlik ve
            destek dahildir.
          </p>
        </motion.div>

        <div className="mt-4 flex justify-center">
          <div className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            Tüm planlarda 14 gün ücretsiz deneme
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className={plan.highlighted ? 'lg:-mt-2 lg:mb-2' : ''}
            >
              <Card
                className={`relative flex h-full flex-col ${
                  plan.highlighted
                    ? 'border-2 border-primary shadow-lg ring-2 ring-primary/10'
                    : 'border-border'
                }`}
              >
                {plan.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge>{plan.badge}</Badge>
                  </div>
                ) : null}
                <CardHeader className="pb-4 pt-8 text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">
                      ₺{plan.price.toLocaleString('tr-TR')}
                    </span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    KDV dahil değildir.
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 px-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex gap-3 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="pt-2">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    asChild
                  >
                    <a href={`${panel}/register`}>{plan.cta}</a>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
