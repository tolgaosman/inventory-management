import type { MovementType, PagedQuery, PagedResult, Product } from "@/lib/types";
import {
  categories,
  products,
  stockForProductByWarehouse,
  stockMovements,
  totalStockForProduct,
  users,
  warehouses,
} from "@/lib/mock/data";
import { isProductCritical } from "@/lib/mock/dashboard";
import { id as makeId } from "@/lib/mock/seed";
import { MOVEMENT_REASON_LABELS } from "@/lib/constants";
import { ApiError, delay, matchesSearch, paginate } from "./client";

export interface ProductQuery extends PagedQuery {
  categoryId?: string;
  warehouseId?: string;
  stockStatus?: "kritik" | "dusuk" | "normal" | "fazla";
  status?: "aktif" | "pasif";
  supplierId?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductRow extends Product {
  totalStock: number;
  /** Quantity in the currently filtered warehouse — only set when `query.warehouseId` is active. */
  warehouseStock?: number;
  categoryName: string;
  critical: boolean;
}

export interface ProductStats {
  total: number;
  critical: number;
  /** Not critical, but below the 1.5x-of-min "healthy" band — same threshold `stockStatus=dusuk` filters on. */
  low: number;
  /** Above `maxStock` — the first place `Product.maxStock` is aggregated across the catalog. */
  overstock: number;
  passive: number;
  stockValue: number;
}

export interface ProductListResult extends PagedResult<ProductRow> {
  stats: ProductStats;
}

function computeStats(rows: ProductRow[]): ProductStats {
  return {
    total: rows.length,
    critical: rows.filter((p) => p.critical).length,
    low: rows.filter((p) => !p.critical && p.totalStock < p.minStock * 1.5).length,
    overstock: rows.filter((p) => p.totalStock > p.maxStock).length,
    passive: rows.filter((p) => p.status === "pasif").length,
    stockValue: rows.reduce((sum, p) => sum + (p.warehouseStock ?? p.totalStock) * p.purchasePrice, 0),
  };
}

function toRow(p: Product): ProductRow {
  return {
    ...p,
    totalStock: totalStockForProduct(p.id),
    categoryName: categories.find((c) => c.id === p.categoryId)?.name ?? "-",
    critical: isProductCritical(p),
  };
}

function getCategoryAndDescendantIds(catId: string): Set<string> {
  const ids = new Set<string>([catId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

export async function listProducts(query: ProductQuery = {}): Promise<ProductListResult> {
  let rows = products.map(toRow);

  rows = rows.filter((p) => matchesSearch([p.name, p.sku, p.barcode, p.brand, p.categoryName], query.search));
  if (query.categoryId) {
    const allowedCatIds = getCategoryAndDescendantIds(query.categoryId);
    rows = rows.filter((p) => allowedCatIds.has(p.categoryId));
  }
  if (query.supplierId) rows = rows.filter((p) => p.supplierId === query.supplierId);
  if (query.warehouseId) {
    // Keep totalStock as the product's overall stock (so the critical-stock
    // badge and min/max comparison stay correct); attach the warehouse-scoped
    // quantity separately for display.
    rows = rows.filter((p) => {
      const warehouseStock = stockForProductByWarehouse(p.id).find((s) => s.warehouseId === query.warehouseId);
      if (warehouseStock && warehouseStock.quantity > 0) {
        p.warehouseStock = warehouseStock.quantity;
        return true;
      }
      return false;
    });
  }
  if (query.stockStatus === "kritik") rows = rows.filter((p) => p.critical);
  if (query.stockStatus === "dusuk")
    rows = rows.filter((p) => !p.critical && p.totalStock < p.minStock * 1.5);
  if (query.stockStatus === "normal") rows = rows.filter((p) => p.totalStock >= p.minStock * 1.5);
  if (query.stockStatus === "fazla") rows = rows.filter((p) => p.totalStock > p.maxStock);
  if (query.status) rows = rows.filter((p) => p.status === query.status);
  if (query.minPrice != null) rows = rows.filter((p) => p.salePrice >= query.minPrice!);
  if (query.maxPrice != null) rows = rows.filter((p) => p.salePrice <= query.maxPrice!);

  if (query.sortBy) {
    const dir = query.sortDir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = a[query.sortBy as keyof ProductRow];
      const bv = b[query.sortBy as keyof ProductRow];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "tr-TR") * dir;
    });
  }

  return delay({ ...paginate(rows, query), stats: computeStats(rows) });
}

export async function getProduct(id: string): Promise<ProductRow> {
  const product = products.find((p) => p.id === id);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");
  return delay(toRow(product));
}

export async function getProductStockByWarehouse(id: string) {
  return delay(stockForProductByWarehouse(id));
}

export interface ProductHistoryEntry {
  id: string;
  date: string;
  delta: number;
  type: MovementType;
  warehouseName: string;
  targetWarehouseName?: string;
  reasonLabel: string;
  userName: string;
  note?: string;
  previousQuantity: number;
  newQuantity: number;
}

export async function getProductHistory(id: string): Promise<ProductHistoryEntry[]> {
  const entries = stockMovements
    .filter((m) => m.productId === id)
    .map((m) => ({
      id: m.id,
      date: m.createdAt,
      delta: m.type === "giris" ? m.quantity : -m.quantity,
      type: m.type,
      warehouseName: warehouses.find((w) => w.id === m.warehouseId)?.name ?? "-",
      targetWarehouseName:
        m.type === "transfer" ? warehouses.find((w) => w.id === m.targetWarehouseId)?.name : undefined,
      reasonLabel: MOVEMENT_REASON_LABELS[m.reason],
      userName: users.find((u) => u.id === m.userId)?.name ?? "-",
      note: m.note,
      previousQuantity: m.previousQuantity,
      newQuantity: m.newQuantity,
    }));
  return delay(entries);
}

export type ProductInput = Omit<Product, "id" | "status">;

export async function createProduct(input: ProductInput): Promise<ProductRow> {
  if (products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase())) {
    throw new ApiError(`"${input.sku}" SKU'su zaten kullanılıyor.`, "CONFLICT");
  }
  const product: Product = { ...input, id: makeId("prd", products.length + 1), status: "aktif" };
  products.push(product);
  return delay(toRow(product), 500);
}

