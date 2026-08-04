# Lojman Yönetim Sistemi

React/Vite arayüzü, Express API, Prisma ve PostgreSQL kullanan personel konaklama yönetim uygulaması.

## Yerel geliştirme

1. `backend/.env.example` dosyasını `backend/.env` olarak kopyalayın ve değerleri değiştirin.
2. PostgreSQL'i başlatın ve backend klasöründe `npm run prisma:migrate` çalıştırın.
3. İlk yönetici için `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerlerini ayarlayıp `npm run prisma:seed` çalıştırın.
4. Backend'de `npm run dev`, frontend'de `npm run dev` çalıştırın.

## Docker ile deploy

1. Kök `.env.example` dosyasını `.env` olarak kopyalayın.
2. `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` ve `DATA_ENCRYPTION_KEY` alanlarını birbirinden farklı, güçlü ve rastgele değerlerle değiştirin. `DATA_ENCRYPTION_KEY` daha sonra değiştirilmemelidir; mevcut TC verilerini çözmek için gereklidir.
3. Gerçek HTTPS alan adını `CLIENT_URL` ve `CORS_ALLOWED_ORIGINS` alanlarına yazın.
4. `docker compose up -d --build` çalıştırın. Backend başlangıçta migration'ları otomatik uygular ve health-check başarılı olmadan frontend açılmaz.
5. İlk kurulumda `docker compose run --rm -e ADMIN_USERNAME -e ADMIN_EMAIL -e ADMIN_FULL_NAME -e ADMIN_PASSWORD backend npm run prisma:seed` ile yönetici hesabını oluşturun; ardından `.env` içindeki `ADMIN_PASSWORD` değerini kaldırın.

Reverse proxy/CDN üzerinde TLS sonlandırın ve uygulamayı yalnızca HTTPS üzerinden yayınlayın. Veritabanı dışarıya port açmaz. Kalıcı `postgres_data` volume'u için düzenli, şifreli yedekleme yapılandırın.

## Doğrulama

- Backend build: `npm run build --prefix backend`
- Frontend build: `npm run build --prefix frontend`
- Prisma şema kontrolü: `npm run prisma:generate --prefix backend`
- Servis durumu: `GET /api/health`

## Aktif kapsam

Dashboard, kimlik doğrulama, personel kayıt/detay işlemleri, odalar ve ziyaretçi modülleri aktiftir. Ziyaretçi modülü; personelle ilişkili giriş/çıkış kaydı, düzenleme, yetkili arşivleme/geri yükleme, ayrıntılı kayıt filtreleri ve kurumsal Excel dökümü içerir. Ziyaretçilerden kimlik veya pasaport bilgisi alınmaz ve saklanmaz.

## Üretim güvenliği

- Uygulama yalnızca HTTPS sağlayan bir reverse proxy/CDN arkasında yayınlanmalıdır.
- PostgreSQL dış ağa açılmaz; şifreli ve düzenli volume yedeği zorunludur.
- Container'lar salt okunur dosya sistemi ve `no-new-privileges` ile çalışır.
- `/api/health` hem uygulama hem veritabanı erişimini kontrol eder.
- Login ve genel API istek limitleri ortam değişkenlerinden yönetilir.
