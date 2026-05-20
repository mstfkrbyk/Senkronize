import type { ReactElement } from 'react';

import { BlogArticleShell } from '@/components/blog/BlogArticleShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { ErpEntegrasyonNedirBody } from '@/lib/blog-content/erp-entegrasyon-nedir';
import { buildBlogArticleJsonLd } from '@/lib/blog-json-ld';
import { createBlogGenerateMetadata } from '@/lib/blog-metadata';

const slug = 'erp-entegrasyon-nedir';
const path = `/blog/${slug}`;
const title = 'ERP Entegrasyonu Nedir? E-Ticarette Neden Kritik?';
const description =
  'ERP tanımı, pazaryeri-ERP köprüsü, Logo/Mikro/BizimHesap karşılaştırması ve ROI analizi: e-ticarette ERP entegrasyonu rehberi.';

export const generateMetadata = createBlogGenerateMetadata({
  title,
  description,
  path,
  slug,
  publishedTime: '2026-05-20',
  keywords: [
    'ERP entegrasyonu',
    'e-ticaret ERP',
    'Logo entegrasyon',
    'Mikro entegrasyon',
    'BizimHesap',
    'pazaryeri ERP köprüsü',
    'ROI',
  ],
  readMinutes: 12,
});

export default function ErpEntegrasyonNedirPage(): ReactElement {
  const articleLd = buildBlogArticleJsonLd({
    headline: title,
    description,
    datePublished: '2026-05-20',
    slug,
    wordCount: 1500,
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <BlogArticleShell
        title={title}
        date="20 Mayıs 2026"
        readMinutes={12}
        author="Senkronize"
        currentSlug={slug}
        canonicalPath={path}
      >
        <ErpEntegrasyonNedirBody />
      </BlogArticleShell>
    </>
  );
}
