import type { CategoryShare, MonthlyFlow, Product, StockMovement } from "@/lib/types";
import { apiFetch } from "./client";

export type DateRangePreset = "bu-ay" | "son-3-ay" | "son-6-ay" | "bu-yil";

export const MONTHS_BY_RANGE: Record<DateRangePreset, number> = {
  "bu-ay": 1,
  "son-3-ay": 3,
  "son-6-ay": 6,
  "bu-yil": 12,
};

export const RANGE_LABELS: Record<DateRangePreset, string> = {
  "bu-ay": "Bu Ay",
  "son-3-ay": "Son 3 Ay",
  "son-6-ay": "Son 6 Ay",
  "bu-yil": "Bu Yıl",
};

export interface DashboardKpis {
  totalProducts: number;
  totalWarehouses: number;
  criticalStockCount: number;
  todayIn: number;
  todayOut: number;
  openPurchaseOrders: number;
  pendingDeliveries: number;
  purchaseTotalValue: number;
  cancelledOrders: number;
  totalPurchaseOrders: number;
  onHandUnits: number;
  incomingUnits: number;
  totalUsers: number;
  totalSuppliers: number;
  categoryCount: number;
  productVariantCount: number;
}

export interface WarehouseStockTotal {
  warehouseId: string;
  name: string;
  units: number;
  capacity: number;
}

export interface EnrichedMovement extends StockMovement {
  productName: string;
  productImageUrl?: string;
  warehouseName: string;
  targetWarehouseName?: string;
  userName: string;
}

export interface TopMover {
  productId: string;
  name: string;
  sku: string;
  movementCount: number;
  totalQuantity: number;
  imageUrl?: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  monthlyFlow: MonthlyFlow[];
  categoryShares: CategoryShare[];
  warehouseTotals: WarehouseStockTotal[];
  recentMovements: EnrichedMovement[];
  topMovers: TopMover[];
  criticalProducts: (Product & { totalStock: number })[];
}

export async function getDashboardData(
  range: DateRangePreset = "son-6-ay",
  warehouseId?: string,
): Promise<DashboardData> {
  return apiFetch<DashboardData>("/dashboard", { query: { range, warehouseId } });
}

export async function getCriticalStockNotifications(
  limit = 5,
): Promise<{ total: number; items: (Product & { totalStock: number })[] }> {
  return apiFetch("/notifications/critical-stock", { query: { limit } });
}
