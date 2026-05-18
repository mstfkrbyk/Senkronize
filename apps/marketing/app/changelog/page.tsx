import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Sürüm Notları',
  description:
    'Senkronize platform sürüm geçmişi: yeni özellikler, iyileştirmeler ve hata düzeltmeleri.',
  openGraph: {
    title: 'Sürüm Notları | Senkronize',
    description: 'API ve panel için sürüm geçmişi özeti.',
    url: '/changelog',
    locale: 'tr_TR',
    type: 'website',
  },
};

interface ReleaseBlock {
  version: string;
  date: string;
  features: string[];
  improvements: string[];
  fixes: string[];
}

const releases: ReleaseBlock[] = [
  {
    version: 'v1.0.0',
    date: '18 Mayıs 2026',
    features: [
      'Genel kullanıma açık REST API sürümü ve Swagger dokümantasyon şablonu.',
      'Geliştirici portalı sayfaları: API rehberi, sürüm notları ve durum ekranı.',
    ],
    improvements: [
      'DTO alanları için Swagger açıklamaları ve örnek değerler.',
      'Sağlık uç noktası `/api/v1/health` altında standart API önekine taşındı.',
    ],
    fixes: [
      'Pazaryeri listesi sorgu parametreleri için OpenAPI şema netleştirmeleri.',
    ],
  },
  {
    version: 'v0.9.0',
    date: '2 Mayıs 2026',
    features: [
      'Organizasyon başına API anahtarı yönetimi ve panelde API anahtarları sekmesi.',
    ],
    improvements: [
      'Kimlik doğrulama akışında istemci hata mesajları sadeleştirildi.',
      'Çok kiracılı sorgularda ek indeks kullanımı ile liste performansı.',
    ],
    fixes: [
      'Davet kabulünde nadir oluşan oturum yenileme yarış durumu giderildi.',
    ],
  },
  {
    version: 'v0.8.0',
    date: '14 Nisan 2026',
    features: [
      'Webhook olay kuyruğu için ilk izleme metrikleri ve yönetici özet uç noktası.',
    ],
    improvements: [
      'E-posta şablonlarında koyu/açık tema uyumu.',
      'BullMQ iş yeniden deneme aralıkları yapılandırılabilir hale getirildi.',
    ],
    fixes: [
      'Trendyol imza başlığı büyük/küçük harf duyarlılığı düzeltildi.',
    ],
  },
];

function ReleaseList({
  title,
  items,
}: {
  title: string;
  items: string[];
}): ReactElement | null {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#111827]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage(): ReactElement {
  return (
    <main>
      <section className="border-b border-border bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Sürüm notları
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            API, panel ve altyapı paketleri için özet değişiklik günlüğü. Ayrıntılı
            teknik notlar için{' '}
            <a
              href="https://api.senkronize.com/api/docs"
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Swagger
            </a>{' '}
            belgesine bakın.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
        {releases.map((r) => (
          <article
            key={r.version}
            className="rounded-xl border border-border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold text-[#111827]">{r.version}</h2>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {r.date}
              </span>
            </div>
            <ReleaseList title="Yeni özellikler" items={r.features} />
            <ReleaseList title="İyileştirmeler" items={r.improvements} />
            <ReleaseList title="Düzeltmeler" items={r.fixes} />
          </article>
        ))}
      </section>
    </main>
  );
}
