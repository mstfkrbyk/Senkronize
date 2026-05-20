import type { Metadata } from 'next';

export interface BlogPageMetadataInput {
  title: string;
  description: string;
  path: string;
  slug: string;
  publishedTime: string;
  keywords: string[];
  readMinutes: number;
}

export function buildBlogMetadata(input: BlogPageMetadataInput): Metadata {
  const absoluteTitle = `${input.title} | Senkronize`;

  return {
    title: { absolute: absoluteTitle },
    description: input.description,
    keywords: input.keywords,
    authors: [{ name: 'Senkronize Ekibi' }],
    alternates: { canonical: input.path },
    openGraph: {
      title: absoluteTitle,
      description: input.description,
      type: 'article',
      locale: 'tr_TR',
      url: input.path,
      publishedTime: input.publishedTime,
      authors: ['Senkronize Ekibi'],
      images: [
        {
          url: `/blog/${input.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      site: '@senkronize',
      images: [`/blog/${input.slug}/opengraph-image`],
    },
  };
}
