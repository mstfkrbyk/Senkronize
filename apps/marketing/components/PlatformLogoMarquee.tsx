import type { ReactElement } from 'react';

const PLATFORMS = [
  'Trendyol',
  'Hepsiburada',
  'N11',
  'Amazon',
  'GittiGidiyor',
  'Etsy',
  'Çiçeksepeti',
  'PTT AVM',
  'Shopify',
  'WooCommerce',
] as const;

function PlatformChip({ name }: { name: string }): ReactElement {
  const abbr = name.slice(0, 3).toUpperCase();
  return (
    <div className="mx-3 flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 shadow-sm">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
        aria-hidden
      >
        {abbr}
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-foreground">
        {name}
      </span>
    </div>
  );
}

export function PlatformLogoMarquee(): ReactElement {
  const items = [...PLATFORMS, ...PLATFORMS];

  return (
    <div
      className="relative overflow-hidden border-y border-border bg-card py-6"
      aria-label="Desteklenen platformlar"
    >
      <div className="flex w-max animate-marquee">
        {items.map((name, i) => (
          <PlatformChip key={`${name}-${i}`} name={name} />
        ))}
      </div>
    </div>
  );
}
