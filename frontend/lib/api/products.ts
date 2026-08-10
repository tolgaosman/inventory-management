import type { PagedQuery, PagedResult, Product } from "@/lib/types";
import {
  categories,
  products,
  stockForProductByWarehouse,
  stockMovements,
  totalStockForProduct,
} from "@/lib/mock/data";
import { isProductCritical } from "@/lib/mock/dashboard";
import { id as makeId } from "@/lib/mock/seed";
import { ApiError, delay, matchesSearch, paginate } from "./client";

export interface ProductQuery extends PagedQuery {
  categoryId?: string;
  warehouseId?: string;
  stockStatus?: "kritik" | "dusuk" | "normal";
  supplierId?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductRow extends Product {
  totalStock: number;
  categoryName: string;
  critical: boolean;
}

function toRow(p: Product): ProductRow {
  return {
    ...p,
    totalStock: totalStockForProduct(p.id),
    categoryName: categories.find((c) => c.id === p.categoryId)?.name ?? "-",
    critical: isProductCritical(p),
  };
}

export async function listProducts(query: ProductQuery = {}): Promise<PagedResult<ProductRow>> {
  let rows = products.map(toRow);

  rows = rows.filter((p) => matchesSearch([p.name, p.sku, p.barcode, p.brand], query.search));
  if (query.categoryId) rows = rows.filter((p) => p.categoryId === query.categoryId);
  if (query.supplierId) rows = rows.filter((p) => p.supplierId === query.supplierId);
  if (query.warehouseId) {
    rows = rows.filter((p) =>
      stockForProductByWarehouse(p.id).some((s) => s.warehouseId === query.warehouseId && s.quantity > 0),
    );
  }
  if (query.stockStatus === "kritik") rows = rows.filter((p) => p.critical);
  if (query.stockStatus === "dusuk")
    rows = rows.filter((p) => !p.critical && p.totalStock < p.minStock * 1.5);
  if (query.stockStatus === "normal") rows = rows.filter((p) => p.totalStock >= p.minStock * 1.5);
  if (query.minPrice != null) rows = rows.filter((p) => p.salePrice >= query.minPrice!);
  if (query.maxPrice != null) rows = rows.filter((p) => p.salePrice <= query.maxPrice!);

  if (query.sortBy) {
    const dir = query.sortDir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = a[query.sortBy as keyof ProductRow];
      const bv = b[query.sortBy as keyof ProductRow];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "tr-TR") * dir;
    });
  }

  return delay(paginate(rows, query));
}

export async function getProduct(id: string): Promise<ProductRow> {
  const product = products.find((p) => p.id === id);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");
  return delay(toRow(product));
}

export async function getProductStockByWarehouse(id: string) {
  return delay(stockForProductByWarehouse(id));
}

export interface ProductHistoryEntry {
  id: string;
  date: string;
  delta: number;
  label: string;
}

export async function getProductHistory(id: string): Promise<ProductHistoryEntry[]> {
  const entries = stockMovements
    .filter((m) => m.productId === id)
    .map((m) => ({
      id: m.id,
      date: m.createdAt,
      delta: m.type === "giris" ? m.quantity : -m.quantity,
      label:
        m.type === "giris"
          ? "Stok Girişi"
          : m.type === "cikis"
            ? "Stok Çıkışı"
            : "Depolar Arası Transfer",
    }));
  return delay(entries);
}

export type ProductInput = Omit<Product, "id" | "status">;

export async function createProduct(input: ProductInput): Promise<ProductRow> {
  if (products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase())) {
    throw new ApiError(`"${input.sku}" SKU'su zaten kullanılıyor.`, "CONFLICT");
  }
  const product: Product = { ...input, id: makeId("prd", products.length + 1), status: "aktif" };
  products.push(product);
  return delay(toRow(product), 500);
}

export async function updateProduct(id: string, input: ProductInput): Promise<ProductRow> {
  const product = products.find((p) => p.id === id);
  if (!product) throw new ApiError("Ürün bulunamadı.", "NOT_FOUND");
  if (products.some((p) => p.id !== id && p.sku.toLowerCase() === input.sku.toLowerCase())) {
    throw new ApiError(`"${input.sku}" SKU'su zaten kullanılıyor.`, "CONFLICT");
  }
  Object.assign(product, input);
  return delay(toRow(product), 500);
}
