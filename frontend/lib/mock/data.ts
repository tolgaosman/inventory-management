import type {
  AppUser,
  Category,
  MovementReason,
  Product,
  PurchaseOrder,
  PurchaseOrderStatus,
  Role,
  StockLevel,
  StockMovement,
  Supplier,
  Warehouse,
} from "@/lib/types";
import { id, int, mulberry32, pick } from "./seed";

const rand = mulberry32(20260810);

// ---------------------------------------------------------------------------
// Near East Technology - Depolar
// ---------------------------------------------------------------------------
export const warehouses: Warehouse[] = [
  { id: "wh-1", name: "Lefkoşa Kampüs Ana Depo", city: "Lefkoşa", address: "Yakın Doğu Bulvarı No:1", capacity: 15000 },
  { id: "wh-2", name: "Girne İnovasyon Deposu", city: "Girne", address: "Karakum Cd. No:45", capacity: 8000 },
  { id: "wh-3", name: "Gazimağusa Veri Merkezi Deposu", city: "Gazimağusa", address: "Teknoloji Bölgesi A-Blok", capacity: 10000 },
  { id: "wh-4", name: "Teknopark AR-GE Deposu", city: "Lefkoşa", address: "AR-GE Binası Zemin Kat", capacity: 6000 },
  { id: "wh-5", name: "İstanbul Lojistik Deposu", city: "İstanbul", address: "Hadımköy OSB 3. Cadde", capacity: 25000 },
  { id: "wh-6", name: "Ankara Bölge Deposu", city: "Ankara", address: "Ostim OSB 5. Cadde No:12", capacity: 12000 },
  { id: "wh-7", name: "İzmir Ege Lojistik Deposu", city: "İzmir", address: "Çiğli Serbest Bölge B-Blok", capacity: 9000 },
];

// ---------------------------------------------------------------------------
// Near East Technology - Kategoriler (IT & BT Donanım)
// ---------------------------------------------------------------------------
export const categories: Category[] = [
  { id: "cat-sunucu", name: "Sunucu & Veri Merkezi", parentId: null },
  { id: "cat-rack-server", name: "Rack Sunucu", parentId: "cat-sunucu" },
  { id: "cat-blade-server", name: "Blade Sunucu", parentId: "cat-sunucu" },
  { id: "cat-storage", name: "Veri Depolama (NAS/SAN)", parentId: "cat-sunucu" },
  { id: "cat-ups", name: "UPS & Güç Sistemleri", parentId: "cat-sunucu" },

  { id: "cat-ag-guvenlik", name: "Ağ & Siber Güvenlik", parentId: null },
  { id: "cat-switch", name: "Ağ Anahtarı (Switch)", parentId: "cat-ag-guvenlik" },
  { id: "cat-router", name: "Yönlendirici (Router)", parentId: "cat-ag-guvenlik" },
  { id: "cat-firewall", name: "Güvenlik Duvarı (Firewall)", parentId: "cat-ag-guvenlik" },
  { id: "cat-ap", name: "Access Point (Wi-Fi 6E)", parentId: "cat-ag-guvenlik" },

  { id: "cat-bilgisayar", name: "Bilgisayar & İş İstasyonu", parentId: null },
  { id: "cat-workstation", name: "İş İstasyonu (Workstation)", parentId: "cat-bilgisayar" },
  { id: "cat-kurumsal-laptop", name: "Kurumsal Laptop", parentId: "cat-bilgisayar" },
  { id: "cat-desktop", name: "Masaüstü PC", parentId: "cat-bilgisayar" },

  { id: "cat-yazilim", name: "Yazılım & Lisanslama", parentId: null },
  { id: "cat-os-license", name: "İşletim Sistemi Lisansı", parentId: "cat-yazilim" },
  { id: "cat-db-license", name: "Veritabanı Lisansı", parentId: "cat-yazilim" },
  { id: "cat-security-software", name: "Siber Güvenlik Lisansı", parentId: "cat-yazilim" },

  { id: "cat-akilli-kampus", name: "Akıllı Kampüs & IoT", parentId: null },
  { id: "cat-ip-kamera", name: "IP Kamera & Güvenlik", parentId: "cat-akilli-kampus" },
  { id: "cat-gecis-sistemi", name: "Kartlı Geçiş & Biyometrik", parentId: "cat-akilli-kampus" },
];

