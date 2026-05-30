import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

/** Liste sonuna yaklaşınca bir sonraki sayfayı yükler. */
export function useLoadMoreOnScroll({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = '240px',
}: Options): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, onLoadMore, rootMargin]);

  return sentinelRef;
}
