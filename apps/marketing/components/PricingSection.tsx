'use client';

import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { getPanelUrl } from '@/lib/panel-url';
import {
  PLANS,
  PRICING_COMPARISON,
  type ComparisonCell,
} from '@/lib/site-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const YEARLY_DISCOUNT = 0.2;

function formatTry(amount: number): string {
  return amount.toLocaleString('tr-TR');
}

function displayPrice(monthlyPrice: number, billing: 'monthly' | 'yearly'): number {
  if (billing === 'monthly') {
    return monthlyPrice;
  }
  return Math.round(monthlyPrice * (1 - YEARLY_DISCOUNT));
}

function renderComparisonCell(value: ComparisonCell): ReactElement {
  if (value === 'check') {
    return (
      <Check className="mx-auto h-5 w-5 text-primary" aria-label="Dahil" />
    );
  }
  if (value === 'dash') {
    return (
      <Minus className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label="Yok" />
    );
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

interface PricingSectionProps {
  /** Daha geniş üst boşluk (tam sayfa kullanımı için) */
  spacious?: boolean;
  /** Karşılaştırma tablosu (fiyatlandırma sayfası) */
  showComparison?: boolean;
}

export function PricingSection({
  spacious = false,
  showComparison = false,
}: PricingSectionProps): ReactElement {
  const panel = getPanelUrl();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const planKeys = useMemo(() => ['baslangic', 'buyume', 'pro'] as const, []);

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
            altyapı dahildir.
          </p>
        </motion.div>

        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
          <div className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            14 gün ücretsiz deneme — kredi kartı gerekmez
          </div>
          <div
            className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1"
            role="group"
            aria-label="Faturalama dönemi"
          >
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                billing === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Aylık
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                billing === 'yearly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yıllık
              <span className="ml-1.5 text-xs font-semibold text-primary">
                −%20
              </span>
            </button>
          </div>
        </div>

        {billing === 'yearly' ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Yıllık ödemede liste fiyatına göre %20 indirim; tutarlar yıllık
            faturalanır.
          </p>
        ) : null}

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan, index) => {
            const price = displayPrice(plan.monthlyPrice, billing);
            return (
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
                        ₺{formatTry(price)}
                      </span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    {billing === 'yearly' ? (
                      <p className="mt-1 text-xs text-muted-foreground line-through">
                        ₺{formatTry(plan.monthlyPrice)}
                        {plan.period} liste
                      </p>
                    ) : null}
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
            );
          })}
        </div>

        {showComparison ? (
          <motion.div
            className="mt-20"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <h3 className="text-center text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
              Plan Karşılaştırması
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
              Özellikleri yan yana görün; büyüyen işletmeniz için doğru planı
              seçin.
            </p>
            <div className="mt-10 overflow-x-auto rounded-xl border border-border shadow-sm">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th
                      scope="col"
                      className="px-4 py-4 font-semibold text-foreground sm:px-6"
                    >
                      Özellik
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-center font-semibold text-foreground sm:px-6"
                    >
                      Başlangıç
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-center font-semibold text-foreground sm:px-6"
                    >
                      Büyüme
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-center font-semibold text-foreground sm:px-6"
                    >
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING_COMPARISON.map((row, rowIndex) => (
                    <tr
                      key={row.label}
                      className={
                        rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                      }
                    >
                      <th
                        scope="row"
                        className="max-w-[200px] px-4 py-3 font-medium text-foreground sm:px-6"
                      >
                        {row.label}
                      </th>
                      {planKeys.map((key) => (
                        <td
                          key={key}
                          className="px-4 py-3 text-center align-middle sm:px-6"
                        >
                          {renderComparisonCell(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
