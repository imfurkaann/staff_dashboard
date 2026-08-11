# Ziyaretçi Yönetimi — İşleyiş ve Canlı Operasyon Notları

## Kayıt oluşturma

- Ziyaretçi adı, kişi sayısı ve ziyaret amacı zorunludur.
- Telefon, firma, araç plakası, not ve ziyaret edilen personel isteğe bağlıdır.
- Malzeme teslimatı, servis, kargo veya genel alan ziyareti için personel seçmeden kayıt açılabilir. Bu kayıtlar arayüzde **Bağımsız giriş** olarak gösterilir.
- Personel seçilecekse yalnızca halen dolu bir yatağa atanmış oda sakini seçilebilir. Arayüz sadece bu kişilerin adını, departmanını ve oda etiketini alır; personelin hassas bilgileri ziyaretçi ekranına taşınmaz.
- Her oluşturma isteği benzersiz bir istek anahtarı taşır. Aynı ağ isteğinin tekrarlanması ikinci kayıt oluşturmaz.
- Aynı adla beraber aynı telefon veya aynı plaka için halen açık bir ziyaret varsa yeni kayıt reddedilir.

## Personel ve oda bağlantısı

- `Visitor.hostEmployeeId`, ziyaretçi kaydını seçilen `Employee` kaydına isteğe bağlı bağlar.
- Kayıt anındaki personel adı `hostEmployeeName`, oda/blok/yatak bilgisi `hostRoomLabel` alanına ayrıca kopyalanır.
- Personel daha sonra oda değiştirirse veya sistemden ayrılırsa geçmiş ziyaretin kayıt anındaki adı ve oda bilgisi korunur.
- Düzenleme sırasında personel bağlantısı değiştirilebilir veya tamamen temizlenebilir.

## Giriş, çıkış ve arşiv

- Yeni kayıt `INSIDE` durumunda ve çıkış zamanı boş olarak açılır.
- Çıkış işlemi durumu `EXITED` yapar ve çıkış zamanını sunucu saatinden kaydeder.
- Yanlış çıkış işlemi yalnızca 30 dakika içinde geri alınabilir. Daha eski bir dönüş için yeni giriş açılır; böylece tarihsel bir ziyaret yanlışlıkla yeniden aktif hale getirilemez.
- İçeride görünen bir kayıt arşivlenirse önce otomatik olarak çıkışı yapılır. Geri yüklenen arşiv kaydı yeniden içeride sayılmaz.
- 24 saati aşan açık ziyaretler yönetim ekranında operasyon uyarısı üretir.

## Yetkiler

- `VISITOR_VIEW`: aktif ziyaret kayıtlarını ve geçmişini görüntüler.
- `VISITOR_MANAGE`: yeni giriş, düzenleme, çıkış ve kısa süreli çıkış geri alma işlemlerini yapar.
- `VISITOR_ARCHIVE`: arşivleme, geri yükleme ve silinmiş kayıtları görüntüleme yetkisidir.
- `VISITOR_EXPORT`: Excel raporu oluşturur.
- Arşiv kayıtları ve arşiv sayıları, arşiv yetkisi olmayan kullanıcılara API üzerinden verilmez.

## Güvenlik ve veri bütünlüğü

- Durum, giriş/çıkış zamanı, silinme alanları ve işlem yapan kullanıcı kimlikleri istemci tarafından değiştirilemez.
- Kimlik veya pasaport numarası ziyaretçi kaydında tutulmaz.
- Metin uzunlukları, telefon biçimi, kişi sayısı, UUID değerleri, tarih aralıkları, sayfalama ve sıralama sunucuda doğrulanır.
- Değişiklik işlemleri kullanıcı bazlı hız sınırına tabidir.
- Liste ve detay yanıtları `private, no-store` olarak döner; paylaşılan tarayıcı önbelleğinde tutulmaz.
- Excel hücreleri formül çalıştırmaya karşı güvenli metne dönüştürülür.
- Oluşturan, son güncelleyen ve arşivleyen kullanıcı bağlantıları denetim amacıyla saklanır.

## Canlı operasyon kontrolü

1. Vardiya başında **Şu An İçeride** listesi kontrol edilir.
2. 24 saat uyarısı varsa fiziksel durum doğrulanır ve eksik çıkış tamamlanır.
3. Teslimat/kargo girişlerinde amaç ve mümkünse firma/plaka yazılır; personel seçmek zorunlu değildir.
4. Aynı ziyaretçinin açık kaydı varsa yeni giriş açmak yerine mevcut kaydın durumu kontrol edilir.
5. Arşiv, hatalı kaydı görünür listeden kaldırır; denetim geçmişini silmez.
