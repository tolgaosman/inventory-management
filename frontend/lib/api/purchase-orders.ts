import type { PagedQuery, PurchaseOrder, PurchaseOrderStatus } from "@/lib/types";
import { products, purchaseOrders, purchaseOrderTotal, suppliers, warehouses, totalStockForProduct } from "@/lib/mock/data";
import { id as makeId } from "@/lib/mock/seed";
import { createStockIn } from "./movements";
import { ApiError, delay, matchesSearch, paginate } from "./client";

export interface PurchaseOrderQuery extends PagedQuery {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  warehouseId?: string;
  /** Only orders past their `expectedAt` that aren't received/cancelled yet. */
  overdue?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

function toRow(po: (typeof purchaseOrders)[number]) {
  return {
    ...po,
    supplierName: suppliers.find((s) => s.id === po.supplierId)?.name ?? "-",
    warehouseName: warehouses.find((w) => w.id === po.warehouseId)?.name ?? "-",
    total: purchaseOrderTotal(po),
    itemCount: po.items.length,
    receivedTotal: po.items.reduce((sum, i) => sum + i.receivedQuantity, 0),
    orderedTotal: po.items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

function isOverdue(po: PurchaseOrder, now: string): boolean {
  return po.status !== "received" && po.status !== "cancelled" && po.expectedAt < now;
}

/** Days from `bISO` to `aISO` (positive = a is later than b). */
function diffDays(aISO: string, bISO: string): number {
  return (new Date(aISO).getTime() - new Date(bISO).getTime()) / (24 * 60 * 60 * 1000);
}

const SORTERS: Record<string, (a: PurchaseOrder, b: PurchaseOrder) => number> = {
  code: (a, b) => a.code.localeCompare(b.code),
  supplier: (a, b) =>
    (suppliers.find((s) => s.id === a.supplierId)?.name ?? "").localeCompare(
      suppliers.find((s) => s.id === b.supplierId)?.name ?? "",
    ),
  total: (a, b) => purchaseOrderTotal(a) - purchaseOrderTotal(b),
  expectedAt: (a, b) => (a.expectedAt < b.expectedAt ? -1 : a.expectedAt > b.expectedAt ? 1 : 0),
  createdAt: (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
};

export async function listPurchaseOrders(query: PurchaseOrderQuery = {}) {
  let rows = [...purchaseOrders];
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.supplierId) rows = rows.filter((r) => r.supplierId === query.supplierId);
  if (query.warehouseId) rows = rows.filter((r) => r.warehouseId === query.warehouseId);
  if (query.dateFrom) rows = rows.filter((r) => r.createdAt >= query.dateFrom!);
  if (query.dateTo) rows = rows.filter((r) => r.createdAt <= query.dateTo!);
  if (query.overdue) {
    const now = new Date().toISOString();
    rows = rows.filter((r) => isOverdue(r, now));
  }
  rows = rows.filter((r) =>
    matchesSearch([r.code, suppliers.find((s) => s.id === r.supplierId)?.name], query.search),
  );

  const sorter = query.sortBy ? SORTERS[query.sortBy] : undefined;
  if (sorter) {
    rows.sort(query.sortDir === "desc" ? (a, b) => -sorter(a, b) : sorter);
  } else {
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  return delay(paginate(rows.map(toRow), query));
}

export async function getPurchaseOrder(id: string) {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  const items = po.items.map((item) => ({
    ...item,
    product: products.find((p) => p.id === item.productId)!,
  }));
  return delay({ ...toRow(po), items });
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
  /** Open orders due within the next 7 days. */
  arrivingThisWeek: number;
  /** `null` until at least one order has actually been received. */
  onTimeRatePercent: number | null;
}

/**
 * Global purchase-order KPIs. The four original fields keep their
 * definitions identical to the panel's `getDashboardKpis`
 * (`lib/mock/dashboard.ts`) so the two screens never disagree — but unscoped
 * by date range, since this page has no range filter. Everything past that
 * is new, purpose-built for the command hero.
 */
export async function getPurchaseOrderStats(): Promise<PurchaseOrderStats> {
  const now = new Date().toISOString();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const openOrders = purchaseOrders.filter(
    (po) => po.status === "ordered" || po.status === "partially_received",
  );
  const nonCancelled = purchaseOrders.filter((po) => po.status !== "cancelled");
  const totalValue = nonCancelled
    .filter((po) => po.status !== "draft")
    .reduce((sum, po) => sum + purchaseOrderTotal(po), 0);
  const openValue = openOrders.reduce((sum, po) => sum + purchaseOrderTotal(po), 0);
  const pendingUnits = openOrders.reduce(
    (sum, po) => sum + po.items.reduce((s, i) => s + (i.quantity - i.receivedQuantity), 0),
    0,
  );

  const orderedTotal = nonCancelled.reduce((sum, po) => sum + po.items.reduce((s, i) => s + i.quantity, 0), 0);
  const receivedTotal = nonCancelled.reduce(
    (sum, po) => sum + po.items.reduce((s, i) => s + i.receivedQuantity, 0),
    0,
  );
  const fillRatePercent = orderedTotal > 0 ? Math.round((receivedTotal / orderedTotal) * 100) : 0;

  const overdue = purchaseOrders.filter((po) => isOverdue(po, now));
  const overdueValue = overdue.reduce((sum, po) => sum + purchaseOrderTotal(po), 0);

  const arrivingThisWeek = openOrders.filter((po) => po.expectedAt >= now && po.expectedAt <= weekFromNow).length;

  const receivedOrders = purchaseOrders.filter((po) => po.status === "received" && po.receivedAt);
  const onTimeRatePercent =
    receivedOrders.length > 0
      ? Math.round(
          (receivedOrders.filter((po) => po.receivedAt! <= po.expectedAt).length / receivedOrders.length) * 100,
        )
      : null;

  return delay({
    totalOrders: purchaseOrders.length,
    openOrders: openOrders.length,
    pendingUnits,
    totalValue,
    openValue,
    fillRatePercent,
    overdueCount: overdue.length,
    overdueValue,
    draftCount: purchaseOrders.filter((po) => po.status === "draft").length,
    arrivingThisWeek,
    onTimeRatePercent,
  });
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
  notes?: string;
  items: PurchaseOrderItemInput[];
}

function validateItems(items: PurchaseOrderItemInput[]) {
  if (items.length === 0) throw new ApiError("En az bir kalem eklemelisiniz.", "VALIDATION");
  const seen = new Set<string>();
  for (const item of items) {
    if (!products.find((p) => p.id === item.productId)) {
      throw new ApiError("Seçilen ürünlerden biri bulunamadı.", "VALIDATION");
    }
    if (item.quantity <= 0) throw new ApiError("Kalem miktarı sıfırdan büyük olmalı.", "VALIDATION");
    if (item.unitPrice < 0) throw new ApiError("Birim fiyat negatif olamaz.", "VALIDATION");
    if (seen.has(item.productId)) {
      throw new ApiError("Aynı ürün birden fazla kez eklenemez.", "VALIDATION");
    }
    seen.add(item.productId);
  }
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  if (!suppliers.find((s) => s.id === input.supplierId)) {
    throw new ApiError("Tedarikçi bulunamadı.", "VALIDATION");
  }
  if (!warehouses.find((w) => w.id === input.warehouseId)) {
    throw new ApiError("Depo bulunamadı.", "VALIDATION");
  }
  if (!input.expectedAt) throw new ApiError("Beklenen teslim tarihi gereklidir.", "VALIDATION");
  validateItems(input.items);

  const n = purchaseOrders.length + 1;
  const po: PurchaseOrder = {
    id: makeId("po", n),
    code: `NET-PO-${new Date().getFullYear()}${String(n).padStart(4, "0")}`,
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    status: "draft",
    items: input.items.map((i) => ({ ...i, receivedQuantity: 0 })),
    createdAt: new Date().toISOString(),
    expectedAt: input.expectedAt,
    currency: "TRY",
    notes: input.notes,
  };
  purchaseOrders.unshift(po);
  return delay(po, 500);
}

export interface UpdatePurchaseOrderInput {
  supplierId?: string;
  warehouseId?: string;
  expectedAt?: string;
  notes?: string;
  items?: PurchaseOrderItemInput[];
}

export async function updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder> {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (po.status !== "draft" && po.status !== "ordered") {
    throw new ApiError("Yalnızca taslak veya sipariş edilmiş siparişler düzenlenebilir.", "CONFLICT");
  }
  if (po.items.some((i) => i.receivedQuantity > 0)) {
    throw new ApiError("Kısmen de olsa teslim alınmış bir sipariş düzenlenemez.", "CONFLICT");
  }

  if (input.supplierId !== undefined) {
    if (!suppliers.find((s) => s.id === input.supplierId)) throw new ApiError("Tedarikçi bulunamadı.", "VALIDATION");
    po.supplierId = input.supplierId;
  }
  if (input.warehouseId !== undefined) {
    if (!warehouses.find((w) => w.id === input.warehouseId)) throw new ApiError("Depo bulunamadı.", "VALIDATION");
    po.warehouseId = input.warehouseId;
  }
  if (input.expectedAt !== undefined) po.expectedAt = input.expectedAt;
  if (input.notes !== undefined) po.notes = input.notes;
  if (input.items !== undefined) {
    validateItems(input.items);
    po.items = input.items.map((i) => ({ ...i, receivedQuantity: 0 }));
  }

  return delay(po, 500);
}

export async function deletePurchaseOrder(id: string): Promise<boolean> {
  const index = purchaseOrders.findIndex((p) => p.id === id);
  if (index === -1) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (purchaseOrders[index].status !== "draft") {
    throw new ApiError(
      "Yalnızca taslak siparişler silinebilir; gönderilmiş siparişleri iptal edin.",
      "CONFLICT",
    );
  }
  purchaseOrders.splice(index, 1);
  return delay(true, 400);
}

export async function markPurchaseOrderOrdered(id: string): Promise<PurchaseOrder> {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (po.status !== "draft") throw new ApiError("Yalnızca taslak siparişler gönderilebilir.", "CONFLICT");
  po.status = "ordered";
  return delay(po, 400);
}

export interface ReceivePurchaseOrderContext {
  userId: string;
  idempotencyKey?: string;
}

export async function receivePurchaseOrder(
  id: string,
  receivedQuantities: Record<string, number>,
  ctx: ReceivePurchaseOrderContext,
) {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (po.status === "cancelled") throw new ApiError("İptal edilmiş sipariş teslim alınamaz.", "CONFLICT");
  if (po.status === "received") throw new ApiError("Sipariş zaten tamamen teslim alınmış.", "CONFLICT");

  // Stock effects happen first so a failed movement leaves the order
  // untouched rather than marking items received without moving stock.
  for (const item of po.items) {
    const add = receivedQuantities[item.productId] ?? 0;
    if (add <= 0) continue;
    const capped = Math.min(add, item.quantity - item.receivedQuantity);
    if (capped <= 0) continue;
    await createStockIn({
      productId: item.productId,
      warehouseId: po.warehouseId,
      quantity: capped,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      note: `${po.code} teslim alındı`,
      userId: ctx.userId,
      idempotencyKey: ctx.idempotencyKey ? `${ctx.idempotencyKey}-${item.productId}` : undefined,
    });
    item.receivedQuantity += capped;
  }

  const allReceived = po.items.every((i) => i.receivedQuantity >= i.quantity);
  const anyReceived = po.items.some((i) => i.receivedQuantity > 0);
  po.status = allReceived ? "received" : anyReceived ? "partially_received" : po.status;
  if (allReceived) po.receivedAt = new Date().toISOString();

  return delay(toRow(po), 600);
}

export async function cancelPurchaseOrder(id: string) {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (po.status === "received") throw new ApiError("Teslim alınmış sipariş iptal edilemez.", "CONFLICT");
  po.status = "cancelled";
  return delay(toRow(po), 500);
}

// ── Bulk operations ─────────────────────────────────────────────────────────
// Mirrors `bulkSetProductStatus`/`bulkDeleteProducts` in `lib/api/products.ts`:
// mutate directly (no per-item network round-trip), report partial failure
// per id instead of throwing on the first bad row.

export interface BulkOperationResult {
  successCount: number;
  failed: { id: string; reason: string }[];
}

export async function bulkMarkPurchaseOrdersOrdered(ids: string[]): Promise<BulkOperationResult> {
  const failed: { id: string; reason: string }[] = [];
  let successCount = 0;
  for (const id of ids) {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) {
      failed.push({ id, reason: "Sipariş bulunamadı." });
    } else if (po.status !== "draft") {
      failed.push({ id, reason: "Yalnızca taslak siparişler gönderilebilir." });
    } else {
      po.status = "ordered";
      successCount++;
    }
  }
  return delay({ successCount, failed }, 500);
}

export async function bulkCancelPurchaseOrders(ids: string[]): Promise<BulkOperationResult> {
  const failed: { id: string; reason: string }[] = [];
  let successCount = 0;
  for (const id of ids) {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) {
      failed.push({ id, reason: "Sipariş bulunamadı." });
    } else if (po.status === "received") {
      failed.push({ id, reason: "Teslim alınmış sipariş iptal edilemez." });
    } else if (po.status === "cancelled") {
      failed.push({ id, reason: "Sipariş zaten iptal edilmiş." });
    } else {
      po.status = "cancelled";
      successCount++;
    }
  }
  return delay({ successCount, failed }, 500);
}

export async function bulkDeletePurchaseOrders(ids: string[]): Promise<BulkOperationResult> {
  const failed: { id: string; reason: string }[] = [];
  let successCount = 0;
  for (const id of ids) {
    const index = purchaseOrders.findIndex((p) => p.id === id);
    if (index === -1) {
      failed.push({ id, reason: "Sipariş bulunamadı." });
    } else if (purchaseOrders[index].status !== "draft") {
      failed.push({ id, reason: "Yalnızca taslak siparişler silinebilir." });
    } else {
      purchaseOrders.splice(index, 1);
      successCount++;
    }
  }
  return delay({ successCount, failed }, 500);
}

// ── Replenishment engine ────────────────────────────────────────────────────
// The page's headline feature: cross-references stock levels, thresholds
// nobody else in the app reads (`Product.maxStock`), and open-order coverage
// to answer "what needs reordering, and how much" — not just "what's low".

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
  const onOrderMap = new Map<string, number>();
  const draftOnOrderMap = new Map<string, number>();
  for (const po of purchaseOrders) {
    if (po.status === "ordered" || po.status === "partially_received") {
      for (const item of po.items) {
        onOrderMap.set(item.productId, (onOrderMap.get(item.productId) ?? 0) + (item.quantity - item.receivedQuantity));
      }
    } else if (po.status === "draft") {
      for (const item of po.items) {
        draftOnOrderMap.set(item.productId, (draftOnOrderMap.get(item.productId) ?? 0) + item.quantity);
      }
    }
  }

  const suggestions: ReplenishmentSuggestion[] = [];
  for (const product of products) {
    if (product.status !== "aktif") continue;
    const totalStock = totalStockForProduct(product.id);
    const onOrder = onOrderMap.get(product.id) ?? 0;
    const projected = totalStock + onOrder;
    // Same "düşük" band as `stockStatus=dusuk` in lib/api/products.ts — kept
    // identical so a product doesn't read "kritik" on one page and "normal" here.
    if (projected >= product.minStock * 1.5) continue;
    const suggestedQty = Math.max(product.maxStock - projected, 0);
    if (suggestedQty <= 0) continue;

    suggestions.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      imageUrl: product.imageUrl,
      supplierId: product.supplierId,
      supplierName: suppliers.find((s) => s.id === product.supplierId)?.name ?? "-",
      totalStock,
      minStock: product.minStock,
      maxStock: product.maxStock,
      onOrder,
      draftOnOrder: draftOnOrderMap.get(product.id) ?? 0,
      projected,
      shortfall: Math.max(product.minStock - projected, 0),
      suggestedQty,
      unitPrice: product.purchasePrice,
      severity: projected < product.minStock ? "kritik" : "dusuk",
    });
  }

  return delay(suggestions.sort((a, b) => b.shortfall - a.shortfall));
}

