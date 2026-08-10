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
