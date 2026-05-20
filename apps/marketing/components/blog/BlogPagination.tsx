import Link from 'next/link';
import type { ReactElement } from 'react';

interface BlogPaginationProps {
  currentPage: number;
  totalPages: number;
  totalPosts: number;
}

export function BlogPagination({
  currentPage,
  totalPages,
  totalPosts,
}: BlogPaginationProps): ReactElement {
  if (totalPages <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {totalPosts} yazı
      </p>
    );
  }

  return (
    <nav
      className="flex items-center gap-2"
      aria-label="Blog sayfalama"
    >
      {currentPage > 1 ? (
        <Link
          href={currentPage === 2 ? '/blog' : `/blog?page=${currentPage - 1}`}
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          ← Önceki
        </Link>
      ) : null}
      <span className="px-2 text-sm text-muted-foreground">
        Sayfa {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link
          href={`/blog?page=${currentPage + 1}`}
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          Sonraki →
        </Link>
      ) : null}
    </nav>
  );
}
