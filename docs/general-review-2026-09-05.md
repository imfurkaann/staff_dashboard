# Genel sistem incelemesi — 5 Eylül 2026

> Docker kurulum doğrulaması sırasında güncelleme: Container içinde yeniden çalıştırılan `npm audit --omit=dev --json`, backend için **3 orta seviye etkilenen paket** bildirdi: `qs`, `body-parser`, `express`. Kök bildirimler `GHSA-x5fp-wj9c-mxmx` ve `GHSA-4mjr-xmp4-gh2g`; düzeltme mevcut. Aşağıdaki önceki yerel taramanın 0 sonucu bu yeni taramayla geçersiz kaldı. Docker başlatma işlemi kapsamında bağımlılıklar değiştirilmedi.

## Sonuç ve kapsam

Personel, oda/temizlik, stok, arıza, ortak eşya ve bunlara bağlı yetkilendirme, portal ve canlı bildirim akışlarında **9 doğrulanabilir bulgu** tespit edildi. Yedi bulgu P1 (yüksek öncelik), iki bulgu P2 (orta öncelik). Bu sınıflandırma CVSS puanı değildir; veri gizliliği, veri bütünlüğü ve operasyon etkisine göre yapılmıştır.

İnceleme yerel kaynak kodu, migration dosyaları, sunucu ve arayüz bağlantıları üzerinden yapıldı. Altı davranış, gerçek derlenmiş servisler üzerinde bellek içi veritabanı/bağlantı taklitleriyle yeniden üretildi. Bunlar PostgreSQL üzerinde uçtan uca test değildir. Canlı sunucuda veri değiştirilmedi; sunucudaki verilerin bu hatalardan etkilenip etkilenmediği ölçülmedi. Uygulama kodu bu inceleme sırasında değiştirilmedi.

## Bulgular

### 1. P1 — İptal edilen oturum canlı bağlantıdan özel talepleri almaya devam ediyor

**Kaynak:** `backend/src/websocket/ticketSocket.ts:54,90,108–120`; benzer oturum yaşam döngüsü eksikliği `backend/src/websocket/sharedAssetSocket.ts` içinde de var.

Kullanıcı ve parola doğrulaması yalnızca WebSocket açılırken yapılıyor. `canViewAll` bağlantıya kopyalanıyor; sonraki yayınlarda güncel rol, hesabın aktifliği, parola sürümü ve token süresi kontrol edilmiyor. Kalp atışı sadece bağlantının yanıt verip vermediğine bakıyor.

**Senaryo:** Yönetici bağlantıyı açar; başka yönetici hesabını pasifleştirir veya rolünü düşürür. Açık bağlantı korunursa başka personellerin yeni talepleri ve açıklamaları gönderilmeye devam eder. Kontrollü bağlantı taklidiyle yeniden üretildi: kullanıcı okuması bir kez yapıldı ve hesap kapatıldıktan sonra başka kullanıcının talebi alındı.

**Düzeltme:** Bağlantıları kullanıcı kimliğiyle indeksleyip hesap/rol/parola değişiminde kapatın. Token son kullanma zamanında bağlantıyı sonlandırın; yayın veya periyodik kontrol sırasında güncel erişim durumunu doğrulayın.

### 2. P1 — Verili kurulumda migration sırası güncellemeyi durdurabilir

**Kaynak:** `backend/prisma/migrations/20260902111500_separate_shared_assets_from_room_inventory/migration.sql:49–60`; önceki kısıt `20260811210000_harden_stock_ledger/migration.sql:18`; düzeltme `20260902134000_allow_shared_asset_stock_type/migration.sql:3–5`.

İlk migration bağlı stokları `ORTAK_EŞYA` türüne çeviriyor. O anda geçerli CHECK kısıtı bu değeri kabul etmiyor. Yeni değeri kabul eden migration daha sonra çalışıyor.

**Senaryo:** Ortak eşya kaydı bulunan ve dönüşüm koşulunu sağlayan eski veritabanını güncelleyin. İlk UPDATE kısıt ihlaliyle durur; sonraki düzeltmeye ulaşılmaz. Docker backend başlangıcındaki `prisma migrate deploy` başarısız olacağı için uygulama açılmaz. Boş veritabanında aynı sorun görünmeyebilir. Migration zinciri üzerinden doğrulandı; gerçek veritabanında çalıştırılmadı.

**Düzeltme:** Mevcut kurulumların migration durumunu kontrol ederek kısıt genişletmesini veri dönüşümünden önce uygulayan, kontrollü bir yükseltme planı hazırlayın. Uygulanmış migration dosyalarını rastgele değiştirerek checksum sorunu yaratmayın. Başarısız migration varsa ayrıca kurtarma adımları gerekir.

### 3. P1 — Yeni ortak eşya türü sayım korumasını atlıyor

