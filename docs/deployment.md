# Yayın adresi ve güncelleme

Docker yayınının tek adres kaynağı proje kökündeki `.env` dosyasındaki `PUBLIC_URL` değeridir:

```dotenv
PUBLIC_URL=http://169.58.124.2:3335
APP_PORT=3335
```

`PUBLIC_URL` protokol, IP/domain ve varsa dış porttan oluşur; alt dizin, sorgu veya kullanıcı bilgisi içeremez. API istekleri `/api`, canlı bağlantılar `/ws/` üzerinden tarayıcının açıldığı adrese gider. Frontend içine IP gömülmez. Backend CORS, yazma isteği origin kontrolü, WebSocket origin kontrolü ve cookie güvenliğini bu değerden türetir. HTTPS adresinde cookie otomatik Secure olur. Başka origin'lere izin verilmez.

## Mevcut sunucuyu güncelleme

1. Veritabanının ve mevcut `.env` dosyasının güvenli yedeğini alın. Yeni proje dosyalarını mevcut proje klasörüne alın; `.env` ve veritabanı volume'unu koruyun.
2. Mevcut kök `.env` dosyasına yukarıdaki `PUBLIC_URL` satırını ekleyin. Eski `CLIENT_URL`, `CORS_ALLOWED_ORIGINS`, `COOKIE_SECURE`, `ALLOW_INSECURE_HTTP` satırlarını kaldırın; Docker artık bunları kullanmaz. Mevcut anahtarları ve parolaları değiştirmeyin. `.env.example` dosyasını mevcut `.env` üzerine kopyalamayın.
3. Proje kökünde çalıştırın:

```sh
docker compose config --quiet
docker compose up -d --build --force-recreate --wait backend frontend
docker compose ps
curl --fail --show-error http://169.58.124.2:3335/api/health
```

Bu işlem kısa bir kesinti oluşturabilir. Backend migration'ları başlangıçta uygular. Frontend de yeniden oluşturulur; Nginx yenilenen backend container adresini çözer. Veritabanı volume'u silinmez. `docker compose down -v` kullanmayın.

## IP değişikliği

Kök `.env` içindeki `PUBLIC_URL` değerini yeni IP ile değiştirin. Port da değişiyorsa `APP_PORT` ve güvenlik duvarını uyarlayın. Kod değişikliği gerekmez. Yalnızca adres değişiminde:

```sh
docker compose config --quiet
docker compose up -d --force-recreate --wait backend frontend
```

Yeni adresin `/api/health` yanıtını, giriş işlemini ve canlı bağlantılarını kontrol edin. Yeni origin'de yeniden giriş ve push aboneliği gerekebilir.

## Domain ve HTTPS geçişi

1. Domain DNS kaydını sunucuya yönlendirin.
2. Sertifikalı HTTPS reverse proxy'yi domain için kurun; tüm yolları uygulamanın 3335 portuna iletin ve `/ws/` için WebSocket Upgrade desteğini açın. Docker içindeki Nginx HTTP dinler; `PUBLIC_URL` sertifika üretmez veya TLS servisi açmaz.
3. Kök `.env` dosyasında adresi `PUBLIC_URL=https://lojman.example.com` yapın. Reverse proxy hâlâ 3335'e bağlanıyorsa `APP_PORT=3335` kalır. Proxy aynı sunucunun üzerinde çalışıyorsa `APP_BIND_ADDRESS=127.0.0.1` ayarlayarak 3335 portunun doğrudan internet erişimini kapatın. Proxy başka bir container veya sunucudaysa bu loopback ayarını kullanmayın; özel ağ ve güvenlik duvarıyla yalnızca proxy erişimine izin verin.
4. Yukarıdaki yeniden oluşturma komutunu çalıştırın; `https://lojman.example.com/api/health`, giriş ve canlı bağlantıları kontrol edin. HTTPS origin ayarlandıktan sonra doğrudan HTTP/IP adresiyle oturum açmayın.

TLS proxy ve DNS ayarları ilgili servis üzerinde ayrıca yönetilir. HTTP yayında kamera ve push özellikleri tarayıcı tarafından kısıtlanabilir.

Yerel Docker dışı geliştirmede eski ortam değişkenleri desteklenir. `PUBLIC_URL` tanımlanırsa eski adres ve cookie değişkenlerinden önceliklidir.
