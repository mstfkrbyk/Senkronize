import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { CTASection } from '@/components/CTASection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { HeroSection } from '@/components/HeroSection';
import { PricingSection } from '@/components/PricingSection';
import { StatsSection } from '@/components/StatsSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';

export const metadata: Metadata = {
  title: 'Senkronize — Tüm Pazaryerlerinizi Tek Yerden Yönetin',
  description:
    'Trendyol, Hepsiburada ve daha fazlası için gerçek zamanlı stok, fiyat ve sipariş yönetimi.',
  keywords: [
    'pazaryeri entegrasyon',
    'trendyol entegrasyon',
    'e-ticaret otomasyon',
  ],
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
