# Migration kuralları

Bu klasör, geliştirme ortamından canlı ortama kadar tek ve değiştirilemez migration geçmişidir.

- Yeni/boş veritabanı kurulumu: `npm run db:setup`
- Mevcut veritabanını güncelleme: `npm run prisma:migrate:deploy`
- Şema ve veritabanı durumu kontrolü: `npm run db:verify`
- Yalnızca yerel geliştirmede yeni migration oluşturma: `npm run prisma:migrate:dev -- --name aciklayici_ad`

Bir migration herhangi bir veritabanına uygulandıktan sonra SQL dosyası değiştirilmez, silinmez veya yeniden adlandırılmaz. Düzeltmeler her zaman daha yeni bir migration ile yapılır. Canlı/test ortamında `prisma migrate dev` veya `prisma migrate reset` çalıştırılmaz.

Deploy öncesinde veritabanı yedeği alınır. Ardından `prisma migrate deploy`, `db:verify`, backend testleri ve kullanıcı/rol tutarlılık kontrolü çalıştırılır. Migration başarısız olursa aynı dosyayı düzenleyip tekrar denemek yerine işlem durdurulur, veritabanı yedekten geri alınır ve yeni bir düzeltme migration'ı hazırlanır.

`20260812114532_en_son_migration` daha önce uygulanmış geçmişin parçasıdır. Adı açıklayıcı olmasa da checksum ve mevcut kurulum uyumluluğunu korumak için yeniden adlandırılmamalıdır.
