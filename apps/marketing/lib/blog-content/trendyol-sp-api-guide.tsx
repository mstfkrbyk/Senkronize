import type { ReactElement } from 'react';

/** ~1500 kelime — Trendyol SP-API entegrasyon rehberi 2026 */
export function TrendyolSpApiGuideBody(): ReactElement {
  return (
    <>
      <p>
        <strong>Trendyol</strong> Türkiye&apos;nin en büyük pazaryerlerinden biri olarak milyonlarca
        alıcıya ulaşmanızı sağlar; ancak mağaza büyüdükçe panel üzerinden manuel yönetim sürdürülebilir
        olmaktan çıkar. <strong>Trendyol SP-API</strong> (Seller Portal API), satıcıların ürün, stok,
        fiyat, sipariş ve iade süreçlerini programatik olarak yönetmesine olanak tanır. Bu rehberde
        2026 güncel akışıyla API kurulumundan ürün yüklemeye, stok senkronizasyonundan sipariş
        çekmeye ve sık karşılaşılan hataların çözümüne kadar eksiksiz bir yol haritası sunuyoruz.
      </p>

      <h2>Trendyol SP-API nedir ve neden kullanmalısınız?</h2>
      <p>
        SP-API, Trendyol satıcı panelindeki işlemlerin büyük kısmını REST tabanlı uç noktalar üzerinden
        otomatikleştirmenizi sağlar. Ürün oluşturma ve güncelleme, stok miktarı bildirimi, fiyat
        değişikliği, sipariş listeleme, kargo bilgisi gönderme ve iade yönetimi bu API&apos;nin temel
        kapsamındadır. Manuel panel kullanımında her SKU için ayrı tıklama, kopyala-yapıştır ve insan
        hatası riski vardır; API ile aynı işlemler saniyeler içinde binlerce kayda uygulanabilir.
      </p>
      <p>
        Entegrasyon olmadan çalışan ekipler genellikle Excel dosyaları, gece mesaileri ve tutarsız stok
        verileriyle mücadele eder. SP-API sayesinde ERP veya WMS sisteminizdeki gerçek stok, belirli
        aralıklarla Trendyol&apos;a yansıtılır; yeni siparişler otomatik olarak iç sisteminize düşer.
        Bu da oversell (stokta olmayan ürünün satılması), geciken kargo bildirimleri ve müşteri
        memnuniyetsizliği gibi sorunları azaltır. 2026&apos;da rekabet ortamında hız ve doğruluk,
        BuyBox görünürlüğünü doğrudan etkileyen faktörler haline gelmiştir.
      </p>

      <h2>SP-API kurulumu: adım adım</h2>
      <p>
        Kurulum süreci dört ana aşamadan oluşur: satıcı hesabı doğrulaması, API anahtarı oluşturma,
        test ortamı yapılandırması ve üretim ortamına geçiş. İlk olarak Trendyol Satıcı Paneli&apos;nde
        &quot;Entegrasyon&quot; veya &quot;API Ayarları&quot; bölümüne gidin. Burada Supplier ID (tedarikçi
        numaranız), API Key ve API Secret üretilir. Bu bilgileri güvenli bir kasada saklayın; asla
        kaynak kod deposuna veya istemci tarafı JavaScript&apos;e yazmayın.
      </p>
      <p>
        İkinci adımda entegrasyon sunucunuzun IP adresini Trendyol&apos;a bildirmeniz gerekebilir.
        Üçüncü adımda sandbox veya test modunda basit bir &quot;ping&quot; isteği atarak kimlik
        doğrulamanın çalıştığını doğrulayın. Dördüncü adımda webhook veya polling stratejinizi
        belirleyin: siparişler için genellikle periyodik çekme (polling) ile anlık webhook
        kombinasyonu tercih edilir. Son olarak loglama ve hata izleme altyapınızı kurun; üretimde
        her API çağrısı korelasyon kimliği ile kaydedilmelidir.
      </p>
      <p>
        <strong>Senkronize</strong> kullanıyorsanız bu adımların büyük kısmı panel üzerinden
        yönlendirilir: kimlik bilgileri AES-256-GCM ile şifrelenerek saklanır, bağlantı testi tek
        tıkla yapılır ve senkron politikaları görsel arayüzden tanımlanır. Böylece teknik ekip API
        detaylarıyla uğraşmak yerine iş kurallarına odaklanır.
      </p>

      <h2>Ürün yükleme ve katalog yönetimi</h2>
      <p>
        Trendyol&apos;a ürün yüklerken barkod (GTIN/EAN), marka, kategori, açıklama, görsel ve fiyat
        alanları zorunludur. SP-API üzerinden toplu ürün oluşturma (batch create) yapılabilir; ancak
        kategori eşleştirmesi doğru yapılmazsa ürünler reddedilir. Her kategori için Trendyol&apos;un
        zorunlu attribute (özellik) listesi farklıdır — örneğin giyimde beden ve renk, elektronikte
        model numarası gerekebilir.
      </p>
      <p>
        Görsel gereksinimleri 2026&apos;da daha sıkı: minimum çözünürlük, beyaz arka plan ve filigransız
        fotoğraf kuralları ihlal edildiğinde ürün onay süreci uzar. API ile görsel URL&apos;leri
        gönderilebilir; görsellerin CDN üzerinden hızlı erişilebilir olması gerekir. Varyantlı ürünlerde
        (renk/beden) ana ürün ve alt varyant ilişkisini doğru kurmak kritiktir; aksi halde stok
        güncellemeleri yanlış varyanta gider.
      </p>
      <p>
        Katalog güncellemelerinde &quot;upsert&quot; mantığı kullanın: mevcut SKU varsa güncelle, yoksa
        oluştur. Bu, mükerrer kayıt ve barkod çakışması hatalarını önler. Toplu yükleme işlemlerini
        kuyruk tabanlı yapın; API limitlerini aşmamak için istekleri gruplandırın ve hata dönen
        kayıtları ayrı bir &quot;dead letter&quot; kuyruğuna alın.
      </p>

      <h2>Stok yönetimi ve senkronizasyon stratejisi</h2>
      <p>
        Stok yönetimi, entegrasyonun en kritik bileşenidir. Trendyol&apos;da görünen stok ile
        depodaki fiziksel stok arasında gecikme varsa çift satış kaçınılmazdır. Tek doğruluk kaynağı
        (single source of truth) olarak ERP veya WMS sisteminizi belirleyin; Trendyol stok miktarı bu
        kaynaktan türetilmelidir. Pratikte brüt stoktan güvenli bir tampon (buffer) düşülerek
        pazaryerine gönderilen miktar hesaplanır.
      </p>
      <p>
        Tampon büyüklüğü ürünün satış hızına, tedarik süresine ve iade oranına göre ayarlanır. Hızlı
        dönen SKU&apos;larda tampon küçük tutulabilir; yavaş ve tedarik süresi uzun ürünlerde daha
        geniş tampon gerekir. Stok güncelleme sıklığı da denge gerektirir: çok seyrek güncelleme
        oversell riskini artırır, çok sık güncelleme API rate limit&apos;ine takılır. Optimal yaklaşım,
        stok değişim olaylarını (satış, iade, sayım) tetikleyici olarak kullanmak ve aynı SKU için
        ardışık güncellemeleri birleştirmektir (debounce).
      </p>
      <p>
        Kampanya dönemlerinde stok tüketimi hızlanır; bu dönemlerde tamponu geçici olarak artırmak
        veya kritik SKU&apos;larda manuel onay mekanizması devreye almak faydalıdır. Stok sıfıra
        düştüğünde ürünü otomatik pasife almak, müşteri deneyimini korur ve ceza puanı birikimini
        engeller.
      </p>

      <h2>Sipariş çekme ve fulfillment akışı</h2>
      <p>
        Yeni siparişler SP-API üzerinden listelenebilir; genellikle &quot;Created&quot; veya
        &quot;Picking&quot; statüsündeki siparişler periyodik olarak çekilir. Sipariş sisteme düştükten
        sonra ERP&apos;de satış fişi oluşturulur, depo picking listesi üretilir ve kargo etiketi
        basılır. Kargo takip numarası Trendyol&apos;a API ile bildirilmelidir; gecikme müşteri
        puanını ve satıcı skorunu düşürür.
      </p>
      <p>
        Sipariş çekme stratejisinde idempotency (aynı siparişin iki kez işlenmemesi) şarttır. Her
        sipariş için benzersiz bir iç ID kullanın ve veritabanında &quot;already processed&quot;
        kontrolü yapın. İptal edilen siparişler için stok geri yükleme akışı tanımlayın; aksi halde
        ERP stok ile pazaryeri stok arasında kalıcı sapma oluşur.
      </p>
      <p>
        Kısmi sevkiyat (split shipment) destekleniyorsa, her paket için ayrı kargo bildirimi yapın.
        İade süreçlerinde iade onayı sonrası stok otomatik geri yüklenmeli ve muhasebe kaydı
        oluşturulmalıdır. Bu uçtan uca akış, entegrasyon olmadan saatler süren manuel işleri dakikalara
        indirir.
      </p>

      <h2>Sık karşılaşılan hatalar ve çözümleri</h2>
      <p>
        <strong>401 Unauthorized:</strong> API Key veya Secret yanlış, süresi dolmuş veya IP kısıtlaması
        nedeniyle oluşur. Kimlik bilgilerini yeniden oluşturun, IP whitelist&apos;i kontrol edin.
      </p>
      <p>
        <strong>429 Too Many Requests:</strong> Rate limit aşıldı. İstekleri kuyruğa alın, exponential
        backoff uygulayın, aynı SKU için ardışık güncellemeleri birleştirin.
      </p>
      <p>
        <strong>400 Bad Request — kategori/attribute hatası:</strong> Zorunlu alan eksik veya kategori
        eşleşmesi yanlış. Trendyol kategori ağacını indirin, attribute mapping tablonuzu güncelleyin.
      </p>
      <p>
        <strong>Stok sapması:</strong> ERP ile Trendyol arasında tutarsızlık. Tampon değerini gözden
        geçirin, iade/iptal akışlarını kontrol edin, periyodik mutabakat (reconciliation) job&apos;u
        çalıştırın.
      </p>
      <p>
        <strong>Duplicate barcode:</strong> Aynı barkod farklı SKU&apos;ya atanmış. Katalog temizliği
        yapın, barkod standardizasyonu uygulayın.
      </p>
      <p>
        <strong>Webhook gecikmesi:</strong> Siparişler geç düşüyor. Polling sıklığını artırın,
        webhook endpoint&apos;inizin 200 OK döndüğünden emin olun, SSL sertifikasını kontrol edin.
      </p>

      <h2>2026 için en iyi uygulamalar</h2>
      <p>
        Birinci kural: test ve üretim ortamlarını kesin ayırın. İkinci kural: tüm API çağrılarını
        loglayın ve hata oranını izleyin. Üçüncü kural: stok için tek doğruluk kaynağı belirleyin.
        Dördüncü kural: kampanya dönemleri için ayrı playbook hazırlayın. Beşinci kural: entegrasyonu
        periyodik olarak regresyon testlerinden geçirin — Trendyol API sürümleri ve katalog kuralları
        değişebilir.
      </p>
      <p>
        <strong>Senkronize</strong> ile Trendyol SP-API entegrasyonunu tek panelden yönetebilir,
        stok-fiyat-sipariş senkronunu otomatikleştirebilir ve çok kanallı satışta aynı operasyon
        omurgasını kullanabilirsiniz. 14 gün ücretsiz deneme ile entegrasyonun işletmenize kattığı
        değeri kendi verilerinizle ölçün.
      </p>

      <h2>Sonuç</h2>
      <p>
        Trendyol mağaza entegrasyonu, doğru kurulduğunda operasyon maliyetini düşürür, hata oranını
        azaltır ve ölçeklenebilir büyüme sağlar. SP-API kurulumundan ürün yüklemeye, stok yönetiminden
        sipariş çekmeye kadar her adımı sistematik ele almak; 2026&apos;da rekabet avantajınızı
        korumanın en güvenilir yoludur.
      </p>
    </>
  );
}
