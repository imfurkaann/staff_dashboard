# Depo ve Stok Yönetimi – Canlı Çalışma ve Doğrulama Notları

## Stok kartı ve hareket geçmişi

- Her stok kartı açılış hareketiyle başlar; başlangıç miktarı sıfır olsa bile denetlenebilir bir kayıt oluşur. Mal kabul, oda/personel zimmeti, iade, transfer, cihaz değişimi, fiziksel sayım ve kart değişiklikleri aynı kalıcı hareket defterine yazılır.
- Ürün geçmişi artık özet ekrandaki son kayıtlarla sınırlı değildir. Sunucu tarafında ürün, hareket türü, başlangıç/bitiş tarihi ve serbest metinle filtrelenir; 50 kayıtlık sayfalarda eksiksiz gezilebilir.
- Arama; stok kodu/adı, oda, personel, seri numarası, açıklama, not ve işlemi yapan kullanıcı alanlarını kapsar. Tarihler İstanbul saat diliminde gün sınırlarıyla uygulanır.
- Stok kartı adı, kodu, birimi veya fiziksel durumu değiştirildiğinde önceki ve sonraki değerler ile işlemi yapan kullanıcı hareket geçmişine kaydedilir.

## Stok doğruluğu ve bağlı süreçler

- Oda ve personel zimmetleri, stok hareketleri ve karttaki toplam/mevcut miktarlar tek veritabanı işlemi içinde güncellenir. İade, oda transferi, seri/marka düzeltmesi ve cihaz değişimi eski kayıt sürümü üzerinden çakışmaya karşı korunur.
- Aynı seri numarası aktif oda veya personel zimmetinde ikinci kez kullanılamaz. Oda, personel, arıza ve stok kartı bağlantılarının birbiriyle eşleşmesi doğrulanır.
- Fiziksel sayım farkı varsa açıklama zorunludur. Kullanılabilir stoğu aşan zimmet, negatif stok, açık zimmeti bulunan kartın hurdaya alınması ve bakiye varken kartın hurda yapılması engellenir.
- Arıza nedeniyle cihaz değişiminde eski zimmet kapatılır, yeni cihaz aynı odaya atanır, ilgili arıza kaydıyla bağlantılı hareket üretilir ve stok miktarı atomik olarak güncellenir.
- Ortak ekipman ve ortak kullanım türlerindeki oda demirbaşları, stok kartı değişiklikleriyle birlikte güncel tutulur.

## Güvenlik ve hata önleme

- Kimlikler, istek gövdeleri, enum değerleri, stok kodu biçimi, metin uzunlukları, miktarlar ve sayfalama parametreleri sunucuda doğrulanır. Bozuk veya dizi biçimindeki istek gövdeleri kontrollü hata üretir.
- Değişiklik istekleri kullanıcı bazlı hız sınırına tabidir. UUID tekrar-gönderim anahtarı; çift tıklama, ağ zaman aşımı ve manuel yeniden denemelerde ikinci kart, hareket veya zimmet oluşmasını önler.
- Kod üretimi ve stok işlemleri eşzamanlı isteklerde kilit/koşullu güncelleme ile korunur. Veritabanı kısıtları negatif miktarı, geçersiz tür/birim/durum değerlerini ve hareket yönü hatalarını uygulamadan bağımsız olarak reddeder.
- Excel çıktılarındaki kullanıcı metinleri formül enjeksiyonuna karşı güvenli hale getirilmiştir. Dışa aktarma ve özet yükü yapılandırılabilir üst sınırlarla korunur.
- Stok kartı ve hareketlerde oluşturan/işlemi yapan kullanıcı ilişkisel olarak saklanır. Kullanıcıdan gönderilen aktör bilgisine güvenilmez.

## Kullanıcı ekranı

- Stok modalları daha geniş, kaydırılabilir ve açıklayıcı hale getirildi. Kart, mal kabul, sayım, zimmet, iade, transfer, kimlik düzeltme ve cihaz değişimi işlemlerinde işlemin stok ve geçmiş üzerindeki etkisi gösterilir.
- Fiziksel sayım farkı için açıklama girilmeden kayıt düğmesi etkinleşmez. Uzun alanlar için sınırlar kullanıcıya yansıtılır.
- Ürün detayında son 20 hareket hızlıca gösterilir; tek düğmeyle o ürüne ait tam ve filtrelenebilir hareket geçmişine geçilir.

## Canlı doğrulama

- `verifyStockProduction.js` yalnızca `ALLOW_STOCK_PRODUCTION_TEST=1` ile çalışır. Geçici stok/oda verileriyle kart açma, mal kabul, oda zimmeti, seri tekrarı, transfer, kimlik düzeltme, fiziksel sayım, kart denetimi, hurda koruması, hareket filtreleri ve iadeyi sınar; verileri her durumda temizler.
- `verifyStockIntegrity.js` mevcut veriyi değiştirmeden 14 tutarlılık kuralını tarar. Negatif ve önbellek uyuşmazlıkları, geçersiz iadeler, seri tekrarları, bağlantı uyuşmazlıkları, eksik hareketler, hareket yönleri, boş anlık görüntüler ve defter toplamlarını denetler.
- 11 Ağustos 2026 doğrulaması: 44 backend testi geçti; backend/frontend üretim derlemeleri geçti; stok uçtan uca testindeki 19 kontrol geçti; 14 veri bütünlüğü sorgusunun tamamı sıfır sonuç verdi; migration başarıyla uygulandı.

