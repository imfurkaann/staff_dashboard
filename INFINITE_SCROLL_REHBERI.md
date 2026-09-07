# Infinite Scroll ve Güncel Backend Verisi Rehberi

Bu rehber, projedeki uzun listelerin eksik kayıt bırakmadan ve tarayıcıyı gereksiz yere yormadan gösterilmesi için kullanılacak ortak yaklaşımı açıklar. Referans uygulama `Kullanıcı Yönetimi` ekranıdır.

## Amaç

- İlk açılışta bütün veritabanını tarayıcıya taşımamak.
- Kullanıcı aşağı indikçe sonraki kayıt grubunu doğrudan backend API'den almak.
- Arama ve filtrelemeyi yalnızca yüklenmiş kayıtlar üzerinde değil, veritabanında yapmak.
- Filtre değiştiğinde önceki sorgunun sonuçlarını yeni sorguya karıştırmamak.
- Aynı kaydın iki kez görünmesini engellemek.
- Kullanıcıya kaç kaydın yüklendiğini ve backend'de toplam kaç kayıt bulunduğunu göstermek.
- Otomatik yükleme çalışmasa bile erişilebilir bir `Daha fazla yükle` düğmesi sunmak.

## Projedeki ortak yapı

- Ortak görünürlük kancası: `frontend/src/hooks/useInfiniteScroll.ts`
- Ortak kayıt birleştirici: `frontend/src/utils/pagination.ts`
- Referans ekran: `frontend/src/components/UserManagementView.tsx`
- Backend sayfalaması: `backend/src/services/userManagementService.ts`
- API istemcisi: `frontend/src/api/userManagementApi.ts`
- Benzer mevcut kullanımlar: ziyaretçi, arıza ve bildirim ekranları

## Proje dönüşüm kontrol listesi

Bu liste uygulama ilerledikçe güncellenmelidir. `[x]` işaretli ekranlar ya backend'den sayfa sayfa veri alıp kimliğe göre tekilleştirir ya da ilişkisel bütünlüğü korumak için backend'den alınan güncel tam veri kümesini arayüzde kademeli gösterir. Kullanılan yöntem her maddenin yanında belirtilir.

### Tamamlananlar

- [x] Kullanıcı Yönetimi ana listesi
- [x] Ziyaretçi Yönetimi aktif/günlük listesi
- [x] Ziyaretçi Geçmişi
- [x] Arıza Yönetimi listesi
- [x] Bildirim Yönetimi geçmişi
- [x] Ortak Eşya tam geçmiş sayfası
- [x] Ortak Eşya Yönetimi içindeki tam geçmiş penceresi
- [x] Depo Yönetimi işlem hareketleri sekmesi

### Backend tam veri kümesiyle kademeli gösterilenler

- [x] Personel Yönetimi ana listesi — ilişkisel sıralamaları korumak için güncel tam veri backend'den alınır, satırlar kademeli gösterilir
- [x] Oda Yönetimi oda listesi — güncel tam blok/oda verisi backend'den alınır, gruplar kademeli gösterilir
- [x] Ticket Yönetimi listesi — yetki kapsamındaki güncel tam veri backend'den alınır, satırlar kademeli gösterilir
- [x] Ortak Eşya Yönetimi günlük/aktif cihaz listesi — WebSocket ile güncellenen tam backend verisi kademeli gösterilir
- [x] Depo stok kartları ve hızlı stok listeleri — güncel tam overview verisi kademeli gösterilir
- [x] Depo aktif oda zimmetleri — güncel tam overview verisi kademeli gösterilir
- [x] Depo aktif personel zimmetleri — güncel tam overview verisi kademeli gösterilir
- [x] Personel Portalı / bildirimler — kullanıcıya ait güncel backend verisi kademeli gösterilir
- [x] Personel Portalı / zimmet ve şahsi eşyalar — kullanıcıya ait güncel backend verisi kademeli gösterilir
- [x] Personel Portalı / ortak eşya durumları — WebSocket ile yenilenen backend verisi kademeli gösterilir
- [x] Personel Portalı / talepler — WebSocket ile yenilenen kullanıcı talepleri kademeli gösterilir

### Detay ekranlarında dönüştürülecek uzun geçmişler

