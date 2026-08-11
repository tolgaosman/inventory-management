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

export const PAGE_SIZE = 10;

export const TIMEZONE_OPTIONS: { value: string; label: string; iana: string }[] = [
  { value: "europe-istanbul", label: "(UTC+03:00) İstanbul", iana: "Europe/Istanbul" },
  { value: "europe-london", label: "(UTC+00:00) Londra", iana: "Europe/London" },
  { value: "america-new_york", label: "(UTC-05:00) New York", iana: "America/New_York" },
];

/** Shared by the Panel export modal and the Ayarlar "default export sections" preference. */
export const REPORT_SECTIONS = [
  { id: "all", label: "Tüm Rapor (Tam Döküm)", desc: "KPI özetleri, stok hareketleri, depolar ve tüm ürünler." },
  { id: "kpi", label: "Dashboard & KPI Özeti", desc: "Yalnızca üst panel sayısal metrikleri." },
  { id: "critical", label: "Kritik Stok Listesi", desc: "Minimum stok seviyesinin altındaki ürünler." },
  { id: "movements", label: "Stok Hareketleri", desc: "Tüm giriş, çıkış ve depolar arası transfer kayıtları." },
  { id: "warehouse", label: "Depo Bazında Stok", desc: "Depo doluluk oranları ve birim kapasiteleri." },
  { id: "products", label: "Ürün Kataloğu", desc: "Katalogdaki tüm aktif ürünler ve mevcut stok miktarları." },
];

export const ALL_SPECIFIC_IDS = REPORT_SECTIONS.filter((s) => s.id !== "all").map((s) => s.id);
