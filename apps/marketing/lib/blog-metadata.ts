import type { Metadata } from 'next';

export interface BlogPageMetadataInput {
  title: string;
  description: string;
  path: string;
  slug: string;
  publishedTime: string;
  keywords: string[];
  readMinutes: number;
  /** Site-relative or absolute OG image; defaults to dynamic OG route */
  image?: string;
}

function resolveOgImage(input: BlogPageMetadataInput): string {
  return input.image ?? `/blog/${input.slug}/opengraph-image`;
}

export function buildBlogMetadata(input: BlogPageMetadataInput): Metadata {
  const absoluteTitle = `${input.title} | Senkronize`;
  const ogImage = resolveOgImage(input);

  return {
    title: { absolute: absoluteTitle },
    description: input.description,
    keywords: input.keywords,
    authors: [{ name: 'Senkronize' }],
    alternates: { canonical: input.path },
    openGraph: {
      title: absoluteTitle,
      description: input.description,
      type: 'article',
      locale: 'tr_TR',
      url: input.path,
      publishedTime: input.publishedTime,
      authors: ['Senkronize'],
      images: [
        {
          url: ogImage,
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
      images: [ogImage],
    },
  };
}

/** App Router `generateMetadata()` için statik blog meta üreticisi */
export function createBlogGenerateMetadata(
  input: BlogPageMetadataInput,
): () => Metadata {
  return () => buildBlogMetadata(input);
}
