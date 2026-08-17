<?php

namespace Database\Seeders;

use App\Support\JsonStore;
use App\Support\Mulberry32;
use Illuminate\Support\Facades\Hash;

/**
 * PHP port of frontend/lib/mock/{seed,data}.ts. Generates the same volume of
 * data (7 warehouses, 21 categories, 15 suppliers, 13 users, 272 products,
 * ~950 stock levels, ~3100 movements over 366 days, 80 purchase orders) with
 * the same id formats, using the same mulberry32(20260810) seed so results
 * are stable run-to-run. Values won't be byte-identical to the frontend mock
 * (JS's Array.sort-based shuffle isn't replicated call-for-call — see
 * Mulberry32::shuffle) but the shapes, volumes and business invariants match.
 */
class DemoDataSeeder
{
    public function __construct(private JsonStore $store)
    {
    }

    public function run(): void
    {
        $rand = new Mulberry32(20260810);

        $warehouses = $this->warehouses();
        $categories = $this->categories();
        $suppliers = $this->suppliers();
        $users = $this->users();

        $products = $this->buildProducts($rand, $categories, $suppliers);
        $stockLevels = $this->buildStockLevels($rand, $products, $warehouses);
        $movements = $this->buildMovements($rand, $products, $warehouses, $users);
        $purchaseOrders = $this->buildPurchaseOrders($rand, $products, $suppliers, $warehouses);

        $this->store->write('warehouses', $warehouses);
        $this->store->write('categories', $categories);
        $this->store->write('suppliers', $suppliers);
        $this->store->write('users', $this->withPasswords($users));
        $this->store->write('products', $products);
        $this->store->write('stock_levels', $stockLevels);
        $this->store->write('stock_movements', $movements);
        $this->store->write('purchase_orders', $purchaseOrders);
        $this->store->write('settings', $this->defaultSettings());
        $this->store->write('idempotency_keys', []);
        $this->store->write('tokens', []);
    }

    private function withPasswords(array $users): array
    {
        $hash = Hash::make(config('inventory.demo_password'));

        return array_map(fn ($u) => $u + ['password_hash' => $hash], $users);
    }

    private function warehouses(): array
    {
        return [
            ['id' => 'wh-1', 'name' => 'Lefkoşa Kampüs Ana Depo', 'city' => 'Lefkoşa', 'address' => 'Yakın Doğu Bulvarı No:1', 'capacity' => 15000],
            ['id' => 'wh-2', 'name' => 'Girne İnovasyon Deposu', 'city' => 'Girne', 'address' => 'Karakum Cd. No:45', 'capacity' => 8000],
            ['id' => 'wh-3', 'name' => 'Gazimağusa Veri Merkezi Deposu', 'city' => 'Gazimağusa', 'address' => 'Teknoloji Bölgesi A-Blok', 'capacity' => 10000],
            ['id' => 'wh-4', 'name' => 'Teknopark AR-GE Deposu', 'city' => 'Lefkoşa', 'address' => 'AR-GE Binası Zemin Kat', 'capacity' => 6000],
            ['id' => 'wh-5', 'name' => 'İstanbul Lojistik Deposu', 'city' => 'İstanbul', 'address' => 'Hadımköy OSB 3. Cadde', 'capacity' => 25000],
            ['id' => 'wh-6', 'name' => 'Ankara Bölge Deposu', 'city' => 'Ankara', 'address' => 'Ostim OSB 5. Cadde No:12', 'capacity' => 12000],
            ['id' => 'wh-7', 'name' => 'İzmir Ege Lojistik Deposu', 'city' => 'İzmir', 'address' => 'Çiğli Serbest Bölge B-Blok', 'capacity' => 9000],
        ];
    }

