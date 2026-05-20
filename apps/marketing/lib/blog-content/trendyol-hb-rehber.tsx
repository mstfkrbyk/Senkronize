import type { ReactElement } from 'react';

/** ~1200 kelime — Trendyol & Hepsiburada entegrasyon rehberi */
export function TrendyolHbIntegrationBody(): ReactElement {
  return (
    <>
      <p>
        <strong>Trendyol</strong> ve <strong>Hepsiburada</strong>, Türkiye&apos;de çoğu markanın
        cirosunun büyük kısmını oluşturan iki ana pazaryeridir. Her ikisinde de mağaza açmak
        kolaydır; zor olan, stok, fiyat ve sipariş akışını sürdürülebilir şekilde senkron
        tutmaktır. Bu rehberde API anahtarı alma, stok senkronizasyonu, sipariş yönetimi ve
        sık karşılaşılan sorunların giderilmesini adım adım anlatıyoruz.
      </p>

      <h2>API anahtarı alma</h2>
      <p>
        Trendyol satıcı panelinde Entegrasyon veya API bölümünden satıcı kimliği, API key ve
        secret üretilir. Hepsiburada tarafında benzer şekilde satıcı merkezi üzerinden API
        erişimi talep edilir; onay süreci hesap geçmişine göre değişebilir. Anahtarları asla
        e-posta veya mesajla paylaşmayın; entegrasyon platformunda şifreli saklanmalıdır.
        Senkronize bağlantı sihirbazında her kanal için ayrı credential girilir; test
        ortamı varsa önce test, sonra canlı anahtar kullanılması önerilir.
      </p>
      <p>
        Anahtar rotasyonu: güvenlik politikası gereği periyodik yenileme yapın. Yeni anahtar
        aktif edilmeden eskisini iptal etmeyin; aksi halde senkron kesilir ve stok sapması
        oluşur. Rotasyon sırasında kısa bir bakım penceresi planlayın veya çift anahtar
        geçişini destekleyen süreç kullanın.
      </p>

      <h2>Stok senkronizasyonu</h2>
      <p>
        Çok kanallı satışta tek doğruluk kaynağı (master stok) tanımlayın. Depo veya ERP
        stoğu değiştiğinde hem Trendyol hem Hepsiburada aynı anda güncellenmelidir. Gecikmeli
        güncelleme çift satışa, fazla gösterilen stok ise iptale yol açar. Barkod ve varyant
        eşlemesi hatalıysa yanlış ürün güncellenir; onboarding&apos;de SKU eşleme listesini
        doğrulayın.
      </p>
      <p>
        Kampanya öncesi güvenlik stoğu (buffer) tanımlamak, ani talep dalgalarında tükenmeyi
        önler. Kampanya bitiminde buffer kaldırılmazsa satılabilir stok yapay olarak düşük
        kalır. Senkronize&apos;da kural bazlı buffer ve kanal önceliği (örneğin önce Trendyol
        rezervasyonu) yapılandırılabilir.
      </p>

      <h2>Sipariş yönetimi</h2>
      <p>
        Siparişler panelden veya API&apos;den çekilir; durumlar (yeni, hazırlanıyor, kargoda,
        teslim) platforma geri yazılır. Gecikmeli durum güncellemesi müşteri şikayeti ve skor
        düşüşü üretir. Kargo takip numarası entegrasyonu otomatik ise operasyon yükü azalır.
        İade ve iptal akışları da senkronize edilmeli; aksi halde stok geri yüklenmez ve
        envanter şişer veya eksilir.
      </p>
      <p>
        ERP veya muhasebe entegrasyonu ile sipariş onaylandığında fatura kaydı oluşturmak,
        manuel veri girişini ortadan kaldırır. Yüksek hacimde günlük mutabakat raporu ile
        panel sipariş sayısı ile ERP kayıtlarını karşılaştırın.
      </p>

      <h2>Sorun giderme</h2>
      <p>
        <strong>401 / yetkilendirme hatası:</strong> Anahtar süresi dolmuş veya yanlış kopyalanmış
        olabilir; panelden yenileyin ve Senkronize bağlantısını güncelleyin.
      </p>
      <p>
        <strong>429 / rate limit:</strong> Çok sık istek atılıyordur; toplu güncellemeleri
        batch halinde ve platform limitlerine uygun aralıklarla gönderin.
      </p>
      <p>
        <strong>Stok uyuşmazlığı:</strong> Son senkron zamanını kontrol edin; manuel panel
        müdahalesi entegrasyonu geçici olarak bozmuş olabilir. Tam sayım sonrası master stok
        ile zorunlu eşitleme (reconcile) çalıştırın.
      </p>
      <p>
        <strong>Fiyat reddedildi:</strong> Platform minimum fiyat veya kampanya kuralına takılıyor
        olabilir; kural setini ve maliyet tablosunu gözden geçirin.
      </p>
      <p>
        Trendyol ve Hepsiburada entegrasyonunu tek panelde birleştirmek, ekip verimliliğini
        artırır ve hata payını düşürür. Senkronize ile API bağlantısı, stok-fiyat-sipariş
        döngüsünü otomatikleştirerek büyümeye odaklanabilirsiniz.
      </p>
    </>
  );
}
