# Kullanıcı ve Rol Yönetimi — Üretim Rehberi

## Yetki kaynağı

Backend `src/security/permissions.ts` dosyasındaki matris nihai yetki kaynağıdır. Arayüzdeki Rol Yetkileri paneli bu matrisi `/api/users/roles` üzerinden canlı olarak gösterir. Frontend kontrolleri yalnızca kullanıcı deneyimi içindir; bütün API uçları backend izin kontrolünden geçer.

`ADMIN` ve `HOUSING_MANAGER` kullanıcı/rol yönetebilir. Diğer roller bu sayfayı göremez ve `/api/users` uçlarına erişemez.

## Hesap yaşam döngüsü

- Yönetim hesabı Kullanıcı & Roller ekranından oluşturulur; `STAFF` burada oluşturulamaz.
- `STAFF` hesabı yalnızca Personel Yönetimi üzerinden bir `Employee` kaydına bağlı oluşturulur.
- Personele bağlı hesabın rolü `STAFF` olarak kilitlidir. Ayrılma veya personel arşivleme hesabı kapatır; yeniden yerleştirme hesabı yeniden etkinleştirebilir.
- Hesaplar fiziksel olarak silinmez. Kapatma, rol değişikliği, parola yenileme ve parola değiştirme denetim kaydı üretir.
- Personel arşivleme/oda çıkışıyla otomatik hesap kapatma ve yeniden yerleştirmeyle hesap açma işlemleri de aynı denetim geçmişine yazılır.
- Yönetici tarafından verilen bütün parolalar geçicidir. Kullanıcı başka modüle erişmeden parolasını değiştirmek zorundadır.
- Daha önce repoda ortak test parolaları bulunduğu için migration mevcut bütün aktif hesapları da bir defalık parola değişimine zorlar.
- Yönetici kendi rolünü düşüremez, kendi hesabını kapatamaz ve kendi parolasını yönetici sıfırlamasıyla değiştiremez.
- Son aktif `ADMIN`/`HOUSING_MANAGER` hesabı kapatılamaz veya düşük role alınamaz. Kontrol seri hale getirilmiş veritabanı işlemiyle eşzamanlı isteklere karşı korunur.

## Sayfa özellikleri

- Sunucu taraflı ad, kullanıcı adı, e-posta ve sicil araması
- Rol ve hesap durumu filtresi; 25 kayıtlık sayfalama
- Personel kaydına doğrudan geçiş
- Hesap, son giriş, oluşturma ve güncelleme zamanları
- İlk giriş parola değişimi durumu
- Son 50 kullanıcı denetim kaydı ve işlemi yapan hesap
- Kritik kapatma/ayrıcalıklı rol değişikliklerinde ikinci onay
- Kendi hesabında mevcut parola doğrulamasıyla güvenli parola değiştirme ve zorunlu yeniden giriş
- Sunucunun uyguladığı rol açıklamaları ve izin matrisi

## Canlıya çıkış kontrolü

1. `npx prisma migrate deploy` ile migration'ları uygulayın.
2. Backend ve frontend üretim derlemelerini tamamlayın.
3. Backend testlerini çalıştırın.
4. `npm run users:verify` ile rol–personel bağlantılarını ve aktif yönetici varlığını doğrulayın.
5. `npm audit --omit=dev` sonuçlarında yüksek/kritik açık olmadığını doğrulayın.
6. Daha önce `test_accounts.txt` içinde paylaşılmış bütün parolaları ifşa olmuş kabul ederek değiştirin.
7. `ADMIN_PASSWORD` değerini ilk seed işleminden sonra deploy ortamından kaldırın.
8. Production ortamında yalnızca HTTPS origin kullanın; farklı `JWT_SECRET`, `COOKIE_SECRET` ve `DATA_ENCRYPTION_KEY` değerleri tanımlayın.

Parola değişimi bekleyen hesap sayısı doğrulama çıktısında bilgi olarak gösterilir. Bu hesaplar parola değiştirene kadar hiçbir operasyon modülünü kullanamaz.
