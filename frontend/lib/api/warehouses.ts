import type { Warehouse } from "@/lib/types";
import { apiFetch } from "./client";
import { cachedFetch, invalidateCache } from "@/lib/api-cache";
import { invalidateWarehouses } from "./catalog";

const WAREHOUSE_DETAIL_CACHE_TTL = 15_000; // 15 s — live operational data, short-lived dedup rather than long staleness

export function invalidateWarehousesDetailed(): void {
  invalidateCache("warehousesDetailed:");
  // This module and lib/api/catalog.ts both cache warehouse data under
  // separate keys (basic list vs. detailed/matrix) — a warehouse mutation
  // needs to bust both.
  invalidateWarehouses();
}

export interface WarehouseDetail extends Warehouse {
  units: number;
  totalValue: number;
  productCount: number;
  capacityUsagePercent: number;
}

export interface ProductStockMatrixRow {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  brand: string;
  minStock: number;
  unitPrice: number;
  totalStock: number;
  totalValue: number;
  isCritical: boolean;
  status: "aktif" | "pasif";
  imageUrl?: string;
  stocksByWarehouse: Record<string, number>;
}

export interface WarehouseQuery {
  search?: string;
  warehouseId?: string;
  categoryId?: string;
}

export async function listWarehousesDetailed(): Promise<WarehouseDetail[]> {
  return cachedFetch(
    "warehousesDetailed:list",
    () => apiFetch<WarehouseDetail[]>("/warehouses/detailed"),
    WAREHOUSE_DETAIL_CACHE_TTL,
  );
}

export async function getProductStockMatrix(query: WarehouseQuery = {}): Promise<ProductStockMatrixRow[]> {
  const key = `warehousesDetailed:matrix:${JSON.stringify(query)}`;
  return cachedFetch(
    key,
    () =>
      apiFetch<ProductStockMatrixRow[]>("/warehouses/stock-matrix", {
        query: {
          search: query.search,
          // "all" is the UI's no-filter sentinel; the server understands it too.
          warehouseId: query.warehouseId,
          categoryId: query.categoryId,
        },
      }),
    WAREHOUSE_DETAIL_CACHE_TTL,
  );
}

export async function createWarehouseInput(input: Omit<Warehouse, "id">): Promise<Warehouse> {
  invalidateWarehousesDetailed();
  return apiFetch<Warehouse>("/warehouses", { method: "POST", body: input });
}

export async function updateWarehouseInput(
  id: string,
  input: Partial<Omit<Warehouse, "id">>,
): Promise<Warehouse> {
  invalidateWarehousesDetailed();
  return apiFetch<Warehouse>(`/warehouses/${id}`, { method: "PUT", body: input });
}

export async function deleteWarehouseInput(id: string): Promise<boolean> {
  invalidateWarehousesDetailed();
  await apiFetch<{ deleted: boolean }>(`/warehouses/${id}`, { method: "DELETE" });
  return true;
}

export async function restoreWarehouse(id: string): Promise<void> {
  invalidateWarehousesDetailed();
  await apiFetch<void>(`/warehouses/${id}/restore`, { method: "POST" });
}
