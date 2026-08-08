# Staff Dashboard — Tam Proje Denetimi

Tarih: 8 Ağustos 2026

## İncelenen kapsam

- Prisma/PostgreSQL şeması ve migration'lar
- Kimlik doğrulama, cookie, CORS, rate limit ve rol kontrolleri
- Personel, oda/yatak, ziyaretçi, arıza/bakım, temizlik, zimmet, bildirim ve personel portalı API'leri
- Yönetici, lojman amiri, güvenlik ve personel kullanıcı akışları
- Frontend sayfa erişimleri, mobil PWA ve Web Push akışı
- Backend sorgu yükü, frontend paket boyutu ve bağımlılık güvenliği

## Düzeltilen yüksek önem dereceli sorunlar

1. Gerçek Web Push altyapısı bulunmuyordu. VAPID, cihaz aboneliği, servis çalışanı push olayı ve hedefli gönderim eklendi.
2. Personel hesabı personel/yatak transaction'ından önce oluşturuluyor, başarısız kayıtta sahipsiz hesap kalıyordu. Tek transaction içine alındı.
3. Lojman amiri, istek gövdesini değiştirerek ADMIN/SECURITY hesabı oluşturabiliyordu. Yetkili rol atama yalnızca ADMIN'e sınırlandı.
4. Arıza kaydında oda seçilmezse kayıt sessizce ilk odaya bağlanıyordu. Oda seçimi zorunlu yapıldı.
5. Oda silme veya kapasite düşürme geçmiş konaklama kayıtlarını cascade ile silebiliyordu. Denetim geçmişi olan yatak/oda işlemleri engellendi.
6. Cookie ile yapılan durum değişikliklerinde cross-origin istek koruması eksikti. Origin guard eklendi.
7. Güvenlik rolü yetkisiz personel ve bildirim ekranlarını görüyordu. Menü ve sayfa guard'ları role göre sınırlandı; detay API'si kapatıldı.

## Veri bütünlüğü ve süreç düzeltmeleri

- Oda numarası, kat, kapasite ve blok yerleşim politikası backend'de doğrulanıyor.
- Temizlik durumları yalnızca `NEEDS_CLEANING`, `IN_PROGRESS`, `CLEANED` kabul ediyor.
- Geçersiz oda durumu servis katmanında da reddediliyor.
- Bildirim hedef kullanıcıları aktif hesaplarla doğrulanıyor; “tümü” yalnızca aktif personeli kapsıyor.
- Bildirim başlığı ve mesaj boyutları sınırlandı.
- Güçsüz `Math.random()` parola üretimi kriptografik güvenli üretimle değiştirildi.
- Özel parola ve kullanıcı adı kuralları backend'de uygulanıyor.
- Süresi dolmuş push abonelikleri otomatik temizleniyor.
- Mobil portal yanıtındaki gereksiz ilişkiler kaldırıldı.

## Performans

- Personel liste sorgusundan tüm zimmetler, disiplin kayıtları ve tam konaklama geçmişi çıkarıldı. Detay yalnızca açıldığında yükleniyor.
- Bildirim listeleri son 100 kayıtla sınırlandı.
- Frontend sayfaları lazy-load parçalara ayrıldı.
- İlk JavaScript paketi yaklaşık 644 KB'dan 208 KB'a, gzip boyutu yaklaşık 146 KB'dan 69 KB'a düştü.
- Sayfa modülleri yalnızca kullanıcı ilgili ekrana geçtiğinde yükleniyor.

## Doğrulamalar

- Backend TypeScript derlemesi: başarılı
- Frontend TypeScript ve production derlemesi: başarılı
- Backend production bağımlılık taraması: 0 bilinen açık
- Frontend production bağımlılık taraması: 0 bilinen açık
- Prisma şeması yerel veritabanına uygulandı
- Yatak doluluk bayrağı/personel ilişkisi tutarsızlığı: 0
- Yataksız `RESIDENT` personel: 0
- Yataksız açık konaklama kaydı: 0
- Aynı oda için birden fazla aktif temizlik işi: 0

## Üretim notları

- Web Push ve PWA için HTTPS zorunludur.
- Üretimde ayrı ve kalıcı VAPID anahtarları kullanılmalıdır.
- Mevcut veritabanı migration geçmişi baseline edilmeden kurulmuş. Yerel şema veri kaybı olmadan senkronize edildi; production dağıtımından önce Prisma migration baseline işlemi yapılmalıdır.
- Çok yüksek bildirim hacminde push gönderimi için kalıcı kuyruk/worker önerilir.
- Otomatik taramalar riski ciddi ölçüde azaltır ancak hiçbir sistem için mutlak “sıfır açık” garantisi verilemez; production log izleme, yedekleme ve periyodik bağımlılık taraması sürdürülmelidir.
