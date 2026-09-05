# Aynı stok kartından birden fazla cihaz

Stok kartı ürünün toplam miktarını, ortak eşya kaydı ise tek fiziksel cihazı temsil eder. Örneğin 100 çamaşır makinesinden “Erkek Çamaşır Makinesi” ve “Kadın Çamaşır Makinesi” oluşturulabilir. Toplam 100 kalır, cihazlara ayrılan miktar 2 ve serbest miktar 98 olur.

İkinci cihazı engelleyen iki neden düzeltildi:

- Eski `SharedAsset_stockItemId_key` benzersiz indeksi, yeni `20260905100000_allow_multiple_shared_assets_per_stock` migration'ıyla normal indekse dönüştürülür. Mevcut cihazlar ve geçmişleri korunur.
- Form artık stok kodunu cihaz kodu olarak kopyalamaz. Backend her cihaza benzersiz kod üretir; eski tarayıcı stok kodunu gönderirse de otomatik kod üretilir. Özel cihaz kodları ve üretici seri numaraları için çakışma kontrolleri devam eder.

Sunucuya güncel backend, frontend ve migration dosyaları aktarıldıktan sonra proje kökünde:

```sh
docker compose config --quiet
docker compose up -d --build --force-recreate --wait --wait-timeout 180 backend frontend
```

Backend yeni migration'ı başlangıçta uygular. Daha önce başarısız olmuş bir migration varsa onun kurtarma işlemi önce tamamlanmış olmalıdır. Bu değişiklik için `.env` dosyasının değiştirilmesi veya stokların tekrar oluşturulması gerekmez.

Doğrulama: Ayrı PostgreSQL test veritabanında 53 migration uygulandı. Aynı karttan 100 benzersiz cihaz oluşturuldu; ilk iki cihazdan sonra kalan miktar 98 doğrulandı. 101. cihaz, tekrar cihaz kodu ve tekrar seri numarası reddedildi; aynı işlem anahtarını tekrar göndermek yeni cihaz oluşturmadı. Backend ve frontend derlemeleri başarılı.

Regresyon senaryosu `backend/src/scripts/verifySharedAssetMultiplicity.ts` dosyasındadır. Yalnızca `staff_shared_asset_regression` adlı ayrı test veritabanında çalışır; uygulama veritabanında çalışmayı reddeder.
