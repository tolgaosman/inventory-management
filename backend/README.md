# Near East Technology — Envanter Yönetimi Backend (Laravel)

Bu backend, `frontend/lib/api/*.ts` içindeki sözleşmeyi (endpoint'ler, hata
kodları, Türkçe mesajlar, iş kuralları) birebir uygulayan bir Laravel 12 REST
API'sidir. **Veritabanı kullanılmaz** — tüm veri `storage/app/data/*.json`
dosyalarında tutulur, uygulama açılışında seed'den üretilir.

Frontend'e bağlanmamıştır; frontend şu an mock katmanında çalışmaya devam
ediyor. Bu backend bağımsız olarak test edilebilir/geliştirilebilir.

## Kurulum

```bash
cd backend
composer install
php artisan data:seed --fresh   # storage/app/data/*.json üretir
php artisan serve --port=8000
```

`.env` içindeki `DEMO_PASSWORD` (varsayılan `demo1234`) tüm demo
kullanıcılar için ortak şifredir.

## Demo giriş

```
POST /api/auth/login
{ "email": "tolgaosman@sirket.com", "password": "demo1234" }
```

13 demo kullanıcı `storage/app/data/users.json` içinde (`database/seeders/DemoDataSeeder.php`
kaynak listesiyle aynı) — 3 rol: `yonetici` (tam yetki), `satinalma`
(ürün görüntüleme + satın alma + tedarikçi), `depo` (ürün görüntüleme + stok
giriş/çıkış/transfer). Yetki haritası `config/permissions.php`.

Dönen `token`'ı sonraki isteklerde `Authorization: Bearer <token>` header'ı
ile gönderin.

## Mimari

- `app/Support/JsonStore.php` — dosya tabanlı "veritabanı". `transaction()`
  çoklu-koleksiyon yazımlarını (örn. sipariş teslim alma) hepsi-ya-da-hiçbiri
  şeklinde garanti eder (hata durumunda tüm dosyalar geri alınır).
- `app/Support/TextTools.php` — Türkçe diyakritik-duyarsız arama,
  `tr-TR` sıralama, `{rows,total,page,pageSize}` sayfalama zarfı.
- `app/Support/InventoryCalc.php` — kritik/düşük/normal/fazla stok eşikleri
  (tek yerden, frontend'deki gibi iki yerde tekrarlanmadan).
- `app/Exceptions/ApiException.php` — `{message, code}` hata zarfı;
  `NOT_FOUND`→404, `VALIDATION`→422, `CONFLICT`→409, `FORBIDDEN`→403.
- `app/Services/StockService.php` — stok giriş/çıkış/transfer, kalıcı
  idempotency-key desteğiyle (`idempotency_keys.json`).
- `app/Services/PurchaseOrderService.php` — sipariş durum makinesi ve teslim
  alma (stok hareketleri önce, PO güncellemesi sonra — hepsi tek transaction).
- `database/seeders/DemoDataSeeder.php` — `frontend/lib/mock/{seed,data}.ts`'in
  PHP portu; aynı `mulberry32(20260810)` PRNG ile aynı hacimde veri üretir.

## Komutlar

```bash
php artisan data:seed            # mevcut veriyi korur, dosya yoksa üretir
php artisan data:seed --fresh    # tüm JSON dosyalarını silip yeniden üretir
php artisan route:list --path=api
```

## Test

`api.http` dosyasını VS Code REST Client eklentisiyle açıp sırayla
çalıştırabilirsiniz (login → token değişkeni otomatik dolar).

## Frontend'e bağlama (sonraki adım, bu iş kapsamında yapılmadı)

`frontend/lib/api/client.ts` başındaki yoruma göre tasarlanmıştır: gerçek bir
backend geldiğinde yalnızca `frontend/lib/api/*.ts` dosyalarının içeriği
(mock array erişimleri yerine `fetch(`${API_URL}/...`)`) değişecek şekilde.
`NEXT_PUBLIC_API_URL` zaten `next.config.ts`'de tanımlı ama hiçbir yerde
okunmuyor — bağlama adımında kullanılabilir.
