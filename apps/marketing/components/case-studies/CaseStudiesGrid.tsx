'use client';

import { useState, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface CaseStudy {
  id: string;
  sector: string;
  headline: string;
  summary: string;
  detail: string;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'fashion',
    sector: 'Moda & Tekstil',
    headline: 'Moda sektöründe %40 sipariş artışı',
    summary:
      'Çok kanallı moda markası, stok ve fiyat senkronunu merkezileştirerek kampanya dönemlerinde çift satış riskini ortadan kaldırdı.',
    detail:
      'Anonim bir moda markası, Trendyol ve Hepsiburada vitrinlerinde aynı SKU setini yönetirken Excel tabanlı stok güncellemeleriyle haftada onlarca iptal yaşıyordu. Senkronize ile tek depo kaynağından anlık stok paylaşımına geçildi; kampanya öncesi toplu fiyat kuralları panelden tanımlandı. İlk çeyrekte sipariş hacmi %40 arttı, iptal oranı ise yarıya indi. BuyBox görünürlüğü artışı, özellikle sezon geçişlerinde satış hızını destekledi.',
  },
  {
    id: 'electronics',
    sector: 'Elektronik',
    headline: 'Stok senkronu ile %15 iade azalması',
    summary:
      'Yüksek SKU çeşitliliğine sahip elektronik satıcısı, yanlış stok gösteriminden kaynaklanan iadeleri düşürdü.',
    detail:
      'Elektronik kategorisinde faaliyet gösteren anonim bir satıcı, farklı depolardan beslenen kanallarda stok tutarsızlığı nedeniyle müşteri şikayetleri alıyordu. Çoklu depo eşlemesi ve düşük stok uyarıları devreye alındıktan sonra, “stokta yokken satış” kaynaklı iadeler %15 azaldı. Sipariş karşılama süresi kısaldı; müşteri memnuniyeti skorları platform panelinde yükseldi.',
  },
  {
    id: 'home',
    sector: 'Ev & Yaşam',
    headline: 'Operasyon ekibinde haftada 25 saat tasarruf',
    summary:
      'Ev & yaşam markası manuel sipariş aktarımını bırakarak ekibini büyüme projelerine ayırdı.',
    detail:
      'Üç pazaryerinde büyüyen ev & yaşam markası, siparişleri ERP’ye elle aktarırken haftalık 25 saatten fazla operasyon harcıyordu. Senkronize sipariş ve fatura akışını otomatikleştirdi; masaüstü köprü uygulaması yerel muhasebe yazılımıyla güvenli bağlantı sağladı. Ekip aynı kadroyla yeni kanal açma kapasitesi kazandı; raporlama ile kanal bazlı kârlılık ilk kez tek ekranda izlendi.',
  },
];

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
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => setActive(study)}>
                Detayları Oku
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog.Root open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl">
            {active ? (
              <>
                <Dialog.Title className="text-lg font-semibold text-foreground">
                  {active.headline}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm font-medium text-primary">
                  {active.sector}
                </Dialog.Description>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {active.detail}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
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
