import type { MovementReason, MovementType, PagedQuery, PagedResult, StockMovement } from "@/lib/types";
import { apiFetch } from "./client";

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
  return apiFetch<PagedResult<StockMovement>>("/movements", {
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
  });
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
