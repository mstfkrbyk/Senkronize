import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { BookOpen, Headphones, ShieldCheck, Users, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPanelUrl } from '@/lib/panel-url';

const ogDescription =
  'Her referansta %20 komisyon, aylık ödeme ve gerçek zamanlı takip. Partner paneli, özel destek ve eğitim materyalleriyle kazan-kazan programı.';

export const metadata: Metadata = {
  title: 'Referans Programı',
  description: ogDescription,
  keywords: [
    'senkronize partner',
    'referans programı',
    'komisyon',
    'e-ticaret ajansı',
  ],
  openGraph: {
    title: 'Referans Programı | Senkronize',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/referral',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Referans Programı | Senkronize',
    description: ogDescription,
    site: '@senkronize',
  },
};

export default function ReferralPage(): ReactElement {
  const panel = getPanelUrl();

  return (
    <main className="bg-[#F9FAFB] py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:max-w-4xl lg:px-8">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Partner ol
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Kazan-Kazan: Referans Programımız
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Tanıdığınız markaları Senkronize ile buluşturun; her başarılı abonelikte{' '}
          <strong>%20 komisyon</strong> kazanın. Ödemeler{' '}
          <strong>aylık</strong> olarak yapılır; panel üzerinden{' '}
          <strong>gerçek zamanlı takip</strong> edersiniz.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href={`${panel}/register`}>Şimdi Katıl</a>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/contact">Bize yazın</Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Card className="border-border text-left shadow-sm">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">
                  Kendi panelinizden yönetin
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Müşteri davetleri, abonelik durumları ve komisyon hareketleri tek
                  partner panelinde toplanır; müşterilerinizle güvenli çalışma modeli
                  kurarsınız.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border text-left shadow-sm">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Headphones className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Özel destek</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Partnerlere öncelikli destek hattı ve entegrasyon sorularında
                  yönlendirme; böylece müşterilerinize daha hızlı değer sunarsınız.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border text-left shadow-sm">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Eğitim materyalleri</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Satış deckleri, ürün özeti ve sık sorulan sorularla ekibinizi hızla
                  eğitin; ilk müşteriye kadar yalnız kalmazsınız.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border text-left shadow-sm">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Şeffaf komisyon</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Her faturalanan abonelik için oranlar net; raporlar indirilebilir ve
                  muhasebe ile uyumludur.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto mt-14 max-w-2xl border-primary/20 bg-card shadow-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex items-start gap-3 text-left">
              <ShieldCheck className="mt-0.5 h-8 w-8 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Güven
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  47 aktif partner
                </p>
                <p className="text-lg font-semibold text-foreground">
                  ₺2.3M+ ödenen komisyon
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <a href={`${panel}/register`}>Şimdi Katıl</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
