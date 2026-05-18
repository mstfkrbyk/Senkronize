import type { ReactElement } from 'react';

const PLATFORMS: { name: string; abbr: string }[] = [
  { name: 'Trendyol', abbr: 'TY' },
  { name: 'Hepsiburada', abbr: 'HB' },
  { name: 'N11', abbr: 'N11' },
  { name: 'Amazon', abbr: 'AMZ' },
  { name: 'Çiçeksepeti', abbr: 'ÇS' },
];

export function PartnerLogosSection(): ReactElement {
  return (
    <section
      className="border-y border-border bg-card py-10 sm:py-12"
      aria-label="Desteklenen pazaryeri markaları (isim gösterimi)"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pazaryeri ve kanal uyumluluğu
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 shadow-sm"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                aria-hidden
              >
                {p.abbr}
              </span>
              <span className="text-sm font-semibold text-foreground">{p.name}</span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted-foreground">
          Gösterilen isimler örnek kanalları temsil eder; entegrasyon kapsamı paket ve
          platform politikalarına göre değişebilir.
        </p>
      </div>
    </section>
  );
}
