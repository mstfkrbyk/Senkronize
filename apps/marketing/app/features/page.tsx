import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ProductFeaturesSections } from '@/components/ProductFeaturesSections';

const ogDescription =
  'Gerçek zamanlı webhook senkronizasyonu, çoklu pazaryeri paneli, otomatik ERP faturalama, AI BuyBox, partner sistemi ve Tauri masaüstü köprüsü.';

export const metadata: Metadata = {
  title: 'Özellikler — Pazaryeri ve ERP Entegrasyonu',
  description: ogDescription,
  keywords: [
    'pazaryeri senkronizasyon',
    'webhook sync',
    'buybox optimizasyonu',
    'erp entegrasyon',
    'tauri masaüstü',
    'partner paneli',
  ],
  openGraph: {
    title: 'Özellikler | Senkronize',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/features',
  },
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
            Türkiye pazaryerleri ve ERP ekosistemi için tasarlanmış entegrasyon
            katmanı: tek panel, gerçek zamanlı veri ve ajans dostu yönetim.
          </p>
        </div>
      </section>
      <ProductFeaturesSections />
    </main>
  );
}