    private function categories(): array
    {
        return [
            ['id' => 'cat-sunucu', 'name' => 'Sunucu & Veri Merkezi', 'parentId' => null],
            ['id' => 'cat-rack-server', 'name' => 'Rack Sunucu', 'parentId' => 'cat-sunucu'],
            ['id' => 'cat-blade-server', 'name' => 'Blade Sunucu', 'parentId' => 'cat-sunucu'],
            ['id' => 'cat-storage', 'name' => 'Veri Depolama (NAS/SAN)', 'parentId' => 'cat-sunucu'],
            ['id' => 'cat-ups', 'name' => 'UPS & Güç Sistemleri', 'parentId' => 'cat-sunucu'],

            ['id' => 'cat-ag-guvenlik', 'name' => 'Ağ & Siber Güvenlik', 'parentId' => null],
            ['id' => 'cat-switch', 'name' => 'Ağ Anahtarı (Switch)', 'parentId' => 'cat-ag-guvenlik'],
            ['id' => 'cat-router', 'name' => 'Yönlendirici (Router)', 'parentId' => 'cat-ag-guvenlik'],
            ['id' => 'cat-firewall', 'name' => 'Güvenlik Duvarı (Firewall)', 'parentId' => 'cat-ag-guvenlik'],
            ['id' => 'cat-ap', 'name' => 'Access Point (Wi-Fi 6E)', 'parentId' => 'cat-ag-guvenlik'],

            ['id' => 'cat-bilgisayar', 'name' => 'Bilgisayar & İş İstasyonu', 'parentId' => null],
            ['id' => 'cat-workstation', 'name' => 'İş İstasyonu (Workstation)', 'parentId' => 'cat-bilgisayar'],
            ['id' => 'cat-kurumsal-laptop', 'name' => 'Kurumsal Laptop', 'parentId' => 'cat-bilgisayar'],
            ['id' => 'cat-desktop', 'name' => 'Masaüstü PC', 'parentId' => 'cat-bilgisayar'],

            ['id' => 'cat-yazilim', 'name' => 'Yazılım & Lisanslama', 'parentId' => null],
            ['id' => 'cat-os-license', 'name' => 'İşletim Sistemi Lisansı', 'parentId' => 'cat-yazilim'],
            ['id' => 'cat-db-license', 'name' => 'Veritabanı Lisansı', 'parentId' => 'cat-yazilim'],
            ['id' => 'cat-security-software', 'name' => 'Siber Güvenlik Lisansı', 'parentId' => 'cat-yazilim'],

            ['id' => 'cat-akilli-kampus', 'name' => 'Akıllı Kampüs & IoT', 'parentId' => null],
            ['id' => 'cat-ip-kamera', 'name' => 'IP Kamera & Güvenlik', 'parentId' => 'cat-akilli-kampus'],
            ['id' => 'cat-gecis-sistemi', 'name' => 'Kartlı Geçiş & Biyometrik', 'parentId' => 'cat-akilli-kampus'],
        ];
    }

