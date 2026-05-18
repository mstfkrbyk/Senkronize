import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { BlogPostListItem } from '@/lib/blog-data';
import { getRelatedPosts } from '@/lib/blog-data';
import { getPanelUrl } from '@/lib/panel-url';
import { getSiteUrl } from '@/lib/site-url';

export interface BlogArticleShellProps {
  title: string;
  date: string;
  readMinutes: number;
  author: string;
  currentSlug: string;
  canonicalPath: string;
  children: ReactNode;
}

function RelatedCard({ post }: { post: BlogPostListItem }): ReactElement {
  return (
    <Card className="border-border transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {post.date}
        </p>
        <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">
          <Link
            href={`/blog/${post.slug}`}
            className="hover:text-primary hover:underline"
          >
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {post.excerpt}
        </p>
      </CardContent>
    </Card>
  );
}

export function BlogArticleShell({
  title,
  date,
  readMinutes,
  author,
  currentSlug,
  canonicalPath,
  children,
}: BlogArticleShellProps): ReactElement {
  const site = getSiteUrl();
  const shareUrl = `${site}${canonicalPath}`;
  const panel = getPanelUrl();
  const related = getRelatedPosts(currentSlug);

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return (
    <main className="bg-[#F9FAFB] pb-20 pt-10 sm:pt-14">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-3xl lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/90 via-primary to-[#1e3a8a] shadow-lg">
          <div
            className="aspect-[21/9] min-h-[140px] w-full opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 12px)',
            }}
            aria-hidden
          />
          <div className="px-6 pb-8 pt-0 sm:px-10 sm:pt-2">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
              <span>{date}</span>
              <span aria-hidden>·</span>
              <span>{readMinutes} dk okuma</span>
              <span aria-hidden>·</span>
              <span>{author}</span>
            </div>
          </div>
        </div>

        <div className="prose prose-slate mt-10 max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-a:text-primary prose-img:rounded-lg">
          {children}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-8">
          <span className="text-sm font-medium text-muted-foreground">
            Paylaş:
          </span>
          <a
            href={twitterHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Twitter / X
          </a>
          <a
            href={linkedInHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            LinkedIn
          </a>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-lg font-semibold text-foreground">
            İlgili yazılar
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {related.map((post) => (
              <RelatedCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">
            Pazaryeri ve ERP&apos;yi tek panelde birleştirin
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Stok, sipariş ve fiyat senkronunu otomatikleştirin; ekibiniz operasyona
            odaklansın.
          </p>
          <Button asChild className="mt-6" size="lg">
            <a href={`${panel}/register`}>Ücretsiz Deneyin</a>
          </Button>
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/blog" className="font-medium text-primary hover:underline">
            ← Tüm blog yazıları
          </Link>
        </p>
      </article>
    </main>
  );
}
