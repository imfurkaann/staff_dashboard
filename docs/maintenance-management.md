# Arıza Yönetimi – Canlı Çalışma ve Doğrulama Notları

## Bağlantılı süreçler

- Arıza kaydı her zaman mevcut bir odaya bağlıdır. Genel oda arızası ile oda demirbaşı arızası ayrı türlerdir.
- Demirbaş arızasında seçilen zimmetin aktif ve aynı odaya ait olması zorunludur. Arıza durumu oda zimmetine, stok hareket geçmişine ve arıza olay günlüğüne birlikte yazılır.
- Kayıp/zayi işlemi yalnızca yetkili yönetici tarafından yeni kayıt sırasında yapılabilir; oda zimmetini kapatır ve toplam stoğu düşürür. Mevcut arıza düzenleme ekranından kayıp/hurda işlemi yapılamaz.
- Cihaz değişimi depo yönetimindeki kontrollü değişim akışından yapılır. Eski zimmet emekliye ayrılır, yeni cihaz odaya bağlanır, stok hareketi arızaya bağlanır ve aktif arıza çözülür.
- Yüksek veya acil açık arıza odayı otomatik olarak kullanım dışına alır. Arıza sonuçlandıktan sonra oda bilinçli bir kontrolle ayrıca kullanıma alınır.

## Durum ve servis kuralları

- Açık/işlemde arıza çözüm tarihi taşıyamaz; çözüldü/kapatıldı kayıt çözüm tarihi, çözüm notu ve çözümleyen personel olmadan saklanamaz.
- Servise gönderilmiş cihaz, servisten dönüş tarihi olmadan çözülemez veya kapatılamaz. Dönüş tarihi gönderim tarihinden önce olamaz.
- Teknik personel aktif kayıtları işleyebilir fakat sonuçlanmış kaydı yeniden açamaz/değiştiremez. Yeniden açma ve servis/maliyet alanlarının yönetimi tam güncelleme yetkisi gerektirir.
- Sonuçlanan demirbaş arızası cihazı sağlam duruma getirir. Yeniden açılan kayıt cihazı tekrar bakım gerekli durumuna alır.
- Aynı oda demirbaşı için yalnızca bir aktif arıza bulunabilir. Eşzamanlı güncellemeler iyimser kilit ve seri işlemle korunur; çakışma kullanıcıya yeniden deneme mesajıyla döner.

## Güvenlik ve denetim

- Oluşturan, son güncelleyen ve olay işlemini yapan kullanıcı kimlikleri güvenilir oturum bilgisinden ilişkisel olarak kaydedilir; ekranda kullanıcının adıyla geçmiş kayıt uydurulmaz.
- Maliyet alanları yalnızca tam güncelleme yetkisi olan rollere döndürülür. Listeleme varsayılan 25, en fazla 100 kayıtla sayfalanır; olay geçmişi kayıt başına sınırlandırılır.
- Oluşturma istekleri UUID tekrar-gönderim anahtarıyla tekilleştirilir. Çift tıklama veya ağ yeniden denemesi ikinci arıza, stok hareketi ya da olay oluşturmaz; anahtar başka kullanıcının kaydını döndüremez.
- Kimlikler, enum değerleri, metin uzunlukları, negatif maliyetler ve bozuk istek gövdeleri sunucuda doğrulanır. Excel hücreleri formül enjeksiyonuna karşı güvenli hale getirilir.
- Veritabanı kısıtları durum/çözüm, servis dönüşü, demirbaş arıza durumu ve denetim aktörü kurallarını uygulama kodundan bağımsız olarak korur.

## Canlı doğrulama

- `verifyMaintenanceProduction.js` yalnızca `ALLOW_MAINTENANCE_PRODUCTION_TEST=1` ile çalışır. Benzersiz geçici blok, oda, stok ve zimmetlerle tekrar-gönderim, yüksek öncelik, denetim ilişkileri, veritabanı kısıtı, çift aktif arıza, servis gönderim/dönüş, çözme, yetkisiz yeniden açma, yetkili yeniden açma ve cihaz değişimini sınar. Oluşturduğu verileri her durumda temizler.
- `verifyMaintenanceIntegrity.js` mevcut veriyi değiştirmeden 13 tutarlılık kuralını tarar ve herhangi bir ihlalde başarısız olur.
- 11 Ağustos 2026 doğrulaması: 41 backend testi geçti; backend/frontend üretim derlemeleri geçti; uçtan uca 18 kontrol geçti; 13 veri tutarlılığı sorgusunun tamamı sıfır sonuç verdi; üretim bağımlılık taramalarında bilinen güvenlik açığı bulunmadı; PostgreSQL migration durumu güncel; veritabanı, backend ve frontend konteynerleri sağlıklı.