**Kaynak:** `backend/src/services/stockService.ts:817–825`; karşılaştırma için stok ekranındaki hesap `:151–155`.

Sayım yasağı yalnızca `ORTAK_EKİPMAN` ve `ORTAK_KULLANIM` türlerini içeriyor. Güncel `ORTAK_EŞYA` türü bu kontrolden geçiyor. Sayım formülü ortak eşya cihazlarına ayrılmış miktarı hesaba katmıyor.

**Senaryo:** Toplam iki ürünün ikisini ortak eşya olarak tanımlayın. Serbest stok sıfırdır. `countedAvailable=0` ile sayım yapılınca toplam stok sıfırlanırken iki cihaz kaydı kalır. Servis taklidiyle yeniden üretildi.

**Düzeltme:** Ortak eşya türlerini tek ortak kümeden doğrulayın. Sayımda ayrılmış ortak cihazları koruyun veya bu kartların genel sayımını engelleyip ayrı sayım akışına yönlendirin. Toplam stok ile aktif cihaz sayısının tutarlılığını kontrol edin.

### 4. P1 — Hurda cihazın konumunu değiştirmek yeniden stok düşüyor

**Kaynak:** `backend/src/services/sharedAssetService.ts:389–400`.

Aynı duruma geçiş farklı konum verilirse kabul ediliyor. Stok düşümü ise yalnızca hedef durumun `RETIRED` olmasına bağlı; cihazın zaten hurda olup olmadığı hesaba katılmıyor.

**Senaryo:** Üç adet stoktan bir cihazı hurdaya ayırın: toplam iki olur. Aynı cihaz için `status=RETIRED` ve farklı `locationNote` gönderin: toplam bir olur. Aynı fiziksel cihaz ikinci kez stoktan düşülür. Servis taklidiyle yeniden üretildi. Farklı işlem anahtarı veya anahtarsız yeni istek olduğunda idempotency bunu engellemez.

**Düzeltme:** Stok düşümünü yalnızca ilk gerçek hurdaya geçişte yapın. Hurda cihazın konum/not düzenlemesini miktar hareketinden ayırın.

### 5. P1 — Ortak cihaz teslim edilmeden personel çıkışı yapılabiliyor

**Kaynak:** `backend/src/services/employeeService.ts:1357–1360`, silme akışı `:173–177`; cihaz teslimi `backend/src/services/sharedAssetService.ts:278–292`.

Çıkış ve silme akışı yalnızca `InventoryItem` zimmetlerini denetliyor. Yeni ortak eşya teslimi bu tabloya satır açmıyor; borç `SharedAsset.currentEmployeeId` üzerinde tutuluyor.

**Senaryo:** Konaklayan personele ortak cihaz verin. Başka zimmeti ve içeride ziyaretçisi yoksa çıkış yapılabiliyor; personel CHECKED_OUT, cihaz LOANED kalıyor. Servis taklidiyle yeniden üretildi. Aynı denetim eksikliği personel arşivlemesinde de mevcut.

**Düzeltme:** Çıkış/silme transaction'ında aktif ortak cihazları da kontrol edin. Teslim alınmadan çıkışı engelleyin veya yetkili ve izlenebilir bir devir/düşüm işlemi isteyin. Eşzamanlı cihaz teslimi ile çıkışın tutarlılığını da test edin.

### 6. P1 — Arıza çözümü temizlik bekleyen odayı hazır yapıyor

**Kaynak:** `backend/src/services/maintenanceService.ts:41–59`.

Oda durumu eşitlemesi, yüksek/acil aktif arıza kalmadığında OUT_OF_ORDER durumunu doğrudan READY yapıyor. Açık temizlik kaydı veya odanın başka nedenle kullanıma kapatılmış olması kontrol edilmiyor.

**Senaryo:** Temizlik bekleyen odada yüksek öncelikli arıza açın; oda OUT_OF_ORDER olur. Arızayı çözün; temizlik tamamlanmadan READY olur ve personel yerleştirmesine açılır. Servis taklidiyle yeniden üretildi.

**Düzeltme:** Oda kullanılabilirliğini aktif arıza, açık temizlik ve bağımsız kullanım engellerinden türeten tek bir fonksiyon kullanın. Manuel kapatmanın nedenini arıza durumundan ayrı tutun.

### 7. P2 — Cihaz değişimi arızayı çözüyor ancak odayı kapalı bırakıyor

**Kaynak:** `backend/src/services/stockService.ts:697–707`.

Değişim akışı arızayı doğrudan RESOLVED yapıyor; arıza servisinin oda durumunu eşitleyen fonksiyonunu çağırmıyor.

