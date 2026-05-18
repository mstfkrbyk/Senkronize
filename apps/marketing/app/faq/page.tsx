import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { FaqAccordion } from '@/components/faq/FaqAccordion';
import { JsonLd } from '@/components/seo/JsonLd';
import { FAQ_PAGE_CATEGORIES } from '@/lib/faq-page-data';

const ogDescription =
  'Senkronize hakkında sık sorulan sorular: genel bilgiler, fiyatlandırma, teknik konular ve partner programı.';

export const metadata: Metadata = {
  title: 'Sık Sorulan Sorular',
  description: ogDescription,
  openGraph: {
    title: 'SSS | Senkronize',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/faq',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SSS | Senkronize',
    description: ogDescription,
    site: '@senkronize',
  },
};

const faqPageLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_PAGE_CATEGORIES.flatMap((category) =>
    category.questions.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  ),
};

export default function FaqPage(): ReactElement {
  return (
    <>
      <JsonLd data={faqPageLd} />
      <main className="bg-[#F9FAFB] py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sık sorulan sorular
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Ürün, fiyatlandırma, teknik konular ve partner programı hakkında yanıtlar.
          </p>
          <div className="mt-12 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
            <FaqAccordion items={FAQ_PAGE_CATEGORIES} />
          </div>
        </div>
      </main>
    </>
  );
}