export const leafCategories = categories.filter((c) =>
  categories.some((p) => p.parentId === c.id) === false,
);

// ---------------------------------------------------------------------------
// Near East Technology - Tedarikçiler
// ---------------------------------------------------------------------------
export const suppliers: Supplier[] = [
  { id: "sup-1", name: "Cisco Systems Türkiye", contactName: "Ahmet Yılmaz", email: "ahmet@cisco.com", phone: "0533 111 22 33", city: "İstanbul" },
  { id: "sup-2", name: "Dell Technologies Enterprise", contactName: "Deniz Kaya", email: "deniz@dell.com", phone: "0542 222 33 44", city: "Lefkoşa" },
  { id: "sup-3", name: "HPE & Aruba Networks", contactName: "Selin Aydın", email: "selin@hpe.com", phone: "0555 333 44 55", city: "Ankara" },
  { id: "sup-4", name: "Lenovo Enterprise Solutions", contactName: "Murat Demir", email: "murat@lenovo.com", phone: "0532 444 55 66", city: "İstanbul" },
  { id: "sup-5", name: "Microsoft Türkiye Lisanslama", contactName: "Ece Şahin", email: "ece@microsoft.com", phone: "0533 555 66 77", city: "İstanbul" },
  { id: "sup-6", name: "Fortinet Cyprus Distribution", contactName: "Kerem Öz", email: "kerem@fortinet.com", phone: "0541 666 77 88", city: "Lefkoşa" },
  { id: "sup-7", name: "Palo Alto Networks", contactName: "İrem Çelik", email: "irem@paloaltonetworks.com", phone: "0552 777 88 99", city: "Girne" },
  { id: "sup-8", name: "NetApp Storage Solutions", contactName: "Baran Koç", email: "baran@netapp.com", phone: "0534 888 99 00", city: "Lefkoşa" },
  { id: "sup-9", name: "Schneider Electric (APC)", contactName: "Zeynep Arslan", email: "zeynep@se.com", phone: "0536 999 00 11", city: "Bursa" },
  { id: "sup-10", name: "Yakın Doğu IT Dağıtım", contactName: "Onur Polat", email: "onur@sirket.com", phone: "0538 000 11 22", city: "Lefkoşa" },
  { id: "sup-11", name: "Juniper Networks Distribution", contactName: "Hakan Er", email: "hakan@juniper.com", phone: "0532 101 22 33", city: "Ankara" },
  { id: "sup-12", name: "MikroTik Bölge Distribütörü", contactName: "Pınar Uçar", email: "pinar@mikrotik.com", phone: "0543 202 33 44", city: "İzmir" },
  { id: "sup-13", name: "Synology Türkiye", contactName: "Burak Toprak", email: "burak@synology.com", phone: "0535 303 44 55", city: "İstanbul" },
  { id: "sup-14", name: "Hikvision Cyprus", contactName: "Melis Kaan", email: "melis@hikvision.com", phone: "0544 404 55 66", city: "Girne" },
  { id: "sup-15", name: "Apple Enterprise Reseller", contactName: "Tarkan Sezer", email: "tarkan@applereseller.com", phone: "0533 505 66 77", city: "İstanbul" },
];

