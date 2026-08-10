import type { PagedQuery, PurchaseOrderStatus } from "@/lib/types";
import { products, purchaseOrders, purchaseOrderTotal, suppliers } from "@/lib/mock/data";
import { ApiError, delay, matchesSearch, paginate } from "./client";

export interface PurchaseOrderQuery extends PagedQuery {
  status?: PurchaseOrderStatus;
  supplierId?: string;
}

function toRow(po: (typeof purchaseOrders)[number]) {
  return {
    ...po,
    supplierName: suppliers.find((s) => s.id === po.supplierId)?.name ?? "-",
    total: purchaseOrderTotal(po),
    itemCount: po.items.length,
  };
}

export async function listPurchaseOrders(query: PurchaseOrderQuery = {}) {
  let rows = purchaseOrders.map(toRow);
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.supplierId) rows = rows.filter((r) => r.supplierId === query.supplierId);
  rows = rows.filter((r) => matchesSearch([r.code, r.supplierName], query.search));
  return delay(paginate(rows, query));
}

export async function getPurchaseOrder(id: string) {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  const items = po.items.map((item) => ({
    ...item,
    product: products.find((p) => p.id === item.productId)!,
  }));
  return delay({ ...toRow(po), items });
}

export async function receivePurchaseOrder(id: string, receivedQuantities: Record<string, number>) {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (po.status === "cancelled") throw new ApiError("İptal edilmiş sipariş teslim alınamaz.", "CONFLICT");

  for (const item of po.items) {
    const add = receivedQuantities[item.productId] ?? 0;
    item.receivedQuantity = Math.min(item.quantity, item.receivedQuantity + add);
  }
  const allReceived = po.items.every((i) => i.receivedQuantity >= i.quantity);
  const anyReceived = po.items.some((i) => i.receivedQuantity > 0);
  po.status = allReceived ? "received" : anyReceived ? "partially_received" : po.status;

  return delay(toRow(po), 600);
}

export async function cancelPurchaseOrder(id: string) {
  const po = purchaseOrders.find((p) => p.id === id);
  if (!po) throw new ApiError("Satın alma siparişi bulunamadı.", "NOT_FOUND");
  if (po.status === "received") throw new ApiError("Teslim alınmış sipariş iptal edilemez.", "CONFLICT");
  po.status = "cancelled";
  return delay(toRow(po), 500);
}