**Senaryo:** Odadaki tek yüksek öncelikli arıza için stoktan cihaz değişimi yapın. Arıza çözülür ve yeni cihaz HEALTHY olur; oda OUT_OF_ORDER kalır, yeni yerleşim yapılamaz. İlgili yazma akışının tamamında oda güncellemesi olmadığı kod üzerinden doğrulandı.

**Düzeltme:** Ortak arıza sonuçlandırma ve oda kullanılabilirliği hesaplamasını stok değişiminin transaction'ı içinde çalıştırın. Temizlik gereksinimini de koruyun.

### 8. P1 — Arıza silme, bağlı gerçek stok hareketlerini de siliyor

**Kaynak:** `backend/src/services/maintenanceService.ts:622–625`; stok değişiminin arızaya bağlı hareketi `backend/src/services/stockService.ts:699–705`.

Silme akışı bakım olaylarını ve o arızaya bağlı bütün stok hareketlerini fiziksel olarak siliyor. Bu filtre yalnızca açıklama/durum kayıtlarını değil, miktar değiştiren REPLACEMENT ve RETIREMENT kayıtlarını da kapsıyor.

**Senaryo:** Arızalı cihazı stoktan yenisiyle değiştirin ve ardından arıza kaydını silin. Stok miktarı değişmiş ve yeni cihaz yerleştirilmiş kalır; değişimin hareket kaydı yok olur. Silme filtresi servis taklidiyle doğrulandı. Silme yapan kullanıcı kimliği de bu serviste kullanılmıyor.

**Düzeltme:** Arızayı arşivleyin ve mali/stok geçmişini koruyun. Düzeltme gerekiyorsa mevcut hareketi silmek yerine yetkili, gerekçeli ters kayıt oluşturun.

### 9. P2 — Tek cihazın hurdaya ayrılması aynı karttaki sağlam cihazları da engelliyor

**Kaynak:** `backend/src/services/sharedAssetService.ts:393` ve teslim kontrolü `:271`.

Bir cihaz hurdaya ayrılırken bütün stok kartının `physicalStatus` değeri HURDA yapılıyor. Cihaz teslimi bu kart değerini kontrol ederek aynı karta bağlı tüm cihazları reddediyor.

**Senaryo:** Aynı stok kartında birden fazla ortak cihaz olsun. Birini hurdaya ayırın. Diğerleri AVAILABLE olsa bile personele teslim edilemez. Hurda yazımı kontrollü senaryoda gözlendi; teslimin neden reddedileceği kontrol koşuluyla doğrulandı.

**Düzeltme:** Fiziksel durumu cihaz düzeyinde yönetin. Kart düzeyinde gösterilecek durum varsa tüm cihazlardan türetin; tek cihazın durumunu tüm karta kopyalamayın.

## Doğrulamalar ve sınırlar

- Altı kontrollü yeniden üretme başarılı: tekrar hurda düşümü, ortak eşya sayımı, temizlik durumunun kaybı, teslimsiz personel çıkışı, stok geçmişinin silinmesi ve iptal edilmiş WebSocket oturumunun veri almaya devam etmesi.
- `npm audit --omit=dev --json` hem backend hem frontend için bilinen üretim bağımlılığı açığı sayısını **0** döndürdü. Bu sonuç uygulama mantığını, Docker imajlarını veya sunucu yapılandırmasını güvenli ilan etmez.
- Önceki doğrulamada 57 mevcut test ve iki uygulamanın derlemesi başarılıydı. İnceleme sırasında uygulama kodu değişmedi. Mevcut testlerin geçmesi yukarıdaki modüller arası senaryoları kapsamıyor.
- Kimlik doğrulama, HTTP isteklerinde güncel rol ve parola sürümü kontrolü, CORS/origin koruması, personel verisi kapsamlandırması, stok rezervasyonundaki atomik miktar kontrolü ve çeşitli veritabanı kısıtları mevcut.
- Gerçek PostgreSQL'de migration yükseltme testi, paralel işlem testi, tüm rollerle tarayıcı testi ve canlı veri bütünlüğü sayımı ayrıca yapılmalı. İnceleme kapsamlı bir sızma testi veya hatasızlık garantisi değildir.

Yeniden üretmeler mevcut hatalı davranışı doğrular; düzeltmelerden sonra bu dosyaların beklenen sonuçları değiştirilerek regresyon testi haline getirilmesi gerekir. Veritabanı bağlantısı açmazlar.

```sh
npm run build --prefix backend
node docs/review-probes.cjs
node docs/review-socket-probe.cjs
```

Önerilen düzeltme sırası: oturum iptali ve migration geçişi; stok sayım/hurda kuralları; arıza silme geçmişi; personel çıkış kontrolü; ortak oda durum hesabı. Düzeltmelerden önce canlı veride oluşmuş tutarsızlıklar ayrıca raporlanmalı, otomatik veri onarımı bu inceleme sonucuna dayanarak doğrudan çalıştırılmamalıdır.
