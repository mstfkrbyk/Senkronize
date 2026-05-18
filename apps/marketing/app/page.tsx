import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { CTASection } from '@/components/CTASection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { HeroSection } from '@/components/HeroSection';
import { PricingSection } from '@/components/PricingSection';
import { StatsSection } from '@/components/StatsSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';

const ogDescription =
  'Trendyol, Hepsiburada, N11 ve daha fazla pazaryerini tek panelden yönetin. Gerçek zamanlı stok, fiyat ve sipariş senkronizasyonu; ERP ve partner araçları.';

export const metadata: Metadata = {
  title: 'Senkronize — E-ticaret Entegrasyon Platformu',
  description: ogDescription,
  keywords: [
    'pazaryeri entegrasyon',
    'trendyol entegrasyon',
    'hepsiburada entegrasyon',
    'n11 entegrasyon',
    'erp entegrasyon',
    'e-ticaret otomasyon',
  ],
  openGraph: {
    title: 'Senkronize — E-ticaret Entegrasyon Platformu',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/',
  },
};

export default function HomePage(): ReactElement {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
    </main>
  );
}
