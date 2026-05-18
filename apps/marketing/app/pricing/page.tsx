import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { Suspense } from 'react';

import { PricingPageViewTracker } from '@/components/pricing/PricingPageViewTracker';
import { PricingSection } from '@/components/PricingSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { PLANS, PRICING_FAQ } from '@/lib/site-content';

const ogDescription =
  'Başlangıç, Gelişim, Pro ve Kurumsal planlarıyla şeffaf yıllık fiyatlandırma, 14 gün ücretsiz deneme, karşılaştırma tablosu ve SSS.';

export const metadata: Metadata = {
  title: 'Fiyatlandırma — Paketler ve Karşılaştırma',
  description: ogDescription,
  keywords: [
    'senkronize fiyat',
    'pazaryeri entegrasyon fiyat',
    'e-ticaret SaaS fiyatlandırma',
    'trendyol entegrasyon ücreti',
  ],
  openGraph: {
    title: 'Fiyatlandırma | Senkronize',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fiyatlandırma | Senkronize',
    description: ogDescription,
    site: '@senkronize',
  },
};

const pricingProductsLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@graph': PLANS.map((plan) => ({
    '@type': 'Product',
    name: `Senkronize ${plan.name}`,
    description: `Senkronize ${plan.name} planı — yıllık abonelik (KDV hariç).`,
    brand: {
      '@type': 'Brand',
      name: 'Senkronize',
    },
    offers: {
      '@type': 'Offer',
      url: 'https://senkronize.com/pricing',
      priceCurrency: 'TRY',
      price: String(plan.yearlyPrice),
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(plan.yearlyPrice),
        priceCurrency: 'TRY',
        billingDuration: 'P1Y',
      },
    },
  })),
};

export default function PricingPage(): ReactElement {
  return (
    <>
      <JsonLd data={pricingProductsLd} />
      <Suspense fallback={null}>
        <PricingPageViewTracker />
      </Suspense>
      <main>
        <PricingSection spacious showComparison />
        <section className="border-t border-border bg-[#F9FAFB] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold text-[#111827] sm:text-3xl">
              Sık Sorulan Sorular
            </h2>
            <ul className="mt-10 space-y-4">
              {PRICING_FAQ.map((item) => (
                <li
                  key={item.q}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
