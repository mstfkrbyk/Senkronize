import type { FaqCategory } from '@/components/faq/FaqAccordion';

/** SSS sayfası — 15 soru (JSON-LD için düz liste: FAQ_PAGE_FLAT) */
export const FAQ_PAGE_CATEGORIES: FaqCategory[] = [
  {
    category: 'Genel',
    questions: [
      {
        q: 'Senkronize nedir?',
        a: 'Senkronize, e-ticaret mağazanızı Trendyol, Hepsiburada, N11 gibi pazaryerleri ve BizimHesap, Paraşüt gibi ERP sistemleri ile entegre eden bulut tabanlı bir SaaS platformudur.',
      },
      {
        q: 'Sözleşme var mı?',
        a: 'Hayır. Aylık veya yıllık abonelik modeliyle çalışıyoruz; uzun süreli bağlayıcı sözleşme zorunluluğu yoktur. İstediğiniz zaman iptal edebilirsiniz.',
      },
      {
        q: '14 gün deneme nasıl çalışır?',
        a: 'Kayıt sonrası 14 gün boyunca seçtiğiniz planın özelliklerini ücretsiz deneyebilirsiniz. Kredi kartı gerekmez; süre bitiminde devam etmek için sizden onay alınır.',
      },
      {
        q: 'Hangi pazaryerlerini destekliyorsunuz?',
        a: 'Trendyol, Hepsiburada, N11, Çiçeksepeti, Amazon.com.tr, PTT AVM ve Pazarama desteklenmektedir. Yeni platformlar yol haritamıza göre eklenmektedir.',
      },
      {
        q: 'ERP entegrasyonu nedir?',
        a: 'Sipariş onaylandığında faturalama ve stok hareketleri BizimHesap, Paraşüt, Logo Tiger, Mikro ERP, Luca gibi sistemlere otomatik aktarılır; manuel veri girişi ortadan kalkar.',
      },
    ],
  },
  {
    category: 'Ürün ve Güvenlik',
    questions: [
      {
        q: 'BuyBox nedir, nasıl çalışır?',
        a: 'BuyBox, pazaryerinde aynı ürünü satan satıcılar arasında öne çıkan teklif kutusudur. Pro plandaki BuyBox AI, marj kurallarınızı koruyarak fiyat önerileri sunar ve görünürlüğünüzü artırmayı hedefler.',
      },
      {
        q: 'Verilerim güvende mi?',
        a: 'API anahtarları ve ERP şifreleri AES-256-GCM ile şifrelenir. Verileriniz Türkiye ve AB GDPR uyumlu veri merkezlerinde saklanır; hassas bilgiler loglara yazılmaz.',
      },
      {
        q: 'Desktop uygulaması ne işe yarar?',
        a: 'Windows ve macOS için Tauri tabanlı masaüstü uygulama, şirket içi veya kapalı ağdaki ERP sistemlerine güvenli köprü sağlar; bulut paneli ile birlikte çalışır.',
      },
      {
        q: 'Gerçek zamanlı senkronizasyon nasıl çalışır?',
        a: 'Webhook ve WebSocket mimarisi ile stok, fiyat ve sipariş değişiklikleri saniyeler içinde tüm bağlı kanallara yansır.',
      },
    ],
  },
  {
    category: 'Fiyatlandırma ve Destek',
    questions: [
      {
        q: 'Ücretlendirme nasıl çalışıyor?',
        a: 'Paketler yıllık faturalama ile sunulur (KDV hariç). Aylık eşdeğer tutarlar karşılaştırma amaçlıdır; fiyatlar resmi lansman öncesi erken kayıt listesinden duyurulacaktır.',
      },
      {
        q: 'Plan değişikliği yapabilir miyim?',
        a: 'Evet. Dilediğiniz zaman planınızı yükseltebilirsiniz; fark ücreti dönem sonuna göre hesaplanır.',
      },
      {
        q: 'Teknik destek var mı?',
        a: 'Tüm planlarda e-posta desteği sunulur. Gelişim ve üzeri planlarda öncelikli destek; Pro ve Kurumsal planlarda genişletilmiş SLA seçenekleri mevcuttur.',
      },
      {
        q: 'API erişimi var mı?',
        a: 'Pro ve Kurumsal plan aboneleri API anahtarı oluşturabilir ve REST API ile sipariş, stok ve katalog işlemlerine erişebilir.',
      },
    ],
  },
  {
    category: 'Partner',
    questions: [
      {
        q: 'Partner / bayi sistemi nedir?',
        a: 'E-ticaret ajansları ve danışmanlar, müşteri organizasyonlarına güvenli erişimle hizmet verir. Impersonation ve denetim kayıtları audit log ile izlenir.',
      },
      {
        q: 'Partner olmak için ne gerekiyor?',
        a: 'Hesap oluşturduktan sonra partner başvurusu yapabilirsiniz. Onay sonrası müşteri daveti göndererek çoklu organizasyon yönetimi kullanabilirsiniz.',
      },
    ],
  },
];

/** JSON-LD FAQPage — tüm sorular */
export const FAQ_PAGE_FLAT: { q: string; a: string }[] = FAQ_PAGE_CATEGORIES.flatMap(
  (c) => c.questions,
);
