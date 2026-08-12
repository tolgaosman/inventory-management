// Read-mostly reference data: categories, warehouses, suppliers, users.
import type { PagedQuery, PagedResult } from "@/lib/types";
import { categories, suppliers, users, warehouses, products, stockLevels } from "@/lib/mock/data";
import { getWarehouseStockTotals } from "@/lib/mock/dashboard";
import { ApiError, delay, matchesSearch, paginate } from "./client";

export async function listWarehouses() {
  const totals = getWarehouseStockTotals();
  const rows = warehouses.map((w) => ({
    ...w,
    units: totals.find((t) => t.warehouseId === w.id)?.units ?? 0,
    productCount: new Set(stockLevels.filter((s) => s.warehouseId === w.id).map((s) => s.productId)).size,
  }));
  return delay(rows);
}

export async function getWarehouse(id: string) {
  const wh = warehouses.find((w) => w.id === id);
  if (!wh) throw new ApiError("Depo bulunamadı.", "NOT_FOUND");
  const levels = stockLevels
    .filter((s) => s.warehouseId === id)
    .map((s) => ({
      ...s,
      product: products.find((p) => p.id === s.productId)!,
    }))
    .filter((s) => s.product);
  return delay({ warehouse: wh, levels });
}

export async function listCategories() {
  return delay(
    categories.map((c) => ({
      ...c,
      productCount: products.filter((p) => p.categoryId === c.id).length,
    })),
  );
}

export type SupplierQuery = PagedQuery;

export async function listSuppliers(query: SupplierQuery = {}) {
  let rows = suppliers.map((s) => ({
    ...s,
    productCount: products.filter((p) => p.supplierId === s.id).length,
  }));
  rows = rows.filter((s) => matchesSearch([s.name, s.contactName, s.email, s.city], query.search));
  return delay(paginate(rows, query) as PagedResult<(typeof rows)[number]>);
}

export async function getSupplier(id: string) {
  const supplier = suppliers.find((s) => s.id === id);
  if (!supplier) throw new Error("Tedarikçi bulunamadı.");
  const supplierProducts = products.filter((p) => p.supplierId === id);
  return delay({ supplier, products: supplierProducts });
}

export async function listUsers() {
  return delay(users);
}