    private function suppliers(): array
    {
        return [
            ['id' => 'sup-1', 'name' => 'Cisco Systems Türkiye', 'contactName' => 'Ahmet Yılmaz', 'email' => 'ahmet@cisco.com', 'phone' => '0533 111 22 33', 'city' => 'İstanbul'],
            ['id' => 'sup-2', 'name' => 'Dell Technologies Enterprise', 'contactName' => 'Deniz Kaya', 'email' => 'deniz@dell.com', 'phone' => '0542 222 33 44', 'city' => 'Lefkoşa'],
            ['id' => 'sup-3', 'name' => 'HPE & Aruba Networks', 'contactName' => 'Selin Aydın', 'email' => 'selin@hpe.com', 'phone' => '0555 333 44 55', 'city' => 'Ankara'],
            ['id' => 'sup-4', 'name' => 'Lenovo Enterprise Solutions', 'contactName' => 'Murat Demir', 'email' => 'murat@lenovo.com', 'phone' => '0532 444 55 66', 'city' => 'İstanbul'],
            ['id' => 'sup-5', 'name' => 'Microsoft Türkiye Lisanslama', 'contactName' => 'Ece Şahin', 'email' => 'ece@microsoft.com', 'phone' => '0533 555 66 77', 'city' => 'İstanbul'],
            ['id' => 'sup-6', 'name' => 'Fortinet Cyprus Distribution', 'contactName' => 'Kerem Öz', 'email' => 'kerem@fortinet.com', 'phone' => '0541 666 77 88', 'city' => 'Lefkoşa'],
            ['id' => 'sup-7', 'name' => 'Palo Alto Networks', 'contactName' => 'İrem Çelik', 'email' => 'irem@paloaltonetworks.com', 'phone' => '0552 777 88 99', 'city' => 'Girne'],
            ['id' => 'sup-8', 'name' => 'NetApp Storage Solutions', 'contactName' => 'Baran Koç', 'email' => 'baran@netapp.com', 'phone' => '0534 888 99 00', 'city' => 'Lefkoşa'],
            ['id' => 'sup-9', 'name' => 'Schneider Electric (APC)', 'contactName' => 'Zeynep Arslan', 'email' => 'zeynep@se.com', 'phone' => '0536 999 00 11', 'city' => 'Bursa'],
            ['id' => 'sup-10', 'name' => 'Yakın Doğu IT Dağıtım', 'contactName' => 'Onur Polat', 'email' => 'onur@sirket.com', 'phone' => '0538 000 11 22', 'city' => 'Lefkoşa'],
            ['id' => 'sup-11', 'name' => 'Juniper Networks Distribution', 'contactName' => 'Hakan Er', 'email' => 'hakan@juniper.com', 'phone' => '0532 101 22 33', 'city' => 'Ankara'],
            ['id' => 'sup-12', 'name' => 'MikroTik Bölge Distribütörü', 'contactName' => 'Pınar Uçar', 'email' => 'pinar@mikrotik.com', 'phone' => '0543 202 33 44', 'city' => 'İzmir'],
            ['id' => 'sup-13', 'name' => 'Synology Türkiye', 'contactName' => 'Burak Toprak', 'email' => 'burak@synology.com', 'phone' => '0535 303 44 55', 'city' => 'İstanbul'],
            ['id' => 'sup-14', 'name' => 'Hikvision Cyprus', 'contactName' => 'Melis Kaan', 'email' => 'melis@hikvision.com', 'phone' => '0544 404 55 66', 'city' => 'Girne'],
            ['id' => 'sup-15', 'name' => 'Apple Enterprise Reseller', 'contactName' => 'Tarkan Sezer', 'email' => 'tarkan@applereseller.com', 'phone' => '0533 505 66 77', 'city' => 'İstanbul'],
        ];
    }

    private function users(): array
    {
        return [
            ['id' => '48271', 'name' => 'Tolga Osman Falay', 'email' => 'tolgaosman@sirket.com', 'role' => 'yonetici', 'initials' => 'TO'],
            ['id' => '63094', 'name' => 'Gizem Karabaşak', 'email' => 'gizem.karabasak@sirket.com', 'role' => 'yonetici', 'initials' => 'GK'],
            ['id' => '17856', 'name' => 'Mustafa Hacı', 'email' => 'mustafa.haci@sirket.com', 'role' => 'depo', 'initials' => 'MH'],
            ['id' => '39412', 'name' => 'Alara Soysan', 'email' => 'alara.soysan@sirket.com', 'role' => 'satinalma', 'initials' => 'AS'],
            ['id' => '82637', 'name' => 'Aliye Kavaz', 'email' => 'aliye.kavaz@sirket.com', 'role' => 'depo', 'initials' => 'AK'],
            ['id' => '54180', 'name' => 'Irmak Bozkurt', 'email' => 'irmak.bozkurt@sirket.com', 'role' => 'satinalma', 'initials' => 'IB'],
            ['id' => '24680', 'name' => 'Kaan Muslu Çağa', 'email' => 'kaan.caga@sirket.com', 'role' => 'yonetici', 'initials' => 'KÇ'],
            ['id' => '71503', 'name' => 'Arda İbrahim Şahin', 'email' => 'arda.sahin@sirket.com', 'role' => 'yonetici', 'initials' => 'AŞ'],
            ['id' => '20946', 'name' => 'Dehan Saycıoğlu', 'email' => 'dehan.saycioglu@sirket.com', 'role' => 'depo', 'initials' => 'DS'],
            ['id' => '95328', 'name' => 'Mertkan Kılıçbey Türemen', 'email' => 'mertkan.turemen@sirket.com', 'role' => 'satinalma', 'initials' => 'MT'],
            ['id' => '46715', 'name' => 'Savaş Muhammed Muhtaroğlu', 'email' => 'savas.muhtaroglu@sirket.com', 'role' => 'yonetici', 'initials' => 'SM'],
            ['id' => '31849', 'name' => 'Berk Fenk', 'email' => 'berk.fenk@sirket.com', 'role' => 'depo', 'initials' => 'BF'],
            ['id' => '89234', 'name' => 'Çiğdem Dürüst', 'email' => 'cigdem.durust@sirket.com', 'role' => 'yonetici', 'initials' => 'ÇD'],
        ];
    }

