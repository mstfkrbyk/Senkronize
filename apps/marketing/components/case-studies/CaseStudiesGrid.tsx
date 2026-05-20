'use client';

import { useState, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface CaseStudyMetric {
  label: string;
  before: string;
  after: string;
}

interface CaseStudy {
  id: string;
  sector: string;
  headline: string;
  summary: string;
  story: string;
  metrics: CaseStudyMetric[];
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'fashion',
    sector: 'Moda & Tekstil',
    headline: 'Moda sektöründe %40 sipariş artışı',
    summary:
      'Çok kanallı moda markası, stok ve fiyat senkronunu merkezileştirerek kampanya dönemlerinde çift satış riskini ortadan kaldırdı.',
    story:
      'Anonim bir moda markası, Trendyol ve Hepsiburada vitrinlerinde aynı SKU setini yönetirken Excel tabanlı stok güncellemeleriyle haftada onlarca iptal yaşıyordu. Senkronize ile tek depo kaynağından anlık stok paylaşımına geçildi; kampanya öncesi toplu fiyat kuralları panelden tanımlandı. BuyBox görünürlüğü artışı, özellikle sezon geçişlerinde satış hızını destekledi.',
    metrics: [
      { label: 'Aylık sipariş hacmi', before: '2.400', after: '3.360 (+40%)' },
      { label: 'İptal oranı', before: '%8,2', after: '%4,1' },
      { label: 'Stok güncelleme süresi', before: '45 dk/gün', after: 'Anlık' },
    ],
  },
  {
    id: 'electronics',
    sector: 'Elektronik',
    headline: 'Stok senkronu ile %15 iade azalması',
    summary:
      'Yüksek SKU çeşitliliğine sahip elektronik satıcısı, yanlış stok gösteriminden kaynaklanan iadeleri düşürdü.',
    story:
      'Elektronik kategorisinde faaliyet gösteren anonim bir satıcı, farklı depolardan beslenen kanallarda stok tutarsızlığı nedeniyle müşteri şikayetleri alıyordu. Çoklu depo eşlemesi ve düşük stok uyarıları devreye alındıktan sonra sipariş karşılama süresi kısaldı; müşteri memnuniyeti skorları platform panelinde yükseldi.',
    metrics: [
      { label: 'İade oranı', before: '%12', after: '%10,2 (-15%)' },
      { label: 'Stokta yokken satış', before: 'Haftada ~18', after: 'Haftada ~3' },
      { label: 'SKU senkron gecikmesi', before: '2–4 saat', after: '<30 sn' },
    ],
  },
  {
    id: 'home',
    sector: 'Ev & Yaşam',
    headline: 'Operasyon ekibinde haftada 25 saat tasarruf',
    summary:
      'Ev & yaşam markası manuel sipariş aktarımını bırakarak ekibini büyüme projelerine ayırdı.',
    story:
      'Üç pazaryerinde büyüyen ev & yaşam markası, siparişleri ERP’ye elle aktarırken haftalık 25 saatten fazla operasyon harcıyordu. Senkronize sipariş ve fatura akışını otomatikleştirdi; masaüstü köprü uygulaması yerel muhasebe yazılımıyla güvenli bağlantı sağladı. Ekip aynı kadroyla yeni kanal açma kapasitesi kazandı.',
    metrics: [
      { label: 'Manuel operasyon süresi', before: '25+ saat/hafta', after: '<5 saat/hafta' },
      { label: 'Aktif pazaryeri kanalı', before: '3', after: '5' },
      { label: 'Fatura aktarım hatası', before: 'Haftada ~12', after: 'Neredeyse sıfır' },
    ],
  },
];

function MetricsBlock({ metrics }: { metrics: CaseStudyMetric[] }): ReactElement {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-border bg-muted/30 p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {m.label}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground line-through">{m.before}</span>
            <ArrowDown className="h-3 w-3 shrink-0 text-muted-foreground/60 sm:hidden" />
            <ArrowUp className="hidden h-3 w-3 shrink-0 text-primary sm:block" aria-hidden />
          </div>
          <p className="mt-1 text-base font-semibold text-primary">{m.after}</p>
        </div>
      ))}
    </div>
  );
}

export function CaseStudiesGrid(): ReactElement {
  const [active, setActive] = useState<CaseStudy | null>(null);

  return (
    <>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {CASE_STUDIES.map((study) => (
          <Card key={study.id} className="flex h-full flex-col border-border">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {study.sector}
              </p>
              <CardTitle className="mt-2 text-lg leading-snug">{study.headline}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm leading-relaxed text-muted-foreground">{study.summary}</p>
              <ul className="mt-4 space-y-1 border-t border-border pt-4">
                {study.metrics.slice(0, 2).map((m) => (
                  <li key={m.label} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.label}:</span>{' '}
                    {m.before} → {m.after}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setActive(study)}>
                Tam Hikayeyi Oku
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog.Root open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl sm:p-8">
            {active ? (
              <>
                <Dialog.Title className="text-xl font-semibold text-foreground">
                  {active.headline}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm font-medium text-primary">
                  {active.sector}
                </Dialog.Description>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {active.story}
                </p>
                <h3 className="mt-6 text-sm font-semibold text-foreground">
                  Öncesi / sonrası metrikler
                </h3>
                <MetricsBlock metrics={active.metrics} />
                <p className="mt-6 text-xs text-muted-foreground">
                  Vaka çalışmaları anonimleştirilmiş örnek senaryolardır; sonuçlar işletme
                  ölçeği ve operasyonel olgunluğa göre değişebilir.
                </p>
              </>
            ) : null}
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
