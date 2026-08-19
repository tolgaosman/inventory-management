import type { PagedQuery, PagedResult, Product, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "@/lib/types";
import { apiFetch } from "./client";

export interface PurchaseOrderQuery extends PagedQuery {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  warehouseId?: string;
  priority?: "low" | "medium" | "high";
  dateFrom?: string;
  dateTo?: string;
}

/** A purchase order plus the denormalized fields the list/detail views render. */
export type PurchaseOrderRow = PurchaseOrder & {
  supplierName: string;
  warehouseName: string;
  total: number;
  itemCount: number;
  receivedTotal: number;
  orderedTotal: number;
};

// Omit `items` before re-adding it: intersecting PurchaseOrderItem[] with the
// hydrated element type leaves TS resolving members against the bare item.
export type PurchaseOrderDetail = Omit<PurchaseOrderRow, "items"> & {
  items: (PurchaseOrderItem & { product: Product })[];
};

export async function listPurchaseOrders(
  query: PurchaseOrderQuery = {},
): Promise<PagedResult<PurchaseOrderRow>> {
  return apiFetch<PagedResult<PurchaseOrderRow>>("/purchase-orders", {
    query: {
      status: query.status,
      supplierId: query.supplierId,
      warehouseId: query.warehouseId,
      priority: query.priority,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
  });
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  return apiFetch<PurchaseOrderDetail>(`/purchase-orders/${id}`);
}

export interface PurchaseOrderStats {
  totalOrders: number;
  openOrders: number;
  pendingUnits: number;
  totalValue: number;
  /** Value still sitting in ordered/partially-received orders. */
  openValue: number;
  /** Σ received / Σ ordered across every non-cancelled order. */
  fillRatePercent: number;
  overdueCount: number;
  overdueValue: number;
  /** Drafts nobody has sent yet. */
  draftCount: number;
  /** Drafts submitted for internal approval, awaiting a decision. */
  pendingApprovalCount: number;
  /** Open orders due within the next 7 days. */
  arrivingThisWeek: number;
  /** `null` until at least one order has actually been received. */
  onTimeRatePercent: number | null;
}

export async function getPurchaseOrderStats(): Promise<PurchaseOrderStats> {
  return apiFetch<PurchaseOrderStats>("/purchase-orders/stats");
}

export interface PurchaseOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  warehouseId: string;
  expectedAt: string;
  priority?: "low" | "medium" | "high";
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>("/purchase-orders", { method: "POST", body: input });
}

export interface UpdatePurchaseOrderInput {
  supplierId?: string;
  warehouseId?: string;
  expectedAt?: string;
  priority?: "low" | "medium" | "high";
  notes?: string;
  items?: PurchaseOrderItemInput[];
}

export async function updatePurchaseOrder(
  id: string,
  input: UpdatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}`, { method: "PUT", body: input });
}

export async function deletePurchaseOrder(id: string): Promise<boolean> {
  await apiFetch<void>(`/purchase-orders/${id}`, { method: "DELETE" });
  return true;
}

export async function markPurchaseOrderOrdered(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/order`, { method: "POST" });
}

export async function requestPurchaseOrderApproval(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/request-approval`, { method: "POST" });
}

export async function approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/approve`, { method: "POST" });
}

export async function rejectPurchaseOrderApproval(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/reject`, { method: "POST" });
}

export interface ReceivePurchaseOrderContext {
  /** Ignored by the server — the receiving user comes from the auth token. */
  userId?: string;
  idempotencyKey?: string;
}

export async function receivePurchaseOrder(
  id: string,
  receivedQuantities: Record<string, number>,
  ctx: ReceivePurchaseOrderContext = {},
): Promise<PurchaseOrderRow> {
  // One request for the whole receipt: the server writes every stock movement
  // and the order update in a single transaction.
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/receive`, {
    method: "POST",
    body: { receivedQuantities, idempotencyKey: ctx.idempotencyKey },
    idempotencyKey: ctx.idempotencyKey,
  });
}

export async function uploadPurchaseOrderInvoice(id: string, file: File): Promise<{ invoiceFilePath: string }> {
  const formData = new FormData();
  formData.append("invoice", file);
  return apiFetch<{ invoiceFilePath: string }>(`/purchase-orders/${id}/invoice`, {
    method: "POST",
    body: formData,
  });
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrderRow> {
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/cancel`, { method: "POST" });
}

export interface BulkOperationResult {
  successCount: number;
  failed: { id: string; reason: string }[];
}

export async function bulkMarkPurchaseOrdersOrdered(ids: string[]): Promise<BulkOperationResult> {
  return apiFetch<BulkOperationResult>("/purchase-orders/bulk-order", { method: "POST", body: { ids } });
}

export async function bulkCancelPurchaseOrders(ids: string[]): Promise<BulkOperationResult> {
  return apiFetch<BulkOperationResult>("/purchase-orders/bulk-cancel", { method: "POST", body: { ids } });
}

export async function bulkDeletePurchaseOrders(ids: string[]): Promise<BulkOperationResult> {
  return apiFetch<BulkOperationResult>("/purchase-orders/bulk-delete", { method: "POST", body: { ids } });
}

export interface ReplenishmentSuggestion {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  imageUrl?: string;
  supplierId: string;
  supplierName: string;
  totalStock: number;
  minStock: number;
  maxStock: number;
  /** Remaining quantity on open (ordered/partially-received) orders. */
  onOrder: number;
  /** Remaining quantity on draft orders — not counted as coverage, shown separately. */
  draftOnOrder: number;
  /** totalStock + onOrder. */
  projected: number;
  shortfall: number;
  suggestedQty: number;
  unitPrice: number;
  severity: "kritik" | "dusuk";
}

export async function getReplenishmentSuggestions(): Promise<ReplenishmentSuggestion[]> {
  return apiFetch<ReplenishmentSuggestion[]>("/replenishment/suggestions");
}

export interface ReplenishmentOrderInput {
  warehouseId: string;
  expectedAt: string;
  lines: { productId: string; quantity: number }[];
}

export async function createPurchaseOrdersFromSuggestions(
  input: ReplenishmentOrderInput,
): Promise<PurchaseOrder[]> {
  return apiFetch<PurchaseOrder[]>("/replenishment/orders", { method: "POST", body: input });
}

export interface SupplierScorecard {
  supplierId: string;
  supplierName: string;
  city: string;
  totalOrders: number;
  openOrders: number;
  cancelledOrders: number;
  totalValue: number;
  openValue: number;
  fillRatePercent: number;
  /** `null` when this supplier has no completed (received) orders yet. */
  onTimeRatePercent: number | null;
  /** Average actual days from order to receipt — `null` with no received orders. */
  avgLeadDays: number | null;
  /** Average promised days (expectedAt − createdAt) across all non-cancelled orders. */
  promisedLeadDays: number | null;
  overdueCount: number;
  overdueDays: number;
  productCount: number;
  lastOrderAt?: string;
}

export async function getSupplierScorecards(): Promise<SupplierScorecard[]> {
  return apiFetch<SupplierScorecard[]>("/suppliers/scorecards");
}
