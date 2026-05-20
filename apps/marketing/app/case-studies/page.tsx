import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { CaseStudiesGrid } from '@/components/case-studies/CaseStudiesGrid';
import { JsonLd } from '@/components/seo/JsonLd';

const path = '/case-studies';
const description =
  'Moda, elektronik ve ev & yaşam sektörlerinde Senkronize ile elde edilen örnek sonuçlar: sipariş artışı, iade azalması ve operasyon tasarrufu.';

export const metadata: Metadata = {
  title: 'Vaka Çalışmaları',
  description,
  openGraph: {
    title: 'Vaka Çalışmaları | Senkronize',
    description,
    type: 'website',
    locale: 'tr_TR',
    url: path,
  },
  alternates: { canonical: path },
};

const collectionLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Senkronize Vaka Çalışmaları',
  description,
  url: 'https://senkronize.com/case-studies',
};

export default function CaseStudiesPage(): ReactElement {
  return (
    <>
      <JsonLd data={collectionLd} />
      <main className="bg-[#F9FAFB] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Vaka Çalışmaları
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Farklı sektörlerde çok kanallı e-ticaret ekiplerinin Senkronize ile
              hedeflediği sonuçlar — anonim örnekler.
            </p>
          </div>
          <CaseStudiesGrid />
        </div>
      </main>
    </>
  );
}
