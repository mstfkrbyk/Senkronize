'use client';

import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { track } from '@/lib/analytics';
import { getPanelUrl } from '@/lib/panel-url';
import {
  HOMEPAGE_PRICING_TEASER,
  PLANS,
  PRICING_COMPARISON,
  PRICING_PAGE_COPY,
  type ComparisonCell,
  type PlanColumnKey,
} from '@/lib/site-content';

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
  spacious?: boolean;
  showComparison?: boolean;
  variant?: 'full' | 'teaser';
}

const COLUMN_HEADERS: { key: PlanColumnKey; label: string }[] = [
  { key: 'baslangic', label: 'Başlangıç' },
  { key: 'gelisim', label: 'Gelişim' },
  { key: 'pro', label: 'Pro' },
  { key: 'kurumsal', label: 'Kurumsal' },
];

export function PricingSection({
  spacious = false,
  showComparison = false,
  variant = 'full',
}: PricingSectionProps): ReactElement {
  const panel = getPanelUrl();

  const planKeys = useMemo(
    () =>
      ['baslangic', 'gelisim', 'pro', 'kurumsal'] as const satisfies readonly PlanColumnKey[],
    [],
  );

  if (variant === 'teaser') {
    return (
      <section className="bg-white py-16 sm:py-24">
        <motion.div
          className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Fiyatlandırma
            </h2>
            <p className="mt-4 text-muted-foreground">{PRICING_PAGE_COPY.homepageTeaserLead}</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOMEPAGE_PRICING_TEASER.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
              >
                <Card
                  className={`flex h-full flex-col ${
                    plan.highlighted
                      ? 'border-2 border-primary shadow-lg ring-2 ring-primary/10'
                      : 'border-border'
                  }`}
                >
                  <CardHeader className="pb-4 text-center">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <p className="mt-4 text-3xl font-bold text-primary">{plan.status}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                  </CardHeader>
                  <CardFooter className="mt-auto">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      asChild
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link
              href="/pricing"
              className="text-sm font-medium text-primary hover:underline"
            >
              Tüm planları ve karşılaştırmayı görün →
            </Link>
          </p>
        </motion.div>
      </section>
    );
  }

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
            Abonelik Planları — Yıllık Faturalama
          </h2>
          <p className="mt-4 text-muted-foreground">
            Entegrasyon, Ön Muhasebe veya Paket sonrası limitler Başlangıç, Gelişim, Pro veya
            Kurumsal planda. 14 gün ücretsiz deneme — kredi kartı gerekmez.
          </p>
        </motion.div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            14 gün ücretsiz deneme — kredi kartı gerekmez
          </div>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className={plan.highlighted ? 'xl:-mt-2 xl:mb-2' : ''}
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
                  <p className="mt-3 text-sm font-medium text-primary">{plan.status}</p>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">
                      {plan.priceLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{plan.billingNote}</p>
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
                  {plan.isEnterprise ? (
                    <Button className="w-full" variant="outline" asChild>
                      <Link href={plan.ctaHref ?? '/contact'}>{plan.cta}</Link>
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      asChild
                    >
                      <Link href="#erken-erisim">{plan.cta}</Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
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
              Tüm özellikleri planlar arasında yan yana görün.
            </p>
            <div className="mt-10 overflow-x-auto rounded-xl border border-border shadow-sm">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th
                      scope="col"
                      className="px-4 py-4 font-semibold text-foreground sm:px-6"
                    >
                      Özellik
                    </th>
                    {COLUMN_HEADERS.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className="px-4 py-4 text-center font-semibold text-foreground sm:px-6"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRICING_COMPARISON.map((row, rowIndex) => (
                    <tr
                      key={row.label}
                      className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
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
            <p className="mt-6 text-center">
              <Button asChild>
                <a
                  href={`${panel}/register`}
                  onClick={() => {
                    track('cta_clicked', { location: 'pricing_comparison', plan: 'trial' });
                  }}
                >
                  14 Gün Ücretsiz Dene
                </a>
              </Button>
            </p>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
