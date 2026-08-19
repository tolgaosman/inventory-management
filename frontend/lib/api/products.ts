import type { MovementType, PagedQuery, PagedResult, Product, StockLevel } from "@/lib/types";
import { apiFetch } from "./client";

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

export async function listProducts(query: ProductQuery = {}): Promise<ProductListResult> {
  return apiFetch<ProductListResult>("/products", {
    query: {
      search: query.search,
      categoryId: query.categoryId,
      warehouseId: query.warehouseId,
      supplierId: query.supplierId,
      stockStatus: query.stockStatus,
      status: query.status,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
  });
}

export async function getProduct(id: string): Promise<ProductRow> {
  return apiFetch<ProductRow>(`/products/${id}`);
}

export async function getProductStockByWarehouse(id: string): Promise<StockLevel[]> {
  return apiFetch<StockLevel[]>(`/products/${id}/stock`);
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
  return apiFetch<ProductHistoryEntry[]>(`/products/${id}/history`);
}

export type ProductInput = Omit<Product, "id" | "status">;

export async function createProduct(input: ProductInput): Promise<ProductRow> {
  return apiFetch<ProductRow>("/products", { method: "POST", body: input });
}

export async function updateProduct(id: string, input: ProductInput): Promise<ProductRow> {
  return apiFetch<ProductRow>(`/products/${id}`, { method: "PUT", body: input });
}

export async function toggleProductStatus(id: string): Promise<ProductRow> {
  return apiFetch<ProductRow>(`/products/${id}/status`, { method: "PATCH" });
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch<void>(`/products/${id}`, { method: "DELETE" });
}

export async function bulkSetProductStatus(
  ids: string[],
  status: "aktif" | "pasif",
): Promise<{ updatedCount: number }> {
  return apiFetch<{ updatedCount: number }>("/products/bulk-status", {
    method: "POST",
    body: { ids, status },
  });
}

export async function bulkDeleteProducts(
  ids: string[],
): Promise<{ deletedCount: number; failedSkus: string[] }> {
  return apiFetch<{ deletedCount: number; failedSkus: string[] }>("/products/bulk-delete", {
    method: "POST",
    body: { ids },
  });
}

export async function bulkImportProducts(
  inputs: ProductInput[],
): Promise<{ importedCount: number; errors: string[] }> {
  return apiFetch<{ importedCount: number; errors: string[] }>("/products/import", {
    method: "POST",
    body: { inputs },
  });
}
