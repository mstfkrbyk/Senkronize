import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { FeaturesSection } from '@/components/FeaturesSection';

export const metadata: Metadata = {
  title: 'Özellikler',
  description:
    'Gerçek zamanlı senkron, BuyBox optimizasyonu, merkezi stok, raporlar, partner paneli ve KVKK uyumlu güvenlik.',
  keywords: [
    'pazaryeri senkronizasyon',
    'buybox',
    'merkezi stok',
    'erp entegrasyon',
  ],
};

export default function FeaturesPage(): ReactElement {
  return (
    <main>
      <section className="border-b border-border bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Özellikler
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Senkronize ile pazaryeri operasyonlarınızı tek panelden yönetin;
            otomasyon ve görünürlük bir arada.
          </p>
        </div>
      </section>
      <FeaturesSection />
    </main>
  );
}
