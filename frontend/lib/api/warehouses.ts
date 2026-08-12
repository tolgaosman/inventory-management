import { categories, products, stockLevels, warehouses } from "@/lib/mock/data";
import { getWarehouseStockTotals } from "@/lib/mock/dashboard";
import { ApiError, delay, matchesSearch } from "./client";
import type { Warehouse } from "@/lib/types";

export interface WarehouseDetail extends Warehouse {
  units: number;
  totalValue: number;
  productCount: number;
  capacityUsagePercent: number;
}

export interface ProductStockMatrixRow {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  brand: string;
  minStock: number;
  unitPrice: number;
  totalStock: number;
  totalValue: number;
  isCritical: boolean;
  status: "aktif" | "pasif";
  imageUrl?: string;
  stocksByWarehouse: Record<string, number>;
}

export interface WarehouseQuery {
  search?: string;
  warehouseId?: string;
  categoryId?: string;
}

export async function listWarehousesDetailed(): Promise<WarehouseDetail[]> {
  const totals = getWarehouseStockTotals();
  
  const rows = warehouses.map((w) => {
    const warehouseLevels = stockLevels.filter((s) => s.warehouseId === w.id);
    const units = totals.find((t) => t.warehouseId === w.id)?.units ?? 0;
    
    // Calculate total value of stock in this warehouse
    const totalValue = warehouseLevels.reduce((sum, level) => {
      const p = products.find((prd) => prd.id === level.productId);
      return sum + (p ? level.quantity * p.purchasePrice : 0);
    }, 0);

    const productCount = new Set(warehouseLevels.filter((s) => s.quantity > 0).map((s) => s.productId)).size;
    const capacityUsagePercent = Math.min(Math.round((units / w.capacity) * 100), 100);

    return {
      ...w,
      units,
      totalValue,
      productCount,
      capacityUsagePercent,
    };
  });

  return delay(rows, 300);
}

export async function getProductStockMatrix(query: WarehouseQuery = {}): Promise<ProductStockMatrixRow[]> {
  let filteredProducts = [...products];

  if (query.categoryId && query.categoryId !== "all") {
    const ids = new Set<string>([query.categoryId]);
    let added = true;
    while (added) {
      added = false;
      for (const c of categories) {
        if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
          ids.add(c.id);
          added = true;
        }
      }
    }
    filteredProducts = filteredProducts.filter((p) => ids.has(p.categoryId));
  }

  if (query.search) {
    filteredProducts = filteredProducts.filter((p) =>
      matchesSearch([p.name, p.sku, p.brand], query.search),
    );
  }

  const rows: ProductStockMatrixRow[] = filteredProducts.map((p) => {
    const stocksByWarehouse: Record<string, number> = {};
    let totalStock = 0;

    warehouses.forEach((w) => {
      const level = stockLevels.find((s) => s.productId === p.id && s.warehouseId === w.id);
      const q = level ? level.quantity : 0;
      stocksByWarehouse[w.id] = q;
      totalStock += q;
    });

    const category = categories.find((c) => c.id === p.categoryId);

    return {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      categoryName: category?.name ?? "Genel",
      brand: p.brand,
      minStock: p.minStock,
      unitPrice: p.purchasePrice,
      totalStock,
      totalValue: totalStock * p.purchasePrice,
      isCritical: totalStock < p.minStock,
      status: p.status,
      imageUrl: p.imageUrl,
      stocksByWarehouse,
    };
  });

  if (query.warehouseId && query.warehouseId !== "all") {
    return delay(rows.filter((r) => (r.stocksByWarehouse[query.warehouseId!] ?? 0) > 0), 300);
  }

  return delay(rows, 350);
}

export async function createWarehouseInput(input: Omit<Warehouse, "id">): Promise<Warehouse> {
  if (!input.name.trim()) throw new ApiError("Depo adı gereklidir.", "VALIDATION");
  if (!input.city.trim()) throw new ApiError("Şehir gereklidir.", "VALIDATION");
  if (input.capacity <= 0) throw new ApiError("Kapasite 0'dan büyük olmalıdır.", "VALIDATION");

  const newWh: Warehouse = {
    id: `wh-${warehouses.length + 1}`,
    name: input.name.trim(),
    city: input.city.trim(),
    address: input.address.trim() || "-",
    capacity: input.capacity,
  };

  warehouses.push(newWh);
  return delay(newWh, 400);
}

export async function updateWarehouseInput(id: string, input: Partial<Omit<Warehouse, "id">>): Promise<Warehouse> {
  const wh = warehouses.find((w) => w.id === id);
  if (!wh) throw new ApiError("Depo bulunamadı.", "NOT_FOUND");

  if (input.name !== undefined) wh.name = input.name.trim();
  if (input.city !== undefined) wh.city = input.city.trim();
  if (input.address !== undefined) wh.address = input.address.trim();
  if (input.capacity !== undefined && input.capacity > 0) wh.capacity = input.capacity;

  return delay(wh, 400);
}

export async function deleteWarehouseInput(id: string): Promise<boolean> {
  const index = warehouses.findIndex((w) => w.id === id);
  if (index === -1) throw new ApiError("Depo bulunamadı.", "NOT_FOUND");

  const hasStock = stockLevels.some((s) => s.warehouseId === id && s.quantity > 0);
  if (hasStock) {
    throw new ApiError("Bu depoda henüz stok bulunduğu için silinemez. Önce stokları başka depoya transfer ediniz.", "VALIDATION");
  }

  warehouses.splice(index, 1);
  return delay(true, 400);
}
