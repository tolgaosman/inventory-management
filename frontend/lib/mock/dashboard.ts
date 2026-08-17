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

/** First moment of the range window, aligned with getMonthlyFlow's bucketing. */
function rangeStart(months: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
}

function movementMatchesWarehouse(m: StockMovement, warehouseId?: string): boolean {
  if (!warehouseId) return true;
  return m.warehouseId === warehouseId || m.targetWarehouseId === warehouseId;
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
  totalPurchaseOrders: number;
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

export function getCriticalProducts(): (Product & { totalStock: number })[] {
  return products
    .filter((p) => p.status === "aktif" && isProductCritical(p))
    .map((p) => ({ ...p, totalStock: totalStockForProduct(p.id) }));
}

export function getDashboardKpis(opts: { months?: number; warehouseId?: string } = {}): DashboardKpis {
  const { months = 6, warehouseId } = opts;

  const scopedMovements = stockMovements.filter((m) => movementMatchesWarehouse(m, warehouseId));
  const scopedStockLevels = warehouseId ? stockLevels.filter((s) => s.warehouseId === warehouseId) : stockLevels;

  const todayMovements = scopedMovements.filter((m) => isToday(m.createdAt));
  const todayIn = todayMovements
    .filter((m) => m.type === "giris")
    .reduce((sum, m) => sum + m.quantity, 0);
  const todayOut = todayMovements
    .filter((m) => m.type === "cikis")
    .reduce((sum, m) => sum + m.quantity, 0);

  // Purchase orders have no warehouse dimension in the schema, so they only
  // respect the date range, never the warehouse filter.
  const since = rangeStart(months).getTime();
  const scopedPurchaseOrders = purchaseOrders.filter((po) => new Date(po.createdAt).getTime() >= since);

  const openPurchaseOrders = scopedPurchaseOrders.filter(
    (po) => po.status === "ordered" || po.status === "partially_received",
  ).length;
  const pendingDeliveries = scopedPurchaseOrders.filter((po) => po.status === "partially_received").length;
  const purchaseTotalValue = scopedPurchaseOrders
    .filter((po) => po.status !== "cancelled" && po.status !== "draft")
    .reduce((sum, po) => sum + po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 0);
  const cancelledOrders = scopedPurchaseOrders.filter((po) => po.status === "cancelled").length;

  const onHandUnits = scopedStockLevels.reduce((sum, s) => sum + s.quantity, 0);
  const incomingUnits = scopedPurchaseOrders
    .filter((po) => po.status === "ordered" || po.status === "partially_received")
    .reduce(
      (sum, po) => sum + po.items.reduce((s, i) => s + (i.quantity - i.receivedQuantity), 0),
      0,
    );

  return {
    totalProducts: products.length,
    totalWarehouses: warehouseId ? 1 : warehouses.length,
    criticalStockCount: getCriticalProducts().length,
    todayIn,
    todayOut,
    openPurchaseOrders,
    pendingDeliveries,
    purchaseTotalValue,
    cancelledOrders,
    totalPurchaseOrders: scopedPurchaseOrders.length,
    onHandUnits,
    incomingUnits,
    totalUsers: users.length,
    totalSuppliers: suppliers.length,
    categoryCount: categories.length,
    productVariantCount: products.length,
  };
}

/** Monthly inbound/outbound totals for the last `months` months. */
export function getMonthlyFlow(months = 9, warehouseId?: string): MonthlyFlow[] {
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
    if (!movementMatchesWarehouse(m, warehouseId)) continue;
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
export function getCategoryShares(warehouseId?: string): CategoryShare[] {
  const topLevel = categories.filter((c) => c.parentId === null);
  const shares: CategoryShare[] = topLevel.map((top) => {
    const descendantIds = new Set([
      top.id,
      ...categories.filter((c) => c.parentId === top.id).map((c) => c.id),
    ]);
    const categoryProducts = products.filter((p) => descendantIds.has(p.categoryId));
    const units = warehouseId
      ? stockLevels
          .filter((s) => s.warehouseId === warehouseId && categoryProducts.some((p) => p.id === s.productId))
          .reduce((sum, s) => sum + s.quantity, 0)
      : categoryProducts.reduce((sum, p) => sum + totalStockForProduct(p.id), 0);
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

export function getWarehouseStockTotals(warehouseId?: string): WarehouseStockTotal[] {
  const scoped = warehouseId ? warehouses.filter((w) => w.id === warehouseId) : warehouses;
  return scoped
    .map((wh) => ({
      warehouseId: wh.id,
      name: wh.name,
      units: stockLevels.filter((s) => s.warehouseId === wh.id).reduce((sum, s) => sum + s.quantity, 0),
      capacity: wh.capacity,
    }))
    .sort((a, b) => b.units - a.units);
}

export interface WarehouseDetail {
  warehouseId: string;
  name: string;
  city: string;
  units: number;
  capacity: number;
  capacityPercent: number;
  totalValue: number;
  productCount: number;
}

/** Richer per-warehouse aggregate (value, SKU variety) for warehouse comparison panels. */
export function getWarehouseDetails(warehouseId?: string): WarehouseDetail[] {
  const scoped = warehouseId ? warehouses.filter((w) => w.id === warehouseId) : warehouses;
  return scoped
    .map((wh) => {
      const levels = stockLevels.filter((s) => s.warehouseId === wh.id);
      const units = levels.reduce((sum, s) => sum + s.quantity, 0);
      const totalValue = levels.reduce((sum, s) => {
        const product = products.find((p) => p.id === s.productId);
        return sum + (product ? s.quantity * product.purchasePrice : 0);
      }, 0);
      const productCount = new Set(levels.filter((s) => s.quantity > 0).map((s) => s.productId)).size;
      return {
        warehouseId: wh.id,
        name: wh.name,
        city: wh.city,
        units,
        capacity: wh.capacity,
        capacityPercent: wh.capacity > 0 ? Math.min(Math.round((units / wh.capacity) * 100), 100) : 0,
        totalValue,
        productCount,
      };
    })
    .sort((a, b) => b.units - a.units);
}

export interface EnrichedMovement extends StockMovement {
  productName: string;
  productImageUrl?: string;
  warehouseName: string;
  targetWarehouseName?: string;
  userName: string;
}

function enrichMovement(m: StockMovement): EnrichedMovement {
  const product = products.find((p) => p.id === m.productId);
  const warehouse = warehouses.find((w) => w.id === m.warehouseId);
  const targetWarehouse = m.targetWarehouseId ? warehouses.find((w) => w.id === m.targetWarehouseId) : undefined;
  const user = users.find((u) => u.id === m.userId);
  return {
    ...m,
    productName: product?.name ?? "Bilinmeyen ürün",
    productImageUrl: product?.imageUrl,
    warehouseName: warehouse?.name ?? "Bilinmeyen depo",
    targetWarehouseName: targetWarehouse?.name,
    userName: user?.name ?? "Bilinmeyen kullanıcı",
  };
}

export function getRecentMovements(limit = 15, warehouseId?: string): EnrichedMovement[] {
  return stockMovements
    .filter((m) => movementMatchesWarehouse(m, warehouseId))
    .slice(0, limit)
    .map(enrichMovement);
}

export interface TopMover {
  productId: string;
  name: string;
  sku: string;
  movementCount: number;
  totalQuantity: number;
  imageUrl?: string;
}

export function getTopMovers(limit = 15, warehouseId?: string): TopMover[] {
  const byProduct = new Map<string, { count: number; qty: number }>();
  for (const m of stockMovements) {
    if (!movementMatchesWarehouse(m, warehouseId)) continue;
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
        imageUrl: product?.imageUrl,
      };
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);
}

/** Critical-stock summary for the header notification popover. */
export function getCriticalStockSummary(limit = 5): { total: number; items: (Product & { totalStock: number })[] } {
  const items = getCriticalProducts();
  return { total: items.length, items: items.slice(0, limit) };
}
