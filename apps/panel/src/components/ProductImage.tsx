import type { ReactElement } from 'react';

interface Props {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  /** true ise width/height verilmez; grid gibi esnek layout için className kullanın */
  fluid?: boolean;
}

/**
 * Ürün görseli: sabit boyut (layout shift azaltma), lazy decode, hata durumunda placeholder.
 */
export function ProductImage({
  src,
  alt,
  size = 40,
  className = '',
  fluid = false,
}: Props): ReactElement {
  const base =
    'rounded object-cover border border-border/60 bg-muted/30';
  return (
    <img
      src={src || '/placeholder-product.svg'}
      alt={alt}
      {...(fluid ? {} : { width: size, height: size })}
      loading="lazy"
      decoding="async"
      className={`${base} ${className}`.trim()}
      onError={(e) => {
        e.currentTarget.src = '/placeholder-product.svg';
      }}
    />
  );
}
