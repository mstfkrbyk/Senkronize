import type { ReactElement } from 'react';

import { BlogArticleShell } from '@/components/blog/BlogArticleShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { TrendyolHbIntegrationBody } from '@/lib/blog-content/trendyol-hb-rehber';
import { buildBlogArticleJsonLd } from '@/lib/blog-json-ld';
import { createBlogGenerateMetadata } from '@/lib/blog-metadata';

const slug = 'trendyol-hepsiburada-entegrasyon-rehberi';
const path = `/blog/${slug}`;
const title = 'Trendyol ve Hepsiburada Entegrasyonu: Adım Adım Rehber';
const description =
  'Trendyol ve Hepsiburada API anahtarı, stok senkronizasyonu, sipariş yönetimi ve sorun giderme — uygulanabilir entegrasyon rehberi.';

export const generateMetadata = createBlogGenerateMetadata({
  title,
  description,
  path,
  slug,
  publishedTime: '2026-05-20',
  keywords: [
    'trendyol entegrasyon',
    'hepsiburada entegrasyon',
    'api anahtarı',
    'stok senkronizasyonu',
    'sipariş yönetimi',
  ],
  readMinutes: 10,
});

export default function TrendyolHbRehberPage(): ReactElement {
  const articleLd = buildBlogArticleJsonLd({
    headline: title,
    description,
    datePublished: '2026-05-20',
    slug,
    wordCount: 1200,
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <BlogArticleShell
        title={title}
        date="20 Mayıs 2026"
        readMinutes={10}
        author="Senkronize Ekibi"
        currentSlug={slug}
        canonicalPath={path}
      >
        <TrendyolHbIntegrationBody />
      </BlogArticleShell>
    </>
  );
}
