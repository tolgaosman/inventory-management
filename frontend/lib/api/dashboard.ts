import {
  getCategoryShares,
  getDashboardKpis,
  getMonthlyFlow,
  getRecentMovements,
  getTopMovers,
  getWarehouseStockTotals,
  getCriticalProducts,
} from "@/lib/mock/dashboard";
import { totalStockForProduct } from "@/lib/mock/data";
import { delay } from "./client";

export type DateRangePreset = "bu-ay" | "son-3-ay" | "son-6-ay" | "bu-yil";

const MONTHS_BY_RANGE: Record<DateRangePreset, number> = {
  "bu-ay": 1,
  "son-3-ay": 3,
  "son-6-ay": 6,
  "bu-yil": 12,
};

export async function getDashboardData(range: DateRangePreset = "son-6-ay") {
  const months = MONTHS_BY_RANGE[range];
  return delay(
    {
      kpis: getDashboardKpis(),
      monthlyFlow: getMonthlyFlow(Math.max(months, 5)),
      categoryShares: getCategoryShares(),
      warehouseTotals: getWarehouseStockTotals(),
      recentMovements: getRecentMovements(8),
      topMovers: getTopMovers(6),
      criticalProducts: getCriticalProducts()
        .slice(0, 6)
        .map((p) => ({ ...p, totalStock: totalStockForProduct(p.id) })),
    },
    500,
  );
}
