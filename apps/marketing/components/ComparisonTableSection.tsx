import { Check, X } from 'lucide-react';
import type { ReactElement } from 'react';

type CellValue = boolean | string;

const ROWS: {
  feature: string;
  senkronize: CellValue;
  entegra: CellValue;
  manuel: CellValue;
}[] = [
  {
    feature: 'Çoklu pazaryeri tek panel',
    senkronize: true,
    entegra: true,
    manuel: false,
  },
  {
    feature: 'Gerçek zamanlı stok/fiyat sync',
    senkronize: true,
    entegra: true,
    manuel: false,
  },
  {
    feature: 'ERP otomatik aktarım',
    senkronize: true,
    entegra: false,
    manuel: false,
  },
  {
    feature: 'BuyBox AI',
    senkronize: true,
    entegra: false,
    manuel: false,
  },
  {
    feature: 'Partner / bayi paneli',
    senkronize: true,
    entegra: false,
    manuel: false,
  },
  {
    feature: 'Masaüstü ERP köprüsü',
    senkronize: true,
    entegra: false,
    manuel: false,
  },
  {
    feature: '14 gün ücretsiz deneme',
    senkronize: '14 gün',
    entegra: '7 gün',
    manuel: false,
  },
  {
    feature: 'Operasyon süresi (tahmini)',
    senkronize: 'Düşük',
    entegra: 'Orta',
    manuel: 'Yüksek',
  },
];

function renderCell(value: CellValue, highlight?: boolean): ReactElement {
  if (value === true) {
    return (
      <Check
        className={`mx-auto h-5 w-5 ${highlight ? 'text-primary' : 'text-emerald-600'}`}
        aria-label="Var"
      />
    );
  }
  if (value === false) {
    return (
      <X className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label="Yok" />
    );
  }
  return (
    <span className={highlight ? 'font-medium text-foreground' : 'text-muted-foreground'}>
      {value}
    </span>
  );
}

export function ComparisonTableSection(): ReactElement {
  return (
    <section className="bg-[#F9FAFB] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Senkronize vs alternatifler
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
          Tipik entegrasyon yazılımı (Entegra) ve Excel/manuel süreçlerle karşılaştırma.
          Paket ve entegrasyon kapsamına göre değişebilir.
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
                  Entegra
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground sm:px-6">
                  Manuel yönetim
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
                  <td className="px-4 py-3 text-center sm:px-6">
                    {renderCell(row.senkronize, true)}
                  </td>
                  <td className="px-4 py-3 text-center sm:px-6">
                    {renderCell(row.entegra)}
                  </td>
                  <td className="px-4 py-3 text-center sm:px-6">
                    {renderCell(row.manuel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
