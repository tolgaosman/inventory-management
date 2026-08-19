import type { Product } from "@/lib/types";
import type { DateRangePreset, WarehouseStockTotal } from "./dashboard";
import type { WarehouseDetail } from "./warehouses";
import { apiFetch } from "./client";

export interface ReportMover {
  productId: string;
  name: string;
  sku: string;
  totalQuantity: number;
}

export interface ProductsReport {
  topMovers: ReportMover[];
  leastMovers: ReportMover[];
  criticalProducts: (Product & { totalStock: number })[];
  totalActiveProducts: number;
}

export interface WarehousesReport {
  warehouses: WarehouseDetail[];
  stockTotals: WarehouseStockTotal[];
}

export interface MovementsReport {
  total: number;
  byType: { type: string; label: string; count: number; percent: number }[];
  byReason: { reason: string; label: string; count: number }[];
}

export interface PurchasingReport {
  statusBreakdown: { status: string; label: string; count: number; value: number }[];
  topSuppliers: { supplierId: string; name: string; value: number }[];
  totalOrders: number;
  totalValue: number;
}

export async function getProductsReport(range: DateRangePreset): Promise<ProductsReport> {
  return apiFetch<ProductsReport>("/reports/products", { query: { range } });
}

export async function getWarehousesReport(warehouseId?: string): Promise<WarehousesReport> {
  return apiFetch<WarehousesReport>("/reports/warehouses", { query: { warehouseId } });
}

export async function getMovementsReport(range: DateRangePreset): Promise<MovementsReport> {
  return apiFetch<MovementsReport>("/reports/movements", { query: { range } });
}

export async function getPurchasingReport(range: DateRangePreset): Promise<PurchasingReport> {
  return apiFetch<PurchasingReport>("/reports/purchasing", { query: { range } });
}
