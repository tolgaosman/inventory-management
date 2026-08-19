// Raw data + pure aggregation helpers for the Raporlar page. reports-client.tsx
// used to import lib/mock/data and lib/mock/dashboard directly and compute
// everything client-side over the full in-memory dataset; this module keeps
// that same "fetch everything once, aggregate in the browser" shape but
// sources the raw arrays from the API instead of the mock module.
import { useMemo } from "react";
import type { AppUser, Category, PurchaseOrderItem, StockMovement, Supplier } from "@/lib/types";
import { listCategoryTree } from "@/lib/api/categories";
import { type ProductRow, listProducts } from "@/lib/api/products";
import { listMovements } from "@/lib/api/movements";
import { type PurchaseOrderRow, listPurchaseOrders } from "@/lib/api/purchase-orders";
import { type WarehouseDetail as ApiWarehouseDetail, getProductStockMatrix, listWarehousesDetailed } from "@/lib/api/warehouses";
import { listSuppliers } from "@/lib/api/catalog";
import { listAppUsers } from "@/lib/api/users";
import { useAsync } from "@/lib/hooks/use-async";

/** Large enough to pull a full year's worth of demo data in one page. */
const ALL = 100000;

export interface ReportDataset {
  warehouses: ApiWarehouseDetail[];
  categories: Category[];
  products: ProductRow[];
  movements: StockMovement[];
  orders: PurchaseOrderRow[];
  suppliers: (Supplier & { productCount: number })[];
  users: AppUser[];
  /** productId → warehouseId → quantity, built from the stock matrix. */
  stocksByProduct: Map<string, Record<string, number>>;
}

/** Fetches the full (unpaginated, un-truncated) dataset the reports page and its exports both aggregate over. */
export async function fetchReportDataset(): Promise<ReportDataset> {
  const [warehouses, categoryTree, productsResult, movementsResult, ordersResult, suppliersResult, users, matrix] =
    await Promise.all([
      listWarehousesDetailed(),
      listCategoryTree(),
      listProducts({ pageSize: ALL }),
      listMovements({ pageSize: ALL }),
      listPurchaseOrders({ pageSize: ALL }),
      listSuppliers({ pageSize: ALL }),
      listAppUsers(),
      getProductStockMatrix({}),
    ]);

  const stocksByProduct = new Map<string, Record<string, number>>();
  for (const row of matrix) stocksByProduct.set(row.productId, row.stocksByWarehouse);

  return {
    warehouses,
    categories: categoryTree.all,
    products: productsResult.rows,
    movements: movementsResult.rows,
    orders: ordersResult.rows,
    suppliers: suppliersResult.rows,
    users,
    stocksByProduct,
  };
}

export function useReportDataset() {
  return useAsync(fetchReportDataset, []);
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

export function warehouseDetails(ds: ReportDataset, warehouseId?: string): WarehouseDetail[] {
  const scoped = warehouseId ? ds.warehouses.filter((w) => w.id === warehouseId) : ds.warehouses;
  return scoped
    .map((w) => ({
      warehouseId: w.id,
      name: w.name,
      city: w.city,
      units: w.units,
      capacity: w.capacity,
      capacityPercent: w.capacityUsagePercent,
      totalValue: w.totalValue,
      productCount: w.productCount,
    }))
    .sort((a, b) => b.units - a.units);
}

export function criticalProducts(ds: ReportDataset) {
  return ds.products.filter((p) => p.status === "aktif" && p.critical);
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  units: number;
}

/** Unit distribution across top-level categories, optionally scoped to one warehouse. */
export function categoryShares(ds: ReportDataset, warehouseId?: string): CategoryShare[] {
  const topLevel = ds.categories.filter((c) => c.parentId === null);
  const shares = topLevel.map((top) => {
    const descendantIds = new Set([top.id, ...ds.categories.filter((c) => c.parentId === top.id).map((c) => c.id)]);
    const categoryProducts = ds.products.filter((p) => descendantIds.has(p.categoryId));
    const units = warehouseId
      ? categoryProducts.reduce((sum, p) => sum + (ds.stocksByProduct.get(p.id)?.[warehouseId] ?? 0), 0)
      : categoryProducts.reduce((sum, p) => sum + p.totalStock, 0);
    return { categoryId: top.id, name: top.name, units };
  });
  return shares.sort((a, b) => b.units - a.units);
}

export interface TopMover {
  productId: string;
  name: string;
  sku: string;
  movementCount: number;
  totalQuantity: number;
  imageUrl?: string;
}

function movementMatchesWarehouse(m: StockMovement, warehouseId?: string): boolean {
  if (!warehouseId) return true;
  return m.warehouseId === warehouseId || m.targetWarehouseId === warehouseId;
}

export function topMovers(ds: ReportDataset, limit = 15, warehouseId?: string): TopMover[] {
  const byProduct = new Map<string, { count: number; qty: number }>();
  for (const m of ds.movements) {
    if (!movementMatchesWarehouse(m, warehouseId)) continue;
    const cur = byProduct.get(m.productId) ?? { count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += m.quantity;
    byProduct.set(m.productId, cur);
  }
  const productsById = new Map(ds.products.map((p) => [p.id, p]));
  return [...byProduct.entries()]
    .map(([productId, v]) => {
      const product = productsById.get(productId);
      return {
        productId,
        name: product?.name ?? "Bilinmeyen ürün",
        sku: product?.sku ?? "-",
        movementCount: v.count,
        totalQuantity: v.qty,
        imageUrl: product?.imageUrl,
      };
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);
}

/** Memoized per-top-level-category share, one entry per warehouse — feeds the "Depo Bazında Kategori Dağılımı" chart. */
export function useWarehouseCategoryShares(ds: ReportDataset | undefined) {
  return useMemo(() => {
    if (!ds) return [];
    return ds.warehouses.map((w) => ({ warehouseId: w.id, name: w.name, shares: categoryShares(ds, w.id) }));
  }, [ds]);
}

export type { PurchaseOrderItem };