- [x] Personel Detayı / zimmet ve şahsi eşya geçmişi (backend detay verisi + kademeli görünüm)
- [x] Personel Detayı / disiplin-şikayet geçmişi (backend detay verisi + kademeli görünüm)
- [x] Personel Detayı / ziyaretçi geçmişi (backend tam liste + kademeli görünüm)
- [x] Personel Detayı / konaklama geçmişi (backend detay verisi + kademeli görünüm)
- [x] Oda Detayı / envanter geçmişi (backend detay verisi + kademeli görünüm)
- [x] Oda Detayı / arıza geçmişi (backend detay verisi + kademeli görünüm)
- [x] Oda Detayı / temizlik geçmişi (backend detay verisi + kademeli görünüm)
- [x] Oda Detayı / konaklama geçmişi (backend detay verisi + kademeli görünüm)
- [x] Depo ürün pasaportu / oda cihazları (backend detay verisi + kademeli görünüm)
- [x] Depo ürün pasaportu / kapsama eksikleri (backend detay verisi + kademeli görünüm)
- [x] Depo ürün pasaportu / arıza geçmişi (backend detay verisi + kademeli görünüm)
- [x] Depo ürün pasaportu / cihaz hareketleri (backend detay verisi + kademeli görünüm)

### Infinite scroll uygulanmayacak alanlar

- Dashboard'daki “son kayıtlar” kartları: bunlar açıkça özet niteliğindedir ve ilgili tam listeye yönlendirir.
- Form seçim kutuları: seçim bileşenleri için aramalı seçenek endpoint'i veya sanallaştırma kullanılmalıdır; sayfa sonu sentinel uygun değildir.
- Tekil kayıt detayları ve sabit özet sayaçları.

## Veri akışı

1. Ekran backend'e `page=1&pageSize=25` ile istek gönderir.
2. Backend filtreleri veritabanı sorgusuna uygular ve `{ items, total, page, pageSize }` döndürür.
3. Listenin sonundaki işaret görünür olunca `useInfiniteScroll` bir sonraki sayfayı ister.
4. Gelen kayıtlar `id` alanına göre tekilleştirilerek mevcut listeye eklenir.
5. `page * pageSize < total` olduğu sürece yükleme devam eder.
6. Arama, filtre veya yenileme değişirse liste temizlenir ve birinci sayfa backend'den yeniden alınır.

## Backend sözleşmesi

Infinite scroll, backend sayfalaması olmadan uygulanmamalıdır. Liste endpoint'i şu sözleşmeye sahip olmalıdır:

```ts
type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
```

Prisma sorgusunda sayfalama ve kararlı sıralama birlikte kullanılmalıdır:

```ts
const [items, total] = await prisma.$transaction([
  prisma.model.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  }),
  prisma.model.count({ where }),
]);
```

Son sıralama alanı benzersiz olmalıdır. Yalnızca tarih veya ad ile sıralama yapılırsa eşit değerlere sahip kayıtlar sayfalar arasında yer değiştirebilir. Bu projede benzersiz bağlayıcı alan olarak `id` kullanılır.

`pageSize` backend tarafından sınırlandırılmalıdır. Bu bir veri kaybı değildir; istemci son sayfaya kadar istek göndermeye devam eder. Tek istekte on binlerce kayıt döndürmek yerine 25-100 kayıtlık gruplar tercih edilmelidir.

## Frontend uygulama adımları

### 1. Gerekli durumları oluşturun

```ts
const [items, setItems] = useState<Row[]>([]);
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(false);
```

### 2. Her sayfayı backend'den alın

```ts
const result = await api.list({ search, status, page, pageSize: 25 });

setItems((current) =>
  page === 1 ? result.items : mergeById(current, result.items)
);
setTotal(result.total);
setHasMore(result.page * result.pageSize < result.total);
```

Arama ve filtre parametreleri backend'e gönderilmelidir. `items.filter(...)` ile yalnızca yüklenmiş kayıtları filtrelemek eksik ve yanıltıcı sonuç üretir.

### 3. Kayıtları kimliğe göre birleştirin

```ts
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}
```

Bu işlem, ardışık istekler sırasında aynı kayıt tekrar geldiyse ekranda çoğalmasını engeller ve yeni sürümle günceller.

