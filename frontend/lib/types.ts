// Domain types for the inventory management system.
// Mirrors the entities described in project_description.txt.

export type Role = "depo" | "satinalma" | "yonetici";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  address: string;
  capacity: number;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
}

export type ProductStatus = "aktif" | "pasif";

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  maxStock: number;
  status: ProductStatus;
  supplierId: string;
  imageUrl?: string;
}

/** Quantity of a single product inside a single warehouse. */
export interface StockLevel {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export type MovementType = "giris" | "cikis" | "transfer";

export type MovementReason =
  | "satin_alma"
  | "satis"
  | "iade"
  | "fire"
  | "sayim_duzeltme"
  | "transfer";

export interface StockMovement {
  id: string;
  type: MovementType;
  productId: string;
  warehouseId: string;
  targetWarehouseId?: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: MovementReason;
  supplierId?: string;
  /** Set when this "giriş" was created by receiving a purchase order — ties the movement back to it. */
  purchaseOrderId?: string;
  userId: string;
  note?: string;
  createdAt: string; // ISO date
}

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  /** Delivery warehouse — where receiving this order adds stock. */
  warehouseId: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  createdAt: string;
  expectedAt: string;
  /** Stamped when `status` transitions to "received" — the only real delivery timestamp in the schema. */
  receivedAt?: string;
  currency: "TRY";
  notes?: string;
}

export interface PagedQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  [key: string]: unknown;
}

export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MonthlyFlow {
  month: string; // "Oca", "Şub", ...
  inbound: number;
  outbound: number;
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  units: number;
}
