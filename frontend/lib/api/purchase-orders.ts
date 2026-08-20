import type { PagedQuery, PagedResult, Product, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "@/lib/types";
import { apiFetch } from "./client";
import { cachedFetch, invalidateCache } from "@/lib/api-cache";

const PO_CACHE_TTL = 10_000; // 10 s — live operational data, short-lived dedup rather than long staleness

export function invalidatePurchaseOrders(): void {
  invalidateCache("purchaseOrders:");
}

export interface PurchaseOrderQuery extends PagedQuery {
  trashed?: boolean;
  status?: PurchaseOrderStatus;
  excludeStatus?: PurchaseOrderStatus;
  supplierId?: string;
  warehouseId?: string;
  priority?: "low" | "medium" | "high";
  dateFrom?: string;
  dateTo?: string;
  isMyDrafts?: boolean;
}

/** A purchase order plus the denormalized fields the list/detail views render. */
export type PurchaseOrderRow = PurchaseOrder & {
  supplierName: string;
  warehouseName: string;
  total: number;
  itemCount: number;
  receivedTotal: number;
  orderedTotal: number;
  invoiceFilePath?: string;
  sharedWith?: string[];
  createdById?: string;
};

// Omit `items` before re-adding it: intersecting PurchaseOrderItem[] with the
// hydrated element type leaves TS resolving members against the bare item.
export type PurchaseOrderDetail = Omit<PurchaseOrderRow, "items"> & {
  items: (PurchaseOrderItem & { product: Product })[];
};

export async function listPurchaseOrders(
  query: PurchaseOrderQuery = {},
): Promise<PagedResult<PurchaseOrderRow>> {
  const key = `purchaseOrders:list:${JSON.stringify(query)}`;
  return cachedFetch(
    key,
    () =>
      apiFetch<PagedResult<PurchaseOrderRow>>("/purchase-orders", {
        query: {
          trashed: query.trashed ? "1" : undefined,
          status: query.status,
          excludeStatus: query.excludeStatus,
          supplierId: query.supplierId,
          warehouseId: query.warehouseId,
          priority: query.priority,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          is_my_drafts: query.isMyDrafts ? "1" : undefined,
          search: query.search,
          page: query.page,
          pageSize: query.pageSize,
          sortBy: query.sortBy,
          sortDir: query.sortDir,
        },
      }),
    PO_CACHE_TTL,
  );
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
  return cachedFetch("purchaseOrders:stats", () => apiFetch<PurchaseOrderStats>("/purchase-orders/stats"), PO_CACHE_TTL);
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
  isDraft?: boolean;
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  invalidatePurchaseOrders();
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
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}`, { method: "PUT", body: input });
}

export async function deletePurchaseOrder(id: string): Promise<boolean> {
  invalidatePurchaseOrders();
  await apiFetch<void>(`/purchase-orders/${id}`, { method: "DELETE" });
  return true;
}

export async function markPurchaseOrderOrdered(id: string): Promise<PurchaseOrder> {
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/order`, { method: "POST" });
}

export async function requestPurchaseOrderApproval(id: string): Promise<PurchaseOrderRow> {
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/request-approval`, { method: "POST" });
}

export async function sharePurchaseOrder(id: string, userIds: string[]): Promise<PurchaseOrderRow> {
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/share`, { method: "POST", body: { userIds } });
}

export async function approvePurchaseOrder(id: string): Promise<PurchaseOrderRow> {
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/approve`, { method: "POST" });
}

export async function rejectPurchaseOrderApproval(id: string, reason: string): Promise<PurchaseOrder> {
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrder>(`/purchase-orders/${id}/reject`, {
    method: "POST",
    body: { reason },
  });
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
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/receive`, {
    method: "POST",
    body: { receivedQuantities, idempotencyKey: ctx.idempotencyKey },
    idempotencyKey: ctx.idempotencyKey,
  });
}

export interface PendingReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  receivedQuantity: number;
  outstandingQuantity: number;
}

/**
 * A purchase order still awaiting (full) receipt — status "ordered" or
 * "partially_received", regardless of invoice state. Every such order is
 * genuinely pending and should be visible; `hasInvoice` says whether it can
 * actually be received right now (`receivePurchaseOrder` still requires one).
 */
export interface PendingReceiptOrder {
  id: string;
  code: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  expectedAt?: string;
  hasInvoice: boolean;
  /**
   * Totals across every line of the order. `items` below only carries the
   * lines with something still outstanding, so the receive percentage must
   * come from these two rather than from summing `items`.
   */
  orderedTotal: number;
  receivedTotal: number;
  items: PendingReceiptItem[];
}

export async function getPendingReceiptOrders(warehouseId?: string): Promise<PendingReceiptOrder[]> {
  const key = `purchaseOrders:pendingReceipt:${warehouseId ?? "all"}`;
  return cachedFetch(
    key,
    () => apiFetch<PendingReceiptOrder[]>("/purchase-orders/pending-receipt", { query: { warehouseId } }),
    PO_CACHE_TTL,
  );
}

export async function uploadPurchaseOrderInvoice(id: string, file: File): Promise<{ invoiceFilePath: string }> {
  const formData = new FormData();
  formData.append("invoice", file);
  return apiFetch<{ invoiceFilePath: string }>(`/purchase-orders/${id}/invoice`, {
    method: "POST",
    body: formData,
  });
}

export async function cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderRow> {
  invalidatePurchaseOrders();
  return apiFetch<PurchaseOrderRow>(`/purchase-orders/${id}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export interface BulkOperationResult {
  successCount: number;
  failed: { id: string; reason: string }[];
}

export async function bulkMarkPurchaseOrdersOrdered(ids: string[]): Promise<BulkOperationResult> {
  invalidatePurchaseOrders();
  return apiFetch<BulkOperationResult>("/purchase-orders/bulk-order", { method: "POST", body: { ids } });
}

export async function bulkCancelPurchaseOrders(ids: string[]): Promise<BulkOperationResult> {
  invalidatePurchaseOrders();
  return apiFetch<BulkOperationResult>("/purchase-orders/bulk-cancel", { method: "POST", body: { ids } });
}

export async function bulkDeletePurchaseOrders(ids: string[]): Promise<BulkOperationResult> {
  invalidatePurchaseOrders();
  return apiFetch<BulkOperationResult>("/purchase-orders/bulk-delete", { method: "POST", body: { ids } });
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
  return cachedFetch(
    "purchaseOrders:scorecards",
    () => apiFetch<SupplierScorecard[]>("/suppliers/scorecards"),
    PO_CACHE_TTL,
  );
}

export async function restorePurchaseOrder(id: string): Promise<void> {
  invalidatePurchaseOrders();
  await apiFetch<void>(`/purchase-orders/${id}/restore`, { method: "POST" });
}
