import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { PricingSection } from '@/components/PricingSection';
import { PRICING_FAQ } from '@/lib/site-content';

const ogDescription =
  'Başlangıç, Büyüme ve Pro planlarıyla şeffaf fiyatlandırma. Yıllık ödemede %20 indirim, 14 gün ücretsiz deneme, karşılaştırma tablosu ve SSS.';

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
};

export default function PricingPage(): ReactElement {
  return (
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
  );
}