    private function productCatalog(): array
    {
        return [
            'names' => [
                'cat-rack-server' => ['Dell PowerEdge R760', 'HPE ProLiant DL380 Gen11', 'Lenovo ThinkSystem SR650 V3', 'Cisco UCS C240 M6', 'Dell PowerEdge R650xs', 'HPE ProLiant DL360 Gen11'],
                'cat-blade-server' => ['Dell PowerEdge MX750c', 'HPE Synergy 480 Gen11', 'Cisco UCS B200 M6', 'Lenovo Flex System x240 M6'],
                'cat-storage' => ['NetApp FAS2750 SAN Storage', 'Dell PowerStore 500T', 'HPE Alletra 6000', 'Synology Enterprise RS4021xs+', 'QNAP TS-h1290FX NAS', 'NetApp AFF A250'],
                'cat-ups' => ['APC Smart-UPS RT 10kVA', 'Eaton 9PX 6kVA UPS', 'Vertiv Liebert GXT5 3000VA', 'APC Smart-UPS SRT 5000VA'],
                'cat-switch' => ['Cisco Catalyst 9300 48P Switch', 'Aruba CX 6300M Switch', 'Dell PowerSwitch N3248P-ON', 'Juniper EX4400-48P', 'MikroTik CRS326-24G-2S+RM'],
                'cat-router' => ['Cisco ISR 4451 Router', 'Juniper MX204 Universal Router', 'MikroTik CCR2216-1G-12XS-2XQ', 'Ubiquiti EdgeRouter Infinity'],
                'cat-firewall' => ['FortiGate 100F Next-Gen Firewall', 'Palo Alto PA-440 Firewall', 'Cisco Secure Firewall 3110', 'FortiGate 60F Desktop Firewall'],
                'cat-ap' => ['Aruba AP-635 Wi-Fi 6E Access Point', 'Cisco Catalyst 9136I AP', 'FortiAP 431F Wi-Fi 6 AP', 'Ubiquiti UniFi U6-Enterprise'],
                'cat-workstation' => ['HP ZBook Fury 16 G10 Workstation', 'Dell Precision 7780 Workstation', 'Lenovo ThinkStation P620', 'Apple Mac Studio M2 Ultra'],
                'cat-kurumsal-laptop' => ['Lenovo ThinkPad T14 Gen 5', 'Dell Latitude 5550', 'HP EliteBook 840 G10', 'Apple MacBook Pro 14 M3 Pro', 'Lenovo ThinkPad X1 Carbon Gen 12'],
                'cat-desktop' => ['Dell OptiPlex 7020 Tower', 'Lenovo ThinkCentre M90q Tiny', 'HP EliteDesk 800 G9', 'Apple Mac mini M2 Pro'],
                'cat-os-license' => ['Microsoft Windows Server 2025 Datacenter', 'Red Hat Enterprise Linux 9 Subscription', 'Ubuntu Advantage Enterprise', 'Microsoft Windows 11 Pro Lisansı'],
                'cat-db-license' => ['Microsoft SQL Server 2022 Enterprise', 'Oracle Database 19c Enterprise Edition', 'PostgreSQL Enterprise Destek Paketi'],
                'cat-security-software' => ['Kaspersky Endpoint Security Cloud', 'CrowdStrike Falcon Enterprise', 'FortiClient EMS Pro License', 'Microsoft Defender for Endpoint P2'],
                'cat-ip-kamera' => ['Hikvision 4K Akıllı PTZ IP Kamera', 'Dahua 8MP Termal IP Kamera', 'Axis P3268-LV Dome Kamera', 'Hikvision ColorVu 4MP Bullet Kamera'],
                'cat-gecis-sistemi' => ['Suprema BioStation 3 Yüz Tanıma', 'HID Signo 40 Kart Okuyucu Terminal', 'ZKTeco SpeedFace V5L Terminal'],
            ],
            'brands' => [
                'cat-rack-server' => ['Dell', 'HPE', 'Lenovo', 'Cisco'],
                'cat-blade-server' => ['Dell', 'HPE', 'Cisco', 'Lenovo'],
                'cat-storage' => ['NetApp', 'Dell', 'HPE', 'Synology', 'QNAP'],
                'cat-ups' => ['APC', 'Eaton', 'Vertiv'],
                'cat-switch' => ['Cisco', 'Aruba', 'Dell', 'Juniper', 'MikroTik'],
                'cat-router' => ['Cisco', 'Juniper', 'MikroTik', 'Ubiquiti'],
                'cat-firewall' => ['Fortinet', 'Palo Alto', 'Cisco'],
                'cat-ap' => ['Aruba', 'Cisco', 'Fortinet', 'Ubiquiti'],
                'cat-workstation' => ['HP', 'Dell', 'Lenovo', 'Apple'],
                'cat-kurumsal-laptop' => ['Lenovo', 'Dell', 'HP', 'Apple'],
                'cat-desktop' => ['Dell', 'Lenovo', 'HP', 'Apple'],
                'cat-os-license' => ['Microsoft', 'Red Hat', 'Canonical'],
                'cat-db-license' => ['Microsoft', 'Oracle', 'PostgreSQL'],
                'cat-security-software' => ['Kaspersky', 'CrowdStrike', 'Fortinet', 'Microsoft'],
                'cat-ip-kamera' => ['Hikvision', 'Dahua', 'Axis'],
                'cat-gecis-sistemi' => ['Suprema', 'HID', 'ZKTeco'],
            ],
            'unit' => [
                'cat-rack-server' => 'Adet', 'cat-blade-server' => 'Adet', 'cat-storage' => 'Adet', 'cat-ups' => 'Adet',
                'cat-switch' => 'Adet', 'cat-router' => 'Adet', 'cat-firewall' => 'Adet', 'cat-ap' => 'Adet',
                'cat-workstation' => 'Adet', 'cat-kurumsal-laptop' => 'Adet', 'cat-desktop' => 'Adet',
                'cat-os-license' => 'Lisans', 'cat-db-license' => 'Lisans', 'cat-security-software' => 'Lisans',
                'cat-ip-kamera' => 'Adet', 'cat-gecis-sistemi' => 'Adet',
            ],
            'priceRange' => [
                'cat-rack-server' => [4500, 18000], 'cat-blade-server' => [5500, 22000], 'cat-storage' => [6000, 35000],
                'cat-ups' => [1200, 6500], 'cat-switch' => [1500, 8500], 'cat-router' => [2200, 14000],
                'cat-firewall' => [2800, 16000], 'cat-ap' => [450, 1800], 'cat-workstation' => [2200, 6800],
                'cat-kurumsal-laptop' => [1100, 3200], 'cat-desktop' => [750, 2100], 'cat-os-license' => [800, 4500],
                'cat-db-license' => [3500, 15000], 'cat-security-software' => [45, 250], 'cat-ip-kamera' => [250, 1400],
                'cat-gecis-sistemi' => [650, 2800],
            ],
        ];
    }

