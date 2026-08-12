import type { MovementReason, MovementType, ProductStatus, PurchaseOrderStatus, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  depo: "Depo Personeli",
  satinalma: "Satın Alma Personeli",
  yonetici: "Yönetici",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  giris: "Stok Girişi",
  cikis: "Stok Çıkışı",
  transfer: "Transfer",
};

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  satin_alma: "Satın Alma",
  satis: "Satış",
  iade: "İade",
  fire: "Fire",
  sayim_duzeltme: "Sayım Düzeltmesi",
  transfer: "Depolar Arası Transfer",
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Taslak",
  ordered: "Sipariş Edildi",
  partially_received: "Kısmen Teslim Alındı",
  received: "Teslim Alındı",
  cancelled: "İptal Edildi",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  aktif: "Aktif",
  pasif: "Pasif",
};

export const PAGE_SIZE = 25;

export const TIMEZONE_OPTIONS: { value: string; label: string; iana: string }[] = [
  { value: "europe-istanbul", label: "(UTC+03:00) İstanbul", iana: "Europe/Istanbul" },
  { value: "europe-london", label: "(UTC+00:00) Londra", iana: "Europe/London" },
  { value: "america-new_york", label: "(UTC-05:00) New York", iana: "America/New_York" },
];

/** Shared by the Panel export modal and the Ayarlar "default export sections" preference. */
export const REPORT_SECTIONS = [
  { id: "all", label: "Tüm Dashboard Özeti", desc: "KPI metrikleri, kritik stoklar, stok hareketleri, depolar ve popüler ürünler." },
  { id: "kpi", label: "KPI Metrikleri & Özet", desc: "Stok, satın alma ve envanter üst panel göstergeleri." },
  { id: "critical", label: "Kritik Stok Uyarıları", desc: "Minimum stok seviyesinin altındaki acil ürünler." },
  { id: "movements", label: "Son Stok Hareketleri", desc: "Panelde yer alan son stok giriş, çıkış ve transfer kayıtları." },
  { id: "warehouse", label: "Depo Stok Kapasiteleri", desc: "Depo doluluk oranları ve birim kapasiteleri." },
  { id: "top_movers", label: "En Çok Hareket Görenler", desc: "İşlem hacmi en yüksek ilk 15 ürün." },
];

export const ALL_SPECIFIC_IDS = REPORT_SECTIONS.filter((s) => s.id !== "all").map((s) => s.id);
