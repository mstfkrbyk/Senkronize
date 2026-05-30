import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  description:
    'Senkronize SaaS hizmetinin kullanım koşulları ve sözleşme hükümleri.',
};

export default function TermsPage(): ReactElement {
  return (
    <main className="min-h-[60vh] bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary">
          <h1>Kullanım Koşulları</h1>
          <p className="text-sm text-muted-foreground not-prose">
            Son güncelleme: Mayıs 2026 — Özet bilgilendirme metnidir; kesin hukuki
            metin avukat onayıyla güncellenecektir.
          </p>

          <h2>1. Hizmet tanımı</h2>
          <p>
            Senkronize; pazaryeri ve ERP entegrasyonu odaklı, çok kiracılı (SaaS)
            yazılım hizmetidir. Hizmetin kapsamı, özellikler ve kullanılabilirlik
            planınıza ve ürün dokümantasyonuna göre şekillenir (ayrıntılar nihai
            sözleşmede düzenlenecektir).
          </p>

          <h2>2. Üyelik ve hesap</h2>
          <p>
            Hesap oluştururken doğru ve güncel bilgi vermeniz beklenir. Hesap
            güvenliğinden (şifre, cihaz erişimi) siz sorumlusunuz. Yetkisiz kullanım
            tespitinde derhal bildirim yapılması önerilir.
          </p>

          <h2>3. Abonelik ve ödeme</h2>
          <ul>
            <li>Ücretsiz deneme süresi örnek olarak 14 gün olarak sunulabilir.</li>
            <li>
              Ödeme sonrası iade uygulaması iş modeline göre belirlenir; nihai politika
              ayrıca yayımlanacaktır.
            </li>
            <li>
              İptal: abonelik iptali halinde erişim, faturalandırılan dönem sonuna
              kadar sürebilir; nihai akış sözleşme ve paneldeki bilgilere tabidir.
            </li>
          </ul>

          <h2>4. Kullanım sınırlamaları</h2>
          <p>
            Hizmet; yürürlükteki mevzuata, üçüncü taraf platform kurallarına ve
            makul kullanım ilkelerine uygun şekilde kullanılmalıdır. Tersine
            mühendislik, kötüye kullanım, güvenliği zayıflatma veya diğer
            kullanıcıların hizmetini olumsuz etkileyecek faaliyetler yasaktır
            (örnek liste nihai metinde genişletilebilir).
          </p>

          <h2>5. Fikri mülkiyet</h2>
          <p>
            Senkronize markası, yazılımı, arayüzü ve dokümantasyonu üzerindeki haklar
            ilgili mevzuat kapsamında korunur. Size yalnızca sözleşme kapsamında
            sınırlı bir kullanım hakkı verilir.
          </p>

          <h2>6. Sorumluluk sınırı</h2>
          <p>
            Hizmet &quot;olduğu gibi&quot; sunulur; belirli garantiler hariç tutulabilir
            ve tazminat üst sınırı sözleşmede tanımlanır. Üçüncü
            taraf platformlardan kaynaklanan kesintilerden doğrudan sorumluluk
            kabul edilmeyebilir (nihai metin).
          </p>

          <h2>7. Sözleşme feshi</h2>
          <p>
            Taraflar için fesih koşulları, bildirim süreleri ve sonuçları nihai
            sözleşmede düzenlenecektir. Ağır ihlal hallerinde hesabın askıya
            alınması veya sonlandırılması mümkün olabilir.
          </p>

          <h2>8. Uygulanacak hukuk</h2>
          <p>
            Uyuşmazlıklarda <strong>Türk Hukuku</strong> uygulanır. İstanbul
            Mahkemeleri ve İcra Daireleri yetkilidir (nihai yetki maddesi sözleşmede
            netleştirilecektir).
          </p>
        </article>
      </div>
    </main>
  );
}
