// Read-mostly reference data: categories, warehouses, suppliers, users.
import type { PagedQuery, PagedResult, Supplier } from "@/lib/types";
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
  if (!supplier) throw new ApiError("Tedarikçi bulunamadı.", "NOT_FOUND");
  const supplierProducts = products.filter((p) => p.supplierId === id);
  return delay({ supplier, products: supplierProducts });
}

export async function createSupplier(input: Omit<Supplier, "id">): Promise<Supplier> {
  if (!input.name.trim()) throw new ApiError("Tedarikçi adı gereklidir.", "VALIDATION");
  if (!input.contactName.trim()) throw new ApiError("Yetkili adı gereklidir.", "VALIDATION");
  if (!input.email.trim().includes("@")) throw new ApiError("Geçerli bir e-posta gereklidir.", "VALIDATION");
  if (!input.phone.trim()) throw new ApiError("Telefon gereklidir.", "VALIDATION");
  if (!input.city.trim()) throw new ApiError("Şehir gereklidir.", "VALIDATION");

  const newSupplier: Supplier = {
    id: `sup-${suppliers.length + 1}`,
    name: input.name.trim(),
    contactName: input.contactName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
  };

  suppliers.push(newSupplier);
  return delay(newSupplier, 400);
}

export async function updateSupplier(id: string, input: Partial<Omit<Supplier, "id">>): Promise<Supplier> {
  const supplier = suppliers.find((s) => s.id === id);
  if (!supplier) throw new ApiError("Tedarikçi bulunamadı.", "NOT_FOUND");

  if (input.name !== undefined) supplier.name = input.name.trim();
  if (input.contactName !== undefined) supplier.contactName = input.contactName.trim();
  if (input.email !== undefined) supplier.email = input.email.trim();
  if (input.phone !== undefined) supplier.phone = input.phone.trim();
  if (input.city !== undefined) supplier.city = input.city.trim();

  return delay(supplier, 400);
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const index = suppliers.findIndex((s) => s.id === id);
  if (index === -1) throw new ApiError("Tedarikçi bulunamadı.", "NOT_FOUND");

  const hasProducts = products.some((p) => p.supplierId === id);
  if (hasProducts) {
    throw new ApiError("Bu tedarikçiye bağlı ürünler olduğu için silinemez. Önce ürünlerin tedarikçisini değiştiriniz.", "VALIDATION");
  }

  suppliers.splice(index, 1);
  return delay(true, 400);
}

export async function listUsers() {
  return delay(users);
}
