import type { ReactElement } from 'react';

const ROWS: {
  feature: string;
  senkronize: string;
  rakipA: string;
  rakipB: string;
}[] = [
  {
    feature: 'Platform sayısı',
    senkronize: '50+',
    rakipA: '20+',
    rakipB: '15+',
  },
  {
    feature: 'ERP entegrasyonu',
    senkronize: '✓',
    rakipA: '✗',
    rakipB: '✓',
  },
  {
    feature: 'BuyBox AI',
    senkronize: '✓',
    rakipA: '✗',
    rakipB: '✗',
  },
  {
    feature: 'Gerçek zamanlı sync',
    senkronize: '✓',
    rakipA: '✓',
    rakipB: '✗',
  },
  {
    feature: 'Fiyatlandırma',
    senkronize: 'Yıllık',
    rakipA: 'Aylık',
    rakipB: 'Aylık',
  },
  {
    feature: 'Ücretsiz deneme',
    senkronize: '14 gün',
    rakipA: '7 gün',
    rakipB: '✗',
  },
];

export function ComparisonTableSection(): ReactElement {
  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Neden Senkronize?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
          Özellikleri yan yana görün. Rakip sütunları tipik alternatifleri temsil eden
          özet bir karşılaştırmadır; paketlere göre değişkenlik gösterebilir.
        </p>
        <div className="mt-10 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-semibold text-foreground sm:px-6">
                  Özellik
                </th>
                <th className="px-4 py-3 font-semibold text-primary sm:px-6">
                  Senkronize
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground sm:px-6">
                  Rakip A
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground sm:px-6">
                  Rakip B
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="px-4 py-3 font-medium text-foreground sm:px-6"
                  >
                    {row.feature}
                  </th>
                  <td className="px-4 py-3 text-foreground sm:px-6">{row.senkronize}</td>
                  <td className="px-4 py-3 text-muted-foreground sm:px-6">{row.rakipA}</td>
                  <td className="px-4 py-3 text-muted-foreground sm:px-6">{row.rakipB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
