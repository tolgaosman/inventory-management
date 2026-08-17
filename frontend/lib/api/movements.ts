import type { MovementReason, MovementType, PagedQuery, StockMovement } from "@/lib/types";
import { products, stockLevels, stockMovements, warehouses } from "@/lib/mock/data";
import { id as makeId } from "@/lib/mock/seed";
import { ApiError, delay, matchesSearch, paginate } from "./client";

export interface MovementQuery extends PagedQuery {
  type?: MovementType;
  reason?: MovementReason;
  productId?: string;
  warehouseId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listMovements(query: MovementQuery = {}) {
  let rows = [...stockMovements];
  if (query.type) rows = rows.filter((m) => m.type === query.type);
  if (query.reason) rows = rows.filter((m) => m.reason === query.reason);
  if (query.productId) rows = rows.filter((m) => m.productId === query.productId);
  // Match both the source warehouse and, for transfers, the destination —
  // otherwise a warehouse's incoming transfers never show up in its history.
  if (query.warehouseId) {
    rows = rows.filter(
      (m) => m.warehouseId === query.warehouseId || m.targetWarehouseId === query.warehouseId,
    );
  }
  if (query.userId) rows = rows.filter((m) => m.userId === query.userId);
  if (query.dateFrom) rows = rows.filter((m) => m.createdAt >= query.dateFrom!);
  if (query.dateTo) rows = rows.filter((m) => m.createdAt <= query.dateTo!);
  if (query.search) {
    rows = rows.filter((m) => {
      const product = products.find((p) => p.id === m.productId);
      return matchesSearch([product?.name, product?.sku], query.search);
    });
  }
  return delay(paginate(rows, query));
}

function findLevel(productId: string, warehouseId: string) {
  return stockLevels.find((s) => s.productId === productId && s.warehouseId === warehouseId);
}

// Idempotency guard: the UI passes a client-generated key per submit; a key
// that has already been processed short-circuits to the original result
// instead of creating a duplicate movement (protects against double-click /
// double-submit and network retries).
const processedKeys = new Map<string, StockMovement>();

function withIdempotency(
  key: string | undefined,
  create: () => StockMovement,
): StockMovement {
  if (key) {
    const existing = processedKeys.get(key);
    if (existing) return existing;
  }
  const movement = create();
  if (key) processedKeys.set(key, movement);
  return movement;
}

export interface StockInInput {
  warehouseId: string;
  productId: string;
  quantity: number;
  supplierId?: string;
  /** Set when this entry comes from receiving a purchase order. */
  purchaseOrderId?: string;
  note?: string;
  userId: string;
  idempotencyKey?: string;
}

export async function createStockIn(input: StockInInput): Promise<StockMovement> {
  if (input.quantity <= 0) throw new ApiError("Miktar sıfırdan büyük olmalı.", "VALIDATION");
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");

  const movement = withIdempotency(input.idempotencyKey, () => {
    const level = findLevel(input.productId, input.warehouseId);
    const previousQuantity = level?.quantity ?? 0;
    const newQuantity = previousQuantity + input.quantity;
    if (level) level.quantity = newQuantity;
    else stockLevels.push({ productId: input.productId, warehouseId: input.warehouseId, quantity: newQuantity });

    const m: StockMovement = {
      id: makeId("mv", stockMovements.length + 1),
      type: "giris",
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reason: "satin_alma",
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId,
      userId: input.userId,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    stockMovements.unshift(m);
    return m;
  });

  return delay(movement, 550);
}

export interface StockOutInput {
  warehouseId: string;
  productId: string;
  quantity: number;
  reason: Extract<MovementReason, "satis" | "fire" | "sayim_duzeltme">;
  note?: string;
  userId: string;
  idempotencyKey?: string;
}

export async function createStockOut(input: StockOutInput): Promise<StockMovement> {
  if (input.quantity <= 0) throw new ApiError("Miktar sıfırdan büyük olmalı.", "VALIDATION");
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");

  const level = findLevel(input.productId, input.warehouseId);
  const currentQuantity = level?.quantity ?? 0;
  if (input.quantity > currentQuantity) {
    throw new ApiError(
      `Yetersiz stok: bu depoda ${currentQuantity} adet var, ${input.quantity} adet çıkış istendi.`,
      "VALIDATION",
    );
  }

  const movement = withIdempotency(input.idempotencyKey, () => {
    const previousQuantity = level!.quantity;
    const newQuantity = previousQuantity - input.quantity;
    level!.quantity = newQuantity;

    const m: StockMovement = {
      id: makeId("mv", stockMovements.length + 1),
      type: "cikis",
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reason: input.reason,
      userId: input.userId,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    stockMovements.unshift(m);
    return m;
  });

  return delay(movement, 550);
}

export interface TransferInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  productId: string;
  quantity: number;
  note?: string;
  userId: string;
  idempotencyKey?: string;
}

export async function createTransfer(input: TransferInput): Promise<StockMovement> {
  if (input.sourceWarehouseId === input.targetWarehouseId) {
    throw new ApiError("Kaynak ve hedef depo aynı olamaz.", "VALIDATION");
  }
  if (input.quantity <= 0) throw new ApiError("Miktar sıfırdan büyük olmalı.", "VALIDATION");

  const product = products.find((p) => p.id === input.productId);
  if (product && product.status === "pasif") {
    throw new ApiError(`"${product.name}" pasif durumda olduğu için stok transferi yapılamaz.`, "VALIDATION");
  }

  const sourceLevel = findLevel(input.productId, input.sourceWarehouseId);
  const currentQuantity = sourceLevel?.quantity ?? 0;
  if (input.quantity > currentQuantity) {
    const sourceName = warehouses.find((w) => w.id === input.sourceWarehouseId)?.name;
    throw new ApiError(
      `Yetersiz stok: ${sourceName} deposunda ${currentQuantity} adet var, ${input.quantity} adet transfer istendi.`,
      "VALIDATION",
    );
  }

  const movement = withIdempotency(input.idempotencyKey, () => {
    // Atomic in the sense that both sides update together, in one
    // synchronous block, before the (simulated) network round-trip resolves.
    const previousQuantity = sourceLevel!.quantity;
    const newQuantity = previousQuantity - input.quantity;
    sourceLevel!.quantity = newQuantity;

    const targetLevel = findLevel(input.productId, input.targetWarehouseId);
    if (targetLevel) targetLevel.quantity += input.quantity;
    else stockLevels.push({ productId: input.productId, warehouseId: input.targetWarehouseId, quantity: input.quantity });

    const m: StockMovement = {
      id: makeId("mv", stockMovements.length + 1),
      type: "transfer",
      productId: input.productId,
      warehouseId: input.sourceWarehouseId,
      targetWarehouseId: input.targetWarehouseId,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reason: "transfer",
      userId: input.userId,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    stockMovements.unshift(m);
    return m;
  });

  return delay(movement, 700);
}

export async function getStockQuantity(productId: string, warehouseId: string): Promise<number> {
  return delay(findLevel(productId, warehouseId)?.quantity ?? 0, 150);
}