// ---------------------------------------------------------------------------
// Near East Technology - Kullanıcılar
// ---------------------------------------------------------------------------
export const users: AppUser[] = [
  { id: "48271", name: "Tolga Osman Falay", email: "tolgaosman@sirket.com", role: "yonetici", initials: "TO" },
  { id: "63094", name: "Gizem Karabaşak", email: "gizem.karabasak@sirket.com", role: "yonetici", initials: "GK" },
  { id: "17856", name: "Mustafa Hacı", email: "mustafa.haci@sirket.com", role: "depo", initials: "MH" },
  { id: "39412", name: "Alara Soysan", email: "alara.soysan@sirket.com", role: "satinalma", initials: "AS" },
  { id: "82637", name: "Aliye Kavaz", email: "aliye.kavaz@sirket.com", role: "depo", initials: "AK" },
  { id: "54180", name: "Irmak Bozkurt", email: "irmak.bozkurt@sirket.com", role: "satinalma", initials: "IB" },
  { id: "24680", name: "Kaan Muslu Çağa", email: "kaan.caga@sirket.com", role: "yonetici", initials: "KÇ" },
  { id: "71503", name: "Arda İbrahim Şahin", email: "arda.sahin@sirket.com", role: "yonetici", initials: "AŞ" },
  { id: "20946", name: "Dehan Saycıoğlu", email: "dehan.saycioglu@sirket.com", role: "depo", initials: "DS" },
  { id: "95328", name: "Mertkan Kılıçbey Türemen", email: "mertkan.turemen@sirket.com", role: "satinalma", initials: "MT" },
  { id: "46715", name: "Savaş Muhammed Muhtaroğlu", email: "savas.muhtaroglu@sirket.com", role: "yonetici", initials: "SM" },
  { id: "31849", name: "Berk Fenk", email: "berk.fenk@sirket.com", role: "depo", initials: "BF" },
  { id: "89234", name: "Çiğdem Dürüst", email: "cigdem.durust@sirket.com", role: "yonetici", initials: "ÇD" },
  { id: "57102", name: "Tolga Falay", email: "tolga.falay@sirket.com", role: "satinalma", initials: "TF" },
  { id: "66721", name: "Kerem Yılmaz", email: "kerem.yilmaz@sirket.com", role: "depo", initials: "KY" },
  { id: "12345", name: "Ayşe Kılıç", email: "ayse.kilic@sirket.com", role: "satinalma", initials: "AK" },
  { id: "98765", name: "Caner Yıldız", email: "caner.yildiz@sirket.com", role: "depo", initials: "CY" },
];

export const CURRENT_ROLES: Role[] = ["yonetici", "depo", "satinalma"];

// ---------------------------------------------------------------------------
// Near East Technology - Ürün Kataloğu
// ---------------------------------------------------------------------------
const productNamesByCategory: Record<string, string[]> = {
  "cat-rack-server": ["Dell PowerEdge R760", "HPE ProLiant DL380 Gen11", "Lenovo ThinkSystem SR650 V3", "Cisco UCS C240 M6", "Dell PowerEdge R650xs", "HPE ProLiant DL360 Gen11"],
  "cat-blade-server": ["Dell PowerEdge MX750c", "HPE Synergy 480 Gen11", "Cisco UCS B200 M6", "Lenovo Flex System x240 M6"],
  "cat-storage": ["NetApp FAS2750 SAN Storage", "Dell PowerStore 500T", "HPE Alletra 6000", "Synology Enterprise RS4021xs+", "QNAP TS-h1290FX NAS", "NetApp AFF A250"],
  "cat-ups": ["APC Smart-UPS RT 10kVA", "Eaton 9PX 6kVA UPS", "Vertiv Liebert GXT5 3000VA", "APC Smart-UPS SRT 5000VA"],
  "cat-switch": ["Cisco Catalyst 9300 48P Switch", "Aruba CX 6300M Switch", "Dell PowerSwitch N3248P-ON", "Juniper EX4400-48P", "MikroTik CRS326-24G-2S+RM"],
  "cat-router": ["Cisco ISR 4451 Router", "Juniper MX204 Universal Router", "MikroTik CCR2216-1G-12XS-2XQ", "Ubiquiti EdgeRouter Infinity"],
  "cat-firewall": ["FortiGate 100F Next-Gen Firewall", "Palo Alto PA-440 Firewall", "Cisco Secure Firewall 3110", "FortiGate 60F Desktop Firewall"],
  "cat-ap": ["Aruba AP-635 Wi-Fi 6E Access Point", "Cisco Catalyst 9136I AP", "FortiAP 431F Wi-Fi 6 AP", "Ubiquiti UniFi U6-Enterprise"],
  "cat-workstation": ["HP ZBook Fury 16 G10 Workstation", "Dell Precision 7780 Workstation", "Lenovo ThinkStation P620", "Apple Mac Studio M2 Ultra"],
  "cat-kurumsal-laptop": ["Lenovo ThinkPad T14 Gen 5", "Dell Latitude 5550", "HP EliteBook 840 G10", "Apple MacBook Pro 14 M3 Pro", "Lenovo ThinkPad X1 Carbon Gen 12"],
  "cat-desktop": ["Dell OptiPlex 7020 Tower", "Lenovo ThinkCentre M90q Tiny", "HP EliteDesk 800 G9", "Apple Mac mini M2 Pro"],
  "cat-os-license": ["Microsoft Windows Server 2025 Datacenter", "Red Hat Enterprise Linux 9 Subscription", "Ubuntu Advantage Enterprise", "Microsoft Windows 11 Pro Lisansı"],
  "cat-db-license": ["Microsoft SQL Server 2022 Enterprise", "Oracle Database 19c Enterprise Edition", "PostgreSQL Enterprise Destek Paketi"],
  "cat-security-software": ["Kaspersky Endpoint Security Cloud", "CrowdStrike Falcon Enterprise", "FortiClient EMS Pro License", "Microsoft Defender for Endpoint P2"],
  "cat-ip-kamera": ["Hikvision 4K Akıllı PTZ IP Kamera", "Dahua 8MP Termal IP Kamera", "Axis P3268-LV Dome Kamera", "Hikvision ColorVu 4MP Bullet Kamera"],
  "cat-gecis-sistemi": ["Suprema BioStation 3 Yüz Tanıma", "HID Signo 40 Kart Okuyucu Terminal", "ZKTeco SpeedFace V5L Terminal"],
};

