import { getSiteUrl } from '@/lib/site-url';

export interface BlogArticleJsonLdInput {
  headline: string;
  description: string;
  datePublished: string;
  slug: string;
  /** ISO 8601 date; defaults to datePublished when omitted */
  dateModified?: string;
  wordCount?: number;
}

export function buildBlogArticleJsonLd(
  input: BlogArticleJsonLdInput,
): Record<string, unknown> {
  const base = getSiteUrl();
  const imageUrl = `${base}/blog/${input.slug}/opengraph-image`;
  const dateModified = input.dateModified ?? input.datePublished;

  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified,
    inLanguage: 'tr-TR',
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

  if (input.wordCount !== undefined) {
    article.wordCount = input.wordCount;
  }

  return article;
}