### 4. Ortak kancayı bağlayın

```tsx
const loadMore = () => {
  if (!hasMore || loading || loadingMore) return;
  setPage((current) => current + 1);
};

const sentinelRef = useInfiniteScroll({
  hasMore,
  isLoading: loading || loadingMore,
  onLoadMore: loadMore,
});

return <div ref={sentinelRef}>{/* yükleme durumu ve düğme */}</div>;
```

`rootMargin` varsayılan olarak işaret ekrana gelmeden önce yüklemeyi başlatır. Böylece kullanıcı listenin sonunda beklemez.

### 5. Filtre değişiminde sıfırlayın

```ts
useEffect(() => {
  setPage(1);
  setItems([]);
  setTotal(0);
  setHasMore(false);
}, [search, status, refreshKey]);
```

Veri isteği yapılan effect mutlaka cleanup kullanmalıdır. Eski sorgunun cevabı yeni filtrenin cevabından sonra gelirse eski cevap yok sayılmalıdır:

```ts
useEffect(() => {
  let active = true;

  api.list(query).then((result) => {
    if (active) applyResult(result);
  });

  return () => {
    active = false;
  };
}, [query]);
```

## Güncellik kuralları

- Liste verisi sabit bir frontend dizisinden değil, her sayfada backend'den gelmelidir.
- Liste endpoint'lerinde `Cache-Control: no-store` kullanılmalıdır.
- `fetch` kullanan istemcilerde `cache: 'no-store'` belirtilmelidir.
- Ekleme, güncelleme veya silme sonrasında birinci sayfadan yeniden yükleme yapılmalıdır.
- Kullanıcıya manuel yenileme düğmesi verilmelidir.
- Infinite scroll tek başına gerçek zamanlı yayın değildir. Başka kullanıcıların yaptığı değişikliklerin ekrana anında düşmesi gerekiyorsa mevcut WebSocket altyapısı kullanılmalı; WebSocket olmayan modüllerde pencere yeniden odaklandığında veya kontrollü aralıklarla backend'den yenileme yapılmalıdır.

## Offset ve cursor seçimi

Projede mevcut endpoint'lerle uyum için sayfa/offset modeli kullanılmaktadır. Az ve orta sıklıkta değişen yönetim listeleri için bu yeterlidir. Stok hareketleri, bildirimler ve arıza logları gibi çok sık yeni kayıt eklenen büyük tablolarda sonraki geliştirme cursor tabanlı olmalıdır:

```text
GET /api/logs?limit=50&after=<son_kayit_id>
```

Backend yanıtı `nextCursor` ve `hasMore` döndürür. Cursor yaklaşımı, kullanıcı kaydırırken listenin başına yeni kayıt eklendiğinde offset kaymasını ve kayıt atlama riskini azaltır.

## Kontrol listesi

- [ ] API toplam kayıt sayısını döndürüyor.
- [ ] Arama ve filtreler backend sorgusuna uygulanıyor.
- [ ] Backend sayfa boyutunu güvenli aralıkta sınırlandırıyor.
- [ ] Sıralama benzersiz bir alanla kararlı hale getiriliyor.
- [ ] İlk sayfa eski listeyi değiştiriyor, sonraki sayfalar ekleniyor.
- [ ] Kayıtlar `id` ile tekilleştiriliyor.
- [ ] Aynı anda ikinci yükleme başlatılmıyor.
- [ ] Eski/gecikmiş istek cevapları yok sayılıyor.
- [ ] Filtre değişiminde sayfa ve liste sıfırlanıyor.
- [ ] Yüklenen/toplam kayıt sayısı kullanıcıya gösteriliyor.
- [ ] Otomatik yüklemeye ek olarak manuel düğme bulunuyor.
- [ ] Backend ve tarayıcı önbelleği güncel veri gerektiren endpoint'lerde kapalı.
- [ ] Liste sonuna gelindiğinde açık bir tamamlanma mesajı gösteriliyor.

## Kaynaklar

- MDN, Intersection Observer API: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- React, Effect ile veri çekerken eski yanıtları yok sayma: https://react.dev/learn/synchronizing-with-effects#fetching-data
- Prisma, offset ve cursor pagination: https://www.prisma.io/docs/orm/prisma-client/queries/pagination
