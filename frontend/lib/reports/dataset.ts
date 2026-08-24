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
import { type WarehouseDetail as ApiWarehouseDetail, listWarehousesDetailed } from "@/lib/api/warehouses";
import { listSuppliers } from "@/lib/api/catalog";
import { listAppUsers } from "@/lib/api/users";
import { getStockByProduct } from "@/lib/api/reports";
import { useAsync } from "@/lib/hooks/use-async";

/** Large enough to pull a full year's worth of demo data in one page. */
const ALL = 100000;

export interface ReportDataset {
  warehouses: ApiWarehouseDetail[];
  categories: Category[];
  products: ProductRow[];
  orders: PurchaseOrderRow[];
  suppliers: (Supplier & { productCount: number })[];
  users: AppUser[];
  /** productId → warehouseId → quantity. */
  stocksByProduct: Map<string, Record<string, number>>;
}

/**
 * Everything the "Ürünler" tab (the page's default tab) needs to render —
 * fetched first and on its own so that tab is interactive without waiting
 * on the Depolar/Satın Alma tabs' data.
 */
interface ReportDatasetCore {
  products: ProductRow[];
  categories: Category[];
}

async function fetchReportDatasetCore(): Promise<ReportDatasetCore> {
  const [productsResult, categoryTree] = await Promise.all([
    listProducts({ pageSize: ALL }),
    listCategoryTree(),
  ]);
  return { products: productsResult.rows, categories: categoryTree.all };
}

/** Everything the Depolar/Hareketler/Satın Alma tabs need, loaded after — never blocks the initial render. */
type ReportDatasetExtra = Omit<ReportDataset, keyof ReportDatasetCore>;

const EMPTY_EXTRA: ReportDatasetExtra = {
  warehouses: [],
  orders: [],
  suppliers: [],
  users: [],
  stocksByProduct: new Map(),
};

async function fetchReportDatasetExtra(): Promise<ReportDatasetExtra> {
  const [warehouses, ordersResult, suppliersResult, users, stockByProduct] = await Promise.all([
    listWarehousesDetailed(),
    listPurchaseOrders({ pageSize: ALL }),
    listSuppliers({ pageSize: ALL }),
    listAppUsers(),
    getStockByProduct(),
  ]);

  return {
    warehouses,
    orders: ordersResult.rows,
    suppliers: suppliersResult.rows,
    users,
    stocksByProduct: new Map(Object.entries(stockByProduct)),
  };
}

/**
 * Fetches the full (unpaginated, un-truncated) dataset the reports page and
 * its exports both aggregate over. Movement-derived numbers (top movers, type
 * counts) are NOT here — those come from the DB-aggregate `/reports/*`
 * endpoints (`lib/api/reports.ts`) instead of downloading the whole
 * stock_movements table just to count/sum it in the browser.
 *
 * Kept for the export builder (`lib/export/report-data.ts`), which genuinely
 * needs the whole thing at once. The on-screen page uses `useReportDataset`
 * below instead, which stages this same data in two waves.
 */
export async function fetchReportDataset(): Promise<ReportDataset> {
  const [core, extra] = await Promise.all([fetchReportDatasetCore(), fetchReportDatasetExtra()]);
  return { ...core, ...extra };
}

/**
 * Loads the reports page's data in two waves instead of one: `core`
 * (products/categories — what the default "Ürünler" tab needs) resolves
 * first and unblocks the page, while `extra` (warehouses/orders/suppliers/
 * users — needed by the other tabs) keeps loading in the background. `status`
 * reflects only `core`, so the page stops feeling stuck as soon as the first
 * tab has something to show; the other tabs simply pick up `extra`'s fields
 * once that wave lands, without a second loading flash on the page itself.
 */
export function useReportDataset() {
  const core = useAsync(fetchReportDatasetCore, []);
  const extra = useAsync(fetchReportDatasetExtra, []);

  const coreData = core.data ?? core.staleData;
  const extraData = extra.data ?? extra.staleData ?? EMPTY_EXTRA;

  const data: ReportDataset | undefined = core.data ? { ...core.data, ...extraData } : undefined;
  const staleData: ReportDataset | undefined = coreData ? { ...coreData, ...extraData } : undefined;

  return { data, staleData, status: core.status, error: core.error ?? extra.error };
}

/**
 * Full, un-truncated movement list for the selected period — used only by
 * the CSV/PDF export builder (`lib/export/report-data.ts`), which genuinely
 * needs every row. Deliberately NOT part of `fetchReportDataset()`/`ReportDataset`:
 * the on-screen Raporlar page gets its movement-derived numbers from the
 * DB-aggregate `/reports/*` endpoints instead, so this (expensive) full fetch
 * only happens when a user actually clicks "Dışa Aktar", not on every page view.
 */
export async function fetchReportMovements(dateFrom?: string): Promise<StockMovement[]> {
  const result = await listMovements({ pageSize: ALL, dateFrom });
  return result.rows;
}

export interface TopMover {
  productId: string;
  name: string;
  sku: string;
  movementCount: number;
  totalQuantity: number;
  imageUrl?: string;
}

/** Pure aggregation over an already-fetched movement list — used by the export builder. */
export function topMoversFromMovements(movements: StockMovement[], products: ProductRow[], limit = 15): TopMover[] {
  const byProduct = new Map<string, { count: number; qty: number }>();
  for (const m of movements) {
    const cur = byProduct.get(m.productId) ?? { count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += m.quantity;
    byProduct.set(m.productId, cur);
  }
  const productsById = new Map(products.map((p) => [p.id, p]));
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
    const categoryProducts = ds.products.filter((p) => descendantIds.has(p.categoryId ?? ""));
    const units = warehouseId
      ? categoryProducts.reduce((sum, p) => sum + (ds.stocksByProduct.get(p.id)?.[warehouseId] ?? 0), 0)
      : categoryProducts.reduce((sum, p) => sum + p.totalStock, 0);
    return { categoryId: top.id, name: top.name, units };
  });
  return shares.sort((a, b) => b.units - a.units);
}

/** Memoized per-top-level-category share, one entry per warehouse — feeds the "Depo Bazında Kategori Dağılımı" chart. */
export function useWarehouseCategoryShares(ds: ReportDataset | undefined) {
  return useMemo(() => {
    if (!ds) return [];
    return ds.warehouses.map((w) => ({ warehouseId: w.id, name: w.name, shares: categoryShares(ds, w.id) }));
  }, [ds]);
}

export type { PurchaseOrderItem };