const brandsByCategory: Record<string, string[]> = {
  "cat-rack-server": ["Dell", "HPE", "Lenovo", "Cisco"],
  "cat-blade-server": ["Dell", "HPE", "Cisco", "Lenovo"],
  "cat-storage": ["NetApp", "Dell", "HPE", "Synology", "QNAP"],
  "cat-ups": ["APC", "Eaton", "Vertiv"],
  "cat-switch": ["Cisco", "Aruba", "Dell", "Juniper", "MikroTik"],
  "cat-router": ["Cisco", "Juniper", "MikroTik", "Ubiquiti"],
  "cat-firewall": ["Fortinet", "Palo Alto", "Cisco"],
  "cat-ap": ["Aruba", "Cisco", "Fortinet", "Ubiquiti"],
  "cat-workstation": ["HP", "Dell", "Lenovo", "Apple"],
  "cat-kurumsal-laptop": ["Lenovo", "Dell", "HP", "Apple"],
  "cat-desktop": ["Dell", "Lenovo", "HP", "Apple"],
  "cat-os-license": ["Microsoft", "Red Hat", "Canonical"],
  "cat-db-license": ["Microsoft", "Oracle", "PostgreSQL"],
  "cat-security-software": ["Kaspersky", "CrowdStrike", "Fortinet", "Microsoft"],
  "cat-ip-kamera": ["Hikvision", "Dahua", "Axis"],
  "cat-gecis-sistemi": ["Suprema", "HID", "ZKTeco"],
};

const unitByCategory: Record<string, string> = {
  "cat-rack-server": "Adet",
  "cat-blade-server": "Adet",
  "cat-storage": "Adet",
  "cat-ups": "Adet",
  "cat-switch": "Adet",
  "cat-router": "Adet",
  "cat-firewall": "Adet",
  "cat-ap": "Adet",
  "cat-workstation": "Adet",
  "cat-kurumsal-laptop": "Adet",
  "cat-desktop": "Adet",
  "cat-os-license": "Lisans",
  "cat-db-license": "Lisans",
  "cat-security-software": "Lisans",
  "cat-ip-kamera": "Adet",
  "cat-gecis-sistemi": "Adet",
};

