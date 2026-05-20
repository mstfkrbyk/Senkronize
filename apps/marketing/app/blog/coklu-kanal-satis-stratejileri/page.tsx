import type { ReactElement } from 'react';

import { BlogArticleShell } from '@/components/blog/BlogArticleShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { OmnichannelGoldenRulesBody } from '@/lib/blog-content/omnichannel-golden-rules';
import { buildBlogArticleJsonLd } from '@/lib/blog-json-ld';
import { createBlogGenerateMetadata } from '@/lib/blog-metadata';

const slug = 'coklu-kanal-satis-stratejileri';
const path = `/blog/${slug}`;
const title = "2026'da Çok Kanallı Satışın 10 Altın Kuralı";
const description =
  'Omnichannel strateji, stok yönetimi, fiyatlandırma, BuyBox kazanımı ve performans ölçümü: çok kanallı satışın on altın kuralı.';

export const generateMetadata = createBlogGenerateMetadata({
  title,
  description,
  path,
  slug,
  publishedTime: '2026-05-20',
  keywords: [
    'çok kanallı satış',
    'omnichannel',
    'stok yönetimi',
    'fiyatlandırma',
    'buybox',
    'performans ölçümü',
    '2026 e-ticaret',
  ],
  readMinutes: 12,
});

export default function CokluKanalSatisStratejileriPage(): ReactElement {
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
        <OmnichannelGoldenRulesBody />
      </BlogArticleShell>
    </>
  );
}
