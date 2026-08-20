import type { AppUser, Category, PagedQuery, PagedResult, Product, StockLevel, Supplier, Warehouse } from "@/lib/types";
import { apiFetch } from "./client";
import { cachedFetch, invalidateCache } from "@/lib/api-cache";

const WAREHOUSE_CACHE_TTL = 60_000; // 60 s — warehouses rarely change
const CATEGORY_CACHE_TTL = 60_000;
const SUPPLIER_CACHE_TTL = 30_000;
const USER_CACHE_TTL = 30_000;

export async function listWarehouses(): Promise<(Warehouse & { units: number; productCount: number })[]> {
  return cachedFetch(
    "warehouses:list",
    () => apiFetch<(Warehouse & { units: number; productCount: number })[]>("/warehouses"),
    WAREHOUSE_CACHE_TTL,
  );
}

export function invalidateWarehouses() {
  invalidateCache("warehouses:");
}

export async function getWarehouse(id: string): Promise<{
  warehouse: Warehouse;
  levels: (StockLevel & { product: Product })[];
}> {
  return apiFetch(`/warehouses/${id}`);
}

export async function listCategories(): Promise<(Category & { productCount: number })[]> {
  return cachedFetch(
    "categories:list",
    async () => {
      const result = await apiFetch<{
        tree: (Category & { productCount: number; children: (Category & { productCount: number })[] })[];
      }>("/categories/tree");

      // The catalog picker wants a flat list with per-category counts; the tree
      // endpoint already carries both, so flatten rather than add an endpoint.
      return result.tree.flatMap((root) => [
        { id: root.id, name: root.name, parentId: root.parentId, productCount: root.productCount },
        ...root.children.map((child) => ({
          id: child.id,
          name: child.name,
          parentId: child.parentId,
          productCount: child.productCount,
        })),
      ]);
    },
    CATEGORY_CACHE_TTL,
  );
}

export function invalidateCategories() {
  invalidateCache("categories:");
}

export type SupplierQuery = PagedQuery;

export async function listSuppliers(
  query: SupplierQuery = {},
): Promise<PagedResult<Supplier & { productCount: number }>> {
  const key = `suppliers:list:${JSON.stringify(query)}`;
  return cachedFetch(
    key,
    () =>
      apiFetch<PagedResult<Supplier & { productCount: number }>>("/suppliers", {
        query: { search: query.search, page: query.page, pageSize: query.pageSize },
      }),
    SUPPLIER_CACHE_TTL,
  );
}

export function invalidateSuppliers() {
  invalidateCache("suppliers:");
}

export async function getSupplier(id: string): Promise<{ supplier: Supplier; products: Product[] }> {
  return apiFetch(`/suppliers/${id}`);
}

export async function createSupplier(input: Omit<Supplier, "id">): Promise<Supplier> {
  invalidateSuppliers();
  return apiFetch<Supplier>("/suppliers", { method: "POST", body: input });
}

export async function updateSupplier(id: string, input: Partial<Omit<Supplier, "id">>): Promise<Supplier> {
  invalidateSuppliers();
  return apiFetch<Supplier>(`/suppliers/${id}`, { method: "PUT", body: input });
}

export async function deleteSupplier(id: string): Promise<boolean> {
  invalidateSuppliers();
  await apiFetch<{ deleted: boolean }>(`/suppliers/${id}`, { method: "DELETE" });
  return true;
}

export async function restoreSupplier(id: string): Promise<void> {
  invalidateSuppliers();
  await apiFetch<void>(`/suppliers/${id}/restore`, { method: "POST" });
}

export async function listUsers(): Promise<AppUser[]> {
  // Same cache key as lib/api/users.ts's listAppUsers — both hit GET /users
  // with no params, so sharing the key dedupes across the two call sites too.
  return cachedFetch("users:list", () => apiFetch<AppUser[]>("/users"), USER_CACHE_TTL);
}

export function invalidateUsers() {
  invalidateCache("users:");
}
