import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface Props {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  /** true ise width/height verilmez; grid gibi esnek layout için className kullanın */
  fluid?: boolean;
  /** Responsive srcset için 1x/2x boyut (varsayılan: size veya 40) */
  srcSetWidths?: number[];
}

const PLACEHOLDER = '/placeholder-product.svg';

function preferWebpUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.includes('.webp')) {
    return url;
  }
  if (/\.(jpe?g|png)(\?|$)/i.test(url)) {
    return url.replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp$2');
  }
  return url;
}

function buildSrcSet(url: string, widths: number[]): string | undefined {
  if (!url || url.startsWith('data:') || url === PLACEHOLDER) {
    return undefined;
  }
  return widths.map((w) => `${url} ${w}w`).join(', ');
}

/**
 * Ürün görseli: intersection observer lazy load, skeleton, WebP tercihi, responsive srcset.
 */
export function ProductImage({
  src,
  alt,
  size = 40,
  className = '',
  fluid = false,
  srcSetWidths,
}: Props): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const resolvedSrc = src && !failed ? src : PLACEHOLDER;
  const webpSrc = preferWebpUrl(resolvedSrc);
  const widths = srcSetWidths ?? (fluid ? [80, 160, 320] : [size, size * 2]);
  const srcSet = buildSrcSet(webpSrc, widths);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const base =
    'rounded object-cover border border-border/60 bg-muted/30 transition-opacity duration-300';

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', fluid ? 'h-full w-full' : '')}
      style={fluid ? undefined : { width: size, height: size }}
    >
      {!loaded ? (
        <div
          className={cn(
            'absolute inset-0 animate-pulse bg-muted/50',
            fluid ? 'h-full w-full' : '',
          )}
          aria-hidden
        />
      ) : null}
      {isVisible ? (
        <picture>
          {webpSrc !== resolvedSrc && webpSrc !== PLACEHOLDER ? (
            <source type="image/webp" srcSet={srcSet ?? webpSrc} />
          ) : null}
          <img
            src={resolvedSrc}
            srcSet={srcSet}
            sizes={fluid ? '(max-width: 640px) 80px, 160px' : `${size}px`}
            alt={alt}
            {...(fluid ? {} : { width: size, height: size })}
            loading="lazy"
            decoding="async"
            className={cn(
              base,
              'object-cover w-full h-full',
              loaded ? 'opacity-100' : 'opacity-0',
              className,
            ).trim()}
            onLoad={() => {
              setLoaded(true);
            }}
            onError={(e) => {
              if (failed) {
                e.currentTarget.src = PLACEHOLDER;
                setLoaded(true);
                return;
              }
              setFailed(true);
              setLoaded(false);
            }}
          />
        </picture>
      ) : null}
    </div>
  );
}