    private function buildProducts(Mulberry32 $rand, array $categories, array $suppliers): array
    {
        $catalog = $this->productCatalog();
        $fallbackImage = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1200&q=85';
        $list = [];
        $n = 1;

        foreach (array_keys($catalog['names']) as $catId) {
            $names = $catalog['names'][$catId];
            $brands = $catalog['brands'][$catId];
            $unit = $catalog['unit'][$catId];
            [$minP, $maxP] = $catalog['priceRange'][$catId];

            for ($rep = 0; $rep < 4; $rep++) {
                foreach ($names as $baseName) {
                    $brand = $rand->pick($brands);
                    $purchasePrice = $rand->int($minP, $maxP);
                    $margin = 1.18 + $rand->next() * 0.25;
                    $salePrice = (int) round($purchasePrice * $margin);
                    $minStock = $rand->int(3, 12);
                    $maxStock = $minStock + $rand->int(15, 60);
                    $supplierId = $rand->pick($suppliers)['id'];
                    $suffix = $rep === 0 ? '' : ' (Rev '.($rep + 1).')';

                    $catSlug = strtoupper(substr(str_replace('cat-', '', $catId), 0, 3));

                    $list[] = [
                        'id' => Mulberry32::id('prd', $n),
                        'name' => $baseName.$suffix,
                        'sku' => "NET-{$catSlug}-".(1000 + $n),
                        'barcode' => '869900'.(100000 + $n),
                        'categoryId' => $catId,
                        'brand' => $brand,
                        'unit' => $unit,
                        'purchasePrice' => $purchasePrice,
                        'salePrice' => $salePrice,
                        'minStock' => $minStock,
                        'maxStock' => $maxStock,
                        'status' => $rand->next() > 0.05 ? 'aktif' : 'pasif',
                        'supplierId' => $supplierId,
                        'imageUrl' => $fallbackImage,
                    ];
                    $n++;
                }
            }
        }

        return $list;
    }

