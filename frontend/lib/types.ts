// Domain types for the inventory management system.
// Mirrors the entities described in project_description.txt.

/**
 * The 5 built-in role ids still type-check as literals for exhaustive
 * switches, but roles are no longer a closed set — admin can create custom
 * ones (see `frontend/lib/api/roles.ts`), so this also accepts any string.
 */
export type Role = "admin" | "depo_yonetici" | "satinalma_yonetici" | "depo" | "satinalma" | (string & {});

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  initials: string;
  mustChangePassword?: boolean;
  deletedAt?: string;
  stats?: {
    movementsCount: number;
    movementsInCount: number;
    movementsOutCount: number;
    movementsTransferCount: number;
    purchaseOrdersCount: number;
    quoteRequestsCount: number;
  };
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
  /** At least 3 addresses — a primary contact plus alternates to send quote requests to. */
  emails: string[];
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
  purchasePrice: number | null;
  /** Only ever shown on the product detail page — never on the Ürün Yönetimi list/form. */
  salePrice: number | null;
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
  id: number;
  productId?: string;
  productName?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId?: string;
  adhocSupplierName?: string;
  adhocSupplierEmail?: string;
  /** Delivery warehouse — optional at creation, required when receiving real products. */
  warehouseId?: string;
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

/** A requested line on a quote — either an existing catalog product, or an ad-hoc name+unit typed in by hand. `unitPrice` is unset until the supplier responds. */
export interface QuoteRequestItem {
  productId: string | null;
  productName: string;
  sku?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number | null;
}

/** A "teklif formu" (RFQ) sent to a supplier — existing or a brand-new one entered by name only — for a hand-picked list of items. Independent of purchase orders; a real order is only placed once the supplier responds with pricing. */
export interface QuoteRequest {
  id: string;
  code: string; // NET-TKL-20260001
  supplierId: string | null;
  /** Set instead of `supplierId` when the request targets a not-yet-registered supplier. */
  adhocSupplierName?: string | null;
  /** The not-yet-registered supplier's email — set alongside `adhocSupplierName`. */
  adhocSupplierEmail?: string | null;
  items: QuoteRequestItem[];
  createdAt: string;
  createdBy: string;
  createdById?: string;
  createdByUser?: AppUser;
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
  approvedByUser?: AppUser;
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
