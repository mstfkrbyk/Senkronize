import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { PricingSection } from '@/components/PricingSection';
import { PRICING_FAQ } from '@/lib/site-content';

export const metadata: Metadata = {
  title: 'Fiyatlandırma',
  description:
    'Senkronize paketleri ve şeffaf fiyatlar. 14 gün ücretsiz deneme, KDV bilgisi ve sık sorulan sorular.',
  keywords: [
    'senkronize fiyat',
    'pazaryeri entegrasyon fiyat',
    'e-ticaret SaaS fiyatlandırma',
  ],
};

export default function PricingPage(): ReactElement {
  return (
    <main>
      <PricingSection spacious />
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
