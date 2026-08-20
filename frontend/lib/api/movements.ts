import type { MovementReason, MovementType, PagedQuery, PagedResult, StockMovement } from "@/lib/types";
import { apiFetch } from "./client";
import { cachedFetch, invalidateCache } from "@/lib/api-cache";
import { invalidateWarehouses } from "./catalog";
import { invalidateWarehousesDetailed } from "./warehouses";
import { invalidateProducts } from "./products";

const MOVEMENT_CACHE_TTL = 10_000; // 10 s — live operational data, short-lived dedup rather than long staleness

/** Every mutation that changes stock quantities invalidates every cache that reflects them. */
function invalidateStockDependents(): void {
  invalidateMovements();
  invalidateWarehouses();
  invalidateWarehousesDetailed();
  invalidateProducts();
}

export interface MovementQuery extends PagedQuery {
  type?: MovementType;
  reason?: MovementReason;
  productId?: string;
  warehouseId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listMovements(query: MovementQuery = {}): Promise<PagedResult<StockMovement>> {
  const key = `movements:list:${JSON.stringify(query)}`;
  return cachedFetch(
    key,
    () =>
      apiFetch<PagedResult<StockMovement>>("/movements", {
        query: {
          type: query.type,
          reason: query.reason,
          productId: query.productId,
          warehouseId: query.warehouseId,
          userId: query.userId,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          search: query.search,
          page: query.page,
          pageSize: query.pageSize,
        },
      }),
    MOVEMENT_CACHE_TTL,
  );
}

export function invalidateMovements(): void {
  invalidateCache("movements:");
}

export interface MovementSummary {
  typeCounts: { giris: number; cikis: number; transfer: number };
  todayIn: number;
  todayOut: number;
  fireCount: number;
}

/**
 * `type`/`page`/`pageSize` are deliberately excluded — the server always
 * breaks the result down by type and always reports "today" globally. A
 * standalone interface (rather than `Omit<MovementQuery, ...>`) sidesteps a
 * TS quirk: `MovementQuery` extends `PagedQuery`, which has a
 * `[key: string]: unknown` index signature, and `Omit` over a type with both
 * named properties and an index signature collapses the named properties'
 * types to `unknown`.
 */
export interface MovementSummaryQuery {
  search?: string;
  reason?: MovementReason;
  productId?: string;
  warehouseId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Aggregate tab-badge/hero-card counts in one round trip — replaces what used
 * to be 6 separate `listMovements()` calls fetched just to read `.total`.
 */
export async function getMovementSummary(query: MovementSummaryQuery = {}): Promise<MovementSummary> {
  const params = {
    search: query.search,
    reason: query.reason,
    productId: query.productId,
    warehouseId: query.warehouseId,
    userId: query.userId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  };
  const key = `movements:summary:${JSON.stringify(params)}`;
  return cachedFetch(key, () => apiFetch<MovementSummary>("/movements/summary", { query: params }), MOVEMENT_CACHE_TTL);
}

/**
 * `userId` is no longer sent — the server takes it from the auth token, so a
 * client can't attribute a movement to someone else. It stays optional in the
 * input types because existing call sites still pass it; it is simply ignored.
 */
export interface StockInInput {
  warehouseId: string;
  productId: string;
  quantity: number;
  supplierId?: string;
  purchaseOrderId?: string;
  note?: string;
  userId?: string;
  idempotencyKey?: string;
}

export async function createStockIn(input: StockInInput): Promise<StockMovement> {
  invalidateStockDependents();
  return apiFetch<StockMovement>("/stock/in", {
    method: "POST",
    body: {
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: input.quantity,
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    },
    idempotencyKey: input.idempotencyKey,
  });
}

export interface StockOutInput {
  warehouseId: string;
  productId: string;
  quantity: number;
  reason: "satis" | "fire" | "sayim_duzeltme";
  note?: string;
  userId?: string;
  idempotencyKey?: string;
}

export async function createStockOut(input: StockOutInput): Promise<StockMovement> {
  invalidateStockDependents();
  return apiFetch<StockMovement>("/stock/out", {
    method: "POST",
    body: {
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: input.quantity,
      reason: input.reason,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    },
    idempotencyKey: input.idempotencyKey,
  });
}

export interface TransferInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  productId: string;
  quantity: number;
  note?: string;
  userId?: string;
  idempotencyKey?: string;
}

export async function createTransfer(input: TransferInput): Promise<StockMovement> {
  invalidateStockDependents();
  return apiFetch<StockMovement>("/stock/transfer", {
    method: "POST",
    body: {
      sourceWarehouseId: input.sourceWarehouseId,
      targetWarehouseId: input.targetWarehouseId,
      productId: input.productId,
      quantity: input.quantity,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function getStockQuantity(productId: string, warehouseId: string): Promise<number> {
  const result = await apiFetch<{ quantity: number }>("/stock/quantity", {
    query: { productId, warehouseId },
  });
  return result.quantity;
}

/** "Deleting" a movement cancels it: the server reverses its stock effect before soft-deleting the row. */
export async function deleteMovement(id: string): Promise<boolean> {
  invalidateStockDependents();
  await apiFetch<{ deleted: boolean }>(`/movements/${id}`, { method: "DELETE" });
  return true;
}

/** Restoring a cancelled movement re-applies its original stock effect. */
export async function restoreMovement(id: string): Promise<void> {
  invalidateStockDependents();
  await apiFetch<void>(`/movements/${id}/restore`, { method: "POST" });
}
