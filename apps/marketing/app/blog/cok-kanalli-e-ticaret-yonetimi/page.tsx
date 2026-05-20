import type { ReactElement } from 'react';

import { BlogArticleShell } from '@/components/blog/BlogArticleShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { OmnichannelManagementBody } from '@/lib/blog-content/omnichannel-yonetim';
import { buildBlogArticleJsonLd } from '@/lib/blog-json-ld';
import { createBlogGenerateMetadata } from '@/lib/blog-metadata';

const slug = 'cok-kanalli-e-ticaret-yonetimi';
const path = `/blog/${slug}`;
const title = 'Çok Kanallı E-Ticaret Yönetimi: Neden ve Nasıl?';
const description =
  'Çok kanallı satışın avantajları, entegrasyonsuz tuzaklar ve merkezi stok-fiyat-sipariş yönetimi ile sürdürülebilir büyüme.';

export const generateMetadata = createBlogGenerateMetadata({
  title,
  description,
  path,
  slug,
  publishedTime: '2026-05-20',
  keywords: [
    'çok kanallı e-ticaret',
    'omnichannel',
    'pazaryeri yönetimi',
    'merkezi stok',
    'çoklu kanal',
  ],
  readMinutes: 10,
});

export default function OmnichannelManagementPage(): ReactElement {
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
        <OmnichannelManagementBody />
      </BlogArticleShell>
    </>
  );
}
