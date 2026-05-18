import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { FaqAccordion } from '@/components/faq/FaqAccordion';
import type { FaqCategory } from '@/components/faq/FaqAccordion';

const ogDescription =
  'Senkronize hakkında sık sorulan sorular: genel bilgiler, fiyatlandırma, teknik konular ve partner programı.';

export const metadata: Metadata = {
  title: 'Sık Sorulan Sorular',
  description: ogDescription,
  openGraph: {
    title: 'SSS | Senkronize',
    description: ogDescription,
    type: 'website',
    locale: 'tr_TR',
    url: '/faq',
  },
};

const FAQS: FaqCategory[] = [
  {
    category: 'Genel',
    questions: [
      {
        q: 'Senkronize nedir?',
        a: 'Senkronize, e-ticaret mağazanızı Trendyol, Hepsiburada, N11 gibi pazaryerleri ve BizimHesap, Paraşüt gibi ERP sistemleri ile entegre eden bulut tabanlı bir SaaS platformudur.',
      },
      {
        q: 'Hangi pazaryerlerini destekliyorsunuz?',
        a: 'Trendyol, Hepsiburada, N11, Çiçeksepeti, Amazon.com.tr, PTT AVM ve Pazarama desteklenmektedir. Yeni platformlar sürekli eklenmektedir.',
      },
      {
        q: 'Deneme süresi var mı?',
        a: '14 gün ücretsiz deneme sunuyoruz. Kredi kartı bilgisi gerekmez.',
      },
    ],
  },
  {
    category: 'Fiyatlandırma',
    questions: [
      {
        q: 'Ücretlendirme nasıl çalışıyor?',
        a: 'Aylık veya yıllık abonelik modeliyle çalışıyoruz. Yıllık planlar %20 indirimlidir.',
      },
      {
        q: 'Ödeme aldıktan sonra iptal edebilir miyim?',
        a: 'Ödeme gerçekleştikten sonra iade yapılmamaktadır. Aboneliğinizi iptal ederseniz, kalan süre boyunca hizmeti kullanmaya devam edebilirsiniz.',
      },
      {
        q: 'Plan değişikliği yapabilir miyim?',
        a: 'Evet, dilediğiniz zaman planınızı yükseltebilirsiniz.',
      },
    ],
  },
  {
    category: 'Teknik',
    questions: [
      {
        q: 'Verilerimi güvende mi?',
        a: "Tüm veriler AES-256-GCM şifreleme ile korunmaktadır. Sunucularımız Türkiye'de ve AB GDPR uyumlu veri merkezlerinde yer almaktadır.",
      },
      {
        q: 'On-premise ERP sistemleri destekleniyor mu?',
        a: 'Evet! Logo Tiger, Mikro ve Netsis gibi on-premise ERP sistemleri için masaüstü uygulamanızı kurarak entegrasyon sağlayabilirsiniz.',
      },
      {
        q: 'API erişimi var mı?',
        a: 'PRO plan aboneleri API anahtarı oluşturabilir ve tüm özelliklerimize REST API üzerinden erişebilir.',
      },
    ],
  },
  {
    category: 'Partner Sistemi',
    questions: [
      {
        q: 'Partner programı nedir?',
        a: 'E-ticaret ajansları ve danışmanlar partner olarak müşterilerini Senkronize üzerinden yönetebilir ve her abonelikten komisyon kazanabilir.',
      },
      {
        q: 'Partner olmak için ne gerekiyor?',
        a: 'Hesabınızı oluşturduktan sonra partner başvurusu yapabilirsiniz. Onay sonrasında müşteri daveti gönderebilirsiniz.',
      },
    ],
  },
];

export default function FaqPage(): ReactElement {
  return (
    <main className="bg-[#F9FAFB] py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Sık sorulan sorular
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Ürün, fiyatlandırma, teknik konular ve partner programı hakkında yanıtlar.
        </p>
        <div className="mt-12 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <FaqAccordion items={FAQS} />
        </div>
      </div>
    </main>
  );
}