    private function buildStockLevels(Mulberry32 $rand, array $products, array $warehouses): array
    {
        $levels = [];

        foreach ($products as $i => &$product) {
            if ($i < 16) {
                $product['minStock'] = 30;
                $wh = $warehouses[0];
                $levels[] = ['productId' => $product['id'], 'warehouseId' => $wh['id'], 'quantity' => $rand->int(1, 5)];
                continue;
            }

            $warehouseCount = $rand->int(2, count($warehouses));
            $shuffled = array_slice($rand->shuffle($warehouses), 0, $warehouseCount);
            foreach ($shuffled as $wh) {
                $quantity = $rand->int($product['minStock'] + 2, $product['maxStock']);
                $levels[] = ['productId' => $product['id'], 'warehouseId' => $wh['id'], 'quantity' => $quantity];
            }
        }
        unset($product);

        return $levels;
    }

    private function buildMovements(Mulberry32 $rand, array $products, array $warehouses, array $users): array
    {
        $reasonsByType = [
            'giris' => ['satin_alma', 'iade', 'sayim_duzeltme'],
            'cikis' => ['satis', 'fire', 'sayim_duzeltme'],
        ];

        $list = [];
        $now = time();
        $days = 365;
        $n = 1;

        for ($d = $days; $d >= 0; $d--) {
            $dayTs = $now - $d * 86400;
            $movementsToday = $rand->int(3, 14);

            for ($i = 0; $i < $movementsToday; $i++) {
                $product = $rand->pick($products);
                $warehouse = $rand->pick($warehouses);
                $roll = $rand->next();
                $type = $roll < 0.45 ? 'giris' : ($roll < 0.85 ? 'cikis' : 'transfer');
                $quantity = $rand->int(1, 20);
                $previousQuantity = $rand->int(5, 100);
                $newQuantity = $previousQuantity;
                $targetWarehouseId = null;

                if ($type === 'giris') {
                    $newQuantity = $previousQuantity + $quantity;
                } elseif ($type === 'cikis') {
                    $newQuantity = max($previousQuantity - $quantity, 0);
                } else {
                    $newQuantity = max($previousQuantity - $quantity, 0);
                    $others = array_values(array_filter($warehouses, fn ($w) => $w['id'] !== $warehouse['id']));
                    $targetWarehouseId = $rand->pick($others)['id'];
                }

                $reason = $type === 'transfer' ? 'transfer' : $rand->pick($reasonsByType[$type]);

                $hour = $rand->int(8, 19);
                $minute = $rand->int(0, 59);
                $createdAt = gmdate('Y-m-d', $dayTs)."T".sprintf('%02d:%02d:00.000', $hour, $minute).'Z';

                $list[] = [
                    'id' => Mulberry32::id('mv', $n),
                    'type' => $type,
                    'productId' => $product['id'],
                    'warehouseId' => $warehouse['id'],
                    'targetWarehouseId' => $targetWarehouseId,
                    'quantity' => $quantity,
                    'previousQuantity' => $previousQuantity,
                    'newQuantity' => $newQuantity,
                    'reason' => $reason,
                    'supplierId' => ($type === 'giris' && $reason === 'satin_alma') ? $product['supplierId'] : null,
                    'purchaseOrderId' => null,
                    'userId' => $rand->pick($users)['id'],
                    'note' => null,
                    'createdAt' => $createdAt,
                ];
                $n++;
            }
        }

        usort($list, fn ($a, $b) => strcmp($b['createdAt'], $a['createdAt']));

        return $list;
    }

