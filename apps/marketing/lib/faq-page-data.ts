import type { FaqCategory } from '@/components/faq/FaqAccordion';

export const FAQ_PAGE_CATEGORIES: FaqCategory[] = [
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