export async function updateProduct(id: string, input: ProductInput): Promise<ProductRow> {
  const product = products.find((p) => p.id === id);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");
  if (products.some((p) => p.id !== id && p.sku.toLowerCase() === input.sku.toLowerCase())) {
    throw new ApiError(`"${input.sku}" SKU'su zaten kullanılıyor.`, "CONFLICT");
  }
  Object.assign(product, input);
  return delay(toRow(product), 500);
}

export async function toggleProductStatus(id: string): Promise<ProductRow> {
  const product = products.find((p) => p.id === id);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");
  product.status = product.status === "aktif" ? "pasif" : "aktif";
  return delay(toRow(product), 400);
}

export async function deleteProduct(id: string): Promise<void> {
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");
  if (stockMovements.some((m) => m.productId === id)) {
    throw new ApiError("Bu ürüne ait stok hareketi olduğu için silinemez.", "CONFLICT");
  }
  products.splice(index, 1);
  return delay(undefined, 400);
}

export async function bulkSetProductStatus(ids: string[], status: "aktif" | "pasif"): Promise<{ updatedCount: number }> {
  let count = 0;
  for (const id of ids) {
    const product = products.find((p) => p.id === id);
    if (product) {
      product.status = status;
      count++;
    }
  }
  return delay({ updatedCount: count }, 400);
}

export async function bulkDeleteProducts(ids: string[]): Promise<{ deletedCount: number; failedSkus: string[] }> {
  let deletedCount = 0;
  const failedSkus: string[] = [];

  for (const id of ids) {
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      const prd = products[index];
      if (stockMovements.some((m) => m.productId === id)) {
        failedSkus.push(prd.sku);
      } else {
        products.splice(index, 1);
        deletedCount++;
      }
    }
  }

  return delay({ deletedCount, failedSkus }, 500);
}

export async function bulkImportProducts(inputs: ProductInput[]): Promise<{ importedCount: number; errors: string[] }> {
  let importedCount = 0;
  const errors: string[] = [];

  for (const input of inputs) {
    if (products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase())) {
      errors.push(`"${input.sku}" SKU'su zaten mevcut, atlandı.`);
      continue;
    }
    const product: Product = {
      ...input,
      id: makeId("prd", products.length + 1),
      status: "aktif",
    };
    products.push(product);
    importedCount++;
  }

  return delay({ importedCount, errors }, 600);
}
