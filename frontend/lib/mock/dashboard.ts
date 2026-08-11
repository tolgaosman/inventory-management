import type { CategoryShare, MonthlyFlow, Product, StockMovement } from "@/lib/types";
import {
  categories,
  products,
  purchaseOrders,
  stockLevels,
  stockMovements,
  suppliers,
  totalStockForProduct,
  users,
  warehouses,
} from "./data";

const MONTH_LABELS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isToday(iso: string): boolean {
  const d = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(new Date()).getTime();
  return d === today;
}

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
  onHandUnits: number;
  incomingUnits: number;
  totalUsers: number;
  totalSuppliers: number;
  categoryCount: number;
  productVariantCount: number;
}

export function isProductCritical(product: Product): boolean {
  return totalStockForProduct(product.id) < product.minStock;
}

export function getCriticalProducts(): Product[] {
  return products.filter((p) => p.status === "aktif" && isProductCritical(p));
}

export function getDashboardKpis(): DashboardKpis {
  const todayMovements = stockMovements.filter((m) => isToday(m.createdAt));
  const todayIn = todayMovements
    .filter((m) => m.type === "giris")
    .reduce((sum, m) => sum + m.quantity, 0);
  const todayOut = todayMovements
    .filter((m) => m.type === "cikis")
    .reduce((sum, m) => sum + m.quantity, 0);

  const openPurchaseOrders = purchaseOrders.filter(
    (po) => po.status === "ordered" || po.status === "partially_received",
  ).length;
  const pendingDeliveries = purchaseOrders.filter((po) => po.status === "partially_received").length;
  const purchaseTotalValue = purchaseOrders
    .filter((po) => po.status !== "cancelled" && po.status !== "draft")
    .reduce((sum, po) => sum + po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 0);
  const cancelledOrders = purchaseOrders.filter((po) => po.status === "cancelled").length;

  const onHandUnits = stockLevels.reduce((sum, s) => sum + s.quantity, 0);
  const incomingUnits = purchaseOrders
    .filter((po) => po.status === "ordered" || po.status === "partially_received")
    .reduce(
      (sum, po) => sum + po.items.reduce((s, i) => s + (i.quantity - i.receivedQuantity), 0),
      0,
    );

  const activeProductsCount = products.filter((p) => p.status === "aktif").length;

  return {
    totalProducts: products.length,
    totalWarehouses: warehouses.length,
    criticalStockCount: getCriticalProducts().length,
    todayIn,
    todayOut,
    openPurchaseOrders,
    pendingDeliveries,
    purchaseTotalValue,
    cancelledOrders,
    onHandUnits,
    incomingUnits,
    totalUsers: users.length,
    totalSuppliers: suppliers.length,
    categoryCount: categories.length,
    productVariantCount: products.length,
  };
}

/** Monthly inbound/outbound totals for the last `months` months. */
export function getMonthlyFlow(months = 9): MonthlyFlow[] {
  const now = new Date();
  const buckets = new Map<string, MonthlyFlow>();
  const order: string[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    order.push(key);
    buckets.set(key, { month: MONTH_LABELS[d.getMonth()], inbound: 0, outbound: 0 });
  }

  for (const m of stockMovements) {
    const d = new Date(m.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (m.type === "giris") bucket.inbound += m.quantity;
    if (m.type === "cikis") bucket.outbound += m.quantity;
  }

  return order.map((k) => buckets.get(k)!);
}

/** Unit distribution across top-level categories, for the radial chart. */
export function getCategoryShares(): CategoryShare[] {
  const topLevel = categories.filter((c) => c.parentId === null);
  const shares: CategoryShare[] = topLevel.map((top) => {
    const descendantIds = new Set([
      top.id,
      ...categories.filter((c) => c.parentId === top.id).map((c) => c.id),
    ]);
    const units = products
      .filter((p) => descendantIds.has(p.categoryId))
      .reduce((sum, p) => sum + totalStockForProduct(p.id), 0);
    return { categoryId: top.id, name: top.name, units };
  });
  return shares.sort((a, b) => b.units - a.units);
}

export interface WarehouseStockTotal {
  warehouseId: string;
  name: string;
  units: number;
  capacity: number;
}

export function getWarehouseStockTotals(): WarehouseStockTotal[] {
  return warehouses
    .map((wh) => ({
      warehouseId: wh.id,
      name: wh.name,
      units: stockLevels.filter((s) => s.warehouseId === wh.id).reduce((sum, s) => sum + s.quantity, 0),
      capacity: wh.capacity,
    }))
    .sort((a, b) => b.units - a.units);
}

export function getRecentMovements(limit = 15): StockMovement[] {
  return stockMovements.slice(0, limit);
}

export interface TopMover {
  productId: string;
  name: string;
  sku: string;
  movementCount: number;
  totalQuantity: number;
}

export function getTopMovers(limit = 15): TopMover[] {
  const byProduct = new Map<string, { count: number; qty: number }>();
  for (const m of stockMovements) {
    const cur = byProduct.get(m.productId) ?? { count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += m.quantity;
    byProduct.set(m.productId, cur);
  }
  return [...byProduct.entries()]
    .map(([productId, v]) => {
      const product = products.find((p) => p.id === productId)!;
      return {
        productId,
        name: product.name,
        sku: product.sku,
        movementCount: v.count,
        totalQuantity: v.qty,
      };
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);
}
