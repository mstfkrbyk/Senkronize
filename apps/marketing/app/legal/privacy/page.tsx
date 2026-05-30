import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description:
    'Senkronize gizlilik politikası ve KVKK kapsamında kişisel verilerin işlenmesi hakkında bilgilendirme.',
};

export default function PrivacyPage(): ReactElement {
  return (
    <main className="min-h-[60vh] bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary">
          <h1>Gizlilik Politikası</h1>
          <p className="text-sm text-muted-foreground not-prose">
            Son güncelleme: Mayıs 2026 — Özet bilgilendirme metnidir; kesin hukuki
            metin avukat onayıyla güncellenecektir.
          </p>

          <h2>1. Veri sorumlusu</h2>
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca,
            veri sorumlusu <strong>Senkronize</strong>’dir (ticari unvan, MERSİS ve
            adres bilgileri yayımlandığında bu sayfada tamamlanacaktır).
          </p>
          <p>
            İletişim:{' '}
            <a href="mailto:kvkk@senkronize.com">kvkk@senkronize.com</a>
          </p>

          <h2>2. Toplanan veriler</h2>
          <p>Hizmetin sunulması kapsamında örnek olarak aşağıdaki veriler işlenebilir:</p>
          <ul>
            <li>Kimlik / iletişim: ad, soyad, e-posta, telefon</li>
            <li>Ödeme ile ilgili veriler: ödeme sağlayıcısı üzerinden işlenen işlem
              bilgileri (kart verileri Senkronize tarafından saklanmaz)</li>
            <li>Kullanım verileri: oturum, log, cihaz/tarayıcı, IP ve benzeri teknik
              veriler</li>
            <li>Organizasyon ve entegrasyon verileri: panel üzerinden girilen iş
              verileri</li>
          </ul>

          <h2>3. Verilerin kullanım amacı</h2>
          <p>Örnek işleme amaçları:</p>
          <ul>
            <li>Sözleşmenin kurulması ve ifası, hesap ve abonelik yönetimi</li>
            <li>Müşteri desteği, güvenlik ve dolandırıcılığın önlenmesi</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            <li>Ürün ve hizmetlerin geliştirilmesi (anonim/istatistiksel ölçüde)</li>
          </ul>

          <h2>4. Verilerin paylaşımı</h2>
          <p>
            Hizmetin gerektirdiği ölçüde iş ortakları ve alt işleyicilerle paylaşım
            söz konusu olabilir. Örnek kategoriler:
          </p>
          <ul>
            <li>Ödeme altyapısı: PayTR</li>
            <li>E-posta iletimi: Resend</li>
            <li>SMS: Netgsm</li>
            <li>Bulut altyapısı ve barındırma sağlayıcıları</li>
          </ul>

          <h2>5. Veri saklama süresi</h2>
          <p>
            Kişisel veriler, işleme amacının gerektirdiği süre ile yasal zamanaşımı
            ve mevzuatta öngörülen süreler çerçevesinde saklanır; süre sonunda
            silinir, yok edilir veya anonim hale getirilir (ayrıntılar politika
            son halinde düzenlenecektir).
          </p>

          <h2>6. Kullanıcı hakları (KVKK md. 11)</h2>
          <p>KVKK&apos;nın 11. maddesi kapsamında haklarınız arasında örneğin:</p>
          <ul>
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>İşlenmişse buna ilişkin bilgi talep etme</li>
            <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
            <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
            <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
            <li>KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini veya yok
              edilmesini isteme</li>
            <li>Aktarılan üçüncü kişilere bildirilmesini isteme</li>
            <li>Münhasıran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize
              bir sonucun ortaya çıkmasına itiraz etme</li>
            <li>Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın
              giderilmesini talep etme</li>
          </ul>
          <p>
            Başvurularınızı <a href="mailto:kvkk@senkronize.com">kvkk@senkronize.com</a>{' '}
            üzerinden iletebilirsiniz.
          </p>

          <h2>7. İletişim</h2>
          <p>
            KVKK ve gizlilik ile ilgili talepler için:{' '}
            <a href="mailto:kvkk@senkronize.com">kvkk@senkronize.com</a>
          </p>
        </article>
      </div>
    </main>
  );
}
