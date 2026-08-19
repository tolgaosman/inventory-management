import type { Warehouse } from "@/lib/types";
import { apiFetch } from "./client";

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
  return apiFetch<WarehouseDetail[]>("/warehouses/detailed");
}

export async function getProductStockMatrix(query: WarehouseQuery = {}): Promise<ProductStockMatrixRow[]> {
  return apiFetch<ProductStockMatrixRow[]>("/warehouses/stock-matrix", {
    query: {
      search: query.search,
      // "all" is the UI's no-filter sentinel; the server understands it too.
      warehouseId: query.warehouseId,
      categoryId: query.categoryId,
    },
  });
}

export async function createWarehouseInput(input: Omit<Warehouse, "id">): Promise<Warehouse> {
  return apiFetch<Warehouse>("/warehouses", { method: "POST", body: input });
}

export async function updateWarehouseInput(
  id: string,
  input: Partial<Omit<Warehouse, "id">>,
): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/warehouses/${id}`, { method: "PUT", body: input });
}

export async function deleteWarehouseInput(id: string): Promise<boolean> {
  await apiFetch<{ deleted: boolean }>(`/warehouses/${id}`, { method: "DELETE" });
  return true;
}
