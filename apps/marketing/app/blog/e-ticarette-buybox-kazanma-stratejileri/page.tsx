import type { ReactElement } from 'react';

import { BlogArticleShell } from '@/components/blog/BlogArticleShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { Buybox2026ArticleBody } from '@/lib/blog-content/buybox-2026';
import { buildBlogArticleJsonLd } from '@/lib/blog-json-ld';
import { createBlogGenerateMetadata } from '@/lib/blog-metadata';

const slug = 'e-ticarette-buybox-kazanma-stratejileri';
const path = `/blog/${slug}`;
const title = 'E-Ticarette BuyBox Nasıl Kazanılır? 2026 Stratejileri';
const description =
  'BuyBox nedir, Trendyol vs Amazon farkları, fiyat-stok dengesi ve Senkronize ile otomatik BuyBox optimizasyonu — 2026 kapsamlı rehber.';

export const generateMetadata = createBlogGenerateMetadata({
  title,
  description,
  path,
  slug,
  publishedTime: '2026-05-20',
  keywords: [
    'buybox',
    'trendyol buybox',
    'amazon buybox',
    'fiyatlandırma stratejisi',
    'pazaryeri optimizasyon',
    '2026 e-ticaret',
  ],
  readMinutes: 12,
});

export default function Buybox2026Page(): ReactElement {
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
        author="Senkronize Ekibi"
        currentSlug={slug}
        canonicalPath={path}
      >
        <Buybox2026ArticleBody />
      </BlogArticleShell>
    </>
  );
}
