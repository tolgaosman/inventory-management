import type { AppUser, Category, PagedQuery, PagedResult, Product, StockLevel, Supplier, Warehouse } from "@/lib/types";
import { apiFetch } from "./client";

export async function listWarehouses(): Promise<(Warehouse & { units: number; productCount: number })[]> {
  return apiFetch<(Warehouse & { units: number; productCount: number })[]>("/warehouses");
}

export async function getWarehouse(id: string): Promise<{
  warehouse: Warehouse;
  levels: (StockLevel & { product: Product })[];
}> {
  return apiFetch(`/warehouses/${id}`);
}

export async function listCategories(): Promise<(Category & { productCount: number })[]> {
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
}

export type SupplierQuery = PagedQuery;

export async function listSuppliers(
  query: SupplierQuery = {},
): Promise<PagedResult<Supplier & { productCount: number }>> {
  return apiFetch<PagedResult<Supplier & { productCount: number }>>("/suppliers", {
    query: { search: query.search, page: query.page, pageSize: query.pageSize },
  });
}

export async function getSupplier(id: string): Promise<{ supplier: Supplier; products: Product[] }> {
  return apiFetch(`/suppliers/${id}`);
}

export async function createSupplier(input: Omit<Supplier, "id">): Promise<Supplier> {
  return apiFetch<Supplier>("/suppliers", { method: "POST", body: input });
}

export async function updateSupplier(id: string, input: Partial<Omit<Supplier, "id">>): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/${id}`, { method: "PUT", body: input });
}

export async function deleteSupplier(id: string): Promise<boolean> {
  await apiFetch<{ deleted: boolean }>(`/suppliers/${id}`, { method: "DELETE" });
  return true;
}

export async function listUsers(): Promise<AppUser[]> {
  return apiFetch<AppUser[]>("/users");
}
