// Teklif İstekleri (RFQ) — bundles one or more of a supplier's draft purchase
// orders into a single quote-request document. Mirrors the shape and
// conventions of lib/api/purchase-orders.ts.
import type { PagedQuery, QuoteCurrency, QuoteRequest } from "@/lib/types";
import { products, purchaseOrders, purchaseOrderTotal, quoteRequests, suppliers, warehouses } from "@/lib/mock/data";
import { id as makeId } from "@/lib/mock/seed";
import { ApiError, delay, matchesSearch, paginate } from "./client";

function toRow(q: QuoteRequest) {
  return {
    ...q,
    supplierName: suppliers.find((s) => s.id === q.supplierId)?.name ?? "-",
    orderCount: q.purchaseOrderIds.length,
    itemCount: q.items.length,
    total: q.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
  };
}

export type QuoteRequestRow = ReturnType<typeof toRow>;

export type QuoteRequestQuery = PagedQuery & {
  supplierId?: string;
};

export async function listQuoteRequests(query: QuoteRequestQuery = {}) {
  let rows = [...quoteRequests];
  if (query.supplierId) rows = rows.filter((r) => r.supplierId === query.supplierId);
  rows = rows.filter((r) =>
    matchesSearch([r.code, suppliers.find((s) => s.id === r.supplierId)?.name], query.search),
  );
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return delay(paginate(rows.map(toRow), query));
}

export async function getQuoteRequest(id: string) {
  const q = quoteRequests.find((r) => r.id === id);
  if (!q) throw new ApiError("Teklif isteği bulunamadı.", "NOT_FOUND");

  const supplier = suppliers.find((s) => s.id === q.supplierId);
  if (!supplier) throw new ApiError("Tedarikçi bulunamadı.", "NOT_FOUND");

  const orders = q.purchaseOrderIds.map((poId) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new ApiError("Kaynak sipariş bulunamadı.", "NOT_FOUND");
    return {
      id: po.id,
      code: po.code,
      expectedAt: po.expectedAt,
      warehouseName: warehouses.find((w) => w.id === po.warehouseId)?.name ?? "-",
      items: q.items
        .filter((i) => i.purchaseOrderId === po.id)
        .map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          product: products.find((p) => p.id === i.productId)!,
        })),
    };
  });

  return delay({ ...toRow(q), supplier, orders });
}

export type QuoteRequestDetail = Awaited<ReturnType<typeof getQuoteRequest>>;

export interface CreateQuoteRequestInput {
  purchaseOrderIds: string[];
  validUntil: string;
  deliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  requestedCurrency: QuoteCurrency;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string;
  createdBy: string;
}

export async function createQuoteRequest(input: CreateQuoteRequestInput): Promise<QuoteRequest> {
  if (input.purchaseOrderIds.length === 0) {
    throw new ApiError("En az bir sipariş seçin.", "VALIDATION");
  }

  const orders = input.purchaseOrderIds.map((poId) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new ApiError("Sipariş bulunamadı.", "VALIDATION");
    return po;
  });

  if (orders.some((po) => po.status !== "draft" && po.status !== "pending_approval")) {
    throw new ApiError(
      "Yalnızca taslak veya onay bekleyen siparişler için teklif formu oluşturulabilir.",
      "VALIDATION",
    );
  }

  const supplierId = orders[0].supplierId;
  if (orders.some((po) => po.supplierId !== supplierId)) {
    throw new ApiError("Seçilen siparişler aynı tedarikçiye ait olmalı.", "VALIDATION");
  }

  if (!input.validUntil) throw new ApiError("Teklif geçerlilik tarihi gereklidir.", "VALIDATION");
  if (!input.deliveryDate) throw new ApiError("İstenen teslim tarihi gereklidir.", "VALIDATION");
  if (!input.deliveryAddress.trim()) throw new ApiError("Teslim adresi gereklidir.", "VALIDATION");

  const n = quoteRequests.length + 1;
  const quote: QuoteRequest = {
    id: makeId("qr", n),
    code: `NET-TKL-${new Date().getFullYear()}${String(n).padStart(4, "0")}`,
    supplierId,
    purchaseOrderIds: input.purchaseOrderIds,
    items: orders.flatMap((po) =>
      po.items.map((i) => ({
        purchaseOrderId: po.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    ),
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    validUntil: input.validUntil,
    deliveryDate: input.deliveryDate,
    deliveryAddress: input.deliveryAddress.trim(),
    paymentTerms: input.paymentTerms.trim(),
    requestedCurrency: input.requestedCurrency,
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    notes: input.notes?.trim() || undefined,
  };
  quoteRequests.unshift(quote);
  return delay(quote, 500);
}

/** For the supplier-selection dialog: quotable (draft or pending-approval) orders grouped by supplier, with totals for display. */
export interface DraftOrderOption {
  id: string;
  code: string;
  supplierId: string;
  status: "draft" | "pending_approval";
  itemCount: number;
  total: number;
  expectedAt: string;
}

export async function listDraftOrdersBySupplier(): Promise<Record<string, DraftOrderOption[]>> {
  const quotable = purchaseOrders.filter((po) => po.status === "draft" || po.status === "pending_approval");
  const grouped: Record<string, DraftOrderOption[]> = {};
  for (const po of quotable) {
    const list = grouped[po.supplierId] ?? (grouped[po.supplierId] = []);
    list.push({
      id: po.id,
      code: po.code,
      supplierId: po.supplierId,
      status: po.status as "draft" | "pending_approval",
      itemCount: po.items.length,
      total: purchaseOrderTotal(po),
      expectedAt: po.expectedAt,
    });
  }
  return delay(grouped);
}

export type QuoteOrInvoiceRow = 
  | (QuoteRequestRow & { type: "quote" })
  | { 
      type: "invoice"; 
      id: string; 
      code: string; 
      supplierName: string; 
      orderCount: number; 
      itemCount: number; 
      createdAt: string; 
      validUntil: string; 
      createdBy: string;
      total: number;
    };

export async function listQuotesAndInvoices(query: QuoteRequestQuery = {}) {
  let qRows = [...quoteRequests];
  if (query.supplierId) qRows = qRows.filter((r) => r.supplierId === query.supplierId);
  qRows = qRows.filter((r) =>
    matchesSearch([r.code, suppliers.find((s) => s.id === r.supplierId)?.name], query.search),
  );
  
  let oRows = purchaseOrders.filter(po => po.status === "received" || po.status === "partially_received");
  if (query.supplierId) oRows = oRows.filter((po) => po.supplierId === query.supplierId);
  oRows = oRows.filter((po) =>
    matchesSearch([po.code, suppliers.find((s) => s.id === po.supplierId)?.name], query.search),
  );

  const combined: QuoteOrInvoiceRow[] = [
    ...qRows.map(q => ({ ...toRow(q), type: "quote" as const })),
    ...oRows.map(po => ({
      type: "invoice" as const,
      id: po.id,
      code: po.code,
      supplierName: suppliers.find(s => s.id === po.supplierId)?.name ?? "-",
      orderCount: 1,
      itemCount: po.items.length,
      createdAt: po.createdAt,
      validUntil: po.expectedAt, // Reuse this field visually
      createdBy: "Sistem",
      total: purchaseOrderTotal(po),
    }))
  ];

  combined.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return delay(paginate(combined, query));
}