export interface ReplenishmentOrderInput {
  warehouseId: string;
  expectedAt: string;
  lines: { productId: string; quantity: number }[];
}

/** Groups the given lines by each product's preferred supplier and creates one draft order per supplier. */
export async function createPurchaseOrdersFromSuggestions(input: ReplenishmentOrderInput): Promise<PurchaseOrder[]> {
  const bySupplier = new Map<string, PurchaseOrderItemInput[]>();
  for (const line of input.lines) {
    if (line.quantity <= 0) continue;
    const product = products.find((p) => p.id === line.productId);
    if (!product) continue;
    const list = bySupplier.get(product.supplierId) ?? [];
    list.push({ productId: product.id, quantity: line.quantity, unitPrice: product.purchasePrice });
    bySupplier.set(product.supplierId, list);
  }
  if (bySupplier.size === 0) throw new ApiError("Geçerli bir ürün/miktar bulunamadı.", "VALIDATION");

  const created: PurchaseOrder[] = [];
  for (const [supplierId, items] of bySupplier) {
    created.push(
      await createPurchaseOrder({
        supplierId,
        warehouseId: input.warehouseId,
        expectedAt: input.expectedAt,
        items,
      }),
    );
  }
  return created;
}

// ── Supplier scorecard ──────────────────────────────────────────────────────

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
  const now = new Date().toISOString();

  const cards: SupplierScorecard[] = suppliers.map((supplier) => {
    const orders = purchaseOrders.filter((po) => po.supplierId === supplier.id);
    const nonCancelled = orders.filter((po) => po.status !== "cancelled");
    const openOrders = orders.filter((po) => po.status === "ordered" || po.status === "partially_received");
    const cancelledOrders = orders.filter((po) => po.status === "cancelled");
    const receivedOrders = orders.filter((po) => po.status === "received" && po.receivedAt);

    const orderedTotal = nonCancelled.reduce((sum, po) => sum + po.items.reduce((s, i) => s + i.quantity, 0), 0);
    const receivedTotal = nonCancelled.reduce(
      (sum, po) => sum + po.items.reduce((s, i) => s + i.receivedQuantity, 0),
      0,
    );

    const onTimeRatePercent =
      receivedOrders.length > 0
        ? Math.round(
            (receivedOrders.filter((po) => po.receivedAt! <= po.expectedAt).length / receivedOrders.length) * 100,
          )
        : null;
    const avgLeadDays =
      receivedOrders.length > 0
        ? round1(receivedOrders.reduce((sum, po) => sum + diffDays(po.receivedAt!, po.createdAt), 0) / receivedOrders.length)
        : null;
    const promisedLeadDays =
      nonCancelled.length > 0
        ? round1(nonCancelled.reduce((sum, po) => sum + diffDays(po.expectedAt, po.createdAt), 0) / nonCancelled.length)
        : null;

    const overdue = orders.filter((po) => isOverdue(po, now));

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      city: supplier.city,
      totalOrders: orders.length,
      openOrders: openOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalValue: nonCancelled.reduce((sum, po) => sum + purchaseOrderTotal(po), 0),
      openValue: openOrders.reduce((sum, po) => sum + purchaseOrderTotal(po), 0),
      fillRatePercent: orderedTotal > 0 ? Math.round((receivedTotal / orderedTotal) * 100) : 0,
      onTimeRatePercent,
      avgLeadDays,
      promisedLeadDays,
      overdueCount: overdue.length,
      overdueDays: Math.round(overdue.reduce((sum, po) => sum + Math.max(diffDays(now, po.expectedAt), 0), 0)),
      productCount: products.filter((p) => p.supplierId === supplier.id).length,
      lastOrderAt: orders[0]?.createdAt,
    };
  });

  return delay(cards.sort((a, b) => b.totalValue - a.totalValue));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
