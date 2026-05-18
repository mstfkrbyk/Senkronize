import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'İptal ve İade',
  description:
    'Senkronize abonelik iptali, cayma hakkı ve iade politikası hakkında bilgilendirme (placeholder metin).',
};

export default function CancellationPage(): ReactElement {
  return (
    <main className="min-h-[60vh] bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary">
          <h1>İptal ve İade</h1>
          <p className="text-sm text-muted-foreground not-prose">
            Son güncelleme: Mayıs 2026 — Bu metin yer tutucudur; kesin hukuki metin
            avukat onayıyla güncellenecektir.
          </p>

          <h2>14 gün cayma hakkı ve ücretsiz deneme</h2>
          <p>
            Mesafeli sözleşmeler ve tüketici mevzuatı kapsamındaki haklarınız saklıdır.
            Ödeme öncesinde sunulan ücretsiz deneme süresi (örnek: 14 gün), hizmeti
            ücret ödemeden denemenize olanak tanır; cayma ve iade koşulları ödeme
            anına ve sunulan içeriğe göre değişebilir.
          </p>

          <h2>Ödeme sonrası iade</h2>
          <p>
            Yer tutucu açıklama: ödeme sonrası iade yapılmamaktadır ifadesi iş
            modeli gereği kullanılabilir; nihai metin ve istisnalar (varsa) ayrıca
            yayımlanacaktır.
          </p>

          <h2>İptal</h2>
          <p>
            Abonelik iptali talebiniz, genel olarak mevcut fatura döneminin sonunda
            veya panelde belirtilen şekilde sona erer; erişim süresi politika ve
            teknik süreçlere bağlıdır.
          </p>

          <h2>Mesafeli satış sözleşmesi</h2>
          <p>
            Ön bilgilendirme ve mesafeli satış sözleşmesi metinleri; ödeme akışında
            ve/veya ayrı sayfalarda sunulacaktır (yer tutucu). Sipariş öncesi
            fiyat, süre, cayma ve destek bilgilerini kontrol etmeniz önerilir.
          </p>

          <p>
            Sorularınız için:{' '}
            <a href="mailto:kvkk@senkronize.com">kvkk@senkronize.com</a>
          </p>
        </article>
      </div>
    </main>
  );
}
