# Ortak Eşya Yönetimi – Canlı Çalışma ve Doğrulama Notları

## Veri kaynağı ve bağlantılı süreçler

- Her ortak eşya, tekil ve aktif bir depo stok kartına ilişkisel olarak bağlıdır. Ad veya kod benzerliğiyle tahmini eşleştirme yapılmaz.
- Takip edilen ortak eşyalar her fiziksel cihaz için ayrı stok kartında 1 adet olarak açılır. Yeni cihaz depo girişiyle aynı karta eklenmez; ayrı kart ve ayrı geçmiş oluşturulur.
- Personel zimmeti ortak eşya, personel envanteri, stok bakiyesi, stok hareketi ve ortak eşya geçmişini tek veritabanı işlemi içinde günceller.
- Oda zimmeti aynı şekilde oda envanterine bağlanır. Oda transferi, iade, cihaz kimliği düzeltmesi ve arıza nedeniyle cihaz değişimi ortak eşya kaydına otomatik yansır.
- Başka bir sayfadan yapılan personel/oda zimmeti ve iadesi de ortak eşya durumunu eşitler. Böylece bir cihaz aynı anda farklı sayfalarda farklı kişiye veya odaya zimmetli görünemez.

## Durum ve zimmet kuralları

- Yalnızca `AVAILABLE` durumundaki ve stokta gerçekten müsait olan eşya zimmetlenebilir. Hedef türü personel, oda veya harici kişi/kurum olarak açıkça seçilir.
- Personel hedefinde aktif personel; oda hedefinde mevcut oda zorunludur. Harici teslimde kişi/kurum adı zorunludur. Beklenen iade tarihi geçmiş olamaz.
- Teslim alma yalnızca aktif zimmette yapılabilir ve açıklama zorunludur. Bağlı personel/oda zimmeti kapatılmadan ortak eşya müsait duruma geçemez.
- Zimmetli eşya doğrudan bakıma veya hurdaya geçirilemez. Önce teslim alınır; fiziksel kontrol sonucu müsait veya bakımda durumu seçilir.
- Bakım başlangıcı yalnızca müsait eşyada, bakım/onarım tamamlaması yalnızca bakımda eşyada çalışır. Hurda kayıt yeniden kullanıma açılamaz.
- Hurdaya ayırma ortak eşya ile stok toplamını birlikte düşürür ve kalıcı stok hareketi oluşturur.

## Geçmiş, filtre ve denetim

- Kayıt açma, zimmet, iade, bakım, arıza, onarım, durum, oda transferi ve cihaz kimliği değişikliklerinin tamamı aktör ve anlık eşya bilgileriyle kaydedilir.
- Tam geçmiş son 20/100 kayıtla sınırlı değildir. Kod, eşya adı, teslim alan, açıklama ve yetkili metni; işlem türü, hedef türü ve tarih aralığı sunucu tarafında filtrelenir.
- Sonuçlar 50 kayıtlık sayfalarda gösterilir. Ürün detayında ilgili eşyanın ilk 50 güncel hareketi ayrı olarak yüklenir.
- Aynı eşya için birden fazla açık zimmet geçmişi veritabanı tarafından engellenir. Beklenen iade ve teslim tarihleri veriliş tarihinden önce olamaz.

## Güvenlik ve canlı dayanıklılığı

- Kimlikler, istek gövdeleri, durum/işlem/hedef değerleri, tarihler, sayfalama ve metin uzunlukları sunucuda doğrulanır.
- Mutasyonlar kullanıcı bazlı hız sınırına tabidir. UUID tekrar-gönderim anahtarı çift tıklama ve ağ tekrarında ikinci zimmet, iade veya bakım kaydı oluşmasını engeller.
- Durum değişiklikleri iyimser kilit ve seri veritabanı işlemleriyle eşzamanlı kullanıma karşı korunur.
- Salt görüntüleme yetkisine sahip personel portalına personel listesi, oda listesi, zimmet sahibi kimliği, notlar ve işlem geçmişi döndürülmez. Portal yalnızca eşya adı ve genel uygunluk durumunu görür.
- Eşya kodu, aktif seri numarası, stok bağlantısı, aktif personel/oda zimmet bağlantısı ve tekrar-gönderim anahtarları benzersizdir.

## Kullanıcı ekranı

- Modallar daha büyük ve açıklayıcı hale getirildi. İşlemin stok, oda/personel zimmeti ve geçmiş üzerindeki etkisi kullanıcıya gösterilir.
- Personel, oda ve harici teslim hedefleri ayrı alanlarla seçilir; ilgisiz alanların birlikte gönderilmesi sunucuda kabul edilmez.
- Ana liste her fiziksel eşya için tek satır gösterir. Eski zimmetler ana listeyi çoğaltmaz; tüm geçmiş ayrı filtrelenebilir tabloda bulunur.
- İade açıklaması ve bakım/arıza ayrıntısı zorunludur; kullanıcıya fiziksel kontrol ve işlem sonucu açıkça anlatılır.

## Canlı doğrulama

- `verifySharedAssetProduction.js` yalnızca `ALLOW_SHARED_ASSET_PRODUCTION_TEST=1` ile çalışır. Geçici stok, personel, blok ve odalarla kart bağlantısı, tekrar-gönderim, personel zimmeti/iadesi, oda zimmeti/transferi/iadesi, bakım/arıza ve geçmiş filtrelerini sınar; oluşturduğu verileri her durumda temizler.
- `verifySharedAssetIntegrity.js` mevcut veriyi değiştirmeden 13 bağlantı ve tutarlılık kuralını tarar. Stok bağlantıları, durum/zimmet alanları, oda/personel envanteri, açık geçmiş, fiziksel durum, stok hareketi, tarihler ve geçici test kalıntıları denetlenir.
- Eski canlı veride tespit edilen oda/personel çakışması ve hurda/müsait durum uyuşmazlığı migration sırasında stok ve aktif zimmet kayıtları kaynak kabul edilerek düzeltildi.
