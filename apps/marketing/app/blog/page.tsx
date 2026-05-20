import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { BlogPagination } from '@/components/blog/BlogPagination';
import { Card, CardContent } from '@/components/ui/card';
import {
  BLOG_POSTS,
  CATEGORY_STYLES,
  truncateExcerpt,
  getBlogPostsPage,
} from '@/lib/blog-data';

const ogDescription =
  'BuyBox, ERP entegrasyonu ve çok kanallı satış üzerine pratik rehberler. E-ticaret ekipleri için Senkronize blog.';

export const metadata: Metadata = {
  title: 'Blog — E-ticaret ve Entegrasyon',
  description: ogDescription,
  keywords: [
    'e-ticaret blog',
    'trendyol buybox',
    'trendyol entegrasyonu',
    'Trendyol API',
    'buybox stratejisi',
    'çoklu kanal satış',
    'omnichannel',
    'erp entegrasyon',
    'çok kanallı satış',
  ],
  openGraph: {
    title: 'Blog | Senkronize',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/blog',
  },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogPage({
  searchParams,
}: BlogPageProps): Promise<ReactElement> {
  const params = await searchParams;
  const pageNum = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const { posts, totalPages, currentPage } = getBlogPostsPage(pageNum);
  const hasMore = currentPage < totalPages;

  return (
    <main className="bg-[#F9FAFB] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
          Blog
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Pazaryeri operasyonları, ERP ve büyüme stratejileri hakkında seçilmiş
          yazılar.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card
              key={post.slug}
              className="flex flex-col border-border transition-shadow hover:shadow-md"
            >
              <CardContent className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[post.category]}`}
                  >
                    {post.category}
                  </span>
                  <time
                    dateTime={post.dateIso}
                    className="text-xs text-muted-foreground"
                  >
                    {post.date}
                  </time>
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-snug text-foreground">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary hover:underline"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {truncateExcerpt(post.excerpt, 150)}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{post.readMinutes} dk okuma</span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Oku →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {hasMore ? (
            <Link
              href={`/blog?page=${currentPage + 1}`}
              className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Tümünü Gör
            </Link>
          ) : (
            <span />
          )}
          <BlogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalPosts={BLOG_POSTS.length}
          />
        </div>
      </div>
    </main>
  );
}