const priceRangeByCategory: Record<string, [number, number]> = {
  "cat-rack-server": [4500, 18000],
  "cat-blade-server": [5500, 22000],
  "cat-storage": [6000, 35000],
  "cat-ups": [1200, 6500],
  "cat-switch": [1500, 8500],
  "cat-router": [2200, 14000],
  "cat-firewall": [2800, 16000],
  "cat-ap": [450, 1800],
  "cat-workstation": [2200, 6800],
  "cat-kurumsal-laptop": [1100, 3200],
  "cat-desktop": [750, 2100],
  "cat-os-license": [800, 4500],
  "cat-db-license": [3500, 15000],
  "cat-security-software": [45, 250],
  "cat-ip-kamera": [250, 1400],
  "cat-gecis-sistemi": [650, 2800],
};

const productCategoryIds = Object.keys(productNamesByCategory);

function buildProducts(): Product[] {
  const list: Product[] = [];
  let n = 1;
  for (const catId of productCategoryIds) {
    const names = productNamesByCategory[catId];
    const brands = brandsByCategory[catId];
    const unit = unitByCategory[catId];
    const [minP, maxP] = priceRangeByCategory[catId];

    const imagesByCategory: Record<string, string[]> = {
      "cat-laptop": [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&q=85",
        "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=1200&q=85",
        "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1200&q=85",
      ],
      "cat-telefon": [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=85",
        "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=1200&q=85",
      ],
      "cat-tablet": [
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1200&q=85",
        "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=1200&q=85",
      ],
      "cat-aksesuar": [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=85",
        "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=1200&q=85",
        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1200&q=85",
      ],
      "cat-kirtasiye": [
        "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=1200&q=85",
      ],
      "cat-mobilya": [
        "https://images.unsplash.com/photo-1580481072645-022f9a6d83d0?w=1200&q=85",
        "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1200&q=85",
      ],
    };

    for (let rep = 0; rep < 4; rep++) {
      for (const baseName of names) {
        const brand = pick(rand, brands);
        const purchasePrice = int(rand, minP, maxP);
        const margin = 1.18 + rand() * 0.25;
        const salePrice = Math.round(purchasePrice * margin);
        const minStock = int(rand, 3, 12);
        const maxStock = minStock + int(rand, 15, 60);
        const supplierId = pick(rand, suppliers).id;
        const suffix = rep === 0 ? "" : ` (Rev ${rep + 1})`;
        const pool = imagesByCategory[catId] || [
          "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1200&q=85",
        ];
        const imageUrl = pool[n % pool.length];

        list.push({
          id: id("prd", n),
          name: `${baseName}${suffix}`,
          sku: `NET-${catId.replace("cat-", "").slice(0, 3).toUpperCase()}-${1000 + n}`,
          barcode: `869900${String(100000 + n)}`,
          categoryId: catId,
          brand,
          unit,
          purchasePrice,
          salePrice,
          minStock,
          maxStock,
          status: rand() > 0.05 ? "aktif" : "pasif",
          supplierId,
          imageUrl,
        });
        n++;
      }
    }
  }
  return list;
}

export const products: Product[] = buildProducts();

// ---------------------------------------------------------------------------
// Stok Seviyeleri
// ---------------------------------------------------------------------------
function buildStockLevels(): StockLevel[] {
  const levels: StockLevel[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    if (i < 16) {
      product.minStock = 30;
      const wh = warehouses[0];
      levels.push({ productId: product.id, warehouseId: wh.id, quantity: int(rand, 1, 5) });
      continue;
    }

    const warehouseCount = int(rand, 2, warehouses.length);
    const shuffled = [...warehouses].sort(() => rand() - 0.5).slice(0, warehouseCount);
    for (const wh of shuffled) {
      const quantity = int(rand, product.minStock + 2, product.maxStock);
      levels.push({ productId: product.id, warehouseId: wh.id, quantity });
    }
  }
  return levels;
}

export const stockLevels: StockLevel[] = buildStockLevels();

export function totalStockForProduct(productId: string): number {
  return stockLevels
    .filter((s) => s.productId === productId)
    .reduce((sum, s) => sum + s.quantity, 0);
}

export function stockForProductByWarehouse(productId: string): StockLevel[] {
  return stockLevels.filter((s) => s.productId === productId);
}

