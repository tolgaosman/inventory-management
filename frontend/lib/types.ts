// Domain types for the inventory management system.
// Mirrors the entities described in project_description.txt.

export type Role = "admin" | "depo_yonetici" | "satinalma_yonetici" | "depo" | "satinalma";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  mustChangePassword?: boolean;
  deletedAt?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  address: string;
  capacity: number;
  deletedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  deletedAt?: string;
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
  deletedAt?: string;
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
  /** The acting user's name, resolved server-side — present whenever that user still exists. */
  userName?: string;
  note?: string;
  createdAt: string; // ISO date
  deletedAt?: string;
}

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
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
  priority: "low" | "medium" | "high";
  items: PurchaseOrderItem[];
  createdAt: string;
  expectedAt: string;
  /** Stamped when `status` transitions to "received" — the only real delivery timestamp in the schema. */
  receivedAt?: string;
  rejectionReason?: string;
  currency: "TRY";
  notes?: string;
  invoiceFilePath?: string | null;
  createdBy?: string;
  approvedBy?: string;
  deletedAt?: string;
}

export type QuoteCurrency = "try" | "usd" | "eur" | "gbp";

/** Snapshot of a purchase-order line at the moment a quote request was sent — the source order can change later without altering the document. */
export interface QuoteRequestItem {
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  /** Copied from the source order's line at send time so the document's prices never drift. */
  unitPrice: number;
}

/** A "teklif formu" sent to a supplier, bundling one or more of their draft purchase orders into a single priced document. */
export interface QuoteRequest {
  id: string;
  code: string; // NET-TKL-20260001
  supplierId: string;
  purchaseOrderIds: string[];
  items: QuoteRequestItem[];
  createdAt: string;
  createdBy: string;
  createdById?: string;
  validUntil: string;
  deliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  requestedCurrency: QuoteCurrency;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string;
  status: QuoteRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  deletedAt?: string;
}

export type QuoteRequestStatus = "pending_approval" | "approved" | "rejected";

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
