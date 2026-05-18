import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { BLOG_POSTS } from '@/lib/blog-data';
import { Card, CardContent } from '@/components/ui/card';

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

export default function BlogPage(): ReactElement {
  return (
    <main className="bg-[#F9FAFB] py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-4xl lg:px-8">
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
          Blog
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Pazaryeri operasyonları, ERP ve büyüme stratejileri hakkında seçilmiş
          yazılar.
        </p>
        <ul className="mt-12 space-y-6">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Card className="border-border transition-shadow hover:shadow-md">
                <CardContent className="p-6 sm:p-8">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    {post.date}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {post.readMinutes} dk okuma · {post.author}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {post.excerpt}
                  </p>
                  <p className="mt-4">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Yazıyı oku →
                    </Link>
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
