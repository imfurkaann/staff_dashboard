# 🔬 Dosinia Resort — Tüm Personel Sayfaları, API'ler, DB ve Güvenlik Kapsamlı Denetim Raporu

İşbu rapor; veritabanındaki **gereksiz/kullanılmayan tablolar ve kolonlar**, **API güvenlik yetkilendirmeleri (RBAC)**, **frontend-backend entegrasyon uyumu**, **süreç mantık denetimleri** ve **veri bütünlüğü** açılarından tüm satırların ve dosyaların tek tek incelenmesi sonucu hazırlanmıştır.

---

## 📌 İÇİNDEKİLER
1. [Gereksiz / Kullanılmayan DB Tabloları ve Kolonları](#1-gereksiz--kullanılmayan-db-tabloları-ve-kolonları)
2. [Tüm Personel Sayfaları & Frontend-Backend Birlikteliği Denetimi](#2-tüm-personel-sayfaları--frontend-backend-birlikteliği-denetimi)
3. [API Güvenliği & Yetkilendirme (RBAC) Zafiyetleri](#3-api-güvenliği--yetkilendirme-rbac-zafiyetleri)
4. [Süreç Mantık Denetimleri ve Son Durum](#4-süreç-mantık-denetimleri-ve-son-durum)
5. [Veri Normalizasyonu ve Standartlaştırma Eksikleri](#5-veri-normalizasyonu-ve-standartlaştırma-eksikleri)
6. [Canlıya Çıkış Öncesi Nihai Kontrol ve Öneri Listesi](#6-canlıya-çıkış-öncesi-nihai-kontrol-ve-öneri-listesi)

---

## 1. 🗑️ GEREKSİZ / KULLANILMAYAN DB TABLOLARI VE KOLONLARI

Kapsamlı kod taraması (`grep` ve AST analizi) sonucunda tespit edilen veritabanı fazlalıkları:

### 1.1 Tamamen Kullanılmayan Tablolar
* **`FacilityLog` Tablosu (`schema.prisma` L282-291):**
  - **Durum:** PostgreSQL geçiş dosyasında (`20260801120000_initial`) ve Prisma şemasında tanımlanmıştır.
  - **Tespit:** Backend servislerinde (`src/services/`), rotalarında (`src/routes/`) veya frontend bileşenlerinde **hiçbir şekilde çağrılmamakta ve kullanılmamaktadır**.
  - **Öneri:** Veritabanı boyutunu ve ilişki haritasını karmaşıklaştırmaması için sonraki migration adımında kaldırılabilir.

### 1.2 Gereksiz / Denormalize (Tekrarlanan) Kolonlar
* **`OccupancyLog` Tablosundaki Denormalize Kolonlar (`schema.prisma` L182-185):**
  - `employeeName`, `employeeDepartment`, `employeeTitle`, `employeeCompany` kolonları `Employee` ilişkisine (`employeeId`) rağmen log tablosunda yedek metin olarak tutulmaktadır. Personele ait geçmişi korumak amaçlanmış olsa da personel bilgisi güncellendiğinde bu loglardaki metinler eski kalmakta ve tutarsızlık yaratmaktadır.
* **`Visitor` Tablosundaki Denormalize Kolonlar (`schema.prisma` L301-302):**
  - `hostEmployeeName` ve `hostRoomLabel` alanları `hostEmployeeId` ilişkisi varken veritabanında ekstra string olarak saklanmaktadır. `hostEmployeeId` üzerinden sorgulamak veri bütünlüğü açısından daha sağlıklıdır.
* **`DisciplinaryNote.status` Kolonu (`schema.prisma` L235):**
  - Tüm kod genelinde sadece varsayılan değer olan `"GÖRÜŞÜLDÜ"` atanmaktadır. Süreç takibi (Uyarıldı, Çözüldü, İşleme Alındı) yapılmadığından işlevsiz durumdadır.

---

## 2. 🔗 TÜM PERSONEL SAYFALARI & FRONTEND-BACKEND BİRLİKTELİĞİ DENETİMİ

### 2.1 `EmployeeManagementView.tsx` (Personel Listesi Ekranı)
- **Arama & Filtre Çakışması:** 
  - İstemci tarafında `filteredEmployees` fonksiyonu `search`, `gender` ve `dateRange` alanlarını **anlık (client-side)** filtrelemektedir.
  - Ancak `statusFilter` ve `departmentFilter` seçildiğinde backend `employeeApi.getEmployees` servisine istek atılarak veriler yeniden indirilmektedir.
  - **Risk:** Kullanıcı arama kutusuna yazı yazıp aynı anda departman değiştirdiğinde istemci ve sunucu filtreleri çakışabilmektedir.
- **Sayfalama (Pagination) Yokluğu:**
  - 500+ personel kayıtlı olduğunda tüm veriler tek seferde çekilip DOM'a basılmaktadır. Büyük veride sayfa kasmalarına neden olur.

### 2.2 `EmployeeDetailView.tsx` (Personel Detay Ekranı)
- **Ziyaretçi İlişkisi Kopması:**
  - Personel detayında `visitors` tabında personelin ziyaretçileri listelenir.
  - Ancak personel silindiğinde veritabanındaki `Visitor.hostEmployeeId` alanı `SetNull` ile `null` yapılır. Bu durum silinen personelin geçmiş ziyaretçi kayıtlarının yetim (orphan) kalmasına ve detay sayfasında görünememesine neden olur.
- **Tab State Hafızası:**
  - `localStorage.setItem('staff_app_emp_detail_tab', tab)` ile son açılan sekme hafızada tutulmaktadır. Bir personelin "Zimmet" sekmesinden çıkıp başka bir personelin detayına girildiğinde otomatik Zimmet sekmesi açılmaktadır. (Kullanıcı açısından şaşırtıcı olabilir).

### 2.3 `AddEmployeeModal.tsx` (Personel Ekleme / Düzenleme Modalı)
- **Base64 Görsel Yüklemesi:**
  - Profil fotoğrafı yüklendiğinde veya kameradan çekildiğinde 1.5 MB'a kadar Base64 string doğrudan DB `photoUrl` kolonuna yazılmaktadır.
  - **Gözlem:** Listeleme sorgusunda `select: { photoUrl: true }` olmasa bile `findMany` tüm Base64 verilerini indirmekte ve ağ trafiğini yavaşlatmaktadır.

---

## 3. 🔐 API GÜVENLİĞİ & YETKİLENDİRME (RBAC) ZAFİYETLERİ

| Route / Uç Nokta | Mevcut Yetki Tanımı | Tespit Edilen Güvenlik Açığı / Risk | Olması Gereken Yetki Tanımı |
| :--- | :--- | :--- | :--- |
| `GET /api/visitors/export.xlsx` | `authenticateToken` | Herhangi bir giriş yapmış kullanıcı (`STAFF`, `SECURITY`) tüm ziyaretçi verilerini Excel olarak indirebilir. | `authorizeRoles('ADMIN', 'HOUSING_MANAGER')` |
| `GET /api/employees` | `authenticateToken` | Giriş yapan her rol tüm personellerin telefon, sicil, departman ve maskeli TC verisini çekebilir. | Rol bazlı veri kısıtlaması veya alan seviyesinde filtreleme |
| `GET /api/rooms` | `authenticateToken` | Güvenlik personeli tüm lojman oda detaylarına ve sakinlerine erişebilir. | Uygun rol kontrolü |
| `POST /api/employees` | `Base64` Yükleme | SVG/HTML içerik barındıran Base64 yüklemelerinde Stored XSS riski. | Görsel formatının backend'de `sharp` veya MIME denetimi ile doğrulanması |

---

## 4. 🔄 SÜREÇ MANTIK DENETİMLERİ VE SON DURUM

1. **Konaklama & Oda Çıkış Süreci (Kullanıcı Talebiyle Güncellendi):**
   - Personel odadan çıkarıldığında veya silindiğinde odanın durumunu otomatik `NEEDS_CLEANING` yapma mantığı kaldırılmıştır. Odanın mevcut statüsü (`READY`, `NEEDS_CLEANING`, `OUT_OF_ORDER`) korunmaktadır.
2. **Personel Silme Süreci:**
   - Personel silindiğinde (`isDeleted: true`), üzerindeki aktif yataklar boşaltılmakta ve zimmetindeki eşyalar otomatik olarak kapatılmaktadır (`status: 'TAM_İADE_ALINDI'`).
3. **Zimmet İade ve Hasarlı/Kayıp Durumu:**
   - Zimmet teslim alınamadığında (Kayıp/Hasarlı) backend veritabanına `status: 'TESLİM_ALINAMADI'` ve açıklama gerekçesi kaydedilmektedir.
4. **Disiplin ve Şikayet Notları:**
   - Ekleme, güncelleme (`PUT`) ve silme (`DELETE`) işlemleri tam olarak veritabanı uç noktalarına bağlanmıştır.

---

## 5. 🔤 VERİ NORMALİZASYONU VE STANDARTLAŞTIRMA EKSİKLERİ

- **Departman ve Ünvan Serbest Metinleri:**
  - Frontend üzerinde select dropdown olsa da API serbest `string` kabul etmektedir. İleride dış sistem entegrasyonunda "İdari İşler" ile "İdari işler" farkı veritabanında çift kayıt oluşturabilir.
- **Zimmet Kategorileri:**
  - DB'de `LOJMAN_ZİMMETİ` ve `ŞAHSİ_EŞYA` şeklinde Türkçe büyük harfli stringler tutulmaktadır. ASCII Enum (`HOUSING_EQUIPMENT`, `PERSONAL_BELONGING`) kullanımı daha güvenlidir.

---

## 6. 🚀 CANLIYA ÇIKIŞ ÖNCESİ NİHAİ KONTROL VE ÖNERİ LİSTESİ

- [ ] **[DB]** İlerleyen migration adımlarında `FacilityLog` tablosunu veritabanından kaldırarak gereksiz tablo yükünü temizleyin.
- [ ] **[GÜVENLİK]** `GET /api/visitors/export.xlsx` rotasına `authorizeRoles('ADMIN', 'HOUSING_MANAGER')` yetki kontrolü ekleyin.
- [ ] **[PERFORMANS]** Base64 formatındaki resimleri veritabanı text alanında tutmak yerine sunucuda dosya olarak (`/uploads/...`) depolayın.
- [ ] **[UI/UX]** Personel listesine sunucu taraflı sayfalama (`page`, `pageSize`) ekleyerek 500+ kayıtta performans performans kaybını önleyin.

---
*Rapor Oluşturulma Tarihi: 06 Ağustos 2026*
*Denetlenen Sistem: Dosinia Resort Staff Management Platform*
