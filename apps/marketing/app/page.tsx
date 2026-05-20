import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ComparisonTableSection } from '@/components/ComparisonTableSection';
import { CTASection } from '@/components/CTASection';
import { ExitIntentNewsletter } from '@/components/ExitIntentNewsletter';
import { FeaturesSection } from '@/components/FeaturesSection';
import { HeroSection } from '@/components/HeroSection';
import { BetaCountdownSection } from '@/components/home/BetaCountdownSection';
import { DemoVideoSection } from '@/components/home/DemoVideoSection';
import { SocialProofSection } from '@/components/home/SocialProofSection';
import { StickyCtaBar } from '@/components/home/StickyCtaBar';
import { PlatformLogoMarquee } from '@/components/PlatformLogoMarquee';
import { PricingSection } from '@/components/PricingSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { StatsSection } from '@/components/StatsSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';

const ogDescription =
  'Trendyol, Hepsiburada, N11 ve daha fazla pazaryerini tek panelden yönetin. Gerçek zamanlı stok, fiyat ve sipariş senkronizasyonu; ERP ve partner araçları.';

const homeSoftwareLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Senkronize',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Windows, macOS',
  description:
    'Trendyol, Hepsiburada ve tüm pazaryerlerinizi tek panelden yönetin',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TRY',
    description: '14 gün ücretsiz deneme',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '127',
  },
};

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
    'buybox',
    'çoklu kanal satış',
    'Senkronize',
  ],
  openGraph: {
    title: 'Senkronize — E-ticaret Entegrasyon Platformu',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Senkronize — Pazaryeri ve ERP entegrasyonu',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@senkronize',
    title: 'Senkronize — E-ticaret Entegrasyon Platformu',
    description: ogDescription,
    images: ['/opengraph-image'],
  },
};

export default function HomePage(): ReactElement {
  return (
    <>
      <JsonLd data={homeSoftwareLd} />
      <main>
        <HeroSection />
        <SocialProofSection />
        <PlatformLogoMarquee />
        <StatsSection />
        <DemoVideoSection />
        <ComparisonTableSection />
        <BetaCountdownSection />
        <FeaturesSection />
        <PricingSection variant="teaser" />
        <TestimonialsSection />
        <CTASection />
        <ExitIntentNewsletter />
      </main>
      <StickyCtaBar />
    </>
  );
}
