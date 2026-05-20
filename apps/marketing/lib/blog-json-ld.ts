import { getSiteUrl } from '@/lib/site-url';

export interface BlogArticleJsonLdInput {
  headline: string;
  description: string;
  datePublished: string;
  slug: string;
  /** ISO 8601 date; defaults to datePublished when omitted */
  dateModified?: string;
  wordCount?: number;
  /** Absolute or site-relative image; defaults to OG route */
  image?: string;
}

export function buildBlogArticleJsonLd(
  input: BlogArticleJsonLdInput,
): Record<string, unknown> {
  const base = getSiteUrl();
  const defaultImage = `${base}/blog/${input.slug}/opengraph-image`;
  const imageUrl = input.image
    ? input.image.startsWith('http')
      ? input.image
      : `${base}${input.image}`
    : defaultImage;
  const dateModified = input.dateModified ?? input.datePublished;

  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified,
    inLanguage: 'tr-TR',
    author: {
      '@type': 'Organization',
      name: 'Senkronize',
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
