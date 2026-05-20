import type { ReactElement } from 'react';

/** ~1500 kelime — ERP entegrasyonu nedir rehberi */
export function ErpEntegrasyonNedirBody(): ReactElement {
  return (
    <>
      <p>
        E-ticaret hacmi büyüdükçe sipariş, stok, fatura ve muhasebe verileri farklı sistemlerde
        parçalanır. <strong>ERP entegrasyonu</strong>, bu sistemleri birbirine bağlayarak veri
        akışını otomatikleştiren köprüdür. Bu yazıda ERP&apos;nin tanımını, pazaryeri-ERP bağlantısının
        neden kritik olduğunu, <strong>Logo</strong>, <strong>Mikro</strong> ve{' '}
        <strong>BizimHesap</strong> karşılaştırmasını ve ROI analizini ele alıyoruz.
      </p>

      <h2>ERP nedir?</h2>
      <p>
        ERP (Enterprise Resource Planning — Kurumsal Kaynak Planlama), bir işletmenin finans,
        muhasebe, stok, satın alma, üretim ve insan kaynakları gibi temel süreçlerini tek bir
        yazılım platformunda birleştiren sistemdir. Türkiye&apos;de KOBİ&apos;lerin büyük kısmı Logo,
        Mikro, Netsis veya BizimHesap gibi yerel ERP çözümlerini kullanır. ERP&apos;nin temel vaadi
        &quot;tek doğruluk kaynağı&quot;dır: stok miktarı, cari bakiye ve satış verileri tek bir
        veritabanında tutulur.
      </p>
      <p>
        Ancak ERP tek başına e-ticaret kanallarını yönetmez. Trendyol, Hepsiburada veya kendi
        e-ticaret sitenizdeki siparişler ERP&apos;ye manuel girildiğinde gecikme, hata ve ölçek
        sorunları ortaya çıkar. İşte bu noktada <strong>pazaryeri-ERP köprüsü</strong> devreye girer.
      </p>

      <h2>Pazaryeri-ERP köprüsü neden kritik?</h2>
      <p>
        Entegrasyon olmadan tipik bir gün şöyle geçer: sabah Trendyol panelinden siparişler
        indirilir, Excel&apos;e aktarılır, ERP&apos;ye manuel girilir, stok panelden güncellenir,
        fatura kesilir, kargo etiketi basılır. Her adımda insan hatası riski vardır ve süreç saatler
        alır. Sipariş hacmi arttıkça bu model çöker.
      </p>
      <p>
        Pazaryeri-ERP köprüsü ile siparişler otomatik ERP&apos;ye düşer, stok otomatik güncellenir,
        fatura otomatik kesilir ve kargo bilgisi pazaryerine geri bildirilir. Bu uçtan uca otomasyon:
      </p>
      <ul>
        <li>Operasyon saatlerini %60-80 oranında azaltır</li>
        <li>Veri giriş hatalarını minimize eder</li>
        <li>Stok doğruluğunu artırarak oversell riskini düşürür</li>
        <li>Finansal raporlamayı gerçek zamanlıya yaklaştırır</li>
        <li>Ölçeklenebilir büyüme altyapısı sağlar</li>
      </ul>
      <p>
        2026&apos;da çok kanallı satış yapan işletmeler için ERP entegrasyonu lüks değil, zorunluluktur.
      </p>

      <h2>Logo, Mikro ve BizimHesap karşılaştırması</h2>
      <p>
        Türkiye&apos;de e-ticaret entegrasyonu en çok talep gören üç ERP ailesi Logo, Mikro ve
        BizimHesap&apos;tır. Her birinin güçlü ve zayıf yönleri farklıdır; seçim işletmenizin
        büyüklüğüne, sektörüne ve mevcut altyapısına bağlıdır.
      </p>

      <h3>Logo ERP</h3>
      <p>
        Logo, orta ve büyük ölçekli işletmelerde yaygın kullanılan, modüler bir ERP&apos;dir. Stok,
        muhasebe, üretim ve CRM modülleri güçlüdür. E-ticaret entegrasyonu için Logo&apos;nun REST
        API veya SQL tabanlı bağlantı seçenekleri mevcuttur. Avantajları: olgun ekosistem, geniş
        muhasebeci/integrator ağı, detaylı raporlama. Dezavantajları: lisans maliyeti yüksek olabilir,
        kurulum ve özelleştirme süresi uzundur. E-ticaret hacmi aylık 1000+ sipariş olan işletmeler
        için genellikle uygun bir seçimdir.
      </p>

      <h3>Mikro ERP</h3>
      <p>
        Mikro, KOBİ segmentinde güçlü bir alternatiftir. Kullanım kolaylığı ve uygun fiyat
        avantajlarıyla öne çıkar. Stok ve muhasebe modülleri e-ticaret ihtiyaçlarını karşılar;
        ancak çok kanallı senkronizasyon için ek entegrasyon katmanı (Senkronize gibi) gerekebilir.
        Mikro&apos;nun API desteği sürüme göre değişir; entegrasyon öncesi sürüm uyumluluğunu
        doğrulayın. Avantajları: düşük giriş maliyeti, hızlı devreye alma, yerel destek. Dezavantajları:
        büyük hacimlerde performans sınırları, sınırlı çok kanallı destek.
      </p>

      <h3>BizimHesap</h3>
      <p>
        BizimHesap, bulut tabanlı muhasebe ve e-fatura odaklı bir çözümdür. Mikro işletmeler ve
        yeni başlayan e-ticaret satıcıları için erişilebilir bir giriş noktasıdır. Stok takibi ve
        e-fatura entegrasyonu güçlüdür; ancak karmaşık depo yönetimi veya çok kanallı otomasyon
        ihtiyaçlarında sınırlı kalabilir. Avantajları: bulut erişimi, düşük maliyet, kolay e-fatura.
        Dezavantajları: gelişmiş WMS ihtiyaçları, yüksek sipariş hacmi senaryoları.
      </p>

      <h3>Karşılaştırma tablosu (özet)</h3>
      <p>
        <strong>Hedef kitle:</strong> Logo → orta/büyük; Mikro → KOBİ; BizimHesap → mikro/yeni
        başlayan. <strong>Maliyet:</strong> Logo yüksek, Mikro orta, BizimHesap düşük.{' '}
        <strong>E-ticaret olgunluğu:</strong> Logo en olgun, Mikro orta, BizimHesap temel.{' '}
        <strong>Entegrasyon kolaylığı:</strong> Üçü de Senkronize üzerinden bağlanabilir; Logo
        ve Mikro doğrudan API/SQL, BizimHesap API ile.
      </p>

      <h2>Entegrasyon mimarisi: nasıl çalışır?</h2>
      <p>
        Tipik bir pazaryeri-ERP entegrasyon mimarisi üç katmandan oluşur. Birinci katman: pazaryeri
        API&apos;leri (Trendyol SP-API, Hepsiburada API vb.). İkinci katman: entegrasyon platformu
        (Senkronize) — stok, fiyat, sipariş akışlarını yönetir, kuyruk ve yeniden deneme sağlar.
        Üçüncü katman: ERP sistemi — muhasebe, stok ve fatura kayıtlarının kalıcı deposu.
      </p>
      <p>
        Veri akışı şöyledir: pazaryerinden yeni sipariş gelir → entegrasyon platformu siparişi
        normalize eder → ERP&apos;de satış fişi oluşturulur → stok düşülür → fatura kesilir → kargo
        bilgisi pazaryerine geri bildirilir. Ters yönde: ERP&apos;de stok değişir → entegrasyon
        platformu tüm pazaryerlerine güncelleme gönderir.
      </p>

      <h2>ROI analizi: entegrasyon ne kadar kazandırır?</h2>
      <p>
        ERP entegrasyonunun yatırım getirisini hesaplarken dört bileşeni ele alın: tasarruf edilen
        operasyon saatleri, azalan hata maliyeti, kaçırılmayan satış fırsatları ve ölçek
        verimliliği.
      </p>
      <p>
        <strong>Operasyon saatleri:</strong> Manuel sipariş girişi ortalama 3-5 dakika/sipariş sürer.
        Günde 100 siparişte bu 5-8 saat demektir. Otomasyonla bu süre dakikalara iner; aylık 150+
        saat tasarruf mümkündür.
      </p>
      <p>
        <strong>Hata maliyeti:</strong> Yanlış stok, çift fatura, geciken kargo bildirimi gibi
        hataların her biri müşteri kaybı ve platform cezası doğurur. Entegrasyon hata oranını
        %90+ azaltabilir.
      </p>
      <p>
        <strong>Kaçırılmayan satış:</strong> Stok doğruluğu arttıkça oversell azalır; iptal edilen
        siparişler yerine gerçek satışlar gerçekleşir. Ayrıca BuyBox görünürlüğü stok disipliniyle
        artar.
      </p>
      <p>
        <strong>Ölçek verimliliği:</strong> Entegrasyon olmadan sipariş hacmi 2 katına çıktığında
        operasyon ekibi de 2 katına çıkmak zorunda kalır. Entegrasyonla aynı ekip 5-10 kat hacim
        yönetebilir.
      </p>
      <p>
        Örnek ROI hesabı: aylık 2000 sipariş, 2 operasyon personeli (toplam 30.000 TL maaş),
        entegrasyon maliyeti 2.000 TL/ay. Tasarruf: 1 personel equivalent (~15.000 TL) + hata
        azaltma (~3.000 TL) + ek satış (~5.000 TL) = ~23.000 TL/ay. Net kazanç: ~21.000 TL/ay;
        yatırım 1. ay içinde kendini amorti eder.
      </p>

      <h2>Entegrasyon projesinde dikkat edilecekler</h2>
      <p>
        Birinci adım: mevcut süreçlerinizi haritalayın (as-is). Hangi veriler nereden nereye
        akıyor, hangi adımlar manuel, hangi hatalar sık tekrarlanıyor? İkinci adım: hedef mimariyi
        tasarlayın (to-be). Üçüncü adım: pilot kanal ile başlayın — örneğin yalnızca Trendyol +
        Logo. Dördüncü adım: test ortamında mutabakat (reconciliation) job&apos;u çalıştırın.
        Beşinci adım: üretime geçin ve ilk 30 gün yakın izleme yapın.
      </p>
      <p>
        Veri eşleştirme (mapping) kritiktir: pazaryeri SKU&apos;su ile ERP stok kodu, birim
        dönüşümleri, KDV oranları ve cari hesap eşleştirmeleri doğru yapılmazsa entegrasyon
        anlamsız hatalar üretir. Bu mapping tablosunu proje başında oluşturun ve katalog
        değişikliklerinde güncelleyin.
      </p>

      <h2>Senkronize ile ERP entegrasyonunu kolaylaştırın</h2>
      <p>
        <strong>Senkronize</strong>, Logo, Mikro, BizimHesap ve daha fazla ERP ile hazır
        bağlantılar sunar. Pazaryeri siparişleri otomatik ERP&apos;ye düşer, stok tek kaynaktan
        tüm kanallara yansır, e-fatura ve kargo süreçleri otomatikleşir. Tauri tabanlı masaüstü
        ajan ile yerel ERP&apos;ye doğrudan köprü de mümkündür. 14 gün ücretsiz deneme ile ROI&apos;yi
        kendi verilerinizle ölçün.
      </p>

      <h2>Sonuç</h2>
      <p>
        ERP entegrasyonu, e-ticarette büyümenin omurgasıdır. Manuel süreçler ölçeklenmez; otomasyon
        ise operasyon maliyetini düşürür, hata oranını azaltır ve gerçek zamanlı karar almayı
        mümkün kılar. Logo, Mikro veya BizimHesap — hangi ERP&apos;yi kullanırsanız kullanın,
        pazaryeri köprüsü olmadan çok kanallı satış sürdürülebilir değildir. Bugün entegrasyon
        yatırımı yapmak, yarının büyüme kapasitesini inşa etmektir.
      </p>
    </>
  );
}