// ---------------------------------------------------------------------------
// Stok Hareketleri
// ---------------------------------------------------------------------------
const reasonsByType: Record<"giris" | "cikis", MovementReason[]> = {
  giris: ["satin_alma", "iade", "sayim_duzeltme"],
  cikis: ["satis", "fire", "sayim_duzeltme"],
};

function buildMovements(): StockMovement[] {
  const list: StockMovement[] = [];
  const now = Date.now();
  const days = 365;
  let n = 1;

  for (let d = days; d >= 0; d--) {
    const dayTs = now - d * 24 * 60 * 60 * 1000;
    const movementsToday = int(rand, 3, 14);
    for (let i = 0; i < movementsToday; i++) {
      const product = pick(rand, products);
      const warehouse = pick(rand, warehouses);
      const roll = rand();
      const type: "giris" | "cikis" | "transfer" =
        roll < 0.45 ? "giris" : roll < 0.85 ? "cikis" : "transfer";
      const quantity = int(rand, 1, 20);
      const previousQuantity = int(rand, 5, 100);
      let newQuantity = previousQuantity;
      let targetWarehouseId: string | undefined;

      if (type === "giris") {
        newQuantity = previousQuantity + quantity;
      } else if (type === "cikis") {
        newQuantity = Math.max(previousQuantity - quantity, 0);
      } else {
        newQuantity = Math.max(previousQuantity - quantity, 0);
        const others = warehouses.filter((w) => w.id !== warehouse.id);
        targetWarehouseId = pick(rand, others).id;
      }

      const reason: MovementReason =
        type === "transfer" ? "transfer" : pick(rand, reasonsByType[type]);

      const hour = int(rand, 8, 19);
      const minute = int(rand, 0, 59);
      const createdAt = new Date(dayTs);
      createdAt.setHours(hour, minute, 0, 0);

      list.push({
        id: id("mv", n),
        type,
        productId: product.id,
        warehouseId: warehouse.id,
        targetWarehouseId,
        quantity,
        previousQuantity,
        newQuantity,
        reason,
        supplierId: type === "giris" && reason === "satin_alma" ? product.supplierId : undefined,
        userId: pick(rand, users).id,
        note: undefined,
        createdAt: createdAt.toISOString(),
      });
      n++;
    }
  }

  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const stockMovements: StockMovement[] = buildMovements();

// ---------------------------------------------------------------------------
// Satın Alma Siparişleri
// ---------------------------------------------------------------------------
const poStatuses: PurchaseOrderStatus[] = [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "received",
  "cancelled",
];

function buildPurchaseOrders(): PurchaseOrder[] {
  const list: PurchaseOrder[] = [];
  const now = Date.now();
  for (let n = 1; n <= 80; n++) {
    const supplier = pick(rand, suppliers);
    const itemCount = int(rand, 1, 4);
    const items = Array.from({ length: itemCount }, () => {
      const product = pick(rand, products.filter((p) => p.supplierId === supplier.id));
      const fallback = pick(rand, products);
      const chosen = product ?? fallback;
      const quantity = int(rand, 2, 25);
      return {
        productId: chosen.id,
        quantity,
        unitPrice: chosen.purchasePrice,
        receivedQuantity: 0,
      };
    });
    const status = pick(rand, poStatuses);
    const createdDaysAgo = int(rand, 1, 120);
    const createdAt = new Date(now - createdDaysAgo * 24 * 60 * 60 * 1000).toISOString();
    const expectedAt = new Date(
      now - createdDaysAgo * 24 * 60 * 60 * 1000 + int(rand, 5, 21) * 24 * 60 * 60 * 1000,
    ).toISOString();

    for (const item of items) {
      if (status === "received") item.receivedQuantity = item.quantity;
      else if (status === "partially_received") item.receivedQuantity = int(rand, 1, item.quantity - 1 || 1);
    }

    list.push({
      id: id("po", n),
      code: `NET-PO-${2026}${String(n).padStart(4, "0")}`,
      supplierId: supplier.id,
      status,
      items,
      createdAt,
      expectedAt,
      currency: "TRY",
    });
  }
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const purchaseOrders: PurchaseOrder[] = buildPurchaseOrders();

export function purchaseOrderTotal(po: PurchaseOrder): number {
  return po.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}