    private function buildPurchaseOrders(Mulberry32 $rand, array $products, array $suppliers, array $warehouses): array
    {
        $poStatuses = ['draft', 'ordered', 'partially_received', 'received', 'received', 'cancelled'];
        $list = [];
        $now = time();

        for ($n = 1; $n <= 80; $n++) {
            $supplier = $rand->pick($suppliers);
            $itemCount = $rand->int(1, 4);
            $bySupplier = array_values(array_filter($products, fn ($p) => $p['supplierId'] === $supplier['id']));

            $items = [];
            for ($k = 0; $k < $itemCount; $k++) {
                $chosen = count($bySupplier) > 0 ? $rand->pick($bySupplier) : $rand->pick($products);
                $quantity = $rand->int(2, 25);
                $items[] = [
                    'productId' => $chosen['id'],
                    'quantity' => $quantity,
                    'unitPrice' => $chosen['purchasePrice'],
                    'receivedQuantity' => 0,
                ];
            }

            $status = $rand->pick($poStatuses);
            $createdDaysAgo = $rand->int(1, 120);
            $createdAtTs = $now - $createdDaysAgo * 86400;
            $expectedAtTs = $createdAtTs + $rand->int(5, 21) * 86400;

            foreach ($items as &$item) {
                if ($status === 'received') {
                    $item['receivedQuantity'] = $item['quantity'];
                } elseif ($status === 'partially_received') {
                    $item['receivedQuantity'] = $rand->int(1, max($item['quantity'] - 1, 1));
                }
            }
            unset($item);

            $warehouse = $rand->pick($warehouses);

            $deliveryJitterDays = $rand->int(-3, 6);
            $receivedAt = $status === 'received'
                ? gmdate('Y-m-d\TH:i:s.000\Z', $expectedAtTs + $deliveryJitterDays * 86400)
                : null;

            $list[] = [
                'id' => Mulberry32::id('po', $n),
                'code' => 'NET-PO-2026'.sprintf('%04d', $n),
                'supplierId' => $supplier['id'],
                'warehouseId' => $warehouse['id'],
                'status' => $status,
                'items' => $items,
                'createdAt' => gmdate('Y-m-d\TH:i:s.000\Z', $createdAtTs),
                'expectedAt' => gmdate('Y-m-d\TH:i:s.000\Z', $expectedAtTs),
                'receivedAt' => $receivedAt,
                'currency' => 'TRY',
                'notes' => null,
            ];
        }

        usort($list, fn ($a, $b) => strcmp($b['createdAt'], $a['createdAt']));

        return $list;
    }

    private function defaultSettings(): array
    {
        return [
            'company' => [
                'companyName' => 'Near East Technology',
                'taxOffice' => 'Lefkoşa Vergi Dairesi',
                'taxNumber' => '1234567890',
                'address' => 'Yakın Doğu Bulvarı No:1, Lefkoşa, KKTC',
            ],
            'notifications' => [
                'notifyStock' => true,
                'notifyOrder' => true,
                'notifySystem' => false,
            ],
            'timezone' => 'Europe/Istanbul',
            'showKurus' => false,
            'defaultRange' => 'bu-ay',
        ];
    }
}
