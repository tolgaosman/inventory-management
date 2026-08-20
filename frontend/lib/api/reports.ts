import type { Product } from "@/lib/types";
import type { DateRangePreset, WarehouseStockTotal } from "./dashboard";
import type { WarehouseDetail } from "./warehouses";
import { apiFetch } from "./client";
import { cachedFetch } from "@/lib/api-cache";

const REPORT_CACHE_TTL = 20_000; // 20 s — live operational data, short-lived dedup rather than long staleness

export interface ReportMover {
  productId: string;
  name: string;
  sku: string;
  totalQuantity: number;
  movementCount: number;
  imageUrl?: string;
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
  byType: { type: string; label: string; count: number; totalQuantity: number; percent: number }[];
  byReason: { reason: string; label: string; count: number }[];
}

export interface PurchasingReport {
  statusBreakdown: { status: string; label: string; count: number; value: number }[];
  topSuppliers: { supplierId: string; name: string; value: number }[];
  totalOrders: number;
  totalValue: number;
}

export interface ProductsReportOptions {
  /** Scopes the movement aggregate to one warehouse (source or transfer target). */
  warehouseId?: string;
  /** How many `topMovers` entries to return (default 10 server-side). `leastMovers` is always 10. */
  limit?: number;
}

export async function getProductsReport(
  range: DateRangePreset,
  opts: ProductsReportOptions = {},
): Promise<ProductsReport> {
  const key = `reports:products:${range}:${JSON.stringify(opts)}`;
  return cachedFetch(
    key,
    () => apiFetch<ProductsReport>("/reports/products", { query: { range, warehouseId: opts.warehouseId, limit: opts.limit } }),
    REPORT_CACHE_TTL,
  );
}

export async function getWarehousesReport(warehouseId?: string): Promise<WarehousesReport> {
  const key = `reports:warehouses:${warehouseId ?? "all"}`;
  return cachedFetch(key, () => apiFetch<WarehousesReport>("/reports/warehouses", { query: { warehouseId } }), REPORT_CACHE_TTL);
}

export async function getMovementsReport(range: DateRangePreset): Promise<MovementsReport> {
  const key = `reports:movements:${range}`;
  return cachedFetch(key, () => apiFetch<MovementsReport>("/reports/movements", { query: { range } }), REPORT_CACHE_TTL);
}

export async function getPurchasingReport(range: DateRangePreset): Promise<PurchasingReport> {
  const key = `reports:purchasing:${range}`;
  return cachedFetch(key, () => apiFetch<PurchasingReport>("/reports/purchasing", { query: { range } }), REPORT_CACHE_TTL);
}

/**
 * productId -> warehouseId -> quantity. A lightweight alternative to
 * getProductStockMatrix() for Raporlar, which only ever reads this shape —
 * skips the product/category/warehouse joins and enrichment that pickers
 * and forms need from the full stock matrix.
 */
export async function getStockByProduct(): Promise<Record<string, Record<string, number>>> {
  return cachedFetch(
    "reports:stockByProduct",
    () => apiFetch<Record<string, Record<string, number>>>("/reports/stock-by-product"),
    REPORT_CACHE_TTL,
  );
}
