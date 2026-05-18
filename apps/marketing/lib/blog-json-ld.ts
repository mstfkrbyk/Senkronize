import { getSiteUrl } from '@/lib/site-url';

export interface BlogArticleJsonLdInput {
  headline: string;
  description: string;
  datePublished: string;
  slug: string;
}

export function buildBlogArticleJsonLd(
  input: BlogArticleJsonLdInput,
): Record<string, unknown> {
  const base = getSiteUrl();
  const imageUrl = `${base}/blog/${input.slug}/opengraph-image`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    author: {
      '@type': 'Person',
      name: 'Senkronize Ekibi',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Senkronize',
      logo: {
        '@type': 'ImageObject',
        url: `${base}/opengraph-image`,
      },
    },
    image: [imageUrl],
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${base}/blog/${input.slug}`,
    },
  };
}
