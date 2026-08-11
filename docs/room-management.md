# Oda Yönetimi: Canlı İş Kuralları ve Bağlantılar

## Veri akışı

- **Oda yönetimi** oda/blok/yatak durumunu, temizlik kayıtlarını, oda demirbaşlarını ve oda bazlı arıza özetini gösterir.
- **Personel yönetimi** yatağa atama, oda transferi ve lojmandan çıkışın tek yazma noktasıdır. Her atama bir açık `OccupancyLog` oluşturur; transfer/çıkış önceki açık kaydı kapatır.
- **Oda detayı** aynı `OccupancyLog` kayıtlarını oda/yatak açısından gösterir. **Personel detayı** aynı kayıtları personel açısından gösterir. Konaklama Excel raporu da aynı kaynaktan üretilir.
- **Teknik Bakım** ve **Oda detayı**, arıza oluşturma/güncellemede aynı `maintenanceService` iş kurallarını kullanır. Bu nedenle iki sayfadan yapılan işlemler aynı kayıt, olay günlüğü ve demirbaş durumuna yansır.
- **Depo / oda demirbaşı** bağlantısında oda zimmeti stok kartından rezerve edilir. Demirbaş arızası oda ve demirbaş eşleşmesini doğrular; durum değişimleri stok hareketi ve arıza olay günlüğü oluşturur.

## Zorunlu kurallar

- Yalnızca `PERSONEL_ODASI` türündeki, `READY` durumundaki ve kapasitesi dolmamış odalara personel atanabilir.
- Bir yatak ya boş ve personelsizdir ya da dolu ve tam bir personele bağlıdır; ara durum veritabanında reddedilir.
- Personel ve yatak başına yalnızca bir açık konaklama kaydı olabilir.
- Aynı yatağın aynı personele yeniden atanması reddedilir; sahte giriş/çıkış geçmişi oluşmaz.
- Blok ve odadaki cinsiyet politikası, atama ve odada kalan personelin cinsiyet değişikliğinde yeniden doğrulanır.
- Oda durumu genel oda düzenleme isteğiyle değiştirilemez. Temizlik ve arıza kontrollerini işleten özel durum akışı kullanılır.
- Yüksek/acil açık arıza odayı otomatik olarak `OUT_OF_ORDER` yapar. Böyle bir arıza varken oda `READY` yapılamaz. Arıza kapandıktan sonra oda ayrıca kontrol edilip bilinçli olarak kullanıma alınır.
- Temizlik tamamlanması `OUT_OF_ORDER` odayı kendiliğinden `READY` yapmaz.
- Oda başına yalnızca bir aktif temizlik kaydı; oda demirbaşı başına yalnızca bir aktif arıza kaydı bulunabilir.
- Tamamlanan temizlik kayıtları fiziksel olarak silinmez, denetim için arşivlenir.
- Oda türü sonradan değiştirilemez. Kapasite düşürme, dolu veya konaklama geçmişi bulunan yatakları silemez.
- Aktif oda demirbaşlarında seri numarası tektir. Demirbaş başka odaya aitse arıza kaydı açılamaz.

## Güvenlik ve canlı önlemleri

- Oda, personel ve arıza cevapları `private, no-store` ile tarayıcı/ara katman önbelleğine alınmaz.
- Yetkiler oda görüntüleme, yönetme, temizlik, arıza, demirbaş, rapor ve hassas personel verisi için ayrı uygulanır.
- Konaklama raporunda TC/pasaport yalnızca hassas personel verisi yetkisi olan kullanıcıya verilir.
- Excel metinleri formül enjeksiyonuna karşı kaçışlanır; oda, konaklama, demirbaş ve arıza raporları yapılandırılabilir satır sınırına tabidir.
- Yazma uçları kullanıcı bazlı hız sınırına tabidir. Kritik işlemler seri hale getirilir ve eşzamanlı güncelleme 409 yanıtıyla güvenli şekilde yeniden denemeye yönlendirilir.
- Veritabanı migrationları yatak/konaklama/temizlik/demirbaş/arızanın temel bütünlük kurallarını uygulama kodundan bağımsız olarak da korur.

## Canlı doğrulama

`dist/scripts/verifyRoomProduction.js`, yalnızca `ALLOW_ROOM_PRODUCTION_TEST=1` verildiğinde benzersiz geçici kayıtlarla oda kapasitesi, yüksek arıza, kullanıma alma engeli, temizlik durumu, arşivleme, aynı yatak koruması, çıkış geçmişi ve veritabanı yatak kısıtını sınar. Betik sonuçtan bağımsız olarak kendi oluşturduğu kayıtları `finally` bloğunda temizler.
